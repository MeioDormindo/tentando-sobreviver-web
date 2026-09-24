import Phaser from 'phaser';
import { ASSET_KEYS, weaponCaseKey } from '../config/assets.config';
import { ART_SCALE } from '../config/visual.config';
import { getWeaponConfig, type WeaponConfig } from '../config/weapons.config';
import type { InteractionPromptPayload } from '../game/events';
import type { EconomySystem } from '../systems/EconomySystem';
import type { SolidPlacer } from './Machines';
import type { Interactable } from '../systems/InteractionSystem';
import type { WeaponSystem } from '../weapons/WeaponSystem';
import { ElementCounter } from './ElementCounter';

export interface StationDeps {
  economy: EconomySystem;
  weapons: WeaponSystem;
  solids: SolidPlacer;
}

/** Arma inicial (sem maleta): o elemento dela sai na caixa de munição. */
const STARTING_ELEMENT_WEAPON = 'm1911';

const money = (n: number): string => `$${n.toLocaleString('pt-BR')}`;

/** Cria a imagem do ponto de compra com um corpo sólido (o jogador não o atravessa). */
function createProp(scene: Phaser.Scene, x: number, y: number, texture: string, body: { w: number; h: number }, solids: SolidPlacer): void {
  scene.add.image(x, y, texture).setScale(ART_SCALE).setDepth(y + body.h / 2);
  solids.addSolid(x - 1, y - 1, body.w, body.h);
}

/**
 * Maleta com arma (GDD §60): compra a arma; se o jogador já a possui, vende munição dela
 * (tocar E) e o elemento especial daquela arma (segurar E).
 */
export class WeaponCase implements Interactable {
  private readonly config: WeaponConfig;
  private readonly element: ElementCounter;

  constructor(scene: Phaser.Scene, readonly x: number, readonly y: number, weaponId: string, private readonly deps: StationDeps) {
    this.config = getWeaponConfig(weaponId);
    this.element = new ElementCounter(scene, deps);
    createProp(scene, x, y, weaponCaseKey(this.config.kind), { w: 54, h: 26 }, deps.solids);
  }

  getPrompt(): InteractionPromptPayload | null {
    const { economy, weapons } = this.deps;
    const cfg = this.config;
    if (weapons.owns(cfg.id)) {
      const el = this.element.promptPart(cfg.id);
      if (weapons.isAmmoFull(cfg.id)) return { text: `${cfg.name.toUpperCase()} — MUNIÇÃO CHEIA${el}`, affordable: this.element.affordable(cfg.id) };
      return { text: `[E] MUNIÇÃO ${cfg.name.toUpperCase()} — ${money(cfg.ammoPrice)}${el}`, affordable: economy.canAfford(cfg.ammoPrice) };
    }
    return { text: `[E] COMPRAR ${cfg.name.toUpperCase()} — ${money(cfg.price)}`, affordable: economy.canAfford(cfg.price) };
  }

  interact(): void {
    const { economy, weapons } = this.deps;
    const cfg = this.config;
    if (weapons.owns(cfg.id)) {
      if (!weapons.isAmmoFull(cfg.id) && economy.spend(cfg.ammoPrice)) weapons.refillAmmo(cfg.id);
      return;
    }
    if (economy.spend(cfg.price)) weapons.give(cfg.id);
  }

  onHold(time: number, delta: number): void {
    if (this.deps.weapons.owns(this.config.id)) this.element.hold(this.config.id, time, delta);
  }
}

/** Caixa de munição (GDD §36): reabastece a arma em mãos pelo preço de munição dela. */
export class AmmoStation implements Interactable {
  private readonly element: ElementCounter;

  constructor(scene: Phaser.Scene, readonly x: number, readonly y: number, private readonly deps: StationDeps) {
    this.element = new ElementCounter(scene, deps);
    createProp(scene, x, y, ASSET_KEYS.ammoCrate, { w: 32, h: 24 }, deps.solids);
  }

  /** A M1911 não tem maleta: o elemento dela é vendido na caixa de munição. */
  private elementWeapon(): string | null {
    const id = this.deps.weapons.current.config.id;
    return id === STARTING_ELEMENT_WEAPON ? id : null;
  }

  getPrompt(): InteractionPromptPayload | null {
    const { economy, weapons } = this.deps;
    const cfg = weapons.current.config;
    const elId = this.elementWeapon();
    const el = elId ? this.element.promptPart(elId) : '';
    if (weapons.isAmmoFull(cfg.id)) return { text: `MUNIÇÃO CHEIA${el}`, affordable: !!elId && this.element.affordable(elId) };
    return { text: `[E] REABASTECER ${cfg.name.toUpperCase()} — ${money(cfg.ammoPrice)}${el}`, affordable: economy.canAfford(cfg.ammoPrice) };
  }

  onHold(time: number, delta: number): void {
    const elId = this.elementWeapon();
    if (elId) this.element.hold(elId, time, delta);
  }

  interact(): void {
    const { economy, weapons } = this.deps;
    const cfg = weapons.current.config;
    if (!weapons.isAmmoFull(cfg.id) && economy.spend(cfg.ammoPrice)) weapons.refillAmmo(cfg.id);
  }
}
