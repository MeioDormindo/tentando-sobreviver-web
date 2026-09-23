import type Phaser from 'phaser';

/** Eventos globais do jogo, emitidos em `game.events`. */
export const GameEvents = {
  PlayerHpChanged: 'player-hp-changed',
  AmmoChanged: 'ammo-changed',
  ZombieKilled: 'zombie-killed',
  PlayerDied: 'player-died',
  /** Estado completo da wave (emitido a cada mudança). */
  WaveState: 'wave-state',
  /** A UI pede o estado atual (ex.: ao ser criada depois da GameScene). */
  HudRequest: 'hud-request',
} as const;

export interface PlayerHpPayload {
  hp: number;
  maxHp: number;
}

export interface AmmoPayload {
  weaponName: string;
  current: number;
  reserve: number;
  reloading: boolean;
}

export interface ZombieKilledPayload {
  type: string;
  reward: number;
}

export type WavePhase = 'waiting' | 'active' | 'intermission';

export interface WaveStatePayload {
  wave: number;
  phase: WavePhase;
  /** Zumbis que ainda faltam matar nesta wave (inclui os que ainda não surgiram). */
  remaining: number;
  total: number;
  /** Tempo até a próxima wave começar (ms), quando phase != 'active'. */
  nextWaveInMs: number;
}

export interface GameEventMap {
  [GameEvents.PlayerHpChanged]: PlayerHpPayload;
  [GameEvents.AmmoChanged]: AmmoPayload;
  [GameEvents.ZombieKilled]: ZombieKilledPayload;
  [GameEvents.PlayerDied]: undefined;
  [GameEvents.WaveState]: WaveStatePayload;
  [GameEvents.HudRequest]: undefined;
}

export type GameEventName = keyof GameEventMap;

/** Emissão tipada. */
export function emitGameEvent<K extends GameEventName>(
  emitter: Phaser.Events.EventEmitter,
  event: K,
  payload: GameEventMap[K],
): void {
  emitter.emit(event, payload);
}

/** Inscrição tipada; retorna função para remover o listener. */
export function onGameEvent<K extends GameEventName>(
  emitter: Phaser.Events.EventEmitter,
  event: K,
  handler: (payload: GameEventMap[K]) => void,
  context?: unknown,
): () => void {
  emitter.on(event, handler, context);
  return () => emitter.off(event, handler, context);
}
