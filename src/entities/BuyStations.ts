import Phaser from 'phaser';
import { ASSET_KEYS, weaponCaseKey } from '../config/assets.config';
import { ART_SCALE } from '../config/visual.config';
import { getWeaponConfig, type WeaponConfig } from '../config/weapons.config';
import type { InteractionPromptPayload } from '../game/events';
import type { EconomySystem } from '../systems/EconomySystem';
import type { Interactable } from '../systems/InteractionSystem';
import type { WeaponSystem } from '../weapons/WeaponSystem';

export interface StationDeps {
  economy: EconomySystem;
  weapons: WeaponSystem;
  obstacles: Phaser.Physics.Arcade.StaticGroup;
}

const money = (n: number): string => `$${n.toLocaleString('pt-BR')}`;

/** Cria a imagem do ponto de compra com um corpo sólido (o jogador não o atravessa). */
function createProp(scene: Phaser.Scene, x: number, y: number, texture: string, body: { w: number; h: number }, obstacles: Phaser.Physics.Arcade.StaticGroup): void {
  scene.add.image(x, y, texture).setScale(ART_SCALE).setDepth(y + body.h / 2);
  obstacles.add(scene.add.zone(x - 1, y - 1, body.w, body.h));
}

/**
 * Maleta com arma (GDD §60): compra a arma; se o jogador já a possui, vende munição dela.
 */
export class WeaponCase implements Interactable {
  private readonly config: WeaponConfig;

  constructor(scene: Phaser.Scene, readonly x: number, readonly y: number, weaponId: string, private readonly deps: StationDeps) {
    this.config = getWeaponConfig(weaponId);
    createProp(scene, x, y, weaponCaseKey(this.config.kind), { w: 54, h: 26 }, deps.obstacles);
  }

  getPrompt(): InteractionPromptPayload | null {
    const { economy, weapons } = this.deps;
    const cfg = this.config;
    if (weapons.owns(cfg.id)) {
      if (weapons.isAmmoFull(cfg.id)) return { text: `${cfg.name.toUpperCase()} — MUNIÇÃO CHEIA`, affordable: false };
      return { text: `[E] MUNIÇÃO ${cfg.name.toUpperCase()} — ${money(cfg.ammoPrice)}`, affordable: economy.canAfford(cfg.ammoPrice) };
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
}

/** Caixa de munição (GDD §36): reabastece a arma em mãos pelo preço de munição dela. */
export class AmmoStation implements Interactable {
  constructor(scene: Phaser.Scene, readonly x: number, readonly y: number, private readonly deps: StationDeps) {
    createProp(scene, x, y, ASSET_KEYS.ammoCrate, { w: 32, h: 24 }, deps.obstacles);
  }

  getPrompt(): InteractionPromptPayload | null {
    const { economy, weapons } = this.deps;
    const cfg = weapons.current.config;
    if (weapons.isAmmoFull(cfg.id)) return { text: 'MUNIÇÃO CHEIA', affordable: false };
    return { text: `[E] REABASTECER ${cfg.name.toUpperCase()} — ${money(cfg.ammoPrice)}`, affordable: economy.canAfford(cfg.ammoPrice) };
  }

  interact(): void {
    const { economy, weapons } = this.deps;
    const cfg = weapons.current.config;
    if (!weapons.isAmmoFull(cfg.id) && economy.spend(cfg.ammoPrice)) weapons.refillAmmo(cfg.id);
  }
}
