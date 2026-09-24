/**
 * Manifesto de assets. Os SVGs são gerados por `npm run art` (scripts/generate-art.mjs)
 * e podem ser substituídos por PNGs com o mesmo layout de frames.
 */
import type { WeaponKind } from './weapons.config';

export interface SheetAsset {
  key: string;
  url: string;
  frameWidth: number;
  frameHeight: number;
  frames: number;
  /** Frames por linha (padrão: todos numa linha só). */
  columns?: number;
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

/** Aparências de zumbi: tamanho do frame (o Tank é maior) e se deixam cadáver. */
export const ZOMBIE_SKINS = {
  a: { frame: 128, corpse: true },
  b: { frame: 128, corpse: true },
  c: { frame: 128, corpse: true },
  runner: { frame: 128, corpse: true },
  tank: { frame: 176, corpse: true },
  exploder: { frame: 128, corpse: false },
} as const;
export type ZombieSkin = keyof typeof ZOMBIE_SKINS;
export const ZOMBIE_SKIN_IDS = Object.keys(ZOMBIE_SKINS) as ZombieSkin[];
/** Ordem dos frames em corpses.svg. */
export const CORPSE_SKINS = ZOMBIE_SKIN_IDS.filter((s) => ZOMBIE_SKINS[s].corpse);

export const ASSET_KEYS = {
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
  ammoCrate: 'ammo_crate',
  generator: 'prop_generator',
  wagonSeat: 'prop_wagon_seat',
  floorConcrete: 'floor_concrete',
  floorMetal: 'floor_metal',
  floorTracks: 'floor_tracks',
  floorTunnel: 'floor_tunnel',
  tunnelMouth: 'tunnel_mouth',
  railSignal: 'rail_signal',
  departureBoard: 'departure_board',
  floorWagon: 'floor_wagon',
  tactile: 'tactile_strip',
  trainCap: 'train_cap',
  trainFull: 'train_full',
  trainRoofUnit: 'train_roof_unit',
  doorShutter: 'door_shutter',
  hazard: 'hazard_stripe',
  plank: 'plank',
  windowSill: 'window_sill',
  papers: 'decal_papers',
  debris: 'decal_debris',
  bloodSplats: 'decal_blood_splats',
  bloodPool: 'decal_blood_pool',
  burst: 'decal_burst',
  extinguisher: 'prop_extinguisher',
  luggageCart: 'prop_luggage_cart',
  pallet: 'prop_pallet',
  signStand: 'prop_sign_stand',
  deskComputer: 'prop_desk_computer',
  chair: 'prop_chair',
  locker: 'prop_locker',
  barrier: 'prop_barrier',
  cables: 'prop_cables',
  floorPipe: 'prop_floor_pipe',
  vitrine: 'prop_vitrine',
  panelPower: 'prop_panel_power',
  panelAlarm: 'prop_panel_alarm',
  panelTrain: 'prop_panel_train',
  panelTrap: 'prop_panel_trap',
  trapGrate: 'prop_trap_grate',
  teddy: 'prop_teddy',
  radio: 'prop_radio',
  trainHead: 'event_train_head',
  trainCar: 'event_train_car',
  supplyCrate: 'event_supply_crate',
  parachute: 'event_parachute',
  gasPipe: 'event_gas_pipe',
} as const;

export const WEAPON_KINDS: WeaponKind[] = ['pistol', 'smg', 'rifle', 'ak', 'shotgun', 'launcher', 'flamer', 'arc', 'energy'];

/** Tronco do jogador por tipo de arma (mesma ordem de frames em todas). */
export const playerTorsoKey = (kind: WeaponKind): string => `player_torso_${kind}`;
export const playerAnimKey = (kind: WeaponKind, anim: 'shoot' | 'reload'): string => `player_${anim}_${kind}`;
export const weaponCaseKey = (kind: WeaponKind): string => `case_${kind}`;
export const gunIconKey = (kind: WeaponKind): string => `gun_${kind}`;

export const PERK_IDS = ['fortify', 'quick_hands', 'sprint', 'deadeye', 'adrenaline', 'overload'] as const;
export const perkIconKey = (id: string): string => `perk_icon_${id}`;

export const POWERUP_IDS = ['max_ammo', 'double_cash', 'insta_kill', 'nuke', 'full_heal', 'armor', 'speed_boost', 'golden'] as const;
export const powerUpKey = (id: string): string => `powerup_${id}`;

export const machineKeys = {
  mysteryBox: 'machine_mystery_box',
  weaponLab: 'machine_weapon_lab',
  perk: (id: string): string => `machine_perk_${id}`,
};

/**
 * Ponta do cano em relação ao centro do jogador (px do mundo): à frente e ao lado,
 * conforme cada pose. Usado para posicionar tiro, clarão e luz.
 */
export const WEAPON_MUZZLE: Record<WeaponKind, { forward: number; side: number }> = {
  pistol: { forward: 25, side: 0 },
  smg: { forward: 23, side: 3 },
  rifle: { forward: 29, side: 3 },
  ak: { forward: 28, side: 3 },
  shotgun: { forward: 29, side: 3 },
  launcher: { forward: 29, side: 3 },
  flamer: { forward: 31, side: 3 },
  arc: { forward: 30, side: 3 },
  energy: { forward: 31, side: 3 },
};

export const zombieSheetKey = (skin: string): string => `zombie_${skin}`;
export const bossSheetKey = (id: string): string => `boss_${id}`;
export const bossCorpseKey = (id: string): string => `boss_${id}_corpse`;
export const bossAnimKey = (id: string, anim: 'walk' | 'swipe' | 'charge' | 'slam' | 'roar'): string => `boss_${id}_${anim}`;
/** Cabeça grande do easter egg "modo cabeção". */
export const zombieBigHeadKey = (skin: string): string => `big_head_${skin}`;
export const zombieAnimKey = (skin: string, anim: 'walk' | 'attack'): string => `zombie_${skin}_${anim}`;

export const PLAYER_FRAMES = {
  aim: 0,
  recoil: 1,
  reloadStart: 2,
  reloadEnd: 6,
} as const;

export const ANIM_KEYS = {
  playerLegsWalk: 'player_legs_walk',
} as const;

const CHAR = 128;

export const SHEETS: SheetAsset[] = [
  ...WEAPON_KINDS.map((kind) => ({
    key: playerTorsoKey(kind),
    url: `assets/player/player_torso_${kind}.svg`,
    frameWidth: CHAR,
    frameHeight: CHAR,
    frames: 7,
  })),
  { key: ASSET_KEYS.playerLegs, url: 'assets/player/player_legs.svg', frameWidth: CHAR, frameHeight: CHAR, frames: 8 },
  ...ZOMBIE_SKIN_IDS.map((skin) => ({
    key: zombieSheetKey(skin),
    url: `assets/zombies/zombie_${skin}.svg`,
    frameWidth: ZOMBIE_SKINS[skin].frame,
    frameHeight: ZOMBIE_SKINS[skin].frame,
    frames: 13,
  })),
  { key: ASSET_KEYS.corpses, url: 'assets/zombies/corpses.svg', frameWidth: 176, frameHeight: 144, frames: CORPSE_SKINS.length },
  { key: ASSET_KEYS.bloodSplats, url: 'assets/particles/blood_splats.svg', frameWidth: 96, frameHeight: 96, frames: 3 },
  // The Conductor: 20 frames em grade 10x2 (andar, golpe, investida, pancada, rugido)
  { key: bossSheetKey('conductor'), url: 'assets/bosses/conductor.svg', frameWidth: 224, frameHeight: 224, frames: 20, columns: 10 },
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
  { key: ASSET_KEYS.ammoCrate, url: 'assets/weapons/ammo_crate.svg' },
  { key: ASSET_KEYS.generator, url: 'assets/props/generator.svg' },
  { key: ASSET_KEYS.wagonSeat, url: 'assets/props/wagon_seat.svg' },
  { key: ASSET_KEYS.floorConcrete, url: 'assets/map/floor_concrete.svg' },
  { key: ASSET_KEYS.floorMetal, url: 'assets/map/floor_metal.svg' },
  { key: ASSET_KEYS.floorTracks, url: 'assets/map/floor_tracks.svg' },
  { key: ASSET_KEYS.floorTunnel, url: 'assets/map/floor_tunnel.svg' },
  { key: ASSET_KEYS.tunnelMouth, url: 'assets/map/tunnel_mouth.svg' },
  { key: ASSET_KEYS.railSignal, url: 'assets/map/rail_signal.svg' },
  { key: ASSET_KEYS.departureBoard, url: 'assets/map/departure_board.svg' },
  { key: ASSET_KEYS.floorWagon, url: 'assets/map/floor_wagon.svg' },
  { key: ASSET_KEYS.tactile, url: 'assets/map/tactile_strip.svg' },
  { key: ASSET_KEYS.trainCap, url: 'assets/map/train_cap.svg' },
  { key: ASSET_KEYS.trainFull, url: 'assets/map/train_full.svg' },
  { key: ASSET_KEYS.trainRoofUnit, url: 'assets/map/train_roof_unit.svg' },
  { key: ASSET_KEYS.doorShutter, url: 'assets/map/door_shutter.svg' },
  { key: ASSET_KEYS.hazard, url: 'assets/map/hazard_stripe.svg' },
  { key: ASSET_KEYS.plank, url: 'assets/map/plank.svg' },
  { key: ASSET_KEYS.windowSill, url: 'assets/map/window_sill.svg' },
  ...WEAPON_KINDS.map((kind) => ({ key: weaponCaseKey(kind), url: `assets/weapons/case_${kind}.svg` })),
  ...WEAPON_KINDS.map((kind) => ({ key: gunIconKey(kind), url: `assets/weapons/gun_${kind}.svg` })),
  { key: machineKeys.mysteryBox, url: 'assets/machines/mystery_box.svg' },
  { key: machineKeys.weaponLab, url: 'assets/machines/weapon_lab.svg' },
  ...PERK_IDS.map((id) => ({ key: machineKeys.perk(id), url: `assets/machines/perk_${id}.svg` })),
  ...PERK_IDS.map((id) => ({ key: perkIconKey(id), url: `assets/ui/perk_icon_${id}.svg` })),
  ...POWERUP_IDS.map((id) => ({ key: powerUpKey(id), url: `assets/powerups/${id}.svg` })),
  { key: ASSET_KEYS.papers, url: 'assets/particles/papers.svg' },
  { key: ASSET_KEYS.debris, url: 'assets/particles/debris.svg' },
  { key: ASSET_KEYS.bloodPool, url: 'assets/particles/blood_pool.svg' },
  { key: ASSET_KEYS.burst, url: 'assets/particles/burst.svg' },
  { key: bossCorpseKey('conductor'), url: 'assets/bosses/conductor_corpse.svg' },
  { key: ASSET_KEYS.extinguisher, url: 'assets/props/extinguisher.svg' },
  { key: ASSET_KEYS.luggageCart, url: 'assets/props/luggage_cart.svg' },
  { key: ASSET_KEYS.pallet, url: 'assets/props/pallet.svg' },
  { key: ASSET_KEYS.signStand, url: 'assets/props/sign_stand.svg' },
  { key: ASSET_KEYS.deskComputer, url: 'assets/props/desk_computer.svg' },
  { key: ASSET_KEYS.chair, url: 'assets/props/chair.svg' },
  { key: ASSET_KEYS.locker, url: 'assets/props/locker.svg' },
  { key: ASSET_KEYS.barrier, url: 'assets/props/barrier.svg' },
  { key: ASSET_KEYS.cables, url: 'assets/props/cables.svg' },
  { key: ASSET_KEYS.floorPipe, url: 'assets/props/floor_pipe.svg' },
  { key: ASSET_KEYS.vitrine, url: 'assets/props/vitrine.svg' },
  { key: ASSET_KEYS.panelPower, url: 'assets/props/panel_power.svg' },
  { key: ASSET_KEYS.panelAlarm, url: 'assets/props/panel_alarm.svg' },
  { key: ASSET_KEYS.panelTrain, url: 'assets/props/panel_train.svg' },
  { key: ASSET_KEYS.panelTrap, url: 'assets/props/panel_trap.svg' },
  { key: ASSET_KEYS.trapGrate, url: 'assets/props/trap_grate.svg' },
  { key: ASSET_KEYS.teddy, url: 'assets/props/teddy.svg' },
  ...ZOMBIE_SKIN_IDS.map((skin) => ({ key: zombieBigHeadKey(skin), url: `assets/zombies/big_head_${skin}.svg` })),
  { key: ASSET_KEYS.radio, url: 'assets/props/radio.svg' },
  { key: ASSET_KEYS.trainHead, url: 'assets/events/train_head.svg' },
  { key: ASSET_KEYS.trainCar, url: 'assets/events/train_car.svg' },
  { key: ASSET_KEYS.supplyCrate, url: 'assets/events/supply_crate.svg' },
  { key: ASSET_KEYS.parachute, url: 'assets/events/parachute.svg' },
  { key: ASSET_KEYS.gasPipe, url: 'assets/events/gas_pipe.svg' },
];

const range = (from: number, to: number): number[] =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

export const ANIMS: AnimAsset[] = [
  { key: ANIM_KEYS.playerLegsWalk, sheet: ASSET_KEYS.playerLegs, frames: range(0, 7), frameRate: 12, repeat: -1 },
  ...WEAPON_KINDS.flatMap((kind) => [
    {
      key: playerAnimKey(kind, 'shoot'),
      sheet: playerTorsoKey(kind),
      frames: [PLAYER_FRAMES.recoil, PLAYER_FRAMES.aim],
      frameRate: 18,
      repeat: 0,
    },
    {
      key: playerAnimKey(kind, 'reload'),
      sheet: playerTorsoKey(kind),
      frames: [...range(PLAYER_FRAMES.reloadStart, PLAYER_FRAMES.reloadEnd), PLAYER_FRAMES.aim],
      frameRate: 5,
      repeat: 0,
    },
  ]),
  { key: bossAnimKey('conductor', 'walk'), sheet: bossSheetKey('conductor'), frames: range(0, 7), frameRate: 8, repeat: -1 },
  { key: bossAnimKey('conductor', 'swipe'), sheet: bossSheetKey('conductor'), frames: range(8, 11), frameRate: 10, repeat: 0 },
  { key: bossAnimKey('conductor', 'charge'), sheet: bossSheetKey('conductor'), frames: range(12, 13), frameRate: 10, repeat: -1 },
  { key: bossAnimKey('conductor', 'slam'), sheet: bossSheetKey('conductor'), frames: range(14, 17), frameRate: 8, repeat: 0 },
  { key: bossAnimKey('conductor', 'roar'), sheet: bossSheetKey('conductor'), frames: range(18, 19), frameRate: 6, repeat: -1 },
  ...ZOMBIE_SKIN_IDS.flatMap((skin) => [
    { key: zombieAnimKey(skin, 'walk'), sheet: zombieSheetKey(skin), frames: range(0, 7), frameRate: 7, repeat: -1 },
    { key: zombieAnimKey(skin, 'attack'), sheet: zombieSheetKey(skin), frames: range(8, 12), frameRate: 14, repeat: 0 },
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
  grenade: 'fx_grenade',
  flame: 'fx_flame',
  plasma: 'fx_plasma',
} as const;
