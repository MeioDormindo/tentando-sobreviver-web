/** Missão principal do Hospital: "O Soro do Dr. Almeida". Posições em tiles. */
export const serumQuestConfig = {
  title: 'O SORO DO DR. ALMEIDA',
  /** Geladeira de amostras na UTI: segurar E por este tempo. */
  fridge: { tx: 108, ty: 4.7, holdMs: 4000 },
  /** Armário trancado da Farmácia: o cadeado só abre com tiro. */
  cabinet: { tx: 110, ty: 56.7, lockRadius: 14 },
  /** Gaveta do Necrotério que abre com o cartão de acesso do Blindado. */
  drawer: { tx: 64, ty: 79.2 },
  /** Centrífuga do Laboratório: defender por este tempo enquanto o soro fica pronto. */
  centrifuge: {
    tx: 66,
    ty: 95.8,
    defendMs: 60_000,
    /** Zumbi a menos disto da centrífuga pausa o tempo (px). */
    threatRadius: 70,
    /** Mais zumbis durante a defesa. */
    spawn: { intervalMultiplier: 0.55, maxAliveBonus: 6 },
  },
  /** Paciente Zero enfurecido: vida extra. */
  bossHealthMultiplier: 1.5,
  /** Segurar E sobre o corpo para aplicar o soro. */
  applyHoldMs: 3000,
};
