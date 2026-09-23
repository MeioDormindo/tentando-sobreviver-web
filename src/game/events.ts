import type Phaser from 'phaser';

/** Eventos globais do jogo, emitidos em `game.events`. */
export const GameEvents = {
  PlayerHpChanged: 'player-hp-changed',
  AmmoChanged: 'ammo-changed',
  ZombieKilled: 'zombie-killed',
  PlayerDied: 'player-died',
  /** Estado completo da wave (emitido a cada mudança). */
  WaveState: 'wave-state',
  MoneyChanged: 'money-changed',
  /** Texto de interação próximo ao jogador (null = nada por perto). */
  InteractionPrompt: 'interaction-prompt',
  /** Tentativa de compra sem dinheiro suficiente. */
  PurchaseDenied: 'purchase-denied',
  /** O jogador entrou em outra área do mapa. */
  AreaEntered: 'area-entered',
  /** Uma porta foi aberta e uma área nova foi liberada. */
  AreaUnlocked: 'area-unlocked',
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
  /** Nome da outra arma do inventário (null se só há uma). */
  secondary: string | null;
}

export interface ZombieKilledPayload {
  type: string;
  reward: number;
  x: number;
  y: number;
  headshot: boolean;
}

export interface MoneyPayload {
  money: number;
  /** Variação que gerou o evento (0 na sincronização). */
  delta: number;
  /** Total ganho na partida. */
  earned: number;
}

export interface InteractionPromptPayload {
  text: string;
  /** Se o jogador pode pagar agora. */
  affordable: boolean;
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
  [GameEvents.MoneyChanged]: MoneyPayload;
  [GameEvents.InteractionPrompt]: InteractionPromptPayload | null;
  [GameEvents.PurchaseDenied]: undefined;
  [GameEvents.AreaEntered]: { id: string; name: string };
  [GameEvents.AreaUnlocked]: { id: string; name: string };
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
