export interface PlayerConfig {
  /** Velocidade de movimento em px/s. */
  speed: number;
  maxHp: number;
  /** Raio do corpo de colisão em px. */
  bodyRadius: number;
  /** Tempo de invulnerabilidade após receber dano (ms). */
  invulnerabilityMs: number;
  startingWeapon: string;
  /** Armadura absorve dano antes da vida (GDD §24). */
  maxArmor: number;
  /** Velocidade andando de lado (strafe) e de costas, em relação à mira. */
  strafeMultiplier: number;
  backpedalMultiplier: number;
  /** Tempo sem levar dano até começar a regenerar (ms). */
  regenDelayMs: number;
  /** Vida recuperada por segundo durante a regeneração. */
  regenPerSecond: number;
}

export const playerConfig: PlayerConfig = {
  speed: 200,
  maxHp: 100,
  bodyRadius: 12,
  invulnerabilityMs: 400,
  startingWeapon: 'm1911',
  maxArmor: 100,
  strafeMultiplier: 0.85,
  backpedalMultiplier: 0.6,
  regenDelayMs: 5000,
  regenPerSecond: 6,
};
