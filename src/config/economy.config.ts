/** Economia (GDD §33–34). A recompensa por abate de cada tipo fica em zombies.config.ts. */
export const economyConfig = {
  startingMoney: 500,
  headshotBonus: 50,
  /** Bônus ao completar a wave: base + perWave × wave. */
  waveBonusBase: 300,
  waveBonusPerWave: 50,
};

/** Headshot (vista de cima): o tiro passa a menos disto do centro da cabeça. */
export const headshotConfig = {
  headRadius: 3.5,
  damageMultiplier: 1.5,
};

/** Interação com máquinas/maletas. */
export const interactionConfig = {
  /** Distância máxima do jogador ao ponto de interação (px). */
  radius: 44,
};
