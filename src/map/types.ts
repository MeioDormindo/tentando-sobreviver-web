import type { PerkId } from '../config/machines.config';
import type { MapId } from '../config/maps.config';
import type { PropType } from './props';

/**
 * Tipos comuns a todos os mapas. Tudo em tiles de 32 px.
 * Construção: tudo começa sólido → áreas/bolsões/pisos viram chão → obstáculos
 * voltam a ser sólidos → recortes → portas → janelas.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TilePos {
  tx: number;
  ty: number;
}

/** Pisos de todos os mapas (cada um tem a sua textura). */
export type FloorKind =
  | 'terminal' | 'concrete' | 'metal' | 'tracks' | 'tunnel' | 'wagon'
  | 'hospital' | 'linoleum' | 'morgue';

export interface AreaDef {
  id: string;
  name: string;
  /** Escuridão ambiente quando o jogador está na área (GDD §50). */
  darkness: number;
  rects: Rect[];
}

export interface FloorDef {
  rect: Rect;
  kind: FloorKind;
}

/** 'train' = trem parado do Terminal (desenhado como vagão, não como parede). */
export type SolidKind = 'wall' | 'train';

export interface ObstacleDef {
  rect: Rect;
  kind: SolidKind;
}

export interface DoorDef {
  id: string;
  rect: Rect;
  cost: number;
  areas: [string, string];
}

export interface WindowDef {
  id: string;
  /** Tiles da janela (numa parede vertical). */
  rect: Rect;
  /** Área para onde a janela dá acesso. */
  area: string;
}

export interface SpawnDef {
  id: string;
  tx: number;
  ty: number;
  /** Área que precisa estar aberta para o ponto funcionar. */
  area: string;
  minWave: number;
}

export type StationPlacement =
  | { type: 'weapon'; weaponId: string; tx: number; ty: number }
  | { type: 'ammo'; tx: number; ty: number };

export type MachinePlacement =
  | { type: 'mystery_box'; tx: number; ty: number }
  | { type: 'weapon_lab'; tx: number; ty: number }
  | { type: 'perk'; perkId: PerkId; tx: number; ty: number };

export interface BoxSpot {
  tx: number;
  ty: number;
  area: string;
}

export interface PropPlacement {
  type: PropType;
  tx: number;
  ty: number;
  angle?: number;
}

export interface LampDef {
  tx: number;
  ty: number;
  radius: number;
  intensity: number;
  flicker: number;
  /** Cor da luz (padrão: lâmpada quente). */
  color?: number;
}

/** Painéis e armadilhas interativos (posição do painel; zona da armadilha em tiles). */
export type MapInteractionDef =
  | { type: 'power' | 'alarm' | 'train' | 'breaker'; tx: number; ty: number }
  | { type: 'trap'; tx: number; ty: number; zone: Rect };

/** Easter eggs do mapa (posições em tiles). */
export interface MapSecrets {
  teddies: TilePos[];
  /** Rádio / gravador que conta a história do mapa. */
  radio: TilePos & { holdMs: number; label: string };
  creditsSign: TilePos;
  loreMessages: readonly string[];
}

/** Estação de trem (só o Terminal): trilhos, trem que passa e detalhes da plataforma. */
export interface StationLayout {
  /** Área que precisa estar aberta para o trem passar. */
  area: string;
  /** Faixa livre dos trilhos por onde o trem passa (tiles). */
  lane: { y: number; h: number };
  /** Trecho em X da plataforma (tiles): pontas dos trilhos. */
  span: { from: number; to: number };
  /** Bordas das plataformas que dão para os trilhos (faixa tátil). y em tiles; `down` = trilho abaixo. */
  edges: Array<{ x: number; y: number; w: number; down: boolean }>;
  /** Unidades de ar-condicionado sobre o teto do trem parado. */
  roofUnits: TilePos[];
  /** Bocas de túnel nas pontas de cada trilho: y e altura (tiles). */
  tunnels: Array<{ y: number; h: number }>;
  /** Semáforos nas pontas do trilho do trem. */
  signals: TilePos[];
  /** Painel de horários. */
  board: TilePos;
}

/** Tudo o que define um mapa jogável. */
export interface MapLayout {
  id: MapId;
  width: number;
  height: number;
  startArea: string;
  playerStart: TilePos;
  /** Escuridão fora das áreas (bolsões externos). */
  outsideDarkness: number;
  areas: AreaDef[];
  pockets: Rect[];
  floors: FloorDef[];
  obstacles: ObstacleDef[];
  carves: Rect[];
  doors: DoorDef[];
  windows: WindowDef[];
  spawns: SpawnDef[];
  stations: StationPlacement[];
  machines: MachinePlacement[];
  boxSpots: BoxSpot[];
  bossSpawns: TilePos[];
  props: PropPlacement[];
  lamps: LampDef[];
  interactions: MapInteractionDef[];
  secrets: MapSecrets;
  /** Semente da sujeira espalhada pelo chão. */
  decalSeed: string;
  station?: StationLayout;
}
