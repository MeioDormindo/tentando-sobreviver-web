import { hordeConfig } from '../config/events.config';
import { getWaveParams } from '../systems/difficulty';
import { audio } from '../audio/AudioSystem';
import type { EventContext, WorldEvent } from './WorldEvent';

/** Horda: a wave ganha muito mais zumbis, que chegam mais rápido. Dura até a wave acabar. */
export class HordeEvent implements WorldEvent {
  readonly id = 'horde';
  readonly durationMs = null;
  readonly endsWithWave = true;
  readonly atWaveStart = true;
  private ctx: EventContext | null = null;

  canStart(): boolean {
    return true;
  }

  start(ctx: EventContext): void {
    this.ctx = ctx;
    const base = getWaveParams(ctx.waves.currentWave).totalEnemies;
    ctx.waves.addEnemies(Math.round(base * hordeConfig.extraEnemiesRatio));
    ctx.waves.setSpawnModifier(this.id, {
      intervalMultiplier: hordeConfig.spawnIntervalMultiplier,
      maxAliveBonus: hordeConfig.maxAliveBonus,
    });
    audio.play('evt_horde', { category: 'world', volume: 1, pitchJitter: 0 });
    ctx.scene.cameras.main.shake(500, 0.004);
  }

  update(): boolean {
    return true;
  }

  end(): void {
    this.ctx?.waves.setSpawnModifier(this.id, null);
    this.ctx = null;
  }
}
