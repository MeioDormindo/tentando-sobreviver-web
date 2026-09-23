import Phaser from 'phaser';
import { ASSET_KEYS, FX_KEYS } from '../config/assets.config';
import { gasLeakConfig } from '../config/events.config';
import { ART_SCALE, DEPTH } from '../config/visual.config';
import { audio, type SpatialLoop } from '../audio/AudioSystem';
import { liveZombies, pickFloorPoint, type EventContext, type WorldEvent } from './WorldEvent';

type Light = { x: number; y: number; radius: number; intensity: number; color?: number };

const GAS_COLOR = 0x9acd32;
const PUFF_EVERY_MS = 90;

/**
 * Vazamento de gás: um cano se rompe perto do jogador e uma nuvem verde toma a
 * área por um tempo. Quem fica dentro dela (jogador e zumbis) perde vida.
 */
export class GasLeakEvent implements WorldEvent {
  readonly id = 'gas_leak';
  readonly durationMs = gasLeakConfig.durationMs;
  readonly endsWithWave = false;
  readonly atWaveStart = false;

  private ctx: EventContext | null = null;
  private x = 0;
  private y = 0;
  private startedAt = 0;
  private nextTickAt = 0;
  private nextPuffAt = 0;
  private pipe: Phaser.GameObjects.Image | null = null;
  private zone: Phaser.GameObjects.Image | null = null;
  private glow: Light | null = null;
  private hiss: SpatialLoop | null = null;

  canStart(ctx: EventContext): boolean {
    const [min, max] = gasLeakConfig.distance;
    return pickFloorPoint(ctx, min, max, 20) !== null;
  }

  start(ctx: EventContext): void {
    const [min, max] = gasLeakConfig.distance;
    const point = pickFloorPoint(ctx, min, max) ?? new Phaser.Math.Vector2(ctx.player.x + min, ctx.player.y);
    this.ctx = ctx;
    this.x = point.x;
    this.y = point.y;
    this.startedAt = ctx.scene.time.now;
    this.nextTickAt = this.startedAt + gasLeakConfig.warningMs;
    this.pipe = ctx.scene.add.image(this.x, this.y, ASSET_KEYS.gasPipe).setScale(ART_SCALE).setDepth(this.y);
    // Marca no chão do alcance da nuvem (cresce durante o aviso).
    this.zone = ctx.scene.add
      .image(this.x, this.y, FX_KEYS.lightRadial)
      .setTint(GAS_COLOR)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.glow)
      .setAlpha(0)
      .setScale(0.1);
    ctx.scene.tweens.add({ targets: this.zone, scale: (gasLeakConfig.radius * 2.2) / 256, alpha: 0.35, duration: gasLeakConfig.warningMs });
    this.glow = ctx.lighting.addDynamicLight({ x: this.x, y: this.y, radius: gasLeakConfig.radius, intensity: 0.35, color: GAS_COLOR });
    this.hiss = audio.loopAt('evt_gas', this.x, this.y, { category: 'world', volume: 0.9, distance: 800 });
    ctx.effects.dustBurst(this.x, this.y, 10);
  }

  update(time: number): boolean {
    const ctx = this.ctx;
    if (!ctx) return false;
    const armed = time >= this.startedAt + gasLeakConfig.warningMs;
    if (time >= this.nextPuffAt) {
      this.nextPuffAt = time + PUFF_EVERY_MS;
      const spread = armed ? gasLeakConfig.radius * 0.75 : gasLeakConfig.radius * 0.3;
      ctx.effects.gasPuff(this.x, this.y, spread, GAS_COLOR);
    }
    if (this.glow) this.glow.intensity = 0.3 + 0.1 * Math.sin(time / 300);
    if (armed && time >= this.nextTickAt) {
      this.nextTickAt = time + gasLeakConfig.tickMs;
      this.poison(ctx);
    }
    return true;
  }

  end(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const fading = [this.zone, this.pipe].filter((o): o is Phaser.GameObjects.Image => o !== null);
    ctx.scene.tweens.killTweensOf(fading);
    ctx.scene.tweens.add({ targets: this.zone, alpha: 0, duration: 1500, onComplete: () => fading.forEach((o) => o.destroy()) });
    if (this.glow) ctx.lighting.removeDynamicLight(this.glow);
    this.hiss?.stop(1500);
    this.zone = null;
    this.pipe = null;
    this.glow = null;
    this.hiss = null;
    this.ctx = null;
  }

  private poison(ctx: EventContext): void {
    const r = gasLeakConfig.radius;
    const p = ctx.player;
    if (p.isAlive && Phaser.Math.Distance.Between(p.x, p.y, this.x, this.y) <= r) {
      p.takeDamage(gasLeakConfig.playerDamagePerTick, ctx.scene.time.now);
    }
    for (const z of liveZombies(ctx.zombies)) {
      if (Phaser.Math.Distance.Between(z.x, z.y, this.x, this.y) > r) continue;
      const { x, y } = z;
      if (z.takeDamage(gasLeakConfig.zombieDamagePerTick, false, 'hazard', false)) {
        ctx.effects.zombieDeath(x, y, Math.random() * Math.PI * 2, z.skin);
      }
    }
  }
}
