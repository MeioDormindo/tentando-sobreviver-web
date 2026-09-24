import type { MapId } from '../config/maps.config';
import { TERMINAL_LAYOUT } from './terminal/layout';
import type { MapLayout } from './types';

/** Layout de cada mapa jogável. Mapas ainda sem conteúdo não aparecem aqui. */
export const LAYOUTS: Partial<Record<MapId, MapLayout>> = {
  terminal: TERMINAL_LAYOUT,
};

/** Layout do mapa pedido (o Terminal se o mapa ainda não existir). */
export function layoutFor(id: MapId): MapLayout {
  return LAYOUTS[id] ?? TERMINAL_LAYOUT;
}
