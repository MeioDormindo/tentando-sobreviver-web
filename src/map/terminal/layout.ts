import type { PropType } from '../props';

/**
 * Terminal Central (GDD §6–17). Tudo em tiles de 32 px.
 * Construção: tudo começa sólido → áreas/bolsões/pisos viram chão → obstáculos
 * voltam a ser sólidos → recortes (vagão aberto) → portas → janelas.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type AreaId = 'hall' | 'platform' | 'ticket' | 'shops' | 'tech' | 'tunnels' | 'maintenance';
export type FloorKind = 'terminal' | 'concrete' | 'metal' | 'tracks' | 'tunnel' | 'wagon';

export interface AreaDef {
  id: AreaId;
  name: string;
  /** Escuridão ambiente quando o jogador está na área (GDD §50). */
  darkness: number;
  rects: Rect[];
}

export const MAP_WIDTH = 128;
export const MAP_HEIGHT = 121;
export const START_AREA: AreaId = 'hall';
export const PLAYER_START = { tx: 64, ty: 42 };
/** Escuridão fora das áreas (bolsões externos). */
export const OUTSIDE_DARKNESS = 0.82;

export const AREAS: AreaDef[] = [
  { id: 'hall', name: 'Hall Central', darkness: 0.64, rects: [{ x: 40, y: 28, w: 48, h: 28 }] },
  { id: 'platform', name: 'Plataforma Norte', darkness: 0.68, rects: [{ x: 16, y: 4, w: 96, h: 22 }] },
  { id: 'ticket', name: 'Bilheteria', darkness: 0.72, rects: [{ x: 12, y: 58, w: 32, h: 20 }] },
  { id: 'shops', name: 'Lojas', darkness: 0.8, rects: [{ x: 84, y: 58, w: 32, h: 20 }] },
  { id: 'tech', name: 'Área Técnica', darkness: 0.78, rects: [{ x: 24, y: 81, w: 80, h: 14 }] },
  { id: 'tunnels', name: 'Túneis', darkness: 0.9, rects: [{ x: 16, y: 98, w: 96, h: 10 }] },
  { id: 'maintenance', name: 'Manutenção', darkness: 0.8, rects: [{ x: 36, y: 110, w: 56, h: 9 }] },
];

/** Bolsões externos atrás das janelas: só zumbis chegam (surgem e entram pela barricada). */
export const POCKETS: Rect[] = [
  { x: 34, y: 31, w: 5, h: 5 },
  { x: 34, y: 46, w: 5, h: 5 },
  { x: 89, y: 31, w: 5, h: 5 },
  { x: 89, y: 46, w: 5, h: 5 },
  { x: 6, y: 61, w: 5, h: 5 },
  { x: 6, y: 70, w: 5, h: 5 },
  { x: 117, y: 61, w: 5, h: 5 },
  { x: 117, y: 70, w: 5, h: 5 },
];

/** Pisos (ordem de desenho). */
export const FLOORS: Array<{ rect: Rect; kind: FloorKind }> = [
  // Plataforma Norte (de cima para baixo): trilho de trás com o trem parado, ilha,
  // trilho da frente (onde o trem passa) e a plataforma principal, ligada ao Hall.
  { rect: { x: 16, y: 4, w: 96, h: 5 }, kind: 'tracks' },
  { rect: { x: 16, y: 9, w: 96, h: 3 }, kind: 'concrete' },
  { rect: { x: 16, y: 12, w: 96, h: 4 }, kind: 'tracks' },
  { rect: { x: 16, y: 16, w: 96, h: 10 }, kind: 'concrete' },
  { rect: { x: 40, y: 28, w: 48, h: 28 }, kind: 'terminal' },
  { rect: { x: 12, y: 58, w: 32, h: 20 }, kind: 'terminal' },
  { rect: { x: 84, y: 58, w: 32, h: 20 }, kind: 'terminal' },
  { rect: { x: 24, y: 81, w: 80, h: 14 }, kind: 'metal' },
  { rect: { x: 16, y: 98, w: 96, h: 10 }, kind: 'tunnel' },
  { rect: { x: 36, y: 110, w: 56, h: 9 }, kind: 'metal' },
  { rect: { x: 58, y: 5, w: 12, h: 4 }, kind: 'wagon' },
  ...POCKETS.map((rect) => ({ rect, kind: 'concrete' as FloorKind })),
];

export type SolidKind = 'wall' | 'train';

/** Obstáculos sólidos dentro das áreas. */
export const OBSTACLES: Array<{ rect: Rect; kind: SolidKind }> = [
  // Hall: pilares e balcão de informações
  { rect: { x: 48, y: 33, w: 2, h: 2 }, kind: 'wall' },
  { rect: { x: 78, y: 33, w: 2, h: 2 }, kind: 'wall' },
  { rect: { x: 48, y: 48, w: 2, h: 2 }, kind: 'wall' },
  { rect: { x: 78, y: 48, w: 2, h: 2 }, kind: 'wall' },
  { rect: { x: 60, y: 34, w: 8, h: 2 }, kind: 'wall' },
  // Plataforma: pilares da plataforma principal e o trem parado no trilho de trás
  { rect: { x: 28, y: 19, w: 2, h: 2 }, kind: 'wall' },
  { rect: { x: 44, y: 19, w: 2, h: 2 }, kind: 'wall' },
  { rect: { x: 82, y: 19, w: 2, h: 2 }, kind: 'wall' },
  { rect: { x: 98, y: 19, w: 2, h: 2 }, kind: 'wall' },
  { rect: { x: 24, y: 4, w: 80, h: 5 }, kind: 'train' },
  // Bilheteria: balcão com guichês
  { rect: { x: 16, y: 65, w: 6, h: 1 }, kind: 'wall' },
  { rect: { x: 23, y: 65, w: 7, h: 1 }, kind: 'wall' },
  { rect: { x: 31, y: 65, w: 6, h: 1 }, kind: 'wall' },
  // Lojas: três lojas com passagens entre si e fachada com portas
  { rect: { x: 84, y: 68, w: 4, h: 1 }, kind: 'wall' },
  { rect: { x: 90, y: 68, w: 8, h: 1 }, kind: 'wall' },
  { rect: { x: 100, y: 68, w: 8, h: 1 }, kind: 'wall' },
  { rect: { x: 110, y: 68, w: 6, h: 1 }, kind: 'wall' },
  { rect: { x: 94, y: 58, w: 1, h: 2 }, kind: 'wall' },
  { rect: { x: 94, y: 62, w: 1, h: 6 }, kind: 'wall' },
  { rect: { x: 104, y: 58, w: 1, h: 2 }, kind: 'wall' },
  { rect: { x: 104, y: 62, w: 1, h: 6 }, kind: 'wall' },
  // Área técnica: labirinto de salas
  { rect: { x: 40, y: 81, w: 1, h: 9 }, kind: 'wall' },
  { rect: { x: 56, y: 86, w: 1, h: 9 }, kind: 'wall' },
  { rect: { x: 72, y: 81, w: 1, h: 9 }, kind: 'wall' },
  { rect: { x: 88, y: 86, w: 1, h: 9 }, kind: 'wall' },
  { rect: { x: 44, y: 88, w: 8, h: 1 }, kind: 'wall' },
  { rect: { x: 76, y: 85, w: 8, h: 1 }, kind: 'wall' },
  // Túneis: dois corredores com travessias
  { rect: { x: 16, y: 102, w: 8, h: 1 }, kind: 'wall' },
  { rect: { x: 27, y: 102, w: 23, h: 1 }, kind: 'wall' },
  { rect: { x: 53, y: 102, w: 23, h: 1 }, kind: 'wall' },
  { rect: { x: 79, y: 102, w: 21, h: 1 }, kind: 'wall' },
  { rect: { x: 103, y: 102, w: 9, h: 1 }, kind: 'wall' },
  { rect: { x: 36, y: 98, w: 1, h: 3 }, kind: 'wall' },
  { rect: { x: 66, y: 103, w: 1, h: 4 }, kind: 'wall' },
  { rect: { x: 94, y: 103, w: 1, h: 4 }, kind: 'wall' },
  // Manutenção
  { rect: { x: 46, y: 113, w: 2, h: 2 }, kind: 'wall' },
  { rect: { x: 80, y: 113, w: 2, h: 2 }, kind: 'wall' },
  { rect: { x: 60, y: 113, w: 8, h: 2 }, kind: 'wall' },
];

/** Recortes feitos depois dos obstáculos: interior do vagão aberto e a porta dele. */
export const CARVES: Rect[] = [
  { x: 58, y: 5, w: 12, h: 3 },
  { x: 62, y: 8, w: 3, h: 1 },
];

export interface DoorDef {
  id: string;
  rect: Rect;
  cost: number;
  areas: [AreaId, AreaId];
}

/** Portas e custos (GDD §18). */
export const DOORS: DoorDef[] = [
  { id: 'door_hall_ticket', rect: { x: 41, y: 56, w: 3, h: 2 }, cost: 750, areas: ['hall', 'ticket'] },
  { id: 'door_hall_shops', rect: { x: 84, y: 56, w: 3, h: 2 }, cost: 1000, areas: ['hall', 'shops'] },
  { id: 'door_hall_platform', rect: { x: 62, y: 26, w: 4, h: 2 }, cost: 1500, areas: ['hall', 'platform'] },
  { id: 'door_ticket_tech', rect: { x: 30, y: 78, w: 3, h: 3 }, cost: 1500, areas: ['ticket', 'tech'] },
  { id: 'door_shops_tech', rect: { x: 96, y: 78, w: 3, h: 3 }, cost: 2000, areas: ['shops', 'tech'] },
  { id: 'door_tech_tunnels', rect: { x: 62, y: 95, w: 3, h: 3 }, cost: 2500, areas: ['tech', 'tunnels'] },
  { id: 'door_tunnels_maint', rect: { x: 86, y: 108, w: 3, h: 2 }, cost: 3000, areas: ['tunnels', 'maintenance'] },
];

export interface WindowDef {
  id: string;
  /** Tiles da janela (numa parede vertical). */
  rect: Rect;
  /** Área para onde a janela dá acesso. */
  area: AreaId;
}

/** Janelas com barricada (GDD §19): ligam um bolsão externo a uma área. */
export const WINDOWS: WindowDef[] = [
  { id: 'win_hall_w1', rect: { x: 39, y: 32, w: 1, h: 2 }, area: 'hall' },
  { id: 'win_hall_w2', rect: { x: 39, y: 47, w: 1, h: 2 }, area: 'hall' },
  { id: 'win_hall_e1', rect: { x: 88, y: 32, w: 1, h: 2 }, area: 'hall' },
  { id: 'win_hall_e2', rect: { x: 88, y: 47, w: 1, h: 2 }, area: 'hall' },
  { id: 'win_ticket_1', rect: { x: 11, y: 62, w: 1, h: 2 }, area: 'ticket' },
  { id: 'win_ticket_2', rect: { x: 11, y: 71, w: 1, h: 2 }, area: 'ticket' },
  { id: 'win_shops_1', rect: { x: 116, y: 62, w: 1, h: 2 }, area: 'shops' },
  { id: 'win_shops_2', rect: { x: 116, y: 71, w: 1, h: 2 }, area: 'shops' },
];

export interface SpawnDef {
  id: string;
  tx: number;
  ty: number;
  /** Área que precisa estar aberta para o ponto funcionar. */
  area: AreaId;
  minWave: number;
}

/** Pontos de spawn (GDD §20). Os do Hall, Bilheteria e Lojas ficam nos bolsões atrás das janelas. */
export const SPAWNS: SpawnDef[] = [
  { id: 'H1', tx: 36, ty: 33, area: 'hall', minWave: 1 },
  { id: 'H2', tx: 36, ty: 48, area: 'hall', minWave: 1 },
  { id: 'H3', tx: 91, ty: 33, area: 'hall', minWave: 1 },
  { id: 'H4', tx: 91, ty: 48, area: 'hall', minWave: 1 },
  // Bocas dos túneis: nas pontas do trilho da frente (na rota do trem) e do trilho de trás
  { id: 'P1', tx: 17, ty: 13, area: 'platform', minWave: 1 },
  { id: 'P2', tx: 110, ty: 14, area: 'platform', minWave: 1 },
  { id: 'P3', tx: 18, ty: 6, area: 'platform', minWave: 1 },
  { id: 'P4', tx: 109, ty: 6, area: 'platform', minWave: 1 },
  { id: 'B1', tx: 8, ty: 63, area: 'ticket', minWave: 1 },
  { id: 'B2', tx: 8, ty: 72, area: 'ticket', minWave: 1 },
  { id: 'L1', tx: 119, ty: 63, area: 'shops', minWave: 1 },
  { id: 'L2', tx: 119, ty: 72, area: 'shops', minWave: 1 },
  { id: 'T1', tx: 25, ty: 82, area: 'tech', minWave: 1 },
  { id: 'T2', tx: 102, ty: 82, area: 'tech', minWave: 1 },
  { id: 'T3', tx: 26, ty: 93, area: 'tech', minWave: 1 },
  { id: 'T4', tx: 101, ty: 93, area: 'tech', minWave: 1 },
  { id: 'U1', tx: 18, ty: 100, area: 'tunnels', minWave: 1 },
  { id: 'U2', tx: 109, ty: 100, area: 'tunnels', minWave: 1 },
  { id: 'U3', tx: 18, ty: 105, area: 'tunnels', minWave: 1 },
  { id: 'U4', tx: 109, ty: 105, area: 'tunnels', minWave: 1 },
  { id: 'U5', tx: 44, ty: 100, area: 'tunnels', minWave: 1 },
  { id: 'U6', tx: 84, ty: 105, area: 'tunnels', minWave: 1 },
  { id: 'M1', tx: 38, ty: 111, area: 'maintenance', minWave: 1 },
  { id: 'M2', tx: 89, ty: 117, area: 'maintenance', minWave: 1 },
];

export type StationPlacement =
  | { type: 'weapon'; weaponId: string; tx: number; ty: number }
  | { type: 'ammo'; tx: number; ty: number };

export const STATIONS: StationPlacement[] = [
  { type: 'weapon', weaponId: 'glock', tx: 56, ty: 40 },
  { type: 'ammo', tx: 71, ty: 40 },
  { type: 'weapon', weaponId: 'mp5', tx: 26, ty: 74 },
  { type: 'weapon', weaponId: 'pump', tx: 18, ty: 60 },
  { type: 'weapon', weaponId: 'vector', tx: 99, ty: 62 },
  { type: 'weapon', weaponId: 'm4', tx: 110, ty: 74 },
  { type: 'ammo', tx: 90, ty: 74 },
  { type: 'weapon', weaponId: 'ak', tx: 52, ty: 22 },
  { type: 'ammo', tx: 76, ty: 22 },
  { type: 'weapon', weaponId: 'combat_shotgun', tx: 66.5, ty: 6 },
  { type: 'ammo', tx: 48, ty: 92 },
];

export type MachinePlacement =
  | { type: 'mystery_box'; tx: number; ty: number }
  | { type: 'weapon_lab'; tx: number; ty: number }
  | { type: 'perk'; perkId: 'fortify' | 'quick_hands' | 'sprint' | 'deadeye' | 'adrenaline' | 'overload' | 'quick_revive'; tx: number; ty: number };

/** Máquinas (GDD §37–40): a Mystery Box no Hall, o Weapon Lab na Manutenção e um perk por área. */
export const MACHINES: MachinePlacement[] = [
  { type: 'mystery_box', tx: 69, ty: 30 },
  { type: 'weapon_lab', tx: 56, ty: 111 },
  { type: 'perk', perkId: 'fortify', tx: 42, ty: 40 },
  // Quick Revive no Hall, perto do início (como no CoD Zombies)
  { type: 'perk', perkId: 'quick_revive', tx: 85, ty: 40 },
  { type: 'perk', perkId: 'quick_hands', tx: 41, ty: 69 },
  { type: 'perk', perkId: 'sprint', tx: 108, ty: 59 },
  { type: 'perk', perkId: 'deadeye', tx: 18, ty: 20 },
  { type: 'perk', perkId: 'adrenaline', tx: 82, ty: 82 },
  { type: 'perk', perkId: 'overload', tx: 90, ty: 112 },
];

/**
 * Locais por onde a Mystery Box passa (um por área). Ela começa no primeiro e, a cada
 * N usos, some e reaparece em outro local de uma área aberta.
 */
export const BOX_SPOTS: Array<{ tx: number; ty: number; area: AreaId }> = [
  { tx: 69, ty: 30, area: 'hall' },
  // Outros pontos no próprio Hall: a caixa muda de lugar mesmo sem outras áreas abertas.
  { tx: 53, ty: 29.6, area: 'hall' },
  { tx: 85, ty: 36, area: 'hall' },
  { tx: 64, ty: 54, area: 'hall' },
  { tx: 46, ty: 21, area: 'platform' },
  { tx: 35, ty: 74, area: 'ticket' },
  { tx: 108, ty: 71, area: 'shops' },
  { tx: 80, ty: 88.5, area: 'tech' },
  { tx: 58, ty: 99.5, area: 'tunnels' },
  { tx: 64, ty: 111, area: 'maintenance' },
];

/** Onde o boss surge (e volta se ficar preso): o centro do Hall, amplo e sempre aberto. */
export const BOSS_SPAWNS: Array<{ tx: number; ty: number }> = [
  { tx: 64, ty: 44 },
  { tx: 55, ty: 42 },
  { tx: 73, ty: 42 },
  { tx: 64, ty: 49 },
];

/** Painéis e armadilhas interativos (posição do painel; zona da armadilha em tiles). */
export type MapInteractionDef =
  | { type: 'power' | 'alarm' | 'train'; tx: number; ty: number }
  | { type: 'trap'; tx: number; ty: number; zone: Rect };

export const INTERACTIONS: MapInteractionDef[] = [
  // Área Técnica: religa a energia durante um Apagão
  { type: 'power', tx: 32.4, ty: 86 },
  // Hall: desliga o Alarme de Emergência
  { type: 'alarm', tx: 46, ty: 28.7 },
  // Plataforma: chama o trem
  { type: 'train', tx: 55, ty: 16.4 },
  // Armadilha elétrica logo abaixo da porta Hall ↔ Plataforma
  { type: 'trap', tx: 60, ty: 28.7, zone: { x: 61, y: 28, w: 6, h: 2 } },
  // Armadilha elétrica no corredor de baixo dos Túneis
  { type: 'trap', tx: 41.4, ty: 103.3, zone: { x: 45, y: 103, w: 5, h: 5 } },
];

export const PROPS: Array<{ type: PropType; tx: number; ty: number; angle?: number }> = [
  // Hall
  { type: 'bench', tx: 52, ty: 46 },
  { type: 'bench', tx: 76, ty: 46 },
  { type: 'bench', tx: 58, ty: 52 },
  { type: 'bench', tx: 70, ty: 52 },
  { type: 'trash', tx: 45, ty: 30 },
  { type: 'trash', tx: 83, ty: 30 },
  { type: 'trash', tx: 45, ty: 54 },
  { type: 'trash', tx: 83, ty: 54 },
  { type: 'suitcase', tx: 60, ty: 45, angle: 25 },
  // Plataforma
  { type: 'bench', tx: 36, ty: 23 },
  { type: 'bench', tx: 88, ty: 23 },
  { type: 'bench', tx: 104, ty: 23 },
  { type: 'trash', tx: 24, ty: 24 },
  { type: 'trash', tx: 70, ty: 24 },
  { type: 'suitcase', tx: 40, ty: 20, angle: -30 },
  { type: 'suitcase', tx: 90, ty: 21, angle: 60 },
  { type: 'wagon_seat', tx: 59.5, ty: 5 },
  { type: 'wagon_seat', tx: 59.5, ty: 7 },
  { type: 'wagon_seat', tx: 68.5, ty: 7 },
  // Bilheteria
  { type: 'trash', tx: 14, ty: 76 },
  { type: 'trash', tx: 42, ty: 76 },
  { type: 'suitcase', tx: 30, ty: 70, angle: 10 },
  { type: 'barrel', tx: 38, ty: 60 },
  // Lojas
  { type: 'crate', tx: 86, ty: 59 },
  { type: 'crate', tx: 87.2, ty: 60.2 },
  { type: 'crate', tx: 113, ty: 59 },
  { type: 'trash', tx: 100, ty: 76 },
  { type: 'bench', tx: 104, ty: 74 },
  // Área técnica
  { type: 'generator', tx: 30, ty: 86 },
  { type: 'generator', tx: 62, ty: 84 },
  { type: 'generator', tx: 94, ty: 90 },
  { type: 'crate', tx: 48, ty: 82 },
  { type: 'crate', tx: 49.2, ty: 83 },
  { type: 'crate', tx: 80, ty: 92 },
  { type: 'barrel', tx: 66, ty: 92 },
  { type: 'barrel', tx: 67.1, ty: 91 },
  { type: 'barrel', tx: 100, ty: 86 },
  // Túneis
  { type: 'barrel', tx: 30, ty: 100 },
  { type: 'barrel', tx: 98, ty: 105 },
  { type: 'crate', tx: 58, ty: 105 },
  // Manutenção
  { type: 'generator', tx: 54, ty: 116 },
  { type: 'crate', tx: 70, ty: 111 },
  { type: 'crate', tx: 71.2, ty: 112 },
  { type: 'barrel', tx: 86, ty: 116 },

  // ── Props extras (GDD §52) ──
  // Hall: carrinhos de bagagem, placas de saída, extintores
  { type: 'luggage_cart', tx: 46.5, ty: 51 },
  { type: 'luggage_cart', tx: 81.5, ty: 42 },
  { type: 'sign_stand', tx: 57.5, ty: 30.5 },
  { type: 'sign_stand', tx: 83, ty: 50.5 },
  { type: 'extinguisher', tx: 40.3, ty: 44 },
  { type: 'extinguisher', tx: 87.2, ty: 38 },
  { type: 'cables', tx: 72, ty: 54.4, angle: 4 },
  // Plataforma: barreiras na borda dos trilhos e placas
  { type: 'barrier', tx: 19.5, ty: 16.6 },
  { type: 'barrier', tx: 107.5, ty: 16.6 },
  { type: 'sign_stand', tx: 36, ty: 17.5 },
  { type: 'sign_stand', tx: 92, ty: 17.5 },
  // Ilha entre os trilhos
  { type: 'bench', tx: 40, ty: 10 },
  { type: 'bench', tx: 88, ty: 10 },
  { type: 'trash', tx: 50, ty: 9.6 },
  { type: 'suitcase', tx: 78, ty: 10.2, angle: 15 },
  { type: 'extinguisher', tx: 16.3, ty: 24 },
  // Bilheteria: guichês com computadores e cadeiras
  { type: 'desk_computer', tx: 25.5, ty: 62.3 },
  { type: 'desk_computer', tx: 33.5, ty: 62.3 },
  { type: 'chair', tx: 25.5, ty: 60.3, angle: 180 },
  { type: 'chair', tx: 33.5, ty: 60.4, angle: 170 },
  { type: 'chair', tx: 16, ty: 70, angle: 40 },
  { type: 'sign_stand', tx: 21, ty: 76.5 },
  // Lojas: vitrines
  { type: 'vitrine', tx: 89, ty: 66 },
  { type: 'vitrine', tx: 99, ty: 66 },
  { type: 'vitrine', tx: 111, ty: 66 },
  { type: 'extinguisher', tx: 84.3, ty: 71 },
  // Área técnica: armários, cabos, tubulação
  { type: 'locker', tx: 34.5, ty: 81.4 },
  { type: 'locker', tx: 67, ty: 81.4 },
  { type: 'cables', tx: 50, ty: 91, angle: -8 },
  { type: 'cables', tx: 84, ty: 88.5, angle: 12 },
  { type: 'floor_pipe', tx: 64, ty: 94.4 },
  { type: 'floor_pipe', tx: 97, ty: 94.4 },
  { type: 'extinguisher', tx: 57.3, ty: 82 },
  // Túneis: barreiras e cabos
  { type: 'barrier', tx: 44, ty: 105.5 },
  { type: 'barrier', tx: 86, ty: 99.5 },
  { type: 'cables', tx: 70, ty: 100.5 },
  { type: 'cables', tx: 30, ty: 106, angle: 180 },
  // Manutenção: paletes, armários, tubulação
  { type: 'pallet', tx: 40.5, ty: 116.5 },
  { type: 'pallet', tx: 76, ty: 116.5 },
  { type: 'locker', tx: 46.5, ty: 110.6 },
  { type: 'floor_pipe', tx: 64, ty: 117.6 },
  { type: 'extinguisher', tx: 36.3, ty: 113 },
];

export interface LampDef {
  tx: number;
  ty: number;
  radius: number;
  intensity: number;
  flicker: number;
}

export const LAMPS: LampDef[] = [
  // Hall
  { tx: 52, ty: 38, radius: 210, intensity: 0.72, flicker: 0.1 },
  { tx: 76, ty: 38, radius: 210, intensity: 0.7, flicker: 0.2 },
  { tx: 64, ty: 50, radius: 230, intensity: 0.75, flicker: 0.05 },
  { tx: 64, ty: 30, radius: 160, intensity: 0.5, flicker: 0.5 },
  // Plataforma
  { tx: 30, ty: 21, radius: 200, intensity: 0.65, flicker: 0.2 },
  { tx: 52, ty: 21, radius: 200, intensity: 0.6, flicker: 0.1 },
  { tx: 76, ty: 21, radius: 200, intensity: 0.6, flicker: 0.5 },
  { tx: 98, ty: 21, radius: 200, intensity: 0.65, flicker: 0.15 },
  // Ilha entre os trilhos
  { tx: 34, ty: 10, radius: 170, intensity: 0.5, flicker: 0.3 },
  { tx: 64, ty: 10, radius: 170, intensity: 0.55, flicker: 0.1 },
  { tx: 94, ty: 10, radius: 170, intensity: 0.5, flicker: 0.6 },
  // Bilheteria
  { tx: 20, ty: 61, radius: 170, intensity: 0.55, flicker: 0.3 },
  { tx: 34, ty: 72, radius: 180, intensity: 0.6, flicker: 0.6 },
  // Lojas
  { tx: 89, ty: 62, radius: 140, intensity: 0.5, flicker: 0.2 },
  { tx: 99, ty: 62, radius: 140, intensity: 0.45, flicker: 0.8 },
  { tx: 109, ty: 62, radius: 140, intensity: 0.5, flicker: 0.3 },
  { tx: 100, ty: 73, radius: 180, intensity: 0.5, flicker: 0.4 },
  // Área técnica
  { tx: 32, ty: 84, radius: 150, intensity: 0.55, flicker: 0.2 },
  { tx: 64, ty: 88, radius: 160, intensity: 0.6, flicker: 0.6 },
  { tx: 96, ty: 84, radius: 150, intensity: 0.5, flicker: 0.3 },
  // Túneis
  { tx: 40, ty: 100, radius: 120, intensity: 0.45, flicker: 0.7 },
  { tx: 88, ty: 105, radius: 120, intensity: 0.45, flicker: 0.5 },
  // Manutenção
  { tx: 50, ty: 114, radius: 180, intensity: 0.6, flicker: 0.2 },
  { tx: 78, ty: 114, radius: 180, intensity: 0.6, flicker: 0.4 },
];

/** Bordas das plataformas que dão para os trilhos (faixa tátil amarela). y em tiles; `down` = trilho abaixo. */
export const PLATFORM_EDGES: Array<{ x: number; y: number; w: number; down: boolean }> = [
  { x: 16, y: 9, w: 96, down: false },
  { x: 16, y: 12, w: 96, down: true },
  { x: 16, y: 16, w: 96, down: false },
];

/** Unidades de ar-condicionado sobre o teto do trem (decoração). */
export const TRAIN_ROOF_UNITS: Array<{ tx: number; ty: number }> = [
  { tx: 30, ty: 6 }, { tx: 40, ty: 6 }, { tx: 48, ty: 6 }, { tx: 78, ty: 6 }, { tx: 88, ty: 6 }, { tx: 97, ty: 6 },
];
