import Phaser from 'phaser';
import { elements } from '../config/elements.config';
import { emitGameEvent, GameEvents } from '../game/events';
import type { EconomySystem } from '../systems/EconomySystem';
import type { WeaponSystem } from '../weapons/WeaponSystem';

/** Tempo segurando E / USAR para comprar o elemento (ms). */
const HOLD_MS = 900;
/** Sem novo onHold por este tempo, o progresso zera (o botão foi solto). */
const RELEASE_MS = 150;
const BAR = 6;

const money = (n: number): string => `$${n.toLocaleString('pt-BR')}`;

/**
 * Venda do elemento de uma arma, embutida numa arma de parede (ou na munição de parede, para a
 * M1911): segurar E compra; o texto mostra o elemento, o preço e uma barra de progresso.
 */
export class ElementCounter {
  private holdMs = 0;
  private lastHoldAt = -Infinity;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly deps: { economy: EconomySystem; weapons: WeaponSystem },
  ) {}

  /** Trecho do aviso sobre o elemento da arma (vazio se ela não tem elemento ou o jogador não a possui). */
  promptPart(weaponId: string): string {
    const el = this.deps.weapons.elementOf(weaponId);
    if (!el) return '';
    const info = elements[el.id];
    if (el.owned) return ` · ${info.icon} ${info.name} ✓`;
    const holding = this.scene.time.now - this.lastHoldAt < RELEASE_MS && this.holdMs > 0;
    const filled = Math.round((this.holdMs / HOLD_MS) * BAR);
    const bar = holding ? ` [${'▰'.repeat(filled)}${'▱'.repeat(BAR - filled)}]` : '';
    return ` · SEGURE E: ${info.icon} ${info.name} ${money(info.price)}${bar}`;
  }

  /** O elemento ainda pode ser comprado (e a pessoa pode pagar)? */
  affordable(weaponId: string): boolean {
    const el = this.deps.weapons.elementOf(weaponId);
    return !!el && !el.owned && this.deps.economy.canAfford(elements[el.id].price);
  }

  hold(weaponId: string, time: number, delta: number): void {
    const { weapons, economy } = this.deps;
    const el = weapons.elementOf(weaponId);
    if (!el || el.owned) return;
    if (time - this.lastHoldAt > RELEASE_MS) this.holdMs = 0;
    this.lastHoldAt = time;
    this.holdMs += delta;
    if (this.holdMs < HOLD_MS) return;
    this.holdMs = 0;
    const info = elements[el.id];
    if (!economy.spend(info.price)) return;
    weapons.giveElement(weaponId);
    emitGameEvent(this.scene.game.events, GameEvents.PowerUpCollected, {
      id: `element_${el.id}`,
      name: `${info.icon} ${info.name}`,
      color: info.color,
      detail: info.description,
    });
  }
}
