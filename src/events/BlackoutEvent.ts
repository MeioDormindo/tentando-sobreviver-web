import { blackoutConfig } from '../config/events.config';
import { audio } from '../audio/AudioSystem';
import type { EventContext, WorldEvent } from './WorldEvent';

const OPTS = {
  extraDarkness: blackoutConfig.extraDarkness,
  emergencyFactor: blackoutConfig.emergencyLightFactor,
  flickerMs: blackoutConfig.flickerMs,
};

/** Apagão: as luminárias piscam e apagam; sobram a lanterna e as luzes de emergência. */
export class BlackoutEvent implements WorldEvent {
  readonly id = 'blackout';
  readonly durationMs = blackoutConfig.durationMs;
  readonly endsWithWave = false;
  readonly atWaveStart = false;
  private ctx: EventContext | null = null;

  canStart(): boolean {
    return true;
  }

  start(ctx: EventContext): void {
    this.ctx = ctx;
    ctx.lighting.setBlackout(true, OPTS);
    audio.play('evt_power_down', { category: 'world', volume: 1, pitchJitter: 0 });
  }

  update(): boolean {
    return true;
  }

  end(): void {
    this.ctx?.lighting.setBlackout(false, OPTS);
    audio.play('evt_power_up', { category: 'world', volume: 0.9, pitchJitter: 0 });
    this.ctx = null;
  }
}
