import { fogConfig } from '../config/events.config';
import type { EventContext, WorldEvent } from './WorldEvent';

const FOG_COLOR = 0xb8c0c6;

/** Neblina: tudo mais escuro, a lanterna alcança menos e a névoa passa em volta. */
export class FogEvent implements WorldEvent {
  readonly id = 'fog';
  readonly durationMs = fogConfig.durationMs;
  readonly endsWithWave = false;
  readonly atWaveStart = false;
  private ctx: EventContext | null = null;
  private nextPuffAt = 0;

  canStart(): boolean {
    return true;
  }

  start(ctx: EventContext): void {
    this.ctx = ctx;
    ctx.lighting.setFog(fogConfig.extraDarkness, fogConfig.flashlightFactor);
  }

  update(time: number): boolean {
    const ctx = this.ctx;
    if (!ctx) return false;
    if (time >= this.nextPuffAt) {
      this.nextPuffAt = time + fogConfig.puffEveryMs;
      ctx.effects.gasPuff(ctx.player.x, ctx.player.y, 320, FOG_COLOR);
    }
    return true;
  }

  end(): void {
    this.ctx?.lighting.setFog(0, 1);
    this.ctx = null;
  }
}
