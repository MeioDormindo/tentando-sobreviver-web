import Phaser from 'phaser';
import { ASSET_KEYS, CORPSE_SKINS, FX_KEYS, ZOMBIE_SKINS, type ZombieSkin } from '../config/assets.config';
import { ART_SCALE, DEPTH, effectsConfig, lightingConfig } from '../config/visual.config';
import type { LightingSystem } from './LightingSystem';
import { audio } from '../audio/AudioSystem';

const DEPTH_PARTICLES = 50_000;
const MUZZLE_FLASH_MS = 45;
/** Resolução da camada de decals (0.5 = metade; 4x menos memória de vídeo em mapas grandes). */
const DECAL_RES = 0.5;

/** Aparência da explosão: gosma do Exploder, granada (fogo) ou descarga de plasma. */
export type ExplosionStyle = 'exploder' | 'grenade' | 'plasma';

const LIGHTNING_MS = 140;
/** Desvio lateral máximo de cada trecho do raio (px). */
const LIGHTNING_JITTER = 9;

interface Corpse {
  body: Phaser.GameObjects.Image;
  pool: Phaser.GameObjects.Image;
  timer: Phaser.Time.TimerEvent;
}

/**
 * Efeitos visuais: sangue, cadáveres, cápsulas, faíscas, clarão do disparo e
 * a camada de decals do chão (tudo que "fica" no chão é carimbado numa RenderTexture).
 */
export class EffectsSystem {
  private readonly scene: Phaser.Scene;
  private readonly decals: Phaser.GameObjects.RenderTexture;
  private readonly blood: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly smoke: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly shells: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly flames: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly muzzle: Phaser.GameObjects.Image;
  private readonly corpses: Corpse[] = [];
  /** Direção atual das explosões de partículas (usada pelos callbacks onEmit). */
  private emitAngle = 0;

  constructor(scene: Phaser.Scene, mapWidth: number, mapHeight: number, private readonly lighting: LightingSystem | null) {
    this.scene = scene;
    this.decals = scene.add
      .renderTexture(0, 0, Math.ceil(mapWidth * DECAL_RES), Math.ceil(mapHeight * DECAL_RES))
      .setOrigin(0)
      .setScale(1 / DECAL_RES)
      .setDepth(DEPTH.decals);

    const spread = (deg: number) => ({ onEmit: () => this.emitAngle + Phaser.Math.FloatBetween(-deg, deg) });

    this.blood = scene.add.particles(0, 0, FX_KEYS.blood, {
      emitting: false,
      angle: spread(28),
      speed: { min: 50, max: 230 },
      lifespan: { min: 180, max: 480 },
      scale: { start: 0.9, end: 0.35 },
      alpha: { start: 1, end: 0.7 },
    });
    this.blood.setDepth(DEPTH_PARTICLES);
    // Gotas que caem viram manchas permanentes no chão.
    this.blood.onParticleDeath((p) => {
      if (Math.random() < 0.55) {
        this.stamp(FX_KEYS.blood, undefined, p.x, p.y, { scale: Phaser.Math.FloatBetween(0.35, 0.8), alpha: 0.75 });
      }
    });

    this.sparks = scene.add.particles(0, 0, FX_KEYS.spark, {
      emitting: false,
      angle: spread(55),
      speed: { min: 80, max: 260 },
      lifespan: { min: 80, max: 220 },
      scale: { start: 1, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
    });
    this.sparks.setDepth(DEPTH.glow);

    this.smoke = scene.add.particles(0, 0, FX_KEYS.smoke, {
      emitting: false,
      angle: spread(40),
      speed: { min: 8, max: 30 },
      lifespan: { min: 300, max: 650 },
      scale: { start: 0.35, end: 1.1 },
      alpha: { start: 0.35, end: 0 },
    });
    this.smoke.setDepth(DEPTH_PARTICLES + 1);

    this.shells = scene.add.particles(0, 0, FX_KEYS.shell, {
      emitting: false,
      angle: spread(18),
      speed: { min: 70, max: 120 },
      lifespan: { min: 280, max: 380 },
      rotate: { start: 0, end: 720 },
    });
    this.shells.setDepth(DEPTH_PARTICLES);
    this.shells.onParticleDeath((p) => {
      this.stamp(FX_KEYS.shell, undefined, p.x, p.y, { rotation: Math.random() * Math.PI, alpha: 0.6 });
    });

    // Fogo sobre alvos em chamas: sobe e se apaga.
    this.flames = scene.add.particles(0, 0, FX_KEYS.flame, {
      emitting: false,
      angle: { min: 240, max: 300 },
      speed: { min: 15, max: 45 },
      lifespan: { min: 220, max: 420 },
      scale: { start: 0.55, end: 0.1 },
      alpha: { start: 0.9, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
    });
    this.flames.setDepth(DEPTH.glow);

    this.muzzle = scene.add
      .image(0, 0, FX_KEYS.muzzle)
      .setOrigin(0, 0.5)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.muzzle)
      .setVisible(false);
  }

  /** Carimba um decal no chão (arte em 2x → escala ART_SCALE). */
  readonly stampDecal = (key: string, frame: number | undefined, x: number, y: number, rotation: number, alpha: number): void => {
    this.stamp(key, frame, x, y, { rotation, alpha, scale: ART_SCALE });
  };

  /** Carimba na camada de decals convertendo coordenadas/escala do mundo para a resolução dela. */
  private stamp(key: string, frame: number | undefined, x: number, y: number, config: Phaser.Types.Textures.StampConfig): void {
    this.decals.stamp(key, frame, x * DECAL_RES, y * DECAL_RES, { ...config, scale: (config.scale ?? 1) * DECAL_RES });
  }

  muzzleFlash(x: number, y: number, angle: number, tint = 0xffffff): void {
    this.muzzle
      .setTint(tint)
      .setPosition(x, y)
      .setRotation(angle)
      .setScale(Phaser.Math.FloatBetween(0.8, 1.15), Phaser.Math.FloatBetween(0.8, 1.1) * (Math.random() < 0.5 ? -1 : 1))
      .setVisible(true);
    this.scene.time.delayedCall(MUZZLE_FLASH_MS, () => this.muzzle.setVisible(false));

    const flash = lightingConfig.muzzleFlash;
    this.lighting?.addFlash(x, y, flash.radius, flash.intensity, flash.durationMs);
    this.emitAngle = Phaser.Math.RadToDeg(angle);
    this.smoke.explode(2, x, y);
  }

  /** Cápsula ejetada para a direita da arma; fica no chão ao cair. */
  ejectShell(x: number, y: number, aim: number): void {
    this.emitAngle = Phaser.Math.RadToDeg(aim) + 90;
    this.shells.explode(1, x, y);
    if (Math.random() < 0.5) this.scene.time.delayedCall(320, () => audio.playAt('shell', x, y, { category: 'world', volume: 0.4 }));
  }

  bloodHit(x: number, y: number, bulletAngle: number): void {
    this.emitAngle = Phaser.Math.RadToDeg(bulletAngle);
    this.blood.explode(effectsConfig.bloodParticlesPerHit, x, y);
    audio.playAt('impact_flesh', x, y, { category: 'world', volume: 0.7 });
    if (Math.random() < effectsConfig.decalSplatChance) {
      const dist = Phaser.Math.Between(8, 22);
      this.stamp(
        ASSET_KEYS.bloodSplats,
        Phaser.Math.Between(0, 2),
        x + Math.cos(bulletAngle) * dist,
        y + Math.sin(bulletAngle) * dist,
        { rotation: Math.random() * Math.PI * 2, scale: ART_SCALE * Phaser.Math.FloatBetween(0.5, 0.9), alpha: 0.8 },
      );
    }
  }

  /** Impacto em parede/cobertura: faíscas e poeira voltando na direção do tiro. */
  surfaceImpact(x: number, y: number, bulletAngle: number): void {
    this.emitAngle = Phaser.Math.RadToDeg(bulletAngle) + 180;
    this.sparks.explode(6, x, y);
    audio.playAt('impact_hard', x, y, { category: 'world', volume: 0.6 });
    this.smoke.explode(1, x, y);
    this.lighting?.addFlash(x, y, 40, 0.5, 60);
  }

  /** Explosão: clarão, fogo (ou descarga elétrica), fumaça e mancha queimada no chão. */
  explosion(x: number, y: number, radius: number, style: ExplosionStyle = 'exploder'): void {
    const plasma = style === 'plasma';
    const volume = Math.min(1, 0.5 + radius / 160);
    audio.playAt(plasma ? 'plasma_burst' : 'explosion', x, y, { category: 'world', volume, distance: 1500 });
    for (const angle of [0, 90, 180, 270]) {
      this.emitAngle = angle;
      this.sparks.explode(10, x, y);
      if (style === 'exploder') this.blood.explode(8, x, y);
      if (!plasma) this.smoke.explode(3, x, y);
    }
    if (plasma) {
      // Descarga: raios curtos saindo do centro.
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + Math.random() * 0.5;
        const d = radius * Phaser.Math.FloatBetween(0.6, 1);
        this.lightning([{ x, y }, { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d }], 0x7fe7ff);
      }
    }
    this.stamp(ASSET_KEYS.burst, undefined, x, y, {
      rotation: Math.random() * Math.PI * 2,
      scale: (radius / 96) * (plasma ? 0.8 : 1.1),
      alpha: plasma ? 0.5 : 0.9,
    });
    const fireball = this.scene.add
      .image(x, y, FX_KEYS.lightRadial)
      .setTint(plasma ? 0x6ff0ff : 0xffa040)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.glow)
      .setScale(0.2);
    this.scene.tweens.add({
      targets: fireball,
      scale: (radius * 2.2) / 256,
      alpha: { from: 1, to: 0 },
      duration: 420,
      ease: 'Cubic.easeOut',
      onComplete: () => fireball.destroy(),
    });
    this.lighting?.addFlash(x, y, radius * 2.4, 1, 350);
    this.scene.cameras.main.shake(260, 0.006);
  }

  /**
   * Raio elétrico ligando os pontos (Arc Gun): linha em zigue-zague com brilho,
   * faíscas e clarão em cada ponto atingido.
   */
  lightning(points: ReadonlyArray<{ x: number; y: number }>, color: number): void {
    if (points.length < 2) return;
    const g = this.scene.add.graphics().setDepth(DEPTH.muzzle).setBlendMode(Phaser.BlendModes.ADD);
    const path: Phaser.Math.Vector2[] = [new Phaser.Math.Vector2(points[0].x, points[0].y)];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      const len = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
      const segments = Math.max(2, Math.round(len / 18));
      const nx = -(b.y - a.y) / (len || 1);
      const ny = (b.x - a.x) / (len || 1);
      for (let s = 1; s <= segments; s++) {
        const t = s / segments;
        const off = s === segments ? 0 : Phaser.Math.FloatBetween(-LIGHTNING_JITTER, LIGHTNING_JITTER);
        path.push(new Phaser.Math.Vector2(a.x + (b.x - a.x) * t + nx * off, a.y + (b.y - a.y) * t + ny * off));
      }
      this.emitAngle = Phaser.Math.RadToDeg(Math.atan2(b.y - a.y, b.x - a.x));
      this.sparks.explode(4, b.x, b.y);
      this.lighting?.addFlash(b.x, b.y, 70, 0.8, LIGHTNING_MS);
    }
    g.lineStyle(6, color, 0.35).strokePoints(path);
    g.lineStyle(2, 0xffffff, 1).strokePoints(path);
    this.scene.tweens.add({ targets: g, alpha: 0, duration: LIGHTNING_MS, onComplete: () => g.destroy() });
  }

  /** Labaredas sobre um alvo em chamas. */
  burnPuff(x: number, y: number): void {
    this.flames.explode(2, x + Phaser.Math.Between(-6, 6), y + Phaser.Math.Between(-6, 6));
  }

  /** Brilho do lança-chamas iluminando o entorno. */
  glow(x: number, y: number, radius: number, durationMs: number): void {
    this.lighting?.addFlash(x, y, radius, 0.7, durationMs);
  }

  zombieDeath(x: number, y: number, fallAngle: number, skin: ZombieSkin): void {
    this.emitAngle = Phaser.Math.RadToDeg(fallAngle);
    this.blood.explode(effectsConfig.bloodParticlesOnDeath, x, y);
    // Quem explode não deixa corpo.
    if (!ZOMBIE_SKINS[skin].corpse) return;

    const cx = x + Math.cos(fallAngle) * 10;
    const cy = y + Math.sin(fallAngle) * 10;
    const pool = this.scene.add
      .image(cx, cy, ASSET_KEYS.bloodPool)
      .setDepth(DEPTH.corpses - 1)
      .setRotation(Math.random() * Math.PI * 2)
      .setScale(ART_SCALE * 0.15);
    this.scene.tweens.add({
      targets: pool,
      scale: ART_SCALE * Phaser.Math.FloatBetween(0.6, 0.9),
      duration: effectsConfig.bloodPoolGrowMs,
      ease: 'Cubic.easeOut',
    });

    const body = this.scene.add
      .image(cx, cy, ASSET_KEYS.corpses, CORPSE_SKINS.indexOf(skin))
      .setDepth(DEPTH.corpses)
      .setRotation(fallAngle + Phaser.Math.FloatBetween(-0.3, 0.3))
      .setScale(ART_SCALE * 0.95);
    this.scene.tweens.add({ targets: body, scale: ART_SCALE, duration: 180, ease: 'Quad.easeOut' });

    const corpse: Corpse = {
      body,
      pool,
      timer: this.scene.time.delayedCall(effectsConfig.corpseLifetimeMs, () => this.removeCorpse(corpse)),
    };
    this.corpses.push(corpse);
    if (this.corpses.length > effectsConfig.maxCorpses) {
      const oldest = this.corpses[0];
      oldest.timer.remove();
      this.removeCorpse(oldest);
    }
  }

  /** Texto que sobe e some (ex.: dinheiro ganho). Fica acima da escuridão. */
  floatingText(x: number, y: number, text: string, color: string, emphasis = false): void {
    const label = this.scene.add
      .text(x, y, text, {
        fontFamily: 'Impact, "Arial Black", sans-serif',
        fontSize: emphasis ? '15px' : '12px',
        color,
        stroke: '#000000',
        strokeThickness: 3,
        resolution: 3,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.muzzle + 1);
    this.scene.tweens.add({
      targets: label,
      y: y - 26,
      alpha: { from: 1, to: 0 },
      duration: 1000,
      ease: 'Quad.easeOut',
      onComplete: () => label.destroy(),
    });
  }

  /** O cadáver some aos poucos; a poça fica gravada no chão. */
  private removeCorpse(corpse: Corpse): void {
    const index = this.corpses.indexOf(corpse);
    if (index === -1) return;
    this.corpses.splice(index, 1);
    this.scene.tweens.add({
      targets: corpse.body,
      alpha: 0,
      duration: 1500,
      onComplete: () => corpse.body.destroy(),
    });
    this.scene.tweens.killTweensOf(corpse.pool);
    const pool = corpse.pool;
    this.stamp(ASSET_KEYS.bloodPool, undefined, pool.x, pool.y, { rotation: pool.rotation, scale: pool.scaleX, alpha: 0.7 });
    pool.destroy();
  }
}
