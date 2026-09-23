/** Configuração do spawner temporário da Fase 1 (substituído pelo SpawnSystem na Fase 2). */
export const testSpawnConfig = {
  maxAlive: 4,
  /** Distância mínima do jogador para um spawn ser válido (px). */
  minDistanceFromPlayer: 400,
  /** Intervalo entre tentativas de spawn (ms). */
  interval: 1500,
  zombieType: 'walker',
};
