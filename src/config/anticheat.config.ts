/**
 * Anti-trapaça: ganhos de dinheiro/score muito acima do possível invalidam a partida.
 * Tetos calibrados com folga sobre o maior ganho legítimo (boss $2500 × Double Cash × Lua de Sangue,
 * bônus de wave, sequências de abates com a minigun) — jogo honesto nunca chega perto.
 */
export const antiCheatConfig = {
  money: {
    /** Maior ganho único permitido: base + porWave × wave. */
    eventBase: 15_000,
    eventPerWave: 300,
    /** Soma máxima dentro da janela: base + porWave × wave. */
    windowBase: 60_000,
    windowPerWave: 1500,
  },
  score: {
    eventBase: 5000,
    eventPerWave: 200,
    windowBase: 30_000,
    windowPerWave: 2000,
  },
  /** Janela deslizante (ms). */
  windowMs: 10_000,
  /** Intervalo da checagem de integridade dos valores (ms). */
  integrityCheckMs: 1000,
  /** Mensagens de zoeira (uma é sorteada). */
  taunts: [
    'HACKER DETECTADO! Até os zumbis estão rindo de você.',
    'Dinheiro caiu do céu? Aqui não, espertinho.',
    'Parabéns, você hackeou... o próprio vexame.',
    'Os zumbis votaram: você é o mais fraco daqui.',
    'Quer pontos grátis? Tenta jogar direito, campeão.',
    'Nem o Paciente Zero é tão desesperado assim.',
  ],
  tauntSubtitle: 'PARTIDA INVALIDADA — não vale save nem ranking',
};
