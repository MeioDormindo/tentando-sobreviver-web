/** Economia (GDD §33–34). A recompensa por abate de cada tipo fica em zombies.config.ts. */
export const economyConfig = {
  startingMoney: 500,
  headshotBonus: 50,
  /** Abate na faca paga mais (como no CoD Zombies). */
  knifeKillBonus: 60,
  /** Bônus ao completar a wave: base + perWave × wave. */
  waveBonusBase: 300,
  waveBonusPerWave: 50,
};

/** Headshot (vista de cima): o tiro passa a menos disto do centro da cabeça. */
export const headshotConfig = {
  headRadius: 3.5,
  damageMultiplier: 1.5,
};

/** Barricadas das janelas (GDD §19). */
export const barricadeConfig = {
  maxPlanks: 5,
  /** Dinheiro ganho por tábua reparada. */
  repairReward: 10,
  /** Tempo segurando E para repor uma tábua (ms). */
  repairTimeMs: 1000,
  /** Levar dano há menos que isso interrompe o reparo (ms). */
  repairInterruptMs: 600,
};

/** Interação com máquinas e compras na parede. */
export const interactionConfig = {
  /** Distância máxima do jogador ao ponto de interação (px). */
  radius: 44,
};
