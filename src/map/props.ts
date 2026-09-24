import { ASSET_KEYS } from '../config/assets.config';

export type PropType =
  | 'bench' | 'crate' | 'barrel' | 'trash' | 'suitcase' | 'generator' | 'wagon_seat'
  | 'extinguisher' | 'luggage_cart' | 'pallet' | 'sign_stand' | 'desk_computer' | 'chair'
  | 'locker' | 'barrier' | 'cables' | 'floor_pipe' | 'vitrine'
  // Hospital
  | 'hospital_bed' | 'wheelchair' | 'iv_stand' | 'gurney' | 'med_cabinet' | 'morgue_drawers'
  | 'lab_bench' | 'vending' | 'surgical_light' | 'waiting_chairs';

export interface PropDef {
  texture: string;
  /** Corpo de colisão (px do mundo), relativo ao centro da imagem. Ausente = decorativo. */
  body?: { w: number; h: number; ox: number; oy: number };
  /** Projéteis param nesse prop (cobertura). */
  blocksBullets: boolean;
  /** Luz própria (tela, placa luminosa, vitrine). */
  light?: { radius: number; intensity: number; color: number };
}

export const PROP_DEFS: Record<PropType, PropDef> = {
  bench: { texture: ASSET_KEYS.bench, body: { w: 64, h: 24, ox: -1, oy: -1.5 }, blocksBullets: false },
  crate: { texture: ASSET_KEYS.crate, body: { w: 30, h: 30, ox: -1, oy: -1 }, blocksBullets: true },
  barrel: { texture: ASSET_KEYS.barrel, body: { w: 25, h: 25, ox: -1, oy: -1 }, blocksBullets: true },
  trash: { texture: ASSET_KEYS.trash, body: { w: 22, h: 22, ox: -1, oy: -1 }, blocksBullets: true },
  suitcase: { texture: ASSET_KEYS.suitcase, blocksBullets: false },
  generator: { texture: ASSET_KEYS.generator, body: { w: 48, h: 30, ox: -2, oy: -2 }, blocksBullets: true },
  wagon_seat: { texture: ASSET_KEYS.wagonSeat, blocksBullets: false },
  extinguisher: { texture: ASSET_KEYS.extinguisher, body: { w: 18, h: 18, ox: 0, oy: 0 }, blocksBullets: false },
  luggage_cart: { texture: ASSET_KEYS.luggageCart, body: { w: 58, h: 30, ox: 0, oy: 0 }, blocksBullets: false },
  pallet: { texture: ASSET_KEYS.pallet, body: { w: 40, h: 40, ox: 0, oy: 0 }, blocksBullets: true },
  sign_stand: {
    texture: ASSET_KEYS.signStand, body: { w: 40, h: 12, ox: 0, oy: 0 }, blocksBullets: false,
    light: { radius: 70, intensity: 0.4, color: 0x5ce08a },
  },
  desk_computer: {
    texture: ASSET_KEYS.deskComputer, body: { w: 58, h: 32, ox: 0, oy: 0 }, blocksBullets: true,
    light: { radius: 60, intensity: 0.35, color: 0x6fc0e8 },
  },
  chair: { texture: ASSET_KEYS.chair, blocksBullets: false },
  locker: { texture: ASSET_KEYS.locker, body: { w: 52, h: 22, ox: 0, oy: 0 }, blocksBullets: true },
  barrier: { texture: ASSET_KEYS.barrier, body: { w: 60, h: 14, ox: 0, oy: 0 }, blocksBullets: true },
  cables: { texture: ASSET_KEYS.cables, blocksBullets: false },
  floor_pipe: { texture: ASSET_KEYS.floorPipe, blocksBullets: false },
  vitrine: {
    texture: ASSET_KEYS.vitrine, body: { w: 60, h: 30, ox: 0, oy: 0 }, blocksBullets: false,
    light: { radius: 75, intensity: 0.4, color: 0xffe0a8 },
  },
  // Hospital
  hospital_bed: { texture: ASSET_KEYS.hospitalBed, body: { w: 62, h: 32, ox: 0, oy: 0 }, blocksBullets: false },
  wheelchair: { texture: ASSET_KEYS.wheelchair, body: { w: 26, h: 26, ox: 1, oy: 1 }, blocksBullets: false },
  iv_stand: { texture: ASSET_KEYS.ivStand, blocksBullets: false },
  gurney: { texture: ASSET_KEYS.gurney, body: { w: 58, h: 22, ox: 0, oy: 0 }, blocksBullets: false },
  med_cabinet: { texture: ASSET_KEYS.medCabinet, body: { w: 54, h: 20, ox: 0, oy: 0 }, blocksBullets: true },
  morgue_drawers: { texture: ASSET_KEYS.morgueDrawers, body: { w: 94, h: 26, ox: 0, oy: 0 }, blocksBullets: true },
  lab_bench: {
    texture: ASSET_KEYS.labBench, body: { w: 78, h: 28, ox: 0, oy: 0 }, blocksBullets: true,
    light: { radius: 80, intensity: 0.4, color: 0x6fe0d8 },
  },
  vending: {
    texture: ASSET_KEYS.vending, body: { w: 38, h: 26, ox: 0, oy: 0 }, blocksBullets: true,
    light: { radius: 70, intensity: 0.4, color: 0xbfe4ff },
  },
  surgical_light: { texture: ASSET_KEYS.surgicalLight, blocksBullets: false, light: { radius: 150, intensity: 0.6, color: 0xe8f6ff } },
  waiting_chairs: { texture: ASSET_KEYS.waitingChairs, body: { w: 78, h: 18, ox: 0, oy: 0 }, blocksBullets: false },
};
