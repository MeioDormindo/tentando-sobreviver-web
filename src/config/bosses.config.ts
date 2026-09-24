import type { MapId } from './maps.config';
import type { HazardPoolConfig } from './zombies.config';

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
  /** Ataques opcionais: cada boss usa só os que tem. */
  shockwave?: { fromPhase: number; radius: number; expandMs: number; damage: number; cooldownMs: number; windupMs: number };
  summon?: { fromPhase: number; count: number; types: string[]; cooldownMs: number };
  /**
   * Círculos marcados no chão: 'blast' explode no fim do aviso; 'acid' vira poça de ácido
   * (chuva de ácido do Paciente Zero).
   */
  area?: { fromPhase: number; count: number; radius: number; telegraphMs: number; damage: number; cooldownMs: number; spread: number; style?: 'blast' | 'acid'; pool?: HazardPoolConfig };
  /** Vômito ácido em cone: poças em leque na frente do boss. */
  vomit?: { fromPhase: number; range: number; arcDeg: number; count: number; windupMs: number; cooldownMs: number; pool: HazardPoolConfig };
  /** Grito: deixa o jogador lento e chama inimigos. */
  scream?: { fromPhase: number; radius: number; slowMs: number; slowFactor: number; cooldownMs: number; summonCount: number; types: string[] };
  /** Lanterna acesa na mão (luz que segue o boss). */
  lantern?: boolean;
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
    lantern: true,
  },
  patient_zero: {
    id: 'patient_zero',
    name: 'Paciente Zero',
    health: 6500,
    healthPerAppearance: 0.6,
    speed: 78,
    bodyRadius: 24,
    reward: 2500,
    phaseThresholds: [0.75, 0.5, 0.25],
    phaseSpeed: [1, 1.2, 1.3, 1.6],
    phaseCooldown: [1, 0.95, 0.85, 0.6],
    roarMs: 1200,
    melee: { range: 66, damage: 38, cooldownMs: 1300 },
    charge: { windupMs: 800, speed: 500, maxDistance: 620, damage: 45, cooldownMs: 7500, stunMs: 1300, minRange: 170, maxRange: 520 },
    vomit: { fromPhase: 1, range: 260, arcDeg: 50, count: 5, windupMs: 650, cooldownMs: 6500, pool: { radius: 42, durationMs: 5000, dps: 18 } },
    scream: { fromPhase: 2, radius: 520, slowMs: 2500, slowFactor: 0.55, cooldownMs: 12000, summonCount: 4, types: ['crawler', 'crawler', 'spitter'] },
    area: {
      fromPhase: 3, count: 5, radius: 52, telegraphMs: 1100, damage: 10, cooldownMs: 8000, spread: 190, style: 'acid',
      pool: { radius: 52, durationMs: 4500, dps: 16 },
    },
    escortRatio: 0.3,
  },
};

/** Qual boss aparece em cada wave de boss de cada mapa (as waves ficam em waves.config.ts). */
export const bossForWave = (map: MapId, _wave: number): string => (map === 'map2' ? 'patient_zero' : 'conductor');
