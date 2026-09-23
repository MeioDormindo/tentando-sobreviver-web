import Phaser from 'phaser';
import { economyConfig } from '../config/economy.config';
import type { EffectsSystem } from '../effects/EffectsSystem';
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

  earn(amount: number): void {
    if (amount <= 0) return;
    this.money += amount;
    this.earned += amount;
    this.emit(amount);
  }

  /** Debita se houver saldo; senão avisa a HUD e retorna false. */
  spend(cost: number): boolean {
    if (!this.canAfford(cost)) {
      emitGameEvent(this.scene.game.events, GameEvents.PurchaseDenied, undefined);
      return false;
    }
    this.money -= cost;
    this.emit(-cost);
    return true;
  }

  syncHud(): void {
    this.emit(0);
  }

  private onZombieKilled(kill: ZombieKilledPayload): void {
    const amount = kill.reward + (kill.headshot ? economyConfig.headshotBonus : 0);
    this.earn(amount);
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
