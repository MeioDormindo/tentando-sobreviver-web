export interface ZombieConfig {
  id: string;
  name: string;
  health: number;
  damage: number;
  /** Velocidade de perseguição em px/s. */
  speed: number;
  /** Distância em que o zumbi percebe o jogador (px). */
  detectRange: number;
  /** Distância entre centros para iniciar o ataque (px). */
  attackRange: number;
  /** Intervalo entre ataques (ms). */
  attackCooldown: number;
  bodyRadius: number;
  /** Recompensa em dinheiro (usada a partir da Fase 3). */
  reward: number;
}

export const zombies: Record<string, ZombieConfig> = {
  walker: {
    id: 'walker',
    name: 'Walker',
    health: 100,
    damage: 10,
    speed: 60,
    // Modo horda: o Walker sempre sabe onde o jogador está (cobre o mapa inteiro).
    detectRange: 4000,
    attackRange: 30,
    attackCooldown: 1000,
    bodyRadius: 12,
    reward: 100,
  },
};

export function getZombieConfig(id: string): ZombieConfig {
  const cfg = zombies[id];
  if (!cfg) throw new Error(`Zumbi desconhecido: ${id}`);
  return cfg;
}
