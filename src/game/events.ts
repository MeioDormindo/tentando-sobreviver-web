import type Phaser from 'phaser';
import type { MapId } from '../config/maps.config';

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
  /** Perks adquiridos mudaram. */
  PerksChanged: 'perks-changed',
  /** Aviso curto no topo da tela (ex.: som ligado/desligado). */
  Toast: 'toast',
  /** Energia do mapa ligada/desligada. */
  PowerChanged: 'power-changed',
  /** Objetivo atual da missão principal (null = sem missão ativa). */
  QuestState: 'quest-state',
  /** Missão principal concluída. */
  QuestComplete: 'quest-complete',
  /** Jogo pausado / retomado (o disparo espera o botão ser solto ao voltar). */
  GamePaused: 'game-paused',
  GameResumed: 'game-resumed',
  /** Power-up coletado (anúncio na HUD). */
  PowerUpCollected: 'powerup-collected',
  /** Efeitos temporários ativos (contagem regressiva na HUD). */
  PowerUpTimers: 'powerup-timers',
  /** Aviso "BOSS INCOMING" (GDD §61). */
  BossIncoming: 'boss-incoming',
  /** Vida/fase do boss para a barra da HUD. */
  BossState: 'boss-state',
  BossPhase: 'boss-phase',
  BossDefeated: 'boss-defeated',
  /** Evento dinâmico começou (apagão, trem, horda...) — anúncio na HUD. */
  WorldEventStarted: 'world-event-started',
  /** Evento ativo e tempo restante (null = nenhum). */
  WorldEventState: 'world-event-state',
  /** Estatísticas: disparos, acertos e dano causado (tela de Game Over). */
  ShotsFired: 'shots-fired',
  ShotHit: 'shot-hit',
  DamageDealt: 'damage-dealt',
  /** Base do minimapa (paredes, áreas abertas/trancadas, portas) — muda ao abrir portas. */
  MinimapBase: 'minimap-base',
  /** Posições no minimapa (jogador, zumbis, boss, caixa, suprimentos). */
  MinimapState: 'minimap-state',
  /** Um mapa novo foi liberado (anúncio na HUD). */
  MapUnlocked: 'map-unlocked',
  /** Pontuação total e o quanto mudou. */
  ScoreChanged: 'score-changed',
  /** Fim de partida com o resumo (GDD §63–64). */
  GameOver: 'game-over',
  /** A UI pede o estado atual (ex.: ao ser criada depois da GameScene). */
  HudRequest: 'hud-request',
} as const;

export interface PlayerHpPayload {
  hp: number;
  maxHp: number;
  armor: number;
  maxArmor: number;
}

export interface AmmoPayload {
  weaponName: string;
  /** Elemento comprado para a arma em mãos (null = nenhum). */
  element: { icon: string; name: string; color: number } | null;
  current: number;
  reserve: number;
  reloading: boolean;
  /** Nome da outra arma do inventário (null se só há uma). */
  secondary: string | null;
}

/**
 * O que matou o zumbi: só abates por arma pagam e soltam power-ups. Explosões de um
 * Exploder abatido a tiro contam como 'weapon'; as que ele mesmo detona, como 'explosion'.
 * 'hazard' = perigos do mapa (trem, gás).
 */
/** 'melee' = faca (conta como abate do jogador, com bônus). */
export type KillSource = 'weapon' | 'melee' | 'nuke' | 'explosion' | 'hazard';

export interface ZombieKilledPayload {
  type: string;
  reward: number;
  x: number;
  y: number;
  headshot: boolean;
  source: KillSource;
}

export interface BossStatePayload {
  active: boolean;
  name: string;
  hp: number;
  maxHp: number;
  phase: number;
  /** Frações de vida das trocas de fase (marcas na barra). */
  thresholds: number[];
}

export interface PowerUpTimer {
  id: string;
  name: string;
  color: number;
  remainingMs: number;
  totalMs: number;
}

export interface WorldEventStatePayload {
  id: string;
  name: string;
  color: number;
  /** null = dura até o fim da wave. */
  remainingMs: number | null;
  totalMs: number | null;
}

/** Resumo da partida (GDD §63–64). */
export interface GameOverStats {
  wave: number;
  kills: number;
  headshots: number;
  moneyEarned: number;
  timeMs: number;
  bosses: number;
  shotsFired: number;
  shotsHit: number;
  damage: number;
  powerUps: number;
  score: number;
  /** Recordes (localStorage) e se esta partida bateu algum. */
  bestWave: number;
  bestKills: number;
  bestScore: number;
  newRecord: boolean;
  mapId: MapId;
  /** A pontuação entra no ranking do mapa (a tela pede o nome). */
  rankEligible: boolean;
}

export interface MinimapBasePayload {
  cols: number;
  rows: number;
  tileSize: number;
  /** Código por tile (ver GameMap.minimapCells). */
  cells: number[];
}

export interface MinimapStatePayload {
  player: [number, number, number];
  /** Posições dos zumbis em pares x, y. */
  zombies: number[];
  boss: [number, number] | null;
  box: [number, number] | null;
  supply: [number, number] | null;
  /** Objetivo atual (disjuntor, etapa da missão). */
  objective: [number, number] | null;
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
  /** Rodada só de cães (muda os textos da HUD). */
  hounds?: boolean;
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
  [GameEvents.PerksChanged]: { perks: Array<{ id: string; level: number }> };
  [GameEvents.Toast]: { text: string };
  [GameEvents.GamePaused]: undefined;
  [GameEvents.GameResumed]: undefined;
  [GameEvents.PowerUpCollected]: { id: string; name: string; color: number; detail?: string };
  [GameEvents.PowerChanged]: { on: boolean };
  [GameEvents.QuestState]: { title: string; objective: string; step: number; total: number } | null;
  [GameEvents.QuestComplete]: { id: string; title: string; subtitle: string };
  [GameEvents.PowerUpTimers]: { timers: PowerUpTimer[] };
  [GameEvents.BossIncoming]: { name: string };
  [GameEvents.BossState]: BossStatePayload;
  [GameEvents.BossPhase]: { name: string; phase: number };
  [GameEvents.BossDefeated]: { name: string; reward: number; id: string; x: number; y: number };
  [GameEvents.WorldEventStarted]: { id: string; name: string; hint: string; color: number };
  [GameEvents.WorldEventState]: WorldEventStatePayload | null;
  [GameEvents.ShotsFired]: { count: number };
  [GameEvents.ShotHit]: undefined;
  [GameEvents.DamageDealt]: { amount: number };
  [GameEvents.ScoreChanged]: { score: number; delta: number };
  [GameEvents.MapUnlocked]: { id: MapId; name: string };
  [GameEvents.MinimapBase]: MinimapBasePayload;
  [GameEvents.MinimapState]: MinimapStatePayload;
  [GameEvents.GameOver]: GameOverStats;
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
