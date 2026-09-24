import type { PerkId } from './machines.config';

/**
 * Energia (como no CoD Zombies): a partida começa sem energia. Os perks e o Weapon Lab só
 * funcionam depois de ligar o disjuntor principal; maletas, portas e a Mystery Box funcionam sempre.
 */
export const powerConfig = {
  /** Segurar E no disjuntor por este tempo (ms). É grátis. */
  breakerHoldMs: 2000,
  /** Luminárias comuns ficam nesta fração da intensidade sem energia. */
  lampFactorOff: 0.55,
  /** As luzes voltam piscando por este tempo ao ligar (ms). */
  restoreFlickerMs: 1400,
  /** Perks que funcionam sem energia (Quick Revive no solo, como no CoD). */
  worksWithoutPower: ['quick_revive'] as PerkId[],
};
