/** Bosses (GDD §45–47). */

export interface BossConfig {
  id: string;
  name: string;
  health: number;
  /** Vida extra a cada nova aparição do mesmo boss (0.6 = +60%). */
  healthPerAppearance: number;
  speed: number;
  bodyRadius: number;
  reward: number;
  /** Frações de vida que iniciam as fases 2, 3 e 4 (GDD §46: 75/50/25%). */
  phaseThresholds: number[];
  /** Multiplicadores por fase (índice 0 = fase 1). */
  phaseSpeed: number[];
  phaseCooldown: number[];
  /** Duração do rugido (entrada e troca de fase), invulnerável (ms). */
  roarMs: number;
  melee: { range: number; damage: number; cooldownMs: number };
  charge: { windupMs: number; speed: number; maxDistance: number; damage: number; cooldownMs: number; stunMs: number; minRange: number; maxRange: number };
  shockwave: { fromPhase: number; radius: number; expandMs: number; damage: number; cooldownMs: number; windupMs: number };
  summon: { fromPhase: number; count: number; types: string[]; cooldownMs: number };
  area: { fromPhase: number; count: number; radius: number; telegraphMs: number; damage: number; cooldownMs: number; spread: number };
  /** Fração da horda normal que acompanha o boss. */
  escortRatio: number;
}

export const bosses: Record<string, BossConfig> = {
  conductor: {
    id: 'conductor',
    name: 'The Conductor',
    health: 6000,
    healthPerAppearance: 0.6,
    speed: 72,
    bodyRadius: 24,
    reward: 2000,
    phaseThresholds: [0.75, 0.5, 0.25],
    phaseSpeed: [1, 1.3, 1.3, 1.6],
    phaseCooldown: [1, 1, 0.9, 0.6],
    roarMs: 1100,
    melee: { range: 64, damage: 35, cooldownMs: 1400 },
    charge: { windupMs: 750, speed: 470, maxDistance: 640, damage: 45, cooldownMs: 6500, stunMs: 1200, minRange: 150, maxRange: 540 },
    shockwave: { fromPhase: 2, radius: 230, expandMs: 650, damage: 30, cooldownMs: 7500, windupMs: 520 },
    summon: { fromPhase: 3, count: 4, types: ['walker', 'walker', 'runner'], cooldownMs: 11000 },
    area: { fromPhase: 4, count: 3, radius: 64, telegraphMs: 1000, damage: 35, cooldownMs: 6000, spread: 150 },
    escortRatio: 0.3,
  },
};

/** Qual boss aparece em cada wave de boss (as waves ficam em waves.config.ts). */
export const bossForWave = (_wave: number): string => 'conductor';
