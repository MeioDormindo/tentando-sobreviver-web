import Phaser from 'phaser';
import { TILE_SIZE } from '../config/game.config';
import { emitGameEvent, GameEvents, onGameEvent } from '../game/events';
import type { GameMap } from '../map/GameMap';

/** Intervalo entre atualizações das posições no minimapa (ms). */
const STATE_EVERY_MS = 150;

interface Point {
  readonly x: number;
  readonly y: number;
}

export interface MinimapSources {
  map: GameMap;
  player: Point & { readonly rotation: number };
  zombies: Phaser.Physics.Arcade.Group;
  bosses: Phaser.Physics.Arcade.Group;
  isAreaOpen(area: string): boolean;
  box(): Point | null;
  supply(): Point | null;
  /** Objetivo atual (disjuntor, etapa da missão). */
  objective(): Point | null;
}

/**
 * Alimenta o minimapa da HUD: envia a base (reenviada quando uma porta abre ou a HUD
 * pede) e, a cada poucos décimos de segundo, as posições do que importa.
 */
export class MinimapFeed {
  private nextAt = 0;

  constructor(private readonly scene: Phaser.Scene, private readonly src: MinimapSources) {
    const ev = scene.game.events;
    const offs = [
      onGameEvent(ev, GameEvents.AreaUnlocked, () => this.sendBase()),
      onGameEvent(ev, GameEvents.HudRequest, () => this.sendBase()),
    ];
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => offs.forEach((off) => off()));
  }

  update(time: number): void {
    if (time < this.nextAt) return;
    this.nextAt = time + STATE_EVERY_MS;
    const { player, zombies, bosses } = this.src;
    const list: number[] = [];
    for (const child of zombies.getChildren()) {
      const z = child as Phaser.Physics.Arcade.Sprite & { isAlive?: boolean };
      if (z.active && z.isAlive) list.push(Math.round(z.x), Math.round(z.y));
    }
    const boss = bosses.getChildren().find((b) => b.active) as (Phaser.GameObjects.Sprite & { isAlive?: boolean }) | undefined;
    const box = this.src.box();
    const supply = this.src.supply();
    const objective = this.src.objective();
    emitGameEvent(this.scene.game.events, GameEvents.MinimapState, {
      player: [player.x, player.y, player.rotation],
      zombies: list,
      boss: boss?.isAlive ? [boss.x, boss.y] : null,
      box: box ? [box.x, box.y] : null,
      supply: supply ? [supply.x, supply.y] : null,
      objective: objective ? [objective.x, objective.y] : null,
    });
  }

  private sendBase(): void {
    const base = this.src.map.minimapCells((area) => this.src.isAreaOpen(area));
    emitGameEvent(this.scene.game.events, GameEvents.MinimapBase, { ...base, tileSize: TILE_SIZE });
  }
}
