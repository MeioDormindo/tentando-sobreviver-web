import Phaser from 'phaser';
import type { MapId } from '../config/maps.config';
import { emitGameEvent, GameEvents, onGameEvent, type GameOverStats } from '../game/events';
import { save } from '../save/SaveStore';

/**
 * Estatísticas da partida (GDD §64), só a partir de eventos: abates, headshots,
 * disparos/acertos, dano, dinheiro, bosses, power-ups e tempo. Na morte do jogador,
 * atualiza recordes e totais no save e emite o resumo para a tela de Game Over.
 */
export class StatsSystem {
  private wave = 0;
  private kills = 0;
  private headshots = 0;
  private moneyEarned = 0;
  private bosses = 0;
  private shotsFired = 0;
  private shotsHit = 0;
  private damage = 0;
  private powerUps = 0;
  private score = 0;
  /** Mensagem do anti-trapaça (partida invalidada), ou null. */
  private cheatTaunt: string | null = null;
  private readonly startedAt: number;

  constructor(private readonly scene: Phaser.Scene, private readonly mapId: MapId) {
    this.startedAt = scene.time.now;
    const ev = scene.game.events;
    const offs = [
      onGameEvent(ev, GameEvents.WaveState, (s) => { this.wave = s.wave; }),
      onGameEvent(ev, GameEvents.ZombieKilled, (k) => {
        this.kills++;
        if (k.headshot) this.headshots++;
      }),
      onGameEvent(ev, GameEvents.MoneyChanged, (m) => { this.moneyEarned = m.earned; }),
      onGameEvent(ev, GameEvents.BossDefeated, () => { this.bosses++; }),
      onGameEvent(ev, GameEvents.PowerUpCollected, () => { this.powerUps++; }),
      onGameEvent(ev, GameEvents.ShotsFired, (s) => { this.shotsFired += s.count; }),
      onGameEvent(ev, GameEvents.ShotHit, () => { this.shotsHit++; }),
      onGameEvent(ev, GameEvents.DamageDealt, (d) => { this.damage += d.amount; }),
      onGameEvent(ev, GameEvents.ScoreChanged, (s) => { this.score = s.score; }),
      onGameEvent(ev, GameEvents.CheatDetected, (c) => { this.cheatTaunt ??= c.taunt; }),
      onGameEvent(ev, GameEvents.PlayerDied, this.finish, this),
    ];
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => offs.forEach((off) => off()));
  }

  private finish(): void {
    const timeMs = this.scene.time.now - this.startedAt;
    // Partida invalidada pelo anti-trapaça não entra em recordes, totais nem ranking.
    const flagged = this.cheatTaunt !== null;
    const prev = flagged ? { ...save.records(this.mapId) } : save.finishRun(this.mapId, { wave: this.wave, kills: this.kills, score: this.score, bosses: this.bosses, timeMs });
    const records = save.records(this.mapId);
    const stats: GameOverStats = {
      wave: this.wave,
      kills: this.kills,
      headshots: this.headshots,
      moneyEarned: this.moneyEarned,
      timeMs,
      bosses: this.bosses,
      shotsFired: this.shotsFired,
      shotsHit: Math.min(this.shotsHit, this.shotsFired),
      damage: Math.round(this.damage),
      powerUps: this.powerUps,
      score: this.score,
      bestWave: records.bestWave,
      bestKills: records.bestKills,
      bestScore: records.bestScore,
      // O recorde principal é a pontuação.
      newRecord: !flagged && this.score > prev.bestScore,
      mapId: this.mapId,
      rankEligible: !flagged && save.qualifies(this.mapId, this.score),
      cheatTaunt: this.cheatTaunt,
    };
    emitGameEvent(this.scene.game.events, GameEvents.GameOver, stats);
  }
}
