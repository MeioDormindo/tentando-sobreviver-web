import Phaser from 'phaser';
import { FX_KEYS } from '../config/assets.config';
import type { HazardPoolConfig } from '../config/zombies.config';
import { DEPTH } from '../config/visual.config';
import { audio } from '../audio/AudioSystem';
import type { EffectsSystem } from '../effects/EffectsSystem';
import type { Player } from '../entities/Player';

export type HazardKind = 'acid' | 'gas';

const COLORS: Record<HazardKind, number> = { acid: 0x9ccf2a, gas: 0x9acd32 };
/** Intervalo entre danos (ms): maior que a invulnerabilidade do jogador após um golpe. */
const TICK_MS = 500;
const PUFF_EVERY_MS = 140;
/** Distância (px) em que o cuspe acerta o jogador em cheio no caminho. */
const SPIT_HIT_RADIUS = 18;

interface Pool {
  kind: HazardKind;
  x: number;
  y: number;
  cfg: HazardPoolConfig;
  endsAt: number;
  nextTickAt: number;
  nextPuffAt: number;
  glow: Phaser.GameObjects.Image;
}

interface Spit {
  sprite: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  remaining: number;
  cfg: HazardPoolConfig;
}

export interface HazardDeps {
  player: Player;
  effects: EffectsSystem;
}

/**
 * Perigos no chão e projéteis dos inimigos: poças de ácido (Cuspidor, boss) e nuvens
 * de gás (Rastejante). Ferem só o jogador, por tick, enquanto ele estiver dentro.
 */
export class HazardSystem {
  private pools: Pool[] = [];
  private spits: Spit[] = [];

  constructor(private readonly scene: Phaser.Scene, private readonly deps: HazardDeps) {
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.pools = [];
      this.spits = [];
    });
  }

  /** Poça/nuvem no ponto. */
  addPool(kind: HazardKind, x: number, y: number, cfg: HazardPoolConfig): void {
    const now = this.scene.time.now;
    const glow = this.scene.add
      .image(x, y, FX_KEYS.lightRadial)
      .setTint(COLORS[kind])
      .setBlendMode(kind === 'acid' ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.ADD)
      .setDepth(kind === 'acid' ? DEPTH.decals + 2 : DEPTH.glow)
      .setAlpha(0)
      .setScale(0.05);
    this.scene.tweens.add({ targets: glow, alpha: kind === 'acid' ? 0.75 : 0.3, scale: (cfg.radius * 2.2) / 256, duration: 260, ease: 'Cubic.easeOut' });
    this.pools.push({ kind, x, y, cfg, endsAt: now + cfg.durationMs, nextTickAt: now + 200, nextPuffAt: now, glow });
  }

  /** Cuspe de ácido voando até (tx, ty); vira poça ao chegar (ou ao acertar o jogador no caminho). */
  spit(x: number, y: number, tx: number, ty: number, speed: number, cfg: HazardPoolConfig): void {
    const dist = Math.max(1, Phaser.Math.Distance.Between(x, y, tx, ty));
    const sprite = this.scene.add
      .image(x, y, FX_KEYS.lightRadial)
      .setTint(COLORS.acid)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0.09)
      .setDepth(DEPTH.glow);
    this.spits.push({ sprite, vx: ((tx - x) / dist) * speed, vy: ((ty - y) / dist) * speed, remaining: dist, cfg });
    audio.playAt('spitter_spit', x, y, { category: 'zombie', volume: 0.9 });
  }

  /** O jogador está dentro de alguma poça/nuvem? (para testes e HUD) */
  get playerInside(): boolean {
    const p = this.deps.player;
    return this.pools.some((pool) => Phaser.Math.Distance.Between(p.x, p.y, pool.x, pool.y) <= pool.cfg.radius);
  }

  update(time: number, delta: number): void {
    this.updateSpits(delta);
    const p = this.deps.player;
    for (const pool of [...this.pools]) {
      if (time >= pool.endsAt) {
        this.remove(pool);
        continue;
      }
      // Some aos poucos no último segundo.
      const left = pool.endsAt - time;
      if (left < 1000) pool.glow.setAlpha((pool.kind === 'acid' ? 0.75 : 0.3) * (left / 1000));
      if (time >= pool.nextPuffAt) {
        pool.nextPuffAt = time + PUFF_EVERY_MS * (pool.kind === 'gas' ? 1 : 3);
        this.deps.effects.gasPuff(pool.x, pool.y, pool.cfg.radius * 0.7, COLORS[pool.kind]);
      }
      if (time >= pool.nextTickAt) {
        pool.nextTickAt = time + TICK_MS;
        if (p.isAlive && Phaser.Math.Distance.Between(p.x, p.y, pool.x, pool.y) <= pool.cfg.radius) {
          p.takeDamage(pool.cfg.dps * (TICK_MS / 1000), time);
        }
      }
    }
  }

  private updateSpits(delta: number): void {
    const p = this.deps.player;
    for (const s of [...this.spits]) {
      const step = (delta / 1000) * Math.hypot(s.vx, s.vy);
      s.sprite.x += (s.vx * delta) / 1000;
      s.sprite.y += (s.vy * delta) / 1000;
      s.remaining -= step;
      s.sprite.setScale(0.09 + 0.02 * Math.sin(s.remaining / 12));
      const hitPlayer = p.isAlive && Phaser.Math.Distance.Between(p.x, p.y, s.sprite.x, s.sprite.y) <= SPIT_HIT_RADIUS;
      if (s.remaining > 0 && !hitPlayer) continue;
      this.spits.splice(this.spits.indexOf(s), 1);
      const { x, y } = s.sprite;
      s.sprite.destroy();
      audio.playAt('spitter_splash', x, y, { category: 'zombie', volume: 0.8 });
      this.addPool('acid', x, y, s.cfg);
    }
  }

  private remove(pool: Pool): void {
    this.pools.splice(this.pools.indexOf(pool), 1);
    pool.glow.destroy();
  }
}
