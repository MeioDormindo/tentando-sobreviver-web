import type { Rarity } from './weapons.config';

/** Mystery Box (GDD §37). */
export const mysteryBoxConfig = {
  price: 950,
  /** Duração da "roleta" de armas (ms). */
  rollMs: 3000,
  /** Tempo para pegar a arma sorteada antes de ela sumir (ms). */
  takeMs: 8000,
  /** Probabilidade de cada raridade (%): armas boas saem com frequência. */
  rarityWeights: {
    common: 22,
    uncommon: 26,
    rare: 25,
    epic: 19,
    legendary: 8,
  } satisfies Record<Rarity, number>,
  /** Usos no mesmo local antes de a caixa sumir e reaparecer em outro. */
  usesBeforeMove: 3,
  /** Animação de saída (tremer + subir) e tempo até reaparecer (ms). */
  moveOutMs: 1600,
  moveGapMs: 1400,
  /** Coluna de luz que marca o novo local (ms). */
  beaconMs: 5000,
};

/** Weapon Lab (GDD §38). */
export const weaponLabConfig = {
  price: 5000,
  /** Segundo upgrade: Mk II → Mk III (projéteis em dobro). */
  priceMk3: 10000,
};

export type PerkId = 'fortify' | 'quick_hands' | 'sprint' | 'deadeye' | 'adrenaline' | 'overload';

/** Efeitos que os perks aplicam ao jogador e às armas. */
export interface PerkModifiers {
  maxHpBonus: number;
  speedMultiplier: number;
  reloadMultiplier: number;
  headshotBonus: number;
  regenMultiplier: number;
  damageMultiplier: number;
}

export interface PerkDef {
  id: PerkId;
  name: string;
  price: number;
  description: string;
  maxLevel: number;
  /** Cor da máquina/luz. */
  color: number;
  effect: Partial<PerkModifiers>;
}

/** Perks (GDD §39–40). */
export const perks: Record<PerkId, PerkDef> = {
  fortify: {
    id: 'fortify', name: 'Fortify', price: 2500, maxLevel: 1, color: 0xc0392b,
    description: '+50 de vida máxima', effect: { maxHpBonus: 50 },
  },
  quick_hands: {
    id: 'quick_hands', name: 'Quick Hands', price: 3000, maxLevel: 1, color: 0x2e86c1,
    description: 'Recarga 40% mais rápida', effect: { reloadMultiplier: 0.6 },
  },
  sprint: {
    id: 'sprint', name: 'Sprint+', price: 2000, maxLevel: 1, color: 0x27ae60,
    description: '+20% de velocidade', effect: { speedMultiplier: 1.2 },
  },
  deadeye: {
    id: 'deadeye', name: 'Deadeye', price: 1500, maxLevel: 1, color: 0xd4ac0d,
    description: 'Headshots causam +100% de dano', effect: { headshotBonus: 1 },
  },
  adrenaline: {
    id: 'adrenaline', name: 'Adrenaline', price: 2000, maxLevel: 1, color: 0xe67e22,
    description: 'Regenera vida 2,5x mais rápido e mais cedo', effect: { regenMultiplier: 2.5 },
  },
  overload: {
    id: 'overload', name: 'Overload', price: 4000, maxLevel: 1, color: 0x8e44ad,
    description: '+25% de dano das armas', effect: { damageMultiplier: 1.25 },
  },
};

export const NEUTRAL_MODIFIERS: PerkModifiers = {
  maxHpBonus: 0,
  speedMultiplier: 1,
  reloadMultiplier: 1,
  headshotBonus: 0,
  regenMultiplier: 1,
  damageMultiplier: 1,
};
