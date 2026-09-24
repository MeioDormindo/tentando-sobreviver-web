import Phaser from 'phaser';
import { ASSET_KEYS, gunIconKey } from '../config/assets.config';
import { getWeaponConfig, wallBuyConfig, type WeaponConfig } from '../config/weapons.config';
import type { InteractionPromptPayload } from '../game/events';
import type { EconomySystem } from '../systems/EconomySystem';
import type { Interactable } from '../systems/InteractionSystem';
import type { WeaponSystem } from '../weapons/WeaponSystem';
import { ElementCounter } from './ElementCounter';
import type { WallDrawing } from '../map/GameMap';

export interface StationDeps {
  economy: EconomySystem;
  weapons: WeaponSystem;
}

/** Arma inicial (sem maleta): o elemento dela sai na caixa de munição. */
const STARTING_ELEMENT_WEAPON = 'm1911';

const money = (n: number): string => `$${n.toLocaleString('pt-BR')}`;

/**
 * Desenho de giz na face da parede (compra na parede, como no CoD Zombies): a silhueta da
 * arma e o preço. Não bloqueia a passagem. Devolve o desenho, para brilhar ao comprar.
 */
function drawChalk(scene: Phaser.Scene, wall: WallDrawing, texture: string, price: string): Phaser.GameObjects.Image {
  const cfg = wallBuyConfig;
  const img = scene.add.image(wall.x, wall.y, texture).setRotation(wall.rotation).setDepth(wall.depth);
  img.setScale(Math.min(cfg.drawingWidth / img.width, cfg.drawingHeight / img.height)).setTint(cfg.chalkColor).setAlpha(cfg.chalkAlpha);
  // Contorno de giz (brilho claro em volta da arma; só no WebGL).
  img.preFX?.addGlow(cfg.chalkColor, 2.5, 0, false, 0.1, 6);
  // Preço escrito a giz logo abaixo do desenho (do lado do chão).
  const off = cfg.drawingHeight / 2 + 5;
  scene.add
    .text(wall.x - Math.sin(wall.rotation) * off, wall.y + Math.cos(wall.rotation) * off, price, { fontFamily: 'monospace', fontSize: '8px', color: '#ece6d2' })
    .setOrigin(0.5)
    .setRotation(wall.rotation)
    .setAlpha(0.9)
    .setResolution(2)
    .setDepth(wall.depth);
  return img;
}

/** Brilho rápido no giz ao comprar (a arma "sai" da parede). */
function flash(scene: Phaser.Scene, img: Phaser.GameObjects.Image): void {
  scene.tweens.killTweensOf(img);
  img.setAlpha(1).setTintFill(0xfff3b0);
  scene.tweens.add({
    targets: img,
    alpha: wallBuyConfig.chalkAlpha,
    duration: wallBuyConfig.purchaseFlashMs,
    onComplete: () => img.setTint(wallBuyConfig.chalkColor),
  });
}

/**
 * Arma na parede (GDD §60, no estilo do CoD Zombies): compra a arma; se o jogador já a possui,
 * vende munição dela (tocar E) e o elemento especial daquela arma (segurar E).
 */
export class WeaponCase implements Interactable {
  private readonly config: WeaponConfig;
  private readonly element: ElementCounter;
  private readonly chalk: Phaser.GameObjects.Image;

  constructor(private readonly scene: Phaser.Scene, readonly x: number, readonly y: number, wall: WallDrawing, weaponId: string, private readonly deps: StationDeps) {
    this.config = getWeaponConfig(weaponId);
    this.element = new ElementCounter(scene, deps);
    this.chalk = drawChalk(scene, wall, gunIconKey(this.config.kind), money(this.config.price));
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
    if (economy.spend(cfg.price)) {
      weapons.give(cfg.id);
      flash(this.scene, this.chalk);
    }
  }

  onHold(time: number, delta: number): void {
    if (this.deps.weapons.owns(this.config.id)) this.element.hold(this.config.id, time, delta);
  }
}

/** Munição na parede (GDD §36): reabastece a arma em mãos pelo preço de munição dela. */
export class AmmoStation implements Interactable {
  private readonly element: ElementCounter;

  constructor(scene: Phaser.Scene, readonly x: number, readonly y: number, wall: WallDrawing, private readonly deps: StationDeps) {
    this.element = new ElementCounter(scene, deps);
    drawChalk(scene, wall, ASSET_KEYS.ammoCrate, 'MUNIÇÃO');
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
