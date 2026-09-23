import { alarmConfig } from '../config/events.config';
import { audio, type SpatialLoop } from '../audio/AudioSystem';
import type { EventContext, WorldEvent } from './WorldEvent';

/** Alarme de emergência: luzes vermelhas, sirene e spawn acelerado. */
export class AlarmEvent implements WorldEvent {
  readonly id = 'emergency_alarm';
  readonly durationMs = alarmConfig.durationMs;
  readonly endsWithWave = true;
  readonly atWaveStart = false;
  private ctx: EventContext | null = null;
  private siren: SpatialLoop | null = null;

  canStart(): boolean {
    return true;
  }

  start(ctx: EventContext): void {
    this.ctx = ctx;
    ctx.lighting.setAlarm(true);
    ctx.waves.setSpawnModifier(this.id, {
      intervalMultiplier: alarmConfig.spawnIntervalMultiplier,
      maxAliveBonus: alarmConfig.maxAliveBonus,
    });
    // A sirene soa pelo terminal inteiro: acompanha o jogador.
    this.siren = audio.loopAt('evt_siren', ctx.player.x, ctx.player.y, { category: 'ambience', volume: 0.8, distance: 100_000 });
  }

  update(): boolean {
    if (this.siren && this.ctx) {
      this.siren.x = this.ctx.player.x;
      this.siren.y = this.ctx.player.y;
    }
    return true;
  }

  end(): void {
    this.ctx?.lighting.setAlarm(false);
    this.ctx?.waves.setSpawnModifier(this.id, null);
    this.siren?.stop(1200);
    this.siren = null;
    this.ctx = null;
  }
}
