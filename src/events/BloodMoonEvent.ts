import { bloodMoonConfig } from '../config/events.config';
import { audio } from '../audio/AudioSystem';
import type { EventContext, WorldEvent } from './WorldEvent';

/** Lua de Sangue: escuridão avermelhada, zumbis mais rápidos e dinheiro/pontos em dobro. */
export class BloodMoonEvent implements WorldEvent {
  readonly id = 'blood_moon';
  readonly durationMs = bloodMoonConfig.durationMs;
  readonly endsWithWave = false;
  readonly atWaveStart = false;
  private ctx: EventContext | null = null;

  canStart(): boolean {
    return true;
  }

  start(ctx: EventContext): void {
    this.ctx = ctx;
    ctx.setZombieSpeed(bloodMoonConfig.zombieSpeed);
    ctx.setRewardMultiplier(bloodMoonConfig.rewardMultiplier);
    ctx.lighting.setDarknessTint(bloodMoonConfig.darknessTint);
    audio.play('evt_horde', { category: 'world', volume: 0.8, rate: 0.8, pitchJitter: 0 });
  }

  update(): boolean {
    return true;
  }

  end(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.setZombieSpeed(1);
    ctx.setRewardMultiplier(1);
    ctx.lighting.setDarknessTint(null);
    this.ctx = null;
  }
}
