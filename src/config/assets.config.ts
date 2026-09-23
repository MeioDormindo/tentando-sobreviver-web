/**
 * Manifesto de assets. Os SVGs são gerados por `npm run art` (scripts/generate-art.mjs)
 * e podem ser substituídos por PNGs com o mesmo layout de frames.
 */

export interface SheetAsset {
  key: string;
  url: string;
  frameWidth: number;
  frameHeight: number;
  frames: number;
}

export interface ImageAsset {
  key: string;
  url: string;
}

export interface AnimAsset {
  key: string;
  sheet: string;
  frames: number[];
  frameRate: number;
  repeat: number;
}

export const ZOMBIE_VARIANTS = ['a', 'b', 'c'] as const;
export type ZombieVariant = (typeof ZOMBIE_VARIANTS)[number];

export const ASSET_KEYS = {
  playerTorso: 'player_torso',
  playerLegs: 'player_legs',
  corpses: 'corpses',
  shadow: 'shadow',
  floor: 'floor_terminal',
  wallFull: 'wall_full',
  wallCap: 'wall_cap',
  wallShadow: 'wall_shadow',
  bench: 'prop_bench',
  crate: 'prop_crate',
  barrel: 'prop_barrel',
  trash: 'prop_trash',
  suitcase: 'prop_suitcase',
  papers: 'decal_papers',
  debris: 'decal_debris',
  bloodSplats: 'decal_blood_splats',
  bloodPool: 'decal_blood_pool',
} as const;

export const zombieSheetKey = (v: ZombieVariant): string => `walker_${v}`;
export const zombieAnimKey = (v: ZombieVariant, anim: 'walk' | 'attack'): string => `walker_${v}_${anim}`;

export const PLAYER_FRAMES = {
  aim: 0,
  recoil: 1,
  reloadStart: 2,
  reloadEnd: 6,
} as const;

export const ANIM_KEYS = {
  playerLegsWalk: 'player_legs_walk',
  playerShoot: 'player_shoot',
  playerReload: 'player_reload',
} as const;

const CHAR = 128;

export const SHEETS: SheetAsset[] = [
  { key: ASSET_KEYS.playerTorso, url: 'assets/player/player_torso.svg', frameWidth: CHAR, frameHeight: CHAR, frames: 7 },
  { key: ASSET_KEYS.playerLegs, url: 'assets/player/player_legs.svg', frameWidth: CHAR, frameHeight: CHAR, frames: 8 },
  ...ZOMBIE_VARIANTS.map((v) => ({
    key: zombieSheetKey(v),
    url: `assets/zombies/walker_${v}.svg`,
    frameWidth: CHAR,
    frameHeight: CHAR,
    frames: 13,
  })),
  { key: ASSET_KEYS.corpses, url: 'assets/zombies/corpses.svg', frameWidth: 176, frameHeight: 144, frames: 3 },
  { key: ASSET_KEYS.bloodSplats, url: 'assets/particles/blood_splats.svg', frameWidth: 96, frameHeight: 96, frames: 3 },
];

export const IMAGES: ImageAsset[] = [
  { key: ASSET_KEYS.shadow, url: 'assets/sprites/shadow.svg' },
  { key: ASSET_KEYS.floor, url: 'assets/map/floor_terminal.svg' },
  { key: ASSET_KEYS.wallFull, url: 'assets/map/wall_full.svg' },
  { key: ASSET_KEYS.wallCap, url: 'assets/map/wall_cap.svg' },
  { key: ASSET_KEYS.wallShadow, url: 'assets/map/wall_shadow.svg' },
  { key: ASSET_KEYS.bench, url: 'assets/props/bench.svg' },
  { key: ASSET_KEYS.crate, url: 'assets/props/crate.svg' },
  { key: ASSET_KEYS.barrel, url: 'assets/props/barrel.svg' },
  { key: ASSET_KEYS.trash, url: 'assets/props/trash.svg' },
  { key: ASSET_KEYS.suitcase, url: 'assets/props/suitcase.svg' },
  { key: ASSET_KEYS.papers, url: 'assets/particles/papers.svg' },
  { key: ASSET_KEYS.debris, url: 'assets/particles/debris.svg' },
  { key: ASSET_KEYS.bloodPool, url: 'assets/particles/blood_pool.svg' },
];

const range = (from: number, to: number): number[] =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

export const ANIMS: AnimAsset[] = [
  { key: ANIM_KEYS.playerLegsWalk, sheet: ASSET_KEYS.playerLegs, frames: range(0, 7), frameRate: 12, repeat: -1 },
  { key: ANIM_KEYS.playerShoot, sheet: ASSET_KEYS.playerTorso, frames: [PLAYER_FRAMES.recoil, PLAYER_FRAMES.aim], frameRate: 18, repeat: 0 },
  {
    key: ANIM_KEYS.playerReload,
    sheet: ASSET_KEYS.playerTorso,
    frames: [...range(PLAYER_FRAMES.reloadStart, PLAYER_FRAMES.reloadEnd), PLAYER_FRAMES.aim],
    frameRate: 5,
    repeat: 0,
  },
  ...ZOMBIE_VARIANTS.flatMap((v) => [
    { key: zombieAnimKey(v, 'walk'), sheet: zombieSheetKey(v), frames: range(0, 7), frameRate: 7, repeat: -1 },
    { key: zombieAnimKey(v, 'attack'), sheet: zombieSheetKey(v), frames: range(8, 12), frameRate: 14, repeat: 0 },
  ]),
];

/** Texturas geradas em tempo de execução (canvas): luzes e partículas. */
export const FX_KEYS = {
  lightRadial: 'fx_light_radial',
  lightCone: 'fx_light_cone',
  blood: 'fx_blood',
  spark: 'fx_spark',
  shell: 'fx_shell',
  tracer: 'fx_tracer',
  muzzle: 'fx_muzzle',
  smoke: 'fx_smoke',
} as const;
