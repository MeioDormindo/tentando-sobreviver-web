/** Power-ups (GDD §41–43). */

export type PowerUpId =
  | 'max_ammo'
  | 'double_cash'
  | 'insta_kill'
  | 'nuke'
  | 'full_heal'
  | 'armor'
  | 'speed_boost'
  | 'carpenter'
  | 'golden';

export interface PowerUpDef {
  id: PowerUpId;
  name: string;
  /** Cor do brilho no mundo e do anúncio. */
  color: number;
  /** Duração do efeito (ms); ausente = instantâneo. */
  durationMs?: number;
}

export const powerUps: Record<PowerUpId, PowerUpDef> = {
  max_ammo: { id: 'max_ammo', name: 'Max Ammo', color: 0x4caf50 },
  double_cash: { id: 'double_cash', name: 'Double Cash', color: 0xe6b422, durationMs: 30_000 },
  insta_kill: { id: 'insta_kill', name: 'Instant Kill', color: 0xd64541, durationMs: 20_000 },
  nuke: { id: 'nuke', name: 'Nuke', color: 0xf08a24 },
  full_heal: { id: 'full_heal', name: 'Full Heal', color: 0xe9e4d8 },
  armor: { id: 'armor', name: 'Armor', color: 0x3d8fd6 },
  speed_boost: { id: 'speed_boost', name: 'Speed Boost', color: 0x35c7c0, durationMs: 15_000 },
  carpenter: { id: 'carpenter', name: 'Carpenter', color: 0xc8873a },
  golden: { id: 'golden', name: 'Golden Drop', color: 0xffd35a },
};

export const dropConfig = {
  /** Chance de um zumbi abatido por arma soltar um power-up (GDD §42). */
  chance: 0.05,
  /** Chance separada, bem baixa, do Golden Drop (GDD §43). */
  goldenChance: 0.005,
  /** Tabela de pesos (%) dos power-ups comuns. */
  table: {
    max_ammo: 20,
    double_cash: 20,
    insta_kill: 15,
    nuke: 10,
    full_heal: 15,
    armor: 10,
    speed_boost: 10,
    carpenter: 8,
  } as Record<Exclude<PowerUpId, 'golden'>, number>,
  maxPerWave: 4,
  /** Tempo no chão antes de sumir e quando começa a piscar (ms). */
  lifetimeMs: 30_000,
  blinkAtMs: 22_000,
  pickupRadius: 30,
};

export const powerUpEffects = {
  cashMultiplier: 2,
  speedMultiplier: 1.35,
  /** Dinheiro fixo do Nuke (os abates dele não pagam individualmente). */
  nukeReward: 400,
  /** Carpenter: conserta todas as barricadas e paga isto. */
  carpenterReward: 200,
};

/** Resultados do Golden Drop (GDD §43) e seus pesos. */
export const goldenConfig = {
  outcomes: {
    weapon: 30,
    money: 30,
    perk: 25,
    fury: 15,
  },
  weapons: ['rail', 'energy_cannon', 'rpk', 'grenade_launcher', 'flamethrower', 'arc_gun'],
  money: 2000,
  /** "Upgrade temporário": dano dobrado. */
  furyDurationMs: 20_000,
  furyDamageMultiplier: 2,
};
