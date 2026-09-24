import Phaser from 'phaser';
import { goldenZombieConfig } from '../config/events.config';
import type { Zombie } from '../entities/Zombie';
import { audio } from '../audio/AudioSystem';
import { pickFloorPoint, type EventContext, type WorldEvent } from './WorldEvent';

type Light = { x: number; y: number; radius: number; intensity: number; color?: number };

const GOLD = 0xffd35a;
/** Quantos esconderijos candidatos ele considera ao fugir. */
const HIDEOUTS = 10;
const RETHINK_MS = 700;

/**
 * Zumbi Dourado: um zumbi brilhante e rápido que foge de você. Se morrer antes de
 * escapar, solta um Golden Drop e dinheiro; senão some no escuro.
 */
export class GoldenZombieEvent implements WorldEvent {
  readonly id = 'golden_zombie';
  readonly durationMs = null;
  readonly endsWithWave = false;
  readonly atWaveStart = false;

  private ctx: EventContext | null = null;
  private zombie: Zombie | null = null;
  private life = 0;
  private startedAt = 0;
  private nextThinkAt = 0;
  private hideouts: Phaser.Math.Vector2[] = [];
  private light: Light | null = null;
  private lastPos = { x: 0, y: 0 };

  canStart(ctx: EventContext): boolean {
    return pickFloorPoint(ctx, 300, 700, 20) !== null;
  }

  start(ctx: EventContext): void {
    this.ctx = ctx;
    this.startedAt = ctx.scene.time.now;
    this.hideouts = [];
    for (let i = 0; i < HIDEOUTS * 3 && this.hideouts.length < HIDEOUTS; i++) {
      const p = pickFloorPoint(ctx, 150, 1400, 10);
      if (p) this.hideouts.push(p);
    }
    const spawn = pickFloorPoint(ctx, 300, 700) ?? new Phaser.Math.Vector2(ctx.player.x + 300, ctx.player.y);
    const cfg = goldenZombieConfig;
    const zombie = ctx.spawnZombie('runner', spawn.x, spawn.y, {
      health: cfg.health + cfg.healthPerWave * ctx.waves.currentWave,
      speed: cfg.speed,
      reward: 0,
      damage: 5,
    });
    if (!zombie) return;
    ctx.waves.addSummoned(1);
    this.zombie = zombie;
    this.life = zombie.lifeId;
    this.light = ctx.lighting.addDynamicLight({ x: spawn.x, y: spawn.y, radius: 90, intensity: 0.9, color: GOLD });
    audio.playAt('box_reveal', spawn.x, spawn.y, { category: 'ui', volume: 1, distance: 1600 });
  }

  update(time: number): boolean {
    const ctx = this.ctx;
    const z = this.zombie;
    if (!ctx || !z) return false;
    // Morreu (tiro, explosão...): prêmio no lugar.
    if (!z.isAlive || z.lifeId !== this.life) {
      const { x, y } = this.lastPos;
      ctx.spawnPowerUp('golden', x, y);
      ctx.economy.earn(goldenZombieConfig.reward);
      ctx.effects.pickupBurst(x, y, GOLD);
      ctx.effects.floatingText(x, y - 20, `+$${goldenZombieConfig.reward}`, '#ffd35a', true);
      ctx.toast('ZUMBI DOURADO ABATIDO!');
      return false;
    }
    this.lastPos = { x: z.x, y: z.y };
    if (this.light) {
      this.light.x = z.x;
      this.light.y = z.y;
    }
    if (Math.random() < 0.3) ctx.effects.flareSmoke(z.x, z.y, GOLD);
    // Foge para o esconderijo mais longe de você quando você chega perto.
    if (time >= this.nextThinkAt) {
      this.nextThinkAt = time + RETHINK_MS;
      const p = ctx.player;
      const near = Phaser.Math.Distance.Between(z.x, z.y, p.x, p.y) < goldenZombieConfig.fleeRange;
      if (near || !z.goal) {
        let best = this.hideouts[0] ?? null;
        let bestD = -1;
        for (const h of this.hideouts) {
          const d = Phaser.Math.Distance.Between(h.x, h.y, p.x, p.y);
          if (d > bestD) {
            best = h;
            bestD = d;
          }
        }
        z.goal = best;
      }
    }
    // Escapou.
    if (time - this.startedAt >= goldenZombieConfig.escapeMs) {
      ctx.toast('O ZUMBI DOURADO ESCAPOU');
      z.takeDamage(z.hp + 1, false, 'hazard', false);
      return false;
    }
    return true;
  }

  end(): void {
    const ctx = this.ctx;
    if (ctx && this.light) ctx.lighting.removeDynamicLight(this.light);
    this.light = null;
    this.zombie = null;
    this.ctx = null;
  }
}
