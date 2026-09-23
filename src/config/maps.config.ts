/** Mapas do jogo e como cada um é liberado. */
export type MapId = 'terminal' | 'map2';

export interface MapInfo {
  id: MapId;
  name: string;
  description: string;
  /** Já tem conteúdo jogável (o Mapa 2 ainda está em desenvolvimento). */
  playable: boolean;
  /** Condição para liberar: derrotar o boss de uma wave em outro mapa (null = livre). */
  unlock: { bossWave: number; onMap: MapId } | null;
}

export const MAPS: Record<MapId, MapInfo> = {
  terminal: {
    id: 'terminal',
    name: 'Terminal Central',
    description: 'Estação de trem abandonada: hall, plataforma, lojas, túneis e manutenção.',
    playable: true,
    unlock: null,
  },
  map2: {
    id: 'map2',
    name: 'Mapa 2',
    description: 'Um novo lugar para sobreviver. Em desenvolvimento.',
    playable: false,
    unlock: { bossWave: 10, onMap: 'terminal' },
  },
};

export const MAP_IDS = Object.keys(MAPS) as MapId[];
export const DEFAULT_MAP: MapId = 'terminal';

/** Quantas posições o ranking de cada mapa guarda. */
export const RANKING_SIZE = 10;
export const PLAYER_NAME_MAX = 14;
