/** Elementos especiais das armas: comprados na parede da própria arma (segurando E / USAR). */
export type ElementId = 'light' | 'shadow' | 'ice' | 'lightning' | 'fire' | 'explosive';

export interface ElementInfo {
  name: string;
  icon: string;
  color: number;
  price: number;
  description: string;
}

export const elements: Record<ElementId, ElementInfo> = {
  light: { name: 'LUZ', icon: '✦', color: 0xfff2a8, price: 2500, description: 'Clarão que cega: atordoa os zumbis e causa +50% de dano no boss.' },
  shadow: { name: 'SOMBRA', icon: '☾', color: 0xb07ae0, price: 2500, description: 'Rouba vida: cada acerto recupera parte do dano causado.' },
  ice: { name: 'GELO', icon: '❄', color: 0x9fe3ff, price: 3000, description: 'Deixa os zumbis lentos e às vezes os congela.' },
  lightning: { name: 'RAIO', icon: 'ϟ', color: 0x7fd8ff, price: 3000, description: 'A eletricidade salta para 2 zumbis próximos.' },
  fire: { name: 'FOGO', icon: '✹', color: 0xff8a3a, price: 3000, description: 'Incendeia: dano contínuo por alguns segundos.' },
  explosive: { name: 'EXPLOSIVO', icon: '✺', color: 0xffb347, price: 3500, description: 'Cada tiro que acerta estoura numa pequena explosão.' },
};

/** Intensidade dos efeitos. `perShot` = em espingardas o efeito ocorre ~1 vez por disparo. */
export const elementParams = {
  light: { stunMs: 600, bossBonus: 0.5 },
  shadow: { leech: 0.08, maxHealPerHit: 6 },
  ice: { slowFactor: 0.55, slowMs: 2200, freezeChance: 0.12, freezeMs: 1300 },
  lightning: { chains: 2, range: 130, damageFactor: 0.5, perShot: true },
  fire: { dps: 22, burnMs: 2500 },
  explosive: { radius: 48, damageFactor: 0.7, perShot: true },
};
