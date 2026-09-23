import Phaser from 'phaser';
import { waveConfig } from '../config/waves.config';
import { getZombieConfig } from '../config/zombies.config';
import type { Player } from '../entities/Player';
import { emitGameEvent, GameEvents, onGameEvent, type WavePhase, type WaveStatePayload } from '../game/events';
import { getWaveParams, scaleZombie, type WaveParams } from './difficulty';
import type { BossSystem } from './BossSystem';
import type { SpawnSystem } from './SpawnSystem';
import { bosses, bossForWave } from '../config/bosses.config';

/** Nova tentativa quando nenhum ponto de spawn está livre (ms). */
const SPAWN_RETRY_MS = 250;

/** Alteração temporária do ritmo de spawn (eventos como Horda e Alarme). */
export interface SpawnModifier {
  intervalMultiplier: number;
  maxAliveBonus: number;
}

/**
 * Ciclo das waves (GDD §30): espera → wave ativa (spawn progressivo até o total)
 * → todos mortos → intervalo → próxima wave, mais difícil.
 */
export class WaveSystem {
  private readonly scene: Phaser.Scene;
  private readonly spawner: SpawnSystem;
  private readonly player: Player;

  private wave = 0;
  private phase: WavePhase = 'waiting';
  private params: WaveParams = getWaveParams(1);
  private spawned = 0;
  private killed = 0;
  private countdownMs: number = waveConfig.firstWaveDelay;
  private spawnTimerMs = 0;
  private lastEmittedKey = '';
  private readonly spawnMods = new Map<string, SpawnModifier>();

  constructor(scene: Phaser.Scene, spawner: SpawnSystem, player: Player, private readonly boss: BossSystem) {
    this.scene = scene;
    this.spawner = spawner;
    this.player = player;

    const off = onGameEvent(scene.game.events, GameEvents.ZombieKilled, this.onZombieKilled, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
    this.emitState(true);
  }

  get currentWave(): number {
    return this.wave;
  }

  get currentPhase(): WavePhase {
    return this.phase;
  }

  update(delta: number): void {
    if (!this.player.isAlive) return;

    if (this.phase !== 'active') {
      this.countdownMs -= delta;
      if (this.countdownMs <= 0) this.startWave(this.wave + 1);
      this.emitState();
      return;
    }

    this.spawner.relocateStuck(this.wave);
    this.completeIfDone();
    this.spawnTimerMs -= delta;
    const alive = this.spawned - this.killed;
    let interval = this.params.spawnInterval;
    let maxAlive = this.params.maxAlive;
    for (const mod of this.spawnMods.values()) {
      interval *= mod.intervalMultiplier;
      maxAlive += mod.maxAliveBonus;
    }
    if (this.spawnTimerMs <= 0 && this.spawned < this.params.totalEnemies && alive < maxAlive) {
      const config = scaleZombie(getZombieConfig(this.pickType()), this.params);
      if (this.spawner.spawn(config, this.wave)) {
        this.spawned++;
        this.spawnTimerMs = interval;
      } else {
        this.spawnTimerMs = SPAWN_RETRY_MS;
      }
    }
  }

  /** Sorteia o tipo do próximo zumbi pela composição da wave, respeitando os limites por tipo. */
  private pickType(): string {
    const stage = [...waveConfig.composition].reverse().find((c) => this.wave >= c.fromWave) ?? waveConfig.composition[0];
    const alive = this.spawner.aliveByType();
    const entries = Object.entries(stage.weights).filter(([type]) => {
      const cap = waveConfig.maxAlivePerType[type];
      return cap === undefined || (alive.get(type) ?? 0) < cap;
    });
    let pick = Math.random() * entries.reduce((sum, [, w]) => sum + w, 0);
    for (const [type, weight] of entries) {
      pick -= weight;
      if (pick < 0) return type;
    }
    return 'walker';
  }

  /** Reenvia o estado para a HUD. */
  syncHud(): void {
    this.emitState(true);
  }

  /** Zumbis extras que entraram na wave (invocados pelo boss). */
  addSummoned(count: number): void {
    this.params.totalEnemies += count;
    this.spawned += count;
    this.emitState(true);
  }

  /** Liga (ou desliga, com null) um modificador de spawn identificado por `id`. */
  setSpawnModifier(id: string, mod: SpawnModifier | null): void {
    if (mod) this.spawnMods.set(id, mod);
    else this.spawnMods.delete(id);
  }

  /** Zumbis extras na wave atual (Horda). */
  addEnemies(count: number): void {
    if (this.phase !== 'active' || count <= 0) return;
    this.params.totalEnemies += count;
    this.emitState(true);
  }

  get isBossWave(): boolean {
    return waveConfig.bossWaves.includes(this.wave);
  }

  private startWave(wave: number): void {
    this.wave = wave;
    this.params = getWaveParams(wave);
    // Wave de boss: o boss vem com uma horda reduzida de escolta.
    if (this.isBossWave) {
      const ratio = bosses[bossForWave(wave)].escortRatio;
      this.params.totalEnemies = Math.max(2, Math.round(this.params.totalEnemies * ratio));
      this.boss.startBossWave(wave);
    }
    this.phase = 'active';
    this.spawned = 0;
    this.killed = 0;
    this.spawnTimerMs = 0;
    this.emitState(true);
  }

  private onZombieKilled(): void {
    if (this.phase !== 'active') return;
    this.killed++;
    this.completeIfDone();
    this.emitState(true);
  }

  /** A wave termina quando todos os zumbis morreram e não há boss vivo. */
  private completeIfDone(): void {
    if (this.phase !== 'active' || this.killed < this.params.totalEnemies || this.boss.isActive) return;
    this.phase = 'intermission';
    this.countdownMs = waveConfig.intermission;
    this.emitState(true);
  }

  private snapshot(): WaveStatePayload {
    return {
      wave: this.wave,
      phase: this.phase,
      remaining: this.phase === 'active' ? this.params.totalEnemies - this.killed + (this.boss.isActive ? 1 : 0) : 0,
      total: this.params.totalEnemies,
      nextWaveInMs: this.phase === 'active' ? 0 : Math.max(0, this.countdownMs),
    };
  }

  /** Durante contagens, emite só quando o segundo exibido muda. */
  private emitState(force = false): void {
    const s = this.snapshot();
    const key = `${s.wave}|${s.phase}|${s.remaining}|${Math.ceil(s.nextWaveInMs / 1000)}`;
    if (!force && key === this.lastEmittedKey) return;
    this.lastEmittedKey = key;
    emitGameEvent(this.scene.game.events, GameEvents.WaveState, s);
  }
}
