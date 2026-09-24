/** Pontuação (score). Recompensa risco e habilidade (GDD §34), separada do dinheiro. */
export const scoreConfig = {
  /** Pontos por abate de cada tipo. */
  kill: { walker: 10, runner: 15, tank: 60, exploder: 25 } as Record<string, number>,
  killDefault: 10,
  /** Cada wave vale mais: pontos de abate × (1 + wave × isto). */
  perWaveMultiplier: 0.1,
  headshot: 5,
  /** Abate na faca. */
  knifeKill: 15,
  /** Abate a queima-roupa (px do jogador). */
  closeRange: { distance: 70, bonus: 5 },
  /** Abates em sequência: a cada abate dentro da janela, o bônus cresce. */
  multiKill: { windowMs: 1500, bonusPerStep: 10, maxSteps: 5 },
  /** Mortes que não são de arma (explosão, Nuke, trem, gás) valem esta fração. */
  indirectFactor: 0.5,
  /** Wave completa: isto × número da wave. */
  waveComplete: 50,
  boss: 1000,
  powerUp: 25,
};
