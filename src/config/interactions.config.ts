/** Interações do mapa (painéis e armadilhas). */
export const interactionsConfig = {
  power: { price: 500, holdMs: 1200 },
  alarm: { price: 750, holdMs: 1000 },
  train: { price: 1500, cooldownMs: 90_000 },
  trap: { price: 1000, activeMs: 15_000, cooldownMs: 45_000, tickMs: 180 },
  /** Válvula do vazamento de gás (grátis, só segurar). */
  valve: { holdMs: 1500 },
};
