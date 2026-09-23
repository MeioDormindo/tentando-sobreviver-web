/** Qualquer alvo que zumbis possam atacar (hoje o Player; no futuro barricadas, aliados). */
export interface Damageable {
  readonly x: number;
  readonly y: number;
  readonly isAlive: boolean;
  takeDamage(amount: number, time: number): void;
}
