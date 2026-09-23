import Phaser from 'phaser';
import { ASSET_KEYS } from '../config/assets.config';
import { TEXTURE_KEYS, TILE_SIZE } from '../config/game.config';
import { ART_SCALE, DEPTH, type LampConfig } from '../config/visual.config';
import type { SpawnPoint } from '../systems/SpawnSystem';
import { PROP_DEFS, type PropPlacement } from './props';

export const TileIndex = {
  Floor: 0,
  Wall: 2,
} as const;

interface TileRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const MAP_WIDTH = 64;
const MAP_HEIGHT = 44;
/** Altura visual da parede acima do seu tile (vista 3/4). */
const WALL_RISE = 16;

/** Obstáculos internos (em tiles): pilares, balcões e paredes parciais. */
const OBSTACLES: TileRect[] = [
  { x: 24, y: 15, w: 2, h: 2 },
  { x: 38, y: 15, w: 2, h: 2 },
  { x: 24, y: 27, w: 2, h: 2 },
  { x: 38, y: 27, w: 2, h: 2 },
  { x: 8, y: 10, w: 8, h: 1 },
  { x: 48, y: 33, w: 8, h: 1 },
  { x: 16, y: 20, w: 1, h: 10 },
  { x: 47, y: 12, w: 1, h: 10 },
  { x: 28, y: 36, w: 8, h: 1 },
  { x: 28, y: 6, w: 8, h: 1 },
];

const PROPS: PropPlacement[] = [
  // área de espera central
  { type: 'bench', tx: 29, ty: 18 },
  { type: 'bench', tx: 35.5, ty: 18 },
  { type: 'bench', tx: 29, ty: 26.5 },
  { type: 'bench', tx: 35.5, ty: 26.5 },
  { type: 'trash', tx: 27, ty: 13 },
  { type: 'trash', tx: 37, ty: 13 },
  { type: 'trash', tx: 27, ty: 31 },
  { type: 'trash', tx: 37, ty: 31 },
  { type: 'trash', tx: 18, ty: 38 },
  // depósito improvisado
  { type: 'crate', tx: 5, ty: 14 },
  { type: 'crate', tx: 6.1, ty: 14.2 },
  { type: 'crate', tx: 5.4, ty: 15.2 },
  { type: 'crate', tx: 57, ty: 6 },
  { type: 'crate', tx: 58.2, ty: 7 },
  { type: 'crate', tx: 40, ty: 39 },
  { type: 'crate', tx: 41.2, ty: 39.3 },
  { type: 'crate', tx: 12, ty: 34 },
  { type: 'barrel', tx: 20, ty: 5 },
  { type: 'barrel', tx: 21.1, ty: 5.9 },
  { type: 'barrel', tx: 52, ty: 26 },
  { type: 'barrel', tx: 10, ty: 24 },
  { type: 'barrel', tx: 44, ty: 30 },
  // abandonados
  { type: 'suitcase', tx: 33, ty: 15, angle: 20 },
  { type: 'suitcase', tx: 22, ty: 22, angle: -35 },
  { type: 'suitcase', tx: 44, ty: 24, angle: 70 },
];

const LAMPS: LampConfig[] = [
  { tx: 32, ty: 12, radius: 220, intensity: 0.75, flicker: 0.1 },
  { tx: 32, ty: 32, radius: 200, intensity: 0.6, flicker: 0.6 },
  { tx: 11, ty: 22, radius: 170, intensity: 0.55, flicker: 0.2 },
  { tx: 53, ty: 22, radius: 180, intensity: 0.5, flicker: 0.9 },
  { tx: 9, ty: 6, radius: 150, intensity: 0.45, flicker: 0.3 },
  { tx: 55, ty: 39, radius: 160, intensity: 0.5, flicker: 0.4 },
];

interface SpawnPointDef {
  id: string;
  tx: number;
  ty: number;
  minWave: number;
}

/** Pontos de spawn (GDD §20), próximos às bordas; alguns só abrem em waves mais altas. */
const SPAWN_POINTS: SpawnPointDef[] = [
  { id: 'H1', tx: 3, ty: 3, minWave: 1 },
  { id: 'H2', tx: 60, ty: 3, minWave: 1 },
  { id: 'H3', tx: 3, ty: 40, minWave: 1 },
  { id: 'H4', tx: 60, ty: 40, minWave: 1 },
  { id: 'H5', tx: 32, ty: 2, minWave: 1 },
  { id: 'H6', tx: 32, ty: 41, minWave: 1 },
  { id: 'H7', tx: 2, ty: 22, minWave: 2 },
  { id: 'H8', tx: 61, ty: 22, minWave: 2 },
  { id: 'H9', tx: 18, ty: 2, minWave: 3 },
  { id: 'H10', tx: 46, ty: 41, minWave: 3 },
  { id: 'H11', tx: 46, ty: 2, minWave: 4 },
  { id: 'H12', tx: 18, ty: 41, minWave: 4 },
];

/** Pontos de compra (em tiles). */
const STATIONS: Array<{ type: 'weapon'; weaponId: string; tx: number; ty: number } | { type: 'ammo'; tx: number; ty: number }> = [
  { type: 'ammo', tx: 30, ty: 22 },
  { type: 'weapon', weaponId: 'glock', tx: 34.5, ty: 21 },
  { type: 'weapon', weaponId: 'mp5', tx: 20, ty: 13 },
  { type: 'weapon', weaponId: 'pump', tx: 22, ty: 34 },
  { type: 'weapon', weaponId: 'm4', tx: 44, ty: 35 },
  { type: 'weapon', weaponId: 'vector', tx: 51, ty: 16 },
  { type: 'weapon', weaponId: 'ak', tx: 11, ty: 28 },
  { type: 'weapon', weaponId: 'combat_shotgun', tx: 56, ty: 28 },
];

export type StationDef = { type: 'weapon'; weaponId: string; x: number; y: number } | { type: 'ammo'; x: number; y: number };

export interface Lamp {
  x: number;
  y: number;
  radius: number;
  intensity: number;
  flicker: number;
}

export type DecalStamper = (key: string, frame: number | undefined, x: number, y: number, rotation: number, alpha: number) => void;

/**
 * Arena de teste com visual 3/4: piso contínuo, paredes com face frontal e sombra,
 * props com colisão e luminárias. Será substituída pelo Terminal Central (Fase 4).
 */
export class TestMap {
  readonly widthPx = MAP_WIDTH * TILE_SIZE;
  readonly heightPx = MAP_HEIGHT * TILE_SIZE;
  /** Camada invisível de colisão (grid de navegação). */
  readonly wallLayer: Phaser.Tilemaps.TilemapLayer;
  /** Corpos estáticos dos props. */
  readonly obstacles: Phaser.Physics.Arcade.StaticGroup;
  /** Props que bloqueiam tiros. */
  readonly bulletBlockers: Phaser.Physics.Arcade.StaticGroup;
  readonly playerSpawn: Phaser.Math.Vector2;
  readonly spawnPoints: SpawnPoint[];
  readonly lamps: Lamp[];
  readonly stations: StationDef[];

  private readonly data: number[][];

  constructor(private readonly scene: Phaser.Scene) {
    this.data = TestMap.buildData();

    const tilemap = scene.make.tilemap({ data: this.data, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const tileset = tilemap.addTilesetImage('collision', TEXTURE_KEYS.tiles, TILE_SIZE, TILE_SIZE, 0, 0);
    if (!tileset) throw new Error('Falha ao criar tileset de colisão');
    const layer = tilemap.createLayer(0, tileset, 0, 0);
    if (!layer) throw new Error('Falha ao criar layer de colisão');
    layer.setCollision(TileIndex.Wall).setVisible(false);
    this.wallLayer = layer;

    this.obstacles = scene.physics.add.staticGroup();
    this.bulletBlockers = scene.physics.add.staticGroup();

    this.createFloor();
    this.createWalls();
    this.createProps();

    this.playerSpawn = TestMap.tileCenter(MAP_WIDTH / 2, MAP_HEIGHT / 2);
    this.spawnPoints = SPAWN_POINTS.map((p) => {
      const pos = TestMap.tileCenter(p.tx, p.ty);
      return { id: p.id, x: pos.x, y: pos.y, sector: 'hall', minWave: p.minWave, enabled: !this.isWall(p.tx, p.ty) };
    });
    this.stations = STATIONS.map((s) => {
      const x = s.tx * TILE_SIZE + TILE_SIZE / 2;
      const y = s.ty * TILE_SIZE + TILE_SIZE / 2;
      return s.type === 'weapon' ? { type: 'weapon', weaponId: s.weaponId, x, y } : { type: 'ammo', x, y };
    });
    this.lamps = LAMPS.map((l) => ({
      x: l.tx * TILE_SIZE + TILE_SIZE / 2,
      y: l.ty * TILE_SIZE + TILE_SIZE / 2,
      radius: l.radius,
      intensity: l.intensity,
      flicker: l.flicker,
    }));
    // Luz fraca sobre cada ponto de compra, para ser encontrado no escuro.
    for (const s of this.stations) this.lamps.push({ x: s.x, y: s.y, radius: 70, intensity: 0.45, flicker: 0 });
  }

  isWall(tx: number, ty: number): boolean {
    if (tx < 0 || ty < 0 || tx >= MAP_WIDTH || ty >= MAP_HEIGHT) return true;
    return this.data[ty][tx] === TileIndex.Wall;
  }

  /** Espalha sujeira, papéis e sangue antigo pelo chão (determinístico). */
  scatterDecals(stamp: DecalStamper): void {
    const rnd = new Phaser.Math.RandomDataGenerator(['terminal-decals']);
    const place = (count: number, key: string, frames: number | undefined, alpha: [number, number]): void => {
      for (let i = 0; i < count; i++) {
        const tx = rnd.between(1, MAP_WIDTH - 2);
        const ty = rnd.between(1, MAP_HEIGHT - 2);
        if (this.isWall(tx, ty)) continue;
        const frame = frames === undefined ? undefined : rnd.between(0, frames - 1);
        stamp(
          key,
          frame,
          tx * TILE_SIZE + rnd.between(0, TILE_SIZE),
          ty * TILE_SIZE + rnd.between(0, TILE_SIZE),
          rnd.rotation(),
          rnd.realInRange(alpha[0], alpha[1]),
        );
      }
    };
    place(18, ASSET_KEYS.debris, undefined, [0.5, 0.9]);
    place(14, ASSET_KEYS.papers, undefined, [0.5, 0.85]);
    place(10, ASSET_KEYS.bloodSplats, 3, [0.35, 0.7]);
  }

  private createFloor(): void {
    this.scene.add
      .tileSprite(0, 0, this.widthPx, this.heightPx, ASSET_KEYS.floor)
      .setOrigin(0)
      .setTileScale(ART_SCALE)
      .setDepth(DEPTH.floor);
  }

  /** Cada tile de parede: topo elevado + face frontal quando não há parede ao sul. */
  private createWalls(): void {
    const { scene } = this;
    for (let ty = 0; ty < MAP_HEIGHT; ty++) {
      for (let tx = 0; tx < MAP_WIDTH; tx++) {
        if (!this.isWall(tx, ty)) continue;
        const x = tx * TILE_SIZE;
        const top = ty * TILE_SIZE - WALL_RISE;
        const depth = (ty + 1) * TILE_SIZE;
        const hasFace = !this.isWall(tx, ty + 1);
        const height = hasFace ? TILE_SIZE + WALL_RISE : TILE_SIZE;

        scene.add
          .image(x, top, hasFace ? ASSET_KEYS.wallFull : ASSET_KEYS.wallCap)
          .setOrigin(0)
          .setScale(ART_SCALE)
          .setDepth(depth);

        if (hasFace) {
          scene.add
            .image(x, (ty + 1) * TILE_SIZE, ASSET_KEYS.wallShadow)
            .setOrigin(0)
            .setScale(ART_SCALE)
            .setDepth(DEPTH.wallShadow);
        }
        // Arestas: luz no topo, sombra nas laterais expostas
        if (!this.isWall(tx, ty - 1)) {
          scene.add.rectangle(x, top, TILE_SIZE, 1.5, 0x8a8c84, 0.55).setOrigin(0).setDepth(depth);
        }
        if (!this.isWall(tx - 1, ty)) {
          scene.add.rectangle(x, top, 1.5, height, 0x050605, 0.8).setOrigin(0).setDepth(depth);
        }
        if (!this.isWall(tx + 1, ty)) {
          scene.add.rectangle(x + TILE_SIZE - 1.5, top, 1.5, height, 0x050605, 0.8).setOrigin(0).setDepth(depth);
        }
      }
    }
  }

  private createProps(): void {
    for (const p of PROPS) {
      const def = PROP_DEFS[p.type];
      const x = p.tx * TILE_SIZE + TILE_SIZE / 2;
      const y = p.ty * TILE_SIZE + TILE_SIZE / 2;
      const img = this.scene.add.image(x, y, def.texture).setScale(ART_SCALE).setAngle(p.angle ?? 0);

      if (def.body) {
        const zone = this.scene.add.zone(x + def.body.ox, y + def.body.oy, def.body.w, def.body.h);
        this.obstacles.add(zone);
        if (def.blocksBullets) this.bulletBlockers.add(zone);
        img.setDepth(y + def.body.oy + def.body.h / 2);
      } else {
        img.setDepth(DEPTH.corpses);
      }
    }
  }

  private static tileCenter(tx: number, ty: number): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(tx * TILE_SIZE + TILE_SIZE / 2, ty * TILE_SIZE + TILE_SIZE / 2);
  }

  private static buildData(): number[][] {
    const data: number[][] = [];
    for (let y = 0; y < MAP_HEIGHT; y++) {
      const row: number[] = [];
      for (let x = 0; x < MAP_WIDTH; x++) {
        const border = x === 0 || y === 0 || x === MAP_WIDTH - 1 || y === MAP_HEIGHT - 1;
        row.push(border ? TileIndex.Wall : TileIndex.Floor);
      }
      data.push(row);
    }
    for (const r of OBSTACLES) {
      for (let y = r.y; y < r.y + r.h; y++) {
        for (let x = r.x; x < r.x + r.w; x++) data[y][x] = TileIndex.Wall;
      }
    }
    return data;
  }
}
