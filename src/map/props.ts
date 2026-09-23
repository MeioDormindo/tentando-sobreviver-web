import { ASSET_KEYS } from '../config/assets.config';

export type PropType = 'bench' | 'crate' | 'barrel' | 'trash' | 'suitcase';

export interface PropDef {
  texture: string;
  /** Corpo de colisão (px do mundo), relativo ao centro da imagem. Ausente = decorativo. */
  body?: { w: number; h: number; ox: number; oy: number };
  /** Projéteis param nesse prop (cobertura). */
  blocksBullets: boolean;
}

export const PROP_DEFS: Record<PropType, PropDef> = {
  bench: { texture: ASSET_KEYS.bench, body: { w: 64, h: 24, ox: -1, oy: -1.5 }, blocksBullets: false },
  crate: { texture: ASSET_KEYS.crate, body: { w: 30, h: 30, ox: -1, oy: -1 }, blocksBullets: true },
  barrel: { texture: ASSET_KEYS.barrel, body: { w: 25, h: 25, ox: -1, oy: -1 }, blocksBullets: true },
  trash: { texture: ASSET_KEYS.trash, body: { w: 22, h: 22, ox: -1, oy: -1 }, blocksBullets: true },
  suitcase: { texture: ASSET_KEYS.suitcase, blocksBullets: false },
};

export interface PropPlacement {
  type: PropType;
  /** Posição em tiles (centro do prop). */
  tx: number;
  ty: number;
  angle?: number;
}
