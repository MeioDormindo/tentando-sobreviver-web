/**
 * Conteúdo que só existe no Godot: o Mapa 3, "O Templo dos Mortos" (mitologia grega sombria).
 * Tudo já em unidades do Godot (m, s) e gravado pelo export-data.ts (npm run godot:data) como
 * .tres, ao lado do que vem do jogo web. O jogo web não usa nada daqui.
 */

export const TEMPLE_ID = 'temple';

/** Entrada do catálogo de mapas: libera ao concluir a missão do Terminal ou do Hospital. */
export const TEMPLE_MAP = {
  id: TEMPLE_ID,
  name: 'Templo dos Mortos',
  description: 'Ruínas gregas, uma necrópole, a floresta de Artemis e o portão para o Submundo.',
  scene: 'res://scenes/maps/temple.tscn',
  unlockAchievements: ['last_train', 'serum'],
};

/** Valor de dicionário .tres: número, texto, bool, lista, StringName ({ sn }) ou objeto. */
export type GdValue = number | string | boolean | { sn: string } | GdValue[] | { [k: string]: GdValue };

// ───────────────────────── Armas ─────────────────────────

export interface GodotWeapon {
  id: string;
  display_name: string;
  kind: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  damage: number;
  fire_rate: number;
  automatic: boolean;
  magazine_size: number;
  reserve_ammo: number;
  reload_time: number;
  spread_degrees: number;
  max_range: number;
  pellets?: number;
  pierce?: number;
  headshot_multiplier?: number;
  projectile_speed?: number;
  price: number;
  ammo_price: number;
  box_only?: boolean;
  /** Mapas cuja Mystery Box pode sortear (vazio = todos). */
  maps?: string[];
  element?: string;
  upgrade_name?: string;
  tracer: number;
  special_type?: string;
  special_params?: Record<string, number>;
  /** Fora do catálogo da Mystery Box (prêmios de missão, segredo e evento). */
  prize?: boolean;
  note: string;
}

/**
 * Arsenal do Templo: tudo novo (a inicial, as de parede e as especiais de missão, segredo,
 * evento e caixa). Armas de época, que combinam com o sítio arqueológico, e as dos deuses.
 */
export const TEMPLE_WEAPONS: GodotWeapon[] = [
  { id: 'makarov', display_name: 'Makarov PM', kind: 'pistol', rarity: 'common', damage: 32, fire_rate: 4.5, automatic: false, magazine_size: 8, reserve_ammo: 88, reload_time: 1.35, spread_degrees: 2.1, max_range: 21, price: 0, ammo_price: 250, element: 'fire', tracer: 0xffd27a, note: 'Pistola inicial do Templo.' },
  { id: 'mauser_c96', display_name: 'Mauser C96', kind: 'pistol', rarity: 'common', damage: 30, fire_rate: 6.5, automatic: false, magazine_size: 10, reserve_ammo: 120, reload_time: 1.6, spread_degrees: 2.2, max_range: 22, price: 500, ammo_price: 250, element: 'shadow', maps: [TEMPLE_ID], tracer: 0xffd27a, note: 'Parede do Templo (Ruínas).' },
  { id: 'thompson', display_name: 'Thompson M1928', kind: 'smg', rarity: 'uncommon', damage: 27, fire_rate: 11, automatic: true, magazine_size: 30, reserve_ammo: 180, reload_time: 2.1, spread_degrees: 4.2, max_range: 20, price: 1200, ammo_price: 600, element: 'ice', maps: [TEMPLE_ID], tracer: 0xffd27a, note: 'Parede do Templo.' },
  { id: 'lupara', display_name: 'Lupara', kind: 'shotgun', rarity: 'uncommon', damage: 21, fire_rate: 2.2, automatic: false, magazine_size: 2, reserve_ammo: 40, reload_time: 1.7, spread_degrees: 12, max_range: 8.5, pellets: 9, price: 1500, ammo_price: 750, element: 'fire', maps: [TEMPLE_ID], tracer: 0xffd27a, note: 'Parede do Templo.' },
  { id: 'lee_enfield', display_name: 'Lee-Enfield', kind: 'sniper', rarity: 'rare', damage: 190, fire_rate: 1.4, automatic: false, magazine_size: 10, reserve_ammo: 60, reload_time: 2.4, spread_degrees: 0.6, max_range: 38, pierce: 2, headshot_multiplier: 2.5, price: 1800, ammo_price: 900, element: 'lightning', maps: [TEMPLE_ID], tracer: 0xfff2c0, note: 'Parede do Templo.' },
  { id: 'stg44', display_name: 'StG 44', kind: 'ak', rarity: 'rare', damage: 40, fire_rate: 9, automatic: true, magazine_size: 30, reserve_ammo: 180, reload_time: 2.4, spread_degrees: 3.2, max_range: 28, price: 2000, ammo_price: 1000, element: 'fire', maps: [TEMPLE_ID], tracer: 0xffd27a, note: 'Parede do Templo.' },
  { id: 'winchester_1887', display_name: 'Winchester 1887', kind: 'shotgun', rarity: 'rare', damage: 19, fire_rate: 2.6, automatic: false, magazine_size: 5, reserve_ammo: 50, reload_time: 2.3, spread_degrees: 8.5, max_range: 11, pellets: 8, price: 2200, ammo_price: 1100, element: 'explosive', maps: [TEMPLE_ID], tracer: 0xffd27a, note: 'Parede do Templo.' },
  { id: 'bren', display_name: 'Bren', kind: 'lmg', rarity: 'epic', damage: 44, fire_rate: 8.5, automatic: true, magazine_size: 30, reserve_ammo: 240, reload_time: 3.1, spread_degrees: 3, max_range: 30, pierce: 1, price: 3000, ammo_price: 1500, element: 'light', maps: [TEMPLE_ID], tracer: 0xffd27a, note: 'Parede do Templo (Submundo).' },
  // Especial da Mystery Box, só no Templo: lança de bronze que explode e incendeia.
  { id: 'hephaestus_spear', display_name: 'Lança de Hefesto', kind: 'launcher', rarity: 'legendary', damage: 260, fire_rate: 1, automatic: false, magazine_size: 4, reserve_ammo: 24, reload_time: 2.6, spread_degrees: 0, max_range: 30, projectile_speed: 22, pierce: 999, price: 0, ammo_price: 3000, box_only: true, maps: [TEMPLE_ID], upgrade_name: 'Forja de Hefesto', tracer: 0xff8a26, special_type: 'plasma', special_params: { blast_radius: 3.5, blast_damage: 240, stun_time: 0.4, burn_dps: 30, burn_time: 3 }, note: 'Mystery Box do Templo.' },
  // Prêmio da missão "Abra o Portão do Submundo".
  { id: 'zeus_bolt', display_name: 'Raio de Zeus', kind: 'arc', rarity: 'legendary', damage: 170, fire_rate: 3.4, automatic: true, magazine_size: 30, reserve_ammo: 240, reload_time: 2.2, spread_degrees: 0, max_range: 19, price: 0, ammo_price: 2500, box_only: true, maps: [TEMPLE_ID], upgrade_name: 'Ira do Olimpo', tracer: 0x9fd8ff, special_type: 'arc', special_params: { chains: 9, chain_range: 7.5, chain_falloff: 0.9, stun_time: 1.1 }, prize: true, note: 'Prêmio da missão do Templo.' },
  // Segredo das 12 estátuas (Santuário do Olimpo): arco de precisão que atravessa a horda.
  { id: 'artemis_bow', display_name: 'Arco de Artemis', kind: 'sniper', rarity: 'legendary', damage: 520, fire_rate: 1.3, automatic: false, magazine_size: 6, reserve_ammo: 48, reload_time: 1.6, spread_degrees: 0, max_range: 45, pierce: 8, headshot_multiplier: 3, price: 0, ammo_price: 2500, box_only: true, maps: [TEMPLE_ID], upgrade_name: 'Caçada Lunar', tracer: 0xd8f0ff, prize: true, note: 'Santuário do Olimpo (12 estátuas).' },
  // Prêmio do evento "Portão do Submundo" (destruir o portal): rajada que arremessa a horda.
  { id: 'poseidon_trident', display_name: 'Tridente de Poseidon', kind: 'wind', rarity: 'legendary', damage: 0, fire_rate: 1.2, automatic: false, magazine_size: 3, reserve_ammo: 15, reload_time: 2.4, spread_degrees: 0, max_range: 11, price: 0, ammo_price: 4000, box_only: true, maps: [TEMPLE_ID], upgrade_name: 'Maremoto', tracer: 0x6fd6ff, special_type: 'gust', special_params: { range: 11, arc_deg: 75, damage: 1400, knockback: 30 }, prize: true, note: 'Prêmio do evento Portão do Submundo.' },
];

// ───────────────────────── Inimigos ─────────────────────────

export interface GodotZombie {
  id: string;
  display_name: string;
  scene?: string;
  max_health: number;
  move_speed: number;
  damage: number;
  attack_range: number;
  attack_interval: number;
  points_kill: number;
  plank_damage: number;
  body_radius: number;
  pushable: boolean;
  shirt: number;
  skin: number;
  scale: number;
  /** Modelo do gerador de sprites (build.mjs): hoplite, skeleton, archer... */
  art: string;
  abilities?: Record<string, GdValue>;
}

/** Inimigos novos do Templo (Fase 1: Hoplitas e Esqueletos). */
export const TEMPLE_ZOMBIES: GodotZombie[] = [
  { id: 'hoplite', display_name: 'Hoplita Morto', max_health: 180, move_speed: 1.7, damage: 16, attack_range: 1.6, attack_interval: 1.2, points_kill: 150, plank_damage: 1, body_radius: 0.42, pushable: true, shirt: 0x7a2a1e, skin: 0x7d8266, scale: 1.05, art: 'hoplite' },
  { id: 'hoplite_shield', display_name: 'Hoplita com Escudo', max_health: 220, move_speed: 1.55, damage: 18, attack_range: 1.6, attack_interval: 1.25, points_kill: 190, plank_damage: 2, body_radius: 0.45, pushable: false, shirt: 0x7a2a1e, skin: 0x7d8266, scale: 1.08, art: 'hoplite_shield',
    // Escudo: de frente (100°) só passa 20% do dano; de lado e de costas, tudo.
    abilities: { shield: { arc_deg: 100, factor: 0.2 } } },
  { id: 'skeleton', display_name: 'Esqueleto Guerreiro', max_health: 70, move_speed: 2.9, damage: 12, attack_range: 1.2, attack_interval: 0.8, points_kill: 110, plank_damage: 1, body_radius: 0.34, pushable: true, shirt: 0x5a4a32, skin: 0xd8d0b8, scale: 0.96, art: 'skeleton',
    // Desmonta ao morrer e, às vezes, se levanta de novo (uma vez só, com metade da vida).
    abilities: { revive: { chance: 0.35, delay_time: 2.2, health_factor: 0.5 } } },
  { id: 'skeleton_archer', display_name: 'Esqueleto Arqueiro', max_health: 60, move_speed: 1.9, damage: 8, attack_range: 1.2, attack_interval: 1, points_kill: 140, plank_damage: 1, body_radius: 0.34, pushable: true, shirt: 0x3e4a2a, skin: 0xd8d0b8, scale: 0.96, art: 'skeleton_archer',
    // Arco: para, mira e atira uma flecha reta (dano direto, sem poça).
    abilities: { ranged: { min_range: 4.5, max_range: 13, cooldown_time: 2.6, windup_time: 0.65, projectile_speed: 18, projectile: 'arrow', damage: 14 } } },
];

/** Composição dos rounds do Templo (vale a última cuja from_round já chegou). */
export const TEMPLE_COMPOSITION: Array<{ from_round: number; weights: Record<string, number> }> = [
  { from_round: 1, weights: { walker: 80, skeleton: 20 } },
  { from_round: 3, weights: { walker: 55, skeleton: 25, runner: 10, hoplite: 10 } },
  { from_round: 6, weights: { walker: 40, skeleton: 20, runner: 12, hoplite: 14, skeleton_archer: 8, tank: 6 } },
  { from_round: 9, weights: { walker: 32, skeleton: 18, runner: 12, hoplite: 12, hoplite_shield: 8, skeleton_archer: 10, tank: 4, crawler: 4 } },
  { from_round: 13, weights: { walker: 26, skeleton: 16, runner: 12, hoplite: 10, hoplite_shield: 10, skeleton_archer: 12, tank: 5, exploder: 5, spitter: 4 } },
];

/** Limite de vivos ao mesmo tempo dos tipos novos. */
export const TEMPLE_TYPE_CAPS: Record<string, number> = { hoplite_shield: 3, skeleton_archer: 4 };

// ───────────────────────── Bosses ─────────────────────────

export interface GodotBoss {
  id: string;
  display_name: string;
  max_health: number;
  health_per_appearance: number;
  move_speed: number;
  body_radius: number;
  reward: number;
  phase_thresholds: number[];
  phase_speed: number[];
  phase_cooldown: number[];
  roar_time: number;
  escort_ratio: number;
  attacks: Record<string, Record<string, GdValue>>;
  area_acid?: boolean;
  /** Extras só do Godot (colunas que desabam na investida, pedras caindo...). */
  extras?: Record<string, GdValue>;
}

/** Bosses do Templo: revezam nos rounds de boss (10, 20, 30...) e a missão os força. */
export const TEMPLE_BOSSES: GodotBoss[] = [
  {
    id: 'minotaur', display_name: 'O Minotauro', max_health: 7000, health_per_appearance: 0.6, move_speed: 2.5, body_radius: 0.85, reward: 2500,
    // Fase 1 Caçada (100–66%), fase 2 Fúria (66–33%), fase 3 Colapso (< 33%).
    phase_thresholds: [0.66, 0.33], phase_speed: [1, 1.35, 1.5], phase_cooldown: [1, 0.75, 0.6], roar_time: 1.2, escort_ratio: 0.3,
    attacks: {
      melee: { range: 2.3, damage: 40, cooldown_time: 1.3 },
      charge: { windup_time: 0.7, speed: 15.5, max_distance: 22, damage: 50, cooldown_time: 5.5, stun_time: 1.4, min_range: 4.5, max_range: 18 },
      shockwave: { from_phase: 1, radius: 6.5, expand_time: 0.6, damage: 28, cooldown_time: 8, windup_time: 0.55 },
      // Colapso: pedras caem do teto e ficam como escombro por alguns segundos.
      area: { from_phase: 3, count: 4, radius: 1.8, telegraph_time: 1.1, damage: 38, cooldown_time: 5.5, spread: 6 },
    },
    extras: { rubble_time: 6.0, breaks_pillars: true },
  },
  {
    // Cérbero: cada cabeça um ataque — mordida (golpe), fogo (leque de chamas no chão) e
    // investida; morde logo depois de investir e, na fase 3, chama os cães de Hades.
    id: 'cerberus', display_name: 'Cérbero', max_health: 9000, health_per_appearance: 0.6, move_speed: 3.2, body_radius: 1.0, reward: 3000,
    phase_thresholds: [0.66, 0.33], phase_speed: [1, 1.25, 1.45], phase_cooldown: [1, 0.7, 0.55], roar_time: 1.1, escort_ratio: 0.25,
    attacks: {
      melee: { range: 2.6, damage: 35, cooldown_time: 0.9 },
      charge: { windup_time: 0.55, speed: 17, max_distance: 20, damage: 45, cooldown_time: 5, stun_time: 1.0, min_range: 4, max_range: 16 },
      vomit: { from_phase: 1, range: 8, arc_deg: 45, count: 6, windup_time: 0.6, cooldown_time: 6, pool: { radius: 1.3, duration_time: 4, dps: 16 } },
      summon: { from_phase: 3, count: 3, types: [{ sn: 'hound' }, { sn: 'hound' }, { sn: 'hound' }], cooldown_time: 12 },
    },
    extras: { fire_pools: true, combo_bite: true },
  },
  {
    // A Entidade do Submundo (boss final): estátua de sombra em chamas. Fase 1: esferas de
    // alma, esqueletos; fase 2: chuva de fogo que vira lava; fase 3: forma monstruosa, com
    // investida e onda de choque.
    id: 'entity', display_name: 'A Entidade do Submundo', max_health: 12000, health_per_appearance: 0.6, move_speed: 2.2, body_radius: 0.9, reward: 4000,
    phase_thresholds: [0.66, 0.33], phase_speed: [1, 1.15, 1.5], phase_cooldown: [1, 0.8, 0.6], roar_time: 1.4, escort_ratio: 0.2,
    area_acid: true,
    attacks: {
      melee: { range: 2.4, damage: 40, cooldown_time: 1.4 },
      volley: { from_phase: 1, count: 5, spread_deg: 50, speed: 9, range: 18, damage: 18, windup_time: 0.5, cooldown_time: 3.5 },
      area: { from_phase: 2, count: 4, radius: 1.8, telegraph_time: 1.1, damage: 30, cooldown_time: 6, spread: 5, pool: { radius: 1.6, duration_time: 6, dps: 18 } },
      summon: { from_phase: 1, count: 3, types: [{ sn: 'skeleton' }, { sn: 'skeleton' }, { sn: 'skeleton_archer' }], cooldown_time: 14 },
      shockwave: { from_phase: 3, radius: 7, expand_time: 0.6, damage: 32, cooldown_time: 7, windup_time: 0.5 },
      charge: { windup_time: 0.7, speed: 15, max_distance: 20, damage: 50, cooldown_time: 6, stun_time: 1.2, min_range: 5, max_range: 16 },
    },
    extras: { fire_pools: true, charge_from_phase: 3, phase_sheets: { '3': 'boss_entity_monstrous' }, lore: 'O templo não era uma prisão. Era uma porta... e ela está se abrindo.' },
  },
];

/** Rodízio dos bosses nos rounds de boss do Templo: 10 Minotauro, 20 Cérbero, 30 Entidade, e de novo. */
export const TEMPLE_BOSS_ROTATION = ['minotaur', 'cerberus', 'entity'];

// ───────────────────────── Personagem e conquistas ─────────────────────────

/** A arqueóloga (personagem padrão do Templo) e as 3 skins que as conquistas do Templo liberam. */
export const TEMPLE_SKINS = [
  { id: 'archaeologist', name: 'Arqueóloga', unlock: '', map: TEMPLE_ID, model: 'archaeologist', style: 'field', jacket: '#a0845a', pack: '#5a4128', hair: '#6a3a1e' },
  { id: 'labyrinth_hunter', name: 'Caçadora do Labirinto', unlock: 'minotaur', map: TEMPLE_ID, model: 'archaeologist', style: 'hunter', jacket: '#5a3a2a', pack: '#2e2620', hair: '#1e1612' },
  { id: 'olympus_priestess', name: 'Sacerdotisa do Olimpo', unlock: 'twelve_statues', map: TEMPLE_ID, model: 'archaeologist', style: 'priestess', jacket: '#e8e0cc', pack: '#c8a24a', hair: '#2a1c12' },
  { id: 'underworld_walker', name: 'Andarilha do Submundo', unlock: 'underworld_gate', map: TEMPLE_ID, model: 'archaeologist', style: 'underworld', jacket: '#3a2a4a', pack: '#7a2a1e', hair: '#d8d0c0' },
];

/** Conquistas do Templo (ícones gerados pelo npm run godot:sprites). */
export const TEMPLE_ACHIEVEMENTS = [
  { id: 'minotaur', name: 'Fio de Ariadne', description: 'Derrote o Minotauro', icon: 'res://assets/sprites/icons/weapon_lee_enfield.png' },
  { id: 'twelve_statues', name: 'Os Doze do Olimpo', description: 'Ative as 12 estátuas dos deuses no Templo', icon: 'res://assets/sprites/icons/weapon_artemis_bow.png' },
  { id: 'underworld_gate', name: 'O Portão do Submundo', description: 'Complete a missão do Templo e pegue o Raio de Zeus', icon: 'res://assets/sprites/icons/weapon_zeus_bolt.png' },
  { id: 'cerberus', name: 'Guardião dos Três', description: 'Derrote o Cérbero', icon: 'res://assets/sprites/icons/weapon_hephaestus_spear.png' },
  { id: 'the_door', name: 'A Porta', description: 'Derrote a Entidade do Submundo', icon: 'res://assets/sprites/icons/weapon_poseidon_trident.png' },
];
