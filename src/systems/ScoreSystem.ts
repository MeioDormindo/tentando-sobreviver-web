import Phaser from 'phaser';
import { scoreConfig } from '../config/score.config';
import type { EffectsSystem } from '../effects/EffectsSystem';
import { IntegrityGuard, type GuardedValue } from './AntiCheat';
import { emitGameEvent, GameEvents, onGameEvent, type WavePhase, type ZombieKilledPayload } from '../game/events';

interface Position {
  readonly x: number;
  readonly y: number;
}

/**
 * Pontuação da partida: abates (por tipo, valendo mais a cada wave), headshots,
 * abates a queima-roupa, sequências de abates, waves completas, bosses e power-ups.
 * Só escuta eventos; a HUD e o Game Over recebem o total por ScoreChanged.
 */
export class ScoreSystem implements GuardedValue {
  private score = 0;
  private readonly guard = new IntegrityGuard(0);
  /** Multiplicador de eventos (Lua de Sangue: pontos em dobro). */
  multiplier = 1;
  private wave = 1;
  private phase: WavePhase = 'waiting';
  private streak = 0;
  private lastKillAt = -Infinity;

  constructor(private readonly scene: Phaser.Scene, private readonly player: Position, private readonly effects: EffectsSystem) {
    const ev = scene.game.events;
    const offs = [
      onGameEvent(ev, GameEvents.ZombieKilled, this.onKill, this),
      onGameEvent(ev, GameEvents.WaveState, (s) => {
        if (this.phase === 'active' && s.phase === 'intermission') this.add(scoreConfig.waveComplete * s.wave);
        this.wave = Math.max(1, s.wave);
        this.phase = s.phase;
      }),
      onGameEvent(ev, GameEvents.BossDefeated, () => this.add(scoreConfig.boss)),
      onGameEvent(ev, GameEvents.PowerUpCollected, () => this.add(scoreConfig.powerUp)),
    ];
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => offs.forEach((off) => off()));
  }

  get total(): number {
    return this.score;
  }

  intact(): boolean {
    return this.guard.matches(this.score);
  }

  syncHud(): void {
    emitGameEvent(this.scene.game.events, GameEvents.ScoreChanged, { score: this.score, delta: 0 });
  }

  private onKill(kill: ZombieKilledPayload): void {
    const cfg = scoreConfig;
    const now = this.scene.time.now;
    let points = (cfg.kill[kill.type] ?? cfg.killDefault) * (1 + this.wave * cfg.perWaveMultiplier);
    if (kill.source === 'weapon' || kill.source === 'melee') {
      if (kill.headshot) points += cfg.headshot;
      if (kill.source === 'melee') points += cfg.knifeKill;
      if (Phaser.Math.Distance.Between(kill.x, kill.y, this.player.x, this.player.y) <= cfg.closeRange.distance) points += cfg.closeRange.bonus;
      // Sequência: abates seguidos dentro da janela rendem um bônus crescente.
      this.streak = now - this.lastKillAt <= cfg.multiKill.windowMs ? this.streak + 1 : 0;
      this.lastKillAt = now;
      if (this.streak > 0) {
        const step = Math.min(this.streak, cfg.multiKill.maxSteps);
        points += step * cfg.multiKill.bonusPerStep;
        if (this.streak >= 2) this.effects.floatingText(kill.x, kill.y - 14, `MULTI x${this.streak + 1}`, '#ffb347', true);
      }
    } else {
      points *= cfg.indirectFactor;
    }
    this.add(points);
  }

  private add(points: number): void {
    const delta = Math.round(points * this.multiplier);
    if (delta <= 0) return;
    this.score += delta;
    this.guard.set(this.score);
    emitGameEvent(this.scene.game.events, GameEvents.ScoreChanged, { score: this.score, delta });
  }
}
