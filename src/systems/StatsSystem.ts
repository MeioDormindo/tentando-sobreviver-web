import Phaser from 'phaser';
import { emitGameEvent, GameEvents, onGameEvent, type GameOverStats } from '../game/events';

const RECORDS_KEY = 'ts-records';

interface Records {
  bestWave: number;
  bestKills: number;
}

/** Recordes salvos no navegador (GDD §65). */
export function loadRecords(): Records {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    const data = raw ? (JSON.parse(raw) as Partial<Records>) : {};
    return { bestWave: Number(data.bestWave) || 0, bestKills: Number(data.bestKills) || 0 };
  } catch {
    return { bestWave: 0, bestKills: 0 };
  }
}

function saveRecords(r: Records): void {
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(r));
  } catch {
    /* armazenamento indisponível: o recorde vale só nesta sessão */
  }
}

/**
 * Estatísticas da partida (GDD §64), só a partir de eventos: abates, headshots,
 * disparos/acertos, dano, dinheiro, bosses, power-ups e tempo. Na morte do jogador,
 * atualiza os recordes e emite o resumo para a tela de Game Over.
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
  private readonly startedAt: number;

  constructor(private readonly scene: Phaser.Scene) {
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
      onGameEvent(ev, GameEvents.PlayerDied, this.finish, this),
    ];
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => offs.forEach((off) => off()));
  }

  private finish(): void {
    const prev = loadRecords();
    const newRecord = this.wave > prev.bestWave || (this.wave === prev.bestWave && this.kills > prev.bestKills);
    const records = { bestWave: Math.max(prev.bestWave, this.wave), bestKills: Math.max(prev.bestKills, this.kills) };
    saveRecords(records);
    const stats: GameOverStats = {
      wave: this.wave,
      kills: this.kills,
      headshots: this.headshots,
      moneyEarned: this.moneyEarned,
      timeMs: this.scene.time.now - this.startedAt,
      bosses: this.bosses,
      shotsFired: this.shotsFired,
      shotsHit: Math.min(this.shotsHit, this.shotsFired),
      damage: Math.round(this.damage),
      powerUps: this.powerUps,
      ...records,
      newRecord,
    };
    emitGameEvent(this.scene.game.events, GameEvents.GameOver, stats);
  }
}
