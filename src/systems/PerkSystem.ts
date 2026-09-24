import Phaser from 'phaser';
import { NEUTRAL_MODIFIERS, perks, type PerkId, type PerkModifiers } from '../config/machines.config';
import { emitGameEvent, GameEvents } from '../game/events';

/**
 * Perks do jogador (GDD §39–40). Mantém os níveis comprados e um único objeto de
 * modificadores que Player, WeaponSystem e CombatSystem leem (multiplicadores se
 * multiplicam; bônus se somam).
 */
export class PerkSystem {
  private readonly levels = new Map<PerkId, number>();
  private readonly purchases = new Map<PerkId, number>();
  private readonly mods: PerkModifiers = { ...NEUTRAL_MODIFIERS };
  private readonly listeners: Array<() => void> = [];

  constructor(private readonly scene: Phaser.Scene) {}

  /** Modificadores atuais (referência viva: sempre reflete os perks comprados). */
  get modifiers(): Readonly<PerkModifiers> {
    return this.mods;
  }

  level(id: PerkId): number {
    return this.levels.get(id) ?? 0;
  }

  isMaxed(id: PerkId): boolean {
    const limit = perks[id].maxPurchases;
    return this.level(id) >= perks[id].maxLevel || (limit !== undefined && (this.purchases.get(id) ?? 0) >= limit);
  }

  /** Compras restantes de um perk que se gasta (ou null se não tem limite). */
  purchasesLeft(id: PerkId): number | null {
    const limit = perks[id].maxPurchases;
    return limit === undefined ? null : limit - (this.purchases.get(id) ?? 0);
  }

  /** Gasta um perk (Quick Revive ao levantar). */
  consume(id: PerkId): boolean {
    if (this.level(id) === 0) return false;
    this.levels.delete(id);
    this.recompute();
    this.listeners.forEach((fn) => fn());
    this.syncHud();
    return true;
  }

  /** Preço do próximo nível. */
  priceOf(id: PerkId): number {
    return perks[id].price * (this.level(id) + 1);
  }

  /** Aplica o perk (o pagamento é feito pela máquina). */
  grant(id: PerkId): boolean {
    if (this.isMaxed(id)) return false;
    this.levels.set(id, this.level(id) + 1);
    this.purchases.set(id, (this.purchases.get(id) ?? 0) + 1);
    this.recompute();
    this.listeners.forEach((fn) => fn());
    this.syncHud();
    return true;
  }

  onChange(fn: () => void): void {
    this.listeners.push(fn);
  }

  syncHud(): void {
    const owned = [...this.levels.entries()].map(([id, level]) => ({ id, level }));
    emitGameEvent(this.scene.game.events, GameEvents.PerksChanged, { perks: owned });
  }

  private recompute(): void {
    Object.assign(this.mods, NEUTRAL_MODIFIERS);
    for (const [id, level] of this.levels) {
      const e = perks[id].effect;
      for (let i = 0; i < level; i++) {
        this.mods.maxHpBonus += e.maxHpBonus ?? 0;
        this.mods.headshotBonus += e.headshotBonus ?? 0;
        this.mods.speedMultiplier *= e.speedMultiplier ?? 1;
        this.mods.reloadMultiplier *= e.reloadMultiplier ?? 1;
        this.mods.regenMultiplier *= e.regenMultiplier ?? 1;
        this.mods.damageMultiplier *= e.damageMultiplier ?? 1;
      }
    }
  }
}
