import Phaser from 'phaser';
import { gunIconKey } from '../config/assets.config';
import { weaponDropConfig } from '../config/weapons.config';
import { DEPTH } from '../config/visual.config';
import type { InteractionPromptPayload } from '../game/events';
import type { InteractionSystem, Interactable } from '../systems/InteractionSystem';
import type { Weapon } from '../weapons/Weapon';

export interface WeaponDropDeps {
  interaction: InteractionSystem;
  /** Nome da arma em mãos (para o aviso de troca). */
  currentName(): string;
  /** Pega a arma de volta (a arma em mãos cai no lugar). */
  takeBack(weapon: Weapon): void;
}

/**
 * Arma largada no chão ao pegar outra com os dois espaços cheios. Guarda o próprio objeto
 * Weapon (munição, Mk, elemento); some em 60s, piscando no fim.
 */
export class WeaponDrop implements Interactable {
  readonly radius = 44;
  private readonly icon: Phaser.GameObjects.Image;
  private readonly glow: Phaser.GameObjects.Arc;
  private readonly createdAt: number;
  private gone = false;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly x: number,
    readonly y: number,
    private readonly weapon: Weapon,
    private readonly deps: WeaponDropDeps,
  ) {
    this.createdAt = scene.time.now;
    this.glow = scene.add.circle(x, y, 20, 0xffe9a8, 0.18).setDepth(DEPTH.glow);
    this.icon = scene.add.image(x, y, gunIconKey(weapon.config.kind)).setScale(0.32).setRotation(Phaser.Math.FloatBetween(-0.5, 0.5)).setDepth(y);
    scene.tweens.add({ targets: this.glow, scale: 1.3, alpha: 0.05, duration: 700, yoyo: true, repeat: -1 });
    deps.interaction.add(this);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.tick, this);
  }

  getPrompt(): InteractionPromptPayload | null {
    if (this.gone) return null;
    const left = Math.ceil((weaponDropConfig.lifetimeMs - (this.scene.time.now - this.createdAt)) / 1000);
    return { text: `[E] PEGAR ${this.weapon.config.name.toUpperCase()} (troca por ${this.deps.currentName().toUpperCase()}) · ${left}s`, affordable: true };
  }

  interact(): void {
    if (this.gone) return;
    this.remove();
    this.deps.takeBack(this.weapon);
  }

  private tick(time: number): void {
    const age = time - this.createdAt;
    if (age >= weaponDropConfig.lifetimeMs) {
      this.remove();
      return;
    }
    // Pisca nos últimos segundos.
    if (age >= weaponDropConfig.blinkAtMs) this.icon.setAlpha(Math.floor(age / 200) % 2 === 0 ? 1 : 0.25);
  }

  private remove(): void {
    if (this.gone) return;
    this.gone = true;
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.tick, this);
    this.deps.interaction.remove(this);
    this.icon.destroy();
    this.glow.destroy();
  }
}
