import Phaser from 'phaser';
import { ASSET_KEYS } from '../config/assets.config';
import { barricadeConfig } from '../config/economy.config';
import { TILE_SIZE } from '../config/game.config';
import { ART_SCALE, DEPTH } from '../config/visual.config';
import type { InteractionPromptPayload } from '../game/events';
import type { WindowDef } from '../map/terminal/layout';
import type { EconomySystem } from '../systems/EconomySystem';
import type { Interactable } from '../systems/InteractionSystem';
import type { Player } from './Player';

export interface BarricadeDeps {
  economy: EconomySystem;
  player: Player;
  /** Corpos das barricadas (colidem com zumbis só enquanto há tábuas; com o jogador, sempre). */
  bodies: Phaser.Physics.Arcade.StaticGroup;
}

/**
 * Barricada de janela (GDD §19): INTACT → DAMAGED → DESTROYED conforme os zumbis
 * arrancam tábuas. O jogador conserta segurando E (+$ por tábua); tomar dano interrompe.
 */
export class Barricade implements Interactable {
  readonly x: number;
  readonly y: number;
  readonly radius = 52;
  private planks = barricadeConfig.maxPlanks;
  private readonly plankImages: Phaser.GameObjects.Image[] = [];
  private repairMs = 0;
  private readonly depth: number;

  constructor(private readonly scene: Phaser.Scene, readonly def: WindowDef, private readonly deps: BarricadeDeps) {
    const r = def.rect;
    const left = r.x * TILE_SIZE;
    const top = r.y * TILE_SIZE;
    const w = r.w * TILE_SIZE;
    const h = r.h * TILE_SIZE;
    this.x = left + w / 2;
    this.y = top + h / 2;
    this.depth = top + h + 1;

    for (let i = 0; i < r.h; i++) {
      scene.add.image(left, top + i * TILE_SIZE, ASSET_KEYS.windowSill).setOrigin(0).setScale(ART_SCALE).setDepth(DEPTH.wallShadow + 1);
    }
    const zone = scene.add.zone(this.x, this.y, w, h);
    zone.setData('barricade', this);
    deps.bodies.add(zone);

    for (let i = 0; i < barricadeConfig.maxPlanks; i++) this.plankImages.push(this.makePlank(i));
  }

  get isIntact(): boolean {
    return this.planks > 0;
  }

  get state(): 'INTACT' | 'DAMAGED' | 'DESTROYED' {
    if (this.planks === barricadeConfig.maxPlanks) return 'INTACT';
    return this.planks > 0 ? 'DAMAGED' : 'DESTROYED';
  }

  /** Um zumbi arranca uma ou mais tábuas. */
  takeHit(amount = 1): void {
    for (let i = 0; i < amount && this.planks > 0; i++) this.removePlank();
  }

  private removePlank(): void {
    this.planks--;
    const plank = this.plankImages[this.planks];
    const dir = this.def.rect.x < 64 ? 1 : -1; // cai para dentro da área
    this.scene.tweens.add({
      targets: plank,
      x: plank.x + dir * Phaser.Math.Between(18, 30),
      y: plank.y + Phaser.Math.Between(-10, 10),
      angle: plank.angle + Phaser.Math.Between(-80, 80),
      alpha: 0,
      duration: 450,
      ease: 'Quad.easeOut',
    });
    this.scene.cameras.main.shake(60, 0.0015);
  }

  getPrompt(): InteractionPromptPayload | null {
    if (this.planks >= barricadeConfig.maxPlanks) return null;
    return { text: `[E] SEGURE PARA REPARAR  (+$${barricadeConfig.repairReward})`, affordable: true };
  }

  interact(): void {
    // O reparo acontece enquanto E está pressionado (onHold).
  }

  onHold(time: number, delta: number): void {
    if (this.planks >= barricadeConfig.maxPlanks) return;
    if (this.deps.player.msSinceDamage(time) < barricadeConfig.repairInterruptMs) {
      this.repairMs = 0;
      return;
    }
    this.repairMs += delta;
    if (this.repairMs < barricadeConfig.repairTimeMs) return;
    this.repairMs = 0;
    const plank = this.plankImages[this.planks];
    this.planks++;
    this.resetPlank(plank, this.planks - 1);
    plank.setAlpha(0).setScale(ART_SCALE * 2.2);
    this.scene.tweens.add({ targets: plank, alpha: 1, scaleX: ART_SCALE * 1.8, scaleY: ART_SCALE * 1.6, duration: 160 });
    this.deps.economy.earn(barricadeConfig.repairReward);
  }

  private makePlank(index: number): Phaser.GameObjects.Image {
    const img = this.scene.add.image(0, 0, ASSET_KEYS.plank).setDepth(this.depth);
    this.resetPlank(img, index);
    return img;
  }

  /** Tábuas cruzadas sobre o vão, na direção da parede. */
  private resetPlank(img: Phaser.GameObjects.Image, index: number): void {
    this.scene.tweens.killTweensOf(img);
    const offset = (index - (barricadeConfig.maxPlanks - 1) / 2) * 4;
    const angle = 90 + (index % 2 === 0 ? 1 : -1) * (8 + index * 3);
    img
      .setPosition(this.x + offset, this.y + offset * 1.5)
      .setAngle(angle)
      .setScale(ART_SCALE * 1.8, ART_SCALE * 1.6)
      .setAlpha(1);
  }
}
