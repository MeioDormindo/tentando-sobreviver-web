import Phaser from 'phaser';
import { eventScheduleConfig, worldEvents, type WorldEventId } from '../config/events.config';
import { waveConfig } from '../config/waves.config';
import { AlarmEvent } from '../events/AlarmEvent';
import { BlackoutEvent } from '../events/BlackoutEvent';
import { GasLeakEvent } from '../events/GasLeakEvent';
import { HordeEvent } from '../events/HordeEvent';
import { SupplyDropEvent } from '../events/SupplyDropEvent';
import { TrainEvent } from '../events/TrainEvent';
import type { EventContext, WorldEvent } from '../events/WorldEvent';
import { emitGameEvent, GameEvents, onGameEvent, type WavePhase, type WaveStatePayload } from '../game/events';

interface Running {
  event: WorldEvent;
  startedAt: number;
}

/**
 * Eventos dinâmicos (GDD §48–49). Quando uma wave começa, pode sortear um evento
 * (um de cada vez), respeitando wave mínima, cooldown e condições de cada um. A Horda
 * começa junto com a wave; os demais, após um atraso aleatório.
 */
export class EventSystem {
  private readonly events: Record<WorldEventId, WorldEvent> = {
    blackout: new BlackoutEvent(),
    emergency_alarm: new AlarmEvent(),
    train: new TrainEvent(),
    horde: new HordeEvent(),
    supply_drop: new SupplyDropEvent(),
    gas_leak: new GasLeakEvent(),
  };
  /** Wave em que cada evento aconteceu por último. */
  private readonly lastWave = new Map<WorldEventId, number>();
  private running: Running | null = null;
  private pending: { id: WorldEventId; at: number } | null = null;
  private wave = 0;
  private phase: WavePhase = 'waiting';
  private lastStateKey = '';

  constructor(private readonly ctx: EventContext) {
    const { scene } = ctx;
    const off = onGameEvent(scene.game.events, GameEvents.WaveState, this.onWaveState, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      off();
      this.stop();
    });
  }

  /** Evento em andamento (para testes/HUD). */
  get activeId(): WorldEventId | null {
    return this.running?.event.id ?? null;
  }

  update(time: number, delta: number): void {
    if (!this.ctx.player.isAlive) return;
    if (this.pending && time >= this.pending.at) {
      const id = this.pending.id;
      this.pending = null;
      if (this.phase === 'active' && !this.running) this.trigger(id);
    }
    const run = this.running;
    if (run) {
      const expired = run.event.durationMs !== null && time - run.startedAt >= run.event.durationMs;
      if (expired || !run.event.update(time, delta)) this.stop();
    }
    this.emitState(time);
  }

  /** Inicia um evento agora (também usado em testes). Retorna false se não pôde. */
  trigger(id: WorldEventId): boolean {
    if (this.running) return false;
    const event = this.events[id];
    if (!event.canStart(this.ctx)) return false;
    event.start(this.ctx);
    this.running = { event, startedAt: this.ctx.scene.time.now };
    this.lastWave.set(id, this.wave);
    const info = worldEvents[id];
    emitGameEvent(this.ctx.scene.game.events, GameEvents.WorldEventStarted, { id, name: info.name, hint: info.hint, color: info.color });
    this.lastStateKey = '';
    return true;
  }

  syncHud(): void {
    this.lastStateKey = '#';
    this.emitState(this.ctx.scene.time.now);
  }

  private stop(): void {
    if (!this.running) return;
    this.running.event.end();
    this.running = null;
    this.emitState(this.ctx.scene.time.now);
  }

  private onWaveState(s: WaveStatePayload): void {
    const started = s.phase === 'active' && (this.phase !== 'active' || s.wave !== this.wave);
    const ended = s.phase !== 'active' && this.phase === 'active';
    this.wave = s.wave;
    this.phase = s.phase;
    if (ended) {
      this.pending = null;
      if (this.running?.event.endsWithWave) this.stop();
    }
    if (started) this.rollForWave();
  }

  /** Sorteio no início da wave. */
  private rollForWave(): void {
    const cfg = eventScheduleConfig;
    if (this.running || this.wave < cfg.firstWave || waveConfig.bossWaves.includes(this.wave)) return;
    if (Math.random() >= cfg.chancePerWave) return;
    const id = this.pick();
    if (!id) return;
    if (this.events[id].atWaveStart) {
      this.trigger(id);
    } else {
      const [min, max] = cfg.startDelayMs;
      this.pending = { id, at: this.ctx.scene.time.now + Phaser.Math.Between(min, max) };
    }
  }

  private pick(): WorldEventId | null {
    const eligible = (Object.keys(this.events) as WorldEventId[]).filter((id) => {
      const info = worldEvents[id];
      const last = this.lastWave.get(id);
      return this.wave >= info.minWave && (last === undefined || this.wave - last > info.cooldownWaves) && this.events[id].canStart(this.ctx);
    });
    let roll = Math.random() * eligible.reduce((sum, id) => sum + worldEvents[id].weight, 0);
    for (const id of eligible) {
      roll -= worldEvents[id].weight;
      if (roll < 0) return id;
    }
    return null;
  }

  /** Estado para a HUD, emitido quando o segundo exibido muda. */
  private emitState(time: number): void {
    const run = this.running;
    const events = this.ctx.scene.game.events;
    if (!run) {
      if (this.lastStateKey !== '') {
        this.lastStateKey = '';
        emitGameEvent(events, GameEvents.WorldEventState, null);
      }
      return;
    }
    const total = run.event.durationMs;
    const remaining = total === null ? null : Math.max(0, total - (time - run.startedAt));
    const key = `${run.event.id}|${remaining === null ? '-' : Math.ceil(remaining / 1000)}`;
    if (key === this.lastStateKey) return;
    this.lastStateKey = key;
    const info = worldEvents[run.event.id];
    emitGameEvent(events, GameEvents.WorldEventState, { id: run.event.id, name: info.name, color: info.color, remainingMs: remaining, totalMs: total });
  }
}
