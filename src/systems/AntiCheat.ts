import Phaser from 'phaser';
import { antiCheatConfig } from '../config/anticheat.config';
import { emitGameEvent, GameEvents, onGameEvent } from '../game/events';

/** Valor com cópia de verificação (quem altera o valor direto, sem passar pelo sistema, é pego). */
export interface GuardedValue {
  /** O valor bate com a cópia de verificação? */
  intact(): boolean;
}

interface Limits {
  eventBase: number;
  eventPerWave: number;
  windowBase: number;
  windowPerWave: number;
}

class GainWindow {
  private gains: Array<{ at: number; value: number }> = [];

  /** Registra o ganho e devolve a soma dentro da janela. */
  add(at: number, value: number): number {
    this.gains.push({ at, value });
    const since = at - antiCheatConfig.windowMs;
    this.gains = this.gains.filter((g) => g.at >= since);
    return this.gains.reduce((sum, g) => sum + g.value, 0);
  }
}

/**
 * Anti-trapaça da partida:
 * 1. ganho único ou soma em 10s muito acima do possível para a wave;
 * 2. dinheiro/score alterados por fora (console, editor de memória): a cópia mascarada não bate.
 * Na primeira detecção a partida fica marcada (não vale save nem ranking) e a HUD zoa o jogador.
 */
export class AntiCheat {
  private wave = 1;
  private flagged = false;
  private readonly money = new GainWindow();
  private readonly score = new GainWindow();

  constructor(private readonly scene: Phaser.Scene, private readonly guarded: readonly GuardedValue[]) {
    const ev = scene.game.events;
    const offs = [
      onGameEvent(ev, GameEvents.WaveState, (s) => { this.wave = Math.max(1, s.wave); }),
      onGameEvent(ev, GameEvents.MoneyChanged, (m) => this.check(m.delta, this.money, antiCheatConfig.money)),
      onGameEvent(ev, GameEvents.ScoreChanged, (s) => this.check(s.delta, this.score, antiCheatConfig.score)),
    ];
    const timer = scene.time.addEvent({ delay: antiCheatConfig.integrityCheckMs, loop: true, callback: this.checkIntegrity, callbackScope: this });
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offs.forEach((off) => off());
      timer.remove();
    });
  }

  get isFlagged(): boolean {
    return this.flagged;
  }

  private check(delta: number, window: GainWindow, lim: Limits): void {
    this.checkIntegrity();
    if (delta <= 0 || this.flagged) return;
    const sum = window.add(this.scene.time.now, delta);
    if (delta > lim.eventBase + lim.eventPerWave * this.wave || sum > lim.windowBase + lim.windowPerWave * this.wave) this.flag();
  }

  private checkIntegrity(): void {
    if (!this.flagged && this.guarded.some((g) => !g.intact())) this.flag();
  }

  private flag(): void {
    this.flagged = true;
    const taunts = antiCheatConfig.taunts;
    emitGameEvent(this.scene.game.events, GameEvents.CheatDetected, { taunt: taunts[Math.floor(Math.random() * taunts.length)] });
  }
}

/** Cópia de verificação de um número inteiro (XOR com uma chave sorteada por partida). */
export class IntegrityGuard {
  private readonly key = Math.floor(Math.random() * 0x7fffffff);
  private mirror: number;

  constructor(value: number) {
    this.mirror = value ^ this.key;
  }

  /** Chamado a cada mudança legítima do valor. */
  set(value: number): void {
    this.mirror = value ^ this.key;
  }

  matches(value: number): boolean {
    return (value ^ this.key) === this.mirror;
  }
}
