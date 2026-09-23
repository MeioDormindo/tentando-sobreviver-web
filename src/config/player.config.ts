export interface PlayerConfig {
  /** Velocidade de movimento em px/s. */
  speed: number;
  maxHp: number;
  /** Raio do corpo de colisão em px. */
  bodyRadius: number;
  /** Tempo de invulnerabilidade após receber dano (ms). */
  invulnerabilityMs: number;
  startingWeapon: string;
}

export const playerConfig: PlayerConfig = {
  speed: 200,
  maxHp: 100,
  bodyRadius: 12,
  invulnerabilityMs: 400,
  startingWeapon: 'm1911',
};
