import Phaser from 'phaser';
import { economyConfig } from '../config/economy.config';
import type { EffectsSystem } from '../effects/EffectsSystem';
import { audio } from '../audio/AudioSystem';
import {
  emitGameEvent,
  GameEvents,
  onGameEvent,
  type WavePhase,
  type WaveStatePayload,
  type ZombieKilledPayload,
} from '../game/events';

/**
 * Dinheiro do jogador (GDD §33–34): ganha por abate, headshot e wave completa;
 * gasta em compras. Única fonte de verdade do saldo (no multiplayer, ficará no servidor).
 */
export class EconomySystem {
  private readonly scene: Phaser.Scene;
  private money = economyConfig.startingMoney;
  private earned = 0;
  private lastPhase: WavePhase = 'waiting';
  /** Multiplicador temporário de ganhos (power-up Double Cash). */
  cashMultiplier = 1;

  constructor(scene: Phaser.Scene, private readonly effects: EffectsSystem) {
    this.scene = scene;
    const offs = [
      onGameEvent(scene.game.events, GameEvents.ZombieKilled, this.onZombieKilled, this),
      onGameEvent(scene.game.events, GameEvents.WaveState, this.onWaveState, this),
    ];
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => offs.forEach((off) => off()));
  }

  get balance(): number {
    return this.money;
  }

  get totalEarned(): number {
    return this.earned;
  }

  canAfford(cost: number): boolean {
    return this.money >= cost;
  }

  /** Soma dinheiro (aplica o Double Cash); retorna o valor efetivamente ganho. */
  earn(amount: number): number {
    if (amount <= 0) return 0;
    const value = Math.round(amount * this.cashMultiplier);
    this.money += value;
    this.earned += value;
    this.emit(value);
    return value;
  }

  /** Debita se houver saldo; senão avisa a HUD e retorna false. */
  spend(cost: number): boolean {
    if (!this.canAfford(cost)) {
      emitGameEvent(this.scene.game.events, GameEvents.PurchaseDenied, undefined);
      return false;
    }
    this.money -= cost;
    this.emit(-cost);
    audio.play('purchase', { category: 'ui', volume: 0.7 });
    return true;
  }

  syncHud(): void {
    this.emit(0);
  }

  private onZombieKilled(kill: ZombieKilledPayload): void {
    if (kill.source !== 'weapon') return;
    const amount = this.earn(kill.reward + (kill.headshot ? economyConfig.headshotBonus : 0));
    this.effects.floatingText(kill.x, kill.y - 14, `+$${amount}`, kill.headshot ? '#ffd166' : '#d9c89a', kill.headshot);
  }

  private onWaveState(state: WaveStatePayload): void {
    if (state.phase === 'intermission' && this.lastPhase === 'active') {
      this.earn(economyConfig.waveBonusBase + economyConfig.waveBonusPerWave * state.wave);
    }
    this.lastPhase = state.phase;
  }

  private emit(delta: number): void {
    emitGameEvent(this.scene.game.events, GameEvents.MoneyChanged, { money: this.money, delta, earned: this.earned });
  }
}
