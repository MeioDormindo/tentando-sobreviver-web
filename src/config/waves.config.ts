/** Parâmetros das waves (GDD §30–32, §84). Valores iniciais — balancear na Fase 12. */
export const waveConfig = {
  baseEnemies: 6,
  enemiesPerWave: 2,
  /** Acréscimo por wave sobre os atributos base do zumbi. */
  healthMultiplier: 0.12,
  damageMultiplier: 0.08,
  speedMultiplier: 0.015,
  /** Waves de boss (usadas a partir da Fase 8). */
  bossWaves: [10, 20, 30],

  /** Intervalo entre spawns (ms): diminui a cada wave até o mínimo. */
  spawnIntervalBase: 1800,
  spawnIntervalPerWave: -120,
  spawnIntervalMin: 450,

  /** Máximo de zumbis vivos ao mesmo tempo. */
  maxAliveBase: 8,
  maxAlivePerWave: 2,
  maxAliveCap: 24,

  /** Espera antes da primeira wave e entre waves (ms). */
  firstWaveDelay: 3500,
  intermission: 10_000,

  /** Tipo de zumbi das waves (Runner/Tank/Exploder entram na Fase 7). */
  zombieType: 'walker',
};

/** Regras de posicionamento de spawn (GDD §21). */
export const spawnConfig = {
  /** Distância mínima do jogador (px). */
  minDistanceFromPlayer: 380,
  /** Margem além da tela para considerar um ponto "visível" (px do mundo). */
  offscreenMargin: 48,
  /** Não spawnar se já houver um zumbi a menos disso do ponto (px). */
  clearRadius: 26,
  /** Zumbi sem se aproximar do jogador por este tempo e fora da tela é realocado (ms). */
  stuckTimeoutMs: 12_000,
  /** Duração do fade-in ao surgir (ms). */
  fadeInMs: 350,
};
