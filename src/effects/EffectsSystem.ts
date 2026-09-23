import Phaser from 'phaser';
import { ASSET_KEYS, FX_KEYS, ZOMBIE_VARIANTS, type ZombieVariant } from '../config/assets.config';
import { ART_SCALE, DEPTH, effectsConfig, lightingConfig } from '../config/visual.config';
import type { LightingSystem } from './LightingSystem';

const DEPTH_PARTICLES = 50_000;
const MUZZLE_FLASH_MS = 45;

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
  private readonly muzzle: Phaser.GameObjects.Image;
  private readonly corpses: Corpse[] = [];
  /** Direção atual das explosões de partículas (usada pelos callbacks onEmit). */
  private emitAngle = 0;

  constructor(scene: Phaser.Scene, mapWidth: number, mapHeight: number, private readonly lighting: LightingSystem | null) {
    this.scene = scene;
    this.decals = scene.add.renderTexture(0, 0, mapWidth, mapHeight).setOrigin(0).setDepth(DEPTH.decals);

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
        this.decals.stamp(FX_KEYS.blood, undefined, p.x, p.y, { scale: Phaser.Math.FloatBetween(0.35, 0.8), alpha: 0.75 });
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
      this.decals.stamp(FX_KEYS.shell, undefined, p.x, p.y, { rotation: Math.random() * Math.PI, alpha: 0.6 });
    });

    this.muzzle = scene.add
      .image(0, 0, FX_KEYS.muzzle)
      .setOrigin(0, 0.5)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.muzzle)
      .setVisible(false);
  }

  /** Carimba um decal no chão (arte em 2x → escala ART_SCALE). */
  readonly stampDecal = (key: string, frame: number | undefined, x: number, y: number, rotation: number, alpha: number): void => {
    this.decals.stamp(key, frame, x, y, { rotation, alpha, scale: ART_SCALE });
  };

  muzzleFlash(x: number, y: number, angle: number): void {
    this.muzzle
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
  }

  bloodHit(x: number, y: number, bulletAngle: number): void {
    this.emitAngle = Phaser.Math.RadToDeg(bulletAngle);
    this.blood.explode(effectsConfig.bloodParticlesPerHit, x, y);
    if (Math.random() < effectsConfig.decalSplatChance) {
      const dist = Phaser.Math.Between(8, 22);
      this.decals.stamp(
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
    this.smoke.explode(1, x, y);
    this.lighting?.addFlash(x, y, 40, 0.5, 60);
  }

  zombieDeath(x: number, y: number, fallAngle: number, variant: ZombieVariant): void {
    this.emitAngle = Phaser.Math.RadToDeg(fallAngle);
    this.blood.explode(effectsConfig.bloodParticlesOnDeath, x, y);

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
      .image(cx, cy, ASSET_KEYS.corpses, ZOMBIE_VARIANTS.indexOf(variant))
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
    this.decals.draw(corpse.pool.setAlpha(0.7));
    corpse.pool.destroy();
  }
}
