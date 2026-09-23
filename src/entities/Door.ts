import Phaser from 'phaser';
import { ASSET_KEYS } from '../config/assets.config';
import { TILE_SIZE } from '../config/game.config';
import { ART_SCALE } from '../config/visual.config';
import type { InteractionPromptPayload } from '../game/events';
import type { TerminalMap } from '../map/TerminalMap';
import type { AreaId, DoorDef } from '../map/terminal/layout';
import type { EconomySystem } from '../systems/EconomySystem';
import type { Interactable } from '../systems/InteractionSystem';

export interface DoorDeps {
  economy: EconomySystem;
  map: TerminalMap;
  isUnlocked: (area: AreaId) => boolean;
  onOpened: (door: Door) => void;
}

const OPEN_MS = 700;
const money = (n: number): string => `$${n.toLocaleString('pt-BR')}`;

/**
 * Porta de enrolar paga (GDD §18): bloqueia colisão, tiros e navegação até ser comprada.
 * Ao abrir, libera a área do outro lado.
 */
export class Door implements Interactable {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  private open = false;
  private readonly visuals: Array<Phaser.GameObjects.TileSprite | Phaser.GameObjects.Rectangle | Phaser.GameObjects.Text> = [];
  private readonly shutter: Phaser.GameObjects.TileSprite;

  constructor(private readonly scene: Phaser.Scene, readonly def: DoorDef, private readonly deps: DoorDeps) {
    const r = def.rect;
    const left = r.x * TILE_SIZE;
    const top = r.y * TILE_SIZE;
    const w = r.w * TILE_SIZE;
    const h = r.h * TILE_SIZE;
    this.x = left + w / 2;
    this.y = top + h / 2;
    // Alcança a porta pelos dois lados, mesmo nas portas mais grossas.
    this.radius = h / 2 + 52;

    const depth = top + h;
    this.shutter = scene.add.tileSprite(left, top - 8, w, h + 8, ASSET_KEYS.doorShutter).setOrigin(0).setTileScale(ART_SCALE).setDepth(depth);
    const stripeTop = scene.add.tileSprite(left, top - 8, w, 6, ASSET_KEYS.hazard).setOrigin(0).setTileScale(ART_SCALE).setDepth(depth + 0.1);
    const stripeBottom = scene.add.tileSprite(left, top + h - 6, w, 6, ASSET_KEYS.hazard).setOrigin(0).setTileScale(ART_SCALE).setDepth(depth + 0.1);
    const frameL = scene.add.rectangle(left, top - 8, 3, h + 8, 0x1b1c1e).setOrigin(0).setDepth(depth + 0.2);
    const frameR = scene.add.rectangle(left + w - 3, top - 8, 3, h + 8, 0x1b1c1e).setOrigin(0).setDepth(depth + 0.2);
    const label = scene.add
      .text(this.x, this.y - 4, money(def.cost), {
        fontFamily: 'Impact, "Arial Black", sans-serif',
        fontSize: '13px',
        color: '#e3c77a',
        stroke: '#000',
        strokeThickness: 3,
        resolution: 3,
      })
      .setOrigin(0.5)
      .setDepth(depth + 0.3);
    this.visuals.push(this.shutter, stripeTop, stripeBottom, frameL, frameR, label);
  }

  get isOpen(): boolean {
    return this.open;
  }

  getPrompt(): InteractionPromptPayload | null {
    if (this.open) return null;
    const [a, b] = this.def.areas;
    const target = this.deps.isUnlocked(a) ? b : a;
    const name = this.deps.map.areas.find((area) => area.id === target)?.name ?? '';
    return {
      text: `[E] ABRIR PORTA — ${money(this.def.cost)}  ▸ ${name.toUpperCase()}`,
      affordable: this.deps.economy.canAfford(this.def.cost),
    };
  }

  interact(): void {
    if (this.open || !this.deps.economy.spend(this.def.cost)) return;
    this.openDoor();
  }

  private openDoor(): void {
    this.open = true;
    this.deps.map.openDoorTiles(this.def.rect);
    this.deps.onOpened(this);
    // A porta "enrola" para cima e some.
    this.scene.tweens.add({
      targets: this.shutter,
      scaleY: 0.05,
      duration: OPEN_MS,
      ease: 'Quad.easeIn',
    });
    this.scene.tweens.add({
      targets: this.visuals,
      alpha: 0,
      delay: OPEN_MS * 0.6,
      duration: OPEN_MS * 0.5,
      onComplete: () => this.visuals.forEach((v) => v.destroy()),
    });
    this.scene.cameras.main.shake(200, 0.0025);
  }
}
