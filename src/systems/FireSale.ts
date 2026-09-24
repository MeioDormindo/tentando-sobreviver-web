import Phaser from 'phaser';
import { audio } from '../audio/AudioSystem';
import { MysteryBox } from '../entities/MysteryBox';
import { emitGameEvent, GameEvents } from '../game/events';
import type { InteractionSystem } from './InteractionSystem';

interface Spot {
  x: number;
  y: number;
  area: string;
}

export interface FireSaleDeps {
  interaction: InteractionSystem;
  spots: readonly Spot[];
  isAreaOpen(area: string): boolean;
  /** Caixa principal (não ganha cópia no mesmo lugar). */
  mainBox(): { x: number; y: number } | null;
  /** O lugar está livre para uma caixa? */
  isFree(spot: Spot): boolean;
  createBox(spot: Spot): MysteryBox;
}

/** Distância mínima (px) da caixa principal para criar uma cópia. */
const MIN_FROM_MAIN = 48;

/**
 * Power-up Fire Sale (clássico do CoD Zombies): durante a liquidação a Mystery Box custa $10 e
 * aparece em todos os locais das áreas abertas. No fim, as caixas extras somem.
 */
export class FireSale {
  private active = false;
  private extras: MysteryBox[] = [];

  constructor(private readonly scene: Phaser.Scene, private readonly deps: FireSaleDeps) {
    MysteryBox.fireSale = false;
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      MysteryBox.fireSale = false;
    });
  }

  start(): void {
    if (this.active) return;
    this.active = true;
    MysteryBox.fireSale = true;
    const main = this.deps.mainBox();
    for (const spot of this.deps.spots) {
      if (!this.deps.isAreaOpen(spot.area) || !this.deps.isFree(spot)) continue;
      if (main && Phaser.Math.Distance.Between(main.x, main.y, spot.x, spot.y) < MIN_FROM_MAIN) continue;
      const box = this.deps.createBox(spot);
      this.deps.interaction.add(box);
      this.extras.push(box);
    }
    audio.play('box_music', { category: 'ui', volume: 0.9, rate: 1.35, pitchJitter: 0 });
    emitGameEvent(this.scene.game.events, GameEvents.Toast, {
      text: `FIRE SALE! MYSTERY BOX A $10${this.extras.length > 0 ? ` · +${this.extras.length} CAIXAS NO MAPA` : ''}`,
    });
  }

  end(): void {
    if (!this.active) return;
    this.active = false;
    MysteryBox.fireSale = false;
    for (const box of this.extras) box.dismiss(() => this.deps.interaction.remove(box));
    this.extras = [];
  }
}
