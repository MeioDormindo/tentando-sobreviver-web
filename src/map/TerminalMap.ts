import Phaser from 'phaser';
import { ASSET_KEYS } from '../config/assets.config';
import { TEXTURE_KEYS, TILE_SIZE } from '../config/game.config';
import { ART_SCALE, DEPTH } from '../config/visual.config';
import { NavCost, NavGrid } from '../systems/pathfinding/NavGrid';
import type { SpawnPoint } from '../systems/SpawnSystem';
import {
  AREAS, CARVES, DOORS, FLOORS, LAMPS, MAP_HEIGHT, MAP_WIDTH, OBSTACLES, OUTSIDE_DARKNESS, PLAYER_START,
  MACHINES, POCKETS, PROPS, SPAWNS, STATIONS, TRAIN_ROOF_UNITS, WINDOWS,
  type AreaDef, type DoorDef, type FloorKind, type MachinePlacement, type Rect, type WindowDef,
} from './terminal/layout';
import { perks } from '../config/machines.config';
import { PROP_DEFS } from './props';

/** Conteúdo de cada tile. */
export const Cell = {
  Floor: 0,
  Wall: 1,
  Train: 2,
  Door: 3,
  Window: 4,
} as const;
type CellValue = (typeof Cell)[keyof typeof Cell];

/** Índices do tileset invisível de colisão. */
const COLLIDE = 2;
const EMPTY = 0;
/** Altura visual das paredes acima do tile (vista 3/4). */
const WALL_RISE = 16;

const FLOOR_TEXTURES: Record<FloorKind, string> = {
  terminal: ASSET_KEYS.floor,
  concrete: ASSET_KEYS.floorConcrete,
  metal: ASSET_KEYS.floorMetal,
  tracks: ASSET_KEYS.floorTracks,
  tunnel: ASSET_KEYS.floorTunnel,
  wagon: ASSET_KEYS.floorWagon,
};

export interface Lamp {
  x: number;
  y: number;
  radius: number;
  intensity: number;
  flicker: number;
  /** Cor do brilho (padrão: luz quente de lâmpada). */
  color?: number;
  /** Luz de emergência: continua fraca durante um apagão (máquinas, pontos de compra). */
  emergency?: boolean;
}

export type MachineDef = MachinePlacement & { x: number; y: number };

export type StationDef = { type: 'weapon'; weaponId: string; x: number; y: number } | { type: 'ammo'; x: number; y: number };

export type DecalStamper = (key: string, frame: number | undefined, x: number, y: number, rotation: number, alpha: number) => void;

/**
 * Mapa Terminal Central (GDD §6–17): monta a grade a partir do layout, cria colisão,
 * navegação e visual (pisos, paredes 3/4, trem, props). Portas e barricadas são
 * entidades à parte (a porta aberta chama openDoorTiles).
 */
export class TerminalMap {
  readonly widthPx = MAP_WIDTH * TILE_SIZE;
  readonly heightPx = MAP_HEIGHT * TILE_SIZE;
  readonly wallLayer: Phaser.Tilemaps.TilemapLayer;
  readonly obstacles: Phaser.Physics.Arcade.StaticGroup;
  readonly bulletBlockers: Phaser.Physics.Arcade.StaticGroup;
  readonly nav: NavGrid;
  readonly playerSpawn: Phaser.Math.Vector2;
  readonly spawnPoints: SpawnPoint[];
  readonly lamps: Lamp[];
  readonly stations: StationDef[];
  readonly machines: MachineDef[];
  readonly doors: DoorDef[] = DOORS;
  readonly windows: WindowDef[] = WINDOWS;
  readonly areas: AreaDef[] = AREAS;

  private readonly cells: Uint8Array;
  /** Luzes dos props luminosos (telas, placas, vitrines), somadas às luminárias. */
  private readonly propLights: Lamp[] = [];
  /** Índice da área de cada tile (-1 = fora de qualquer área). */
  private readonly areaIndex: Int8Array;

  constructor(private readonly scene: Phaser.Scene) {
    this.cells = new Uint8Array(MAP_WIDTH * MAP_HEIGHT).fill(Cell.Wall);
    this.areaIndex = new Int8Array(MAP_WIDTH * MAP_HEIGHT).fill(-1);
    this.buildCells();

    // Colisão (camada invisível): paredes, trem e portas fechadas.
    const data: number[][] = [];
    for (let y = 0; y < MAP_HEIGHT; y++) {
      const row: number[] = [];
      for (let x = 0; x < MAP_WIDTH; x++) {
        const c = this.cell(x, y);
        row.push(c === Cell.Wall || c === Cell.Train || c === Cell.Door ? COLLIDE : EMPTY);
      }
      data.push(row);
    }
    const tilemap = scene.make.tilemap({ data, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const tileset = tilemap.addTilesetImage('collision', TEXTURE_KEYS.tiles, TILE_SIZE, TILE_SIZE, 0, 0);
    if (!tileset) throw new Error('Falha ao criar tileset de colisão');
    const layer = tilemap.createLayer(0, tileset, 0, 0);
    if (!layer) throw new Error('Falha ao criar layer de colisão');
    layer.setCollision(COLLIDE).setVisible(false);
    this.wallLayer = layer;

    // Navegação dos zumbis
    this.nav = new NavGrid(MAP_WIDTH, MAP_HEIGHT, TILE_SIZE);
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const c = this.cell(x, y);
        this.nav.setCost(x, y, c === Cell.Floor ? NavCost.Floor : c === Cell.Window ? NavCost.Window : NavCost.Blocked);
      }
    }

    this.obstacles = scene.physics.add.staticGroup();
    this.bulletBlockers = scene.physics.add.staticGroup();

    this.renderFloors();
    this.renderWalls();
    this.renderPlatformDetails();
    this.renderProps();

    const center = (tx: number, ty: number) => new Phaser.Math.Vector2(tx * TILE_SIZE + TILE_SIZE / 2, ty * TILE_SIZE + TILE_SIZE / 2);
    this.playerSpawn = center(PLAYER_START.tx, PLAYER_START.ty);
    this.spawnPoints = SPAWNS.map((s) => {
      const p = center(s.tx, s.ty);
      return { id: s.id, x: p.x, y: p.y, sector: s.area, minWave: s.minWave, enabled: this.cell(s.tx, s.ty) === Cell.Floor };
    });
    this.stations = STATIONS.map((s) => {
      const p = center(s.tx, s.ty);
      return s.type === 'weapon' ? { type: 'weapon', weaponId: s.weaponId, x: p.x, y: p.y } : { type: 'ammo', x: p.x, y: p.y };
    });
    this.lamps = LAMPS.map((l) => ({ ...center(l.tx, l.ty), radius: l.radius, intensity: l.intensity, flicker: l.flicker }));
    this.lamps.push(...this.propLights);
    // Luz fraca sobre cada ponto de compra, para ser encontrado no escuro.
    for (const s of this.stations) this.lamps.push({ x: s.x, y: s.y, radius: 70, intensity: 0.45, flicker: 0, emergency: true });
    this.machines = MACHINES.map((m) => ({ ...m, ...center(m.tx, m.ty) }));
    // Máquinas iluminadas com a cor delas (perks) ou luz dourada/roxa.
    for (const m of this.machines) {
      const color = m.type === 'perk' ? perks[m.perkId].color : m.type === 'weapon_lab' ? 0x9b59d0 : 0xffd27a;
      this.lamps.push({ x: m.x, y: m.y, radius: 95, intensity: 0.6, flicker: 0.05, color, emergency: true });
    }
  }

  // ───────────────────────── Consultas ─────────────────────────

  cell(tx: number, ty: number): CellValue {
    if (tx < 0 || ty < 0 || tx >= MAP_WIDTH || ty >= MAP_HEIGHT) return Cell.Wall;
    return this.cells[ty * MAP_WIDTH + tx] as CellValue;
  }

  areaAt(x: number, y: number): AreaDef | null {
    const tx = Math.floor(x / TILE_SIZE);
    const ty = Math.floor(y / TILE_SIZE);
    if (tx < 0 || ty < 0 || tx >= MAP_WIDTH || ty >= MAP_HEIGHT) return null;
    const i = this.areaIndex[ty * MAP_WIDTH + tx];
    return i >= 0 ? AREAS[i] : null;
  }

  /** Tipo de piso num ponto (som dos passos). */
  floorAt(x: number, y: number): FloorKind {
    const tx = Math.floor(x / TILE_SIZE);
    const ty = Math.floor(y / TILE_SIZE);
    for (let i = FLOORS.length - 1; i >= 0; i--) {
      const r = FLOORS[i].rect;
      if (tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h) return FLOORS[i].kind;
    }
    return 'concrete';
  }

  /** Escuridão ambiente no ponto (varia por área, GDD §50). */
  readonly darknessAt = (x: number, y: number): number => this.areaAt(x, y)?.darkness ?? OUTSIDE_DARKNESS;

  // ───────────────────────── Mudanças dinâmicas ─────────────────────────

  /** Corpo sólido extra (máquinas, maletas): colide, bloqueia tiros e a navegação. */
  addSolid(cx: number, cy: number, w: number, h: number): void {
    const zone = this.scene.add.zone(cx, cy, w, h);
    this.obstacles.add(zone);
    this.bulletBlockers.add(zone);
    this.blockNav(cx, cy, w, h);
  }

  private blockNav(cx: number, cy: number, w: number, h: number): void {
    const t = (v: number) => Math.floor(v / TILE_SIZE);
    for (let ty = t(cy - h / 2 + 4); ty <= t(cy + h / 2 - 4); ty++) {
      for (let tx = t(cx - w / 2 + 4); tx <= t(cx + w / 2 - 4); tx++) this.nav.setCost(tx, ty, NavCost.Blocked);
    }
  }

  /** Porta aberta: os tiles viram chão para colisão e navegação. */
  openDoorTiles(rect: Rect): void {
    this.forEachTile(rect, (x, y) => {
      this.cells[y * MAP_WIDTH + x] = Cell.Floor;
      this.wallLayer.putTileAt(EMPTY, x, y);
      this.nav.setCost(x, y, NavCost.Floor);
    });
  }

  /** Espalha sujeira, papéis e sangue antigo pelo chão das áreas (determinístico). */
  scatterDecals(stamp: DecalStamper): void {
    const rnd = new Phaser.Math.RandomDataGenerator(['terminal-decals']);
    for (const area of AREAS) {
      for (const r of area.rects) {
        const tiles = r.w * r.h;
        const place = (count: number, key: string, frames: number | undefined, alpha: [number, number]): void => {
          for (let i = 0; i < count; i++) {
            const tx = rnd.between(r.x, r.x + r.w - 1);
            const ty = rnd.between(r.y, r.y + r.h - 1);
            if (this.cell(tx, ty) !== Cell.Floor) continue;
            const frame = frames === undefined ? undefined : rnd.between(0, frames - 1);
            stamp(key, frame, tx * TILE_SIZE + rnd.between(0, TILE_SIZE), ty * TILE_SIZE + rnd.between(0, TILE_SIZE), rnd.rotation(), rnd.realInRange(alpha[0], alpha[1]));
          }
        };
        place(Math.round(tiles / 70), ASSET_KEYS.debris, undefined, [0.5, 0.9]);
        place(Math.round(tiles / 110), ASSET_KEYS.papers, undefined, [0.5, 0.85]);
        place(Math.round(tiles / 160), ASSET_KEYS.bloodSplats, 3, [0.3, 0.65]);
      }
    }
  }

  // ───────────────────────── Construção ─────────────────────────

  private buildCells(): void {
    const set = (r: Rect, value: CellValue) => this.forEachTile(r, (x, y) => (this.cells[y * MAP_WIDTH + x] = value));
    for (const a of AREAS) for (const r of a.rects) set(r, Cell.Floor);
    for (const r of POCKETS) set(r, Cell.Floor);
    for (const o of OBSTACLES) set(o.rect, o.kind === 'train' ? Cell.Train : Cell.Wall);
    for (const r of CARVES) set(r, Cell.Floor);
    for (const d of DOORS) set(d.rect, Cell.Door);
    for (const w of WINDOWS) set(w.rect, Cell.Window);

    AREAS.forEach((area, index) => {
      for (const r of area.rects) this.forEachTile(r, (x, y) => (this.areaIndex[y * MAP_WIDTH + x] = index));
    });
  }

  private forEachTile(r: Rect, fn: (x: number, y: number) => void): void {
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        if (x >= 0 && y >= 0 && x < MAP_WIDTH && y < MAP_HEIGHT) fn(x, y);
      }
    }
  }

  private isSolidVisual(tx: number, ty: number): boolean {
    const c = this.cell(tx, ty);
    return c === Cell.Wall || c === Cell.Train;
  }

  private renderFloors(): void {
    for (const { rect, kind } of FLOORS) {
      this.scene.add
        .tileSprite(rect.x * TILE_SIZE, rect.y * TILE_SIZE, rect.w * TILE_SIZE, rect.h * TILE_SIZE, FLOOR_TEXTURES[kind])
        .setOrigin(0)
        .setTileScale(ART_SCALE)
        .setTilePosition(rect.x * TILE_SIZE * 2, rect.y * TILE_SIZE * 2)
        .setDepth(DEPTH.floor);
    }
  }

  /**
   * Só desenha paredes que tocam algo aberto: a massa sólida interna fica escura
   * (fundo), o que reduz milhares de sprites.
   */
  private renderWalls(): void {
    const { scene } = this;
    const exposed = (x: number, y: number): boolean => {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!this.isSolidVisual(x + dx, y + dy)) return true;
      return false;
    };

    for (let ty = 0; ty < MAP_HEIGHT; ty++) {
      for (let tx = 0; tx < MAP_WIDTH; tx++) {
        if (!this.isSolidVisual(tx, ty)) continue;
        const train = this.cell(tx, ty) === Cell.Train;
        // O trem é sempre desenhado inteiro (é um objeto, não massa de parede).
        if (!train && !exposed(tx, ty)) continue;
        const x = tx * TILE_SIZE;
        const top = ty * TILE_SIZE - WALL_RISE;
        const depth = (ty + 1) * TILE_SIZE;
        const hasFace = !this.isSolidVisual(tx, ty + 1);
        const height = hasFace ? TILE_SIZE + WALL_RISE : TILE_SIZE;
        const texture = train
          ? hasFace ? ASSET_KEYS.trainFull : ASSET_KEYS.trainCap
          : hasFace ? ASSET_KEYS.wallFull : ASSET_KEYS.wallCap;

        scene.add.image(x, top, texture).setOrigin(0).setScale(ART_SCALE).setDepth(depth);
        if (hasFace) {
          scene.add.image(x, (ty + 1) * TILE_SIZE, ASSET_KEYS.wallShadow).setOrigin(0).setScale(ART_SCALE).setDepth(DEPTH.wallShadow);
        }
        const edge = train ? 0x1a2228 : 0x050605;
        if (!this.isSolidVisual(tx, ty - 1)) scene.add.rectangle(x, top, TILE_SIZE, 1.5, 0x8a8c84, 0.55).setOrigin(0).setDepth(depth);
        if (!this.isSolidVisual(tx - 1, ty)) scene.add.rectangle(x, top, 1.5, height, edge, 0.8).setOrigin(0).setDepth(depth);
        if (!this.isSolidVisual(tx + 1, ty)) scene.add.rectangle(x + TILE_SIZE - 1.5, top, 1.5, height, edge, 0.8).setOrigin(0).setDepth(depth);
      }
    }
  }

  /** Faixa tátil na borda da plataforma e equipamentos no teto do trem. */
  private renderPlatformDetails(): void {
    const platform = FLOORS.find((f) => f.kind === 'concrete');
    if (platform) {
      const r = platform.rect;
      this.scene.add
        .tileSprite(r.x * TILE_SIZE, r.y * TILE_SIZE + 2, r.w * TILE_SIZE, 10, ASSET_KEYS.tactile)
        .setOrigin(0)
        .setTileScale(ART_SCALE)
        .setDepth(DEPTH.decals + 1);
    }
    for (const u of TRAIN_ROOF_UNITS) {
      this.scene.add
        .image(u.tx * TILE_SIZE, u.ty * TILE_SIZE - WALL_RISE, ASSET_KEYS.trainRoofUnit)
        .setScale(ART_SCALE)
        .setDepth(12 * TILE_SIZE + 1);
    }
  }

  private renderProps(): void {
    for (const p of PROPS) {
      const def = PROP_DEFS[p.type];
      const x = p.tx * TILE_SIZE + TILE_SIZE / 2;
      const y = p.ty * TILE_SIZE + TILE_SIZE / 2;
      const img = this.scene.add.image(x, y, def.texture).setScale(ART_SCALE).setAngle(p.angle ?? 0);
      if (def.light) this.propLights.push({ x, y, ...def.light, flicker: 0.05, emergency: true });
      if (def.body) {
        const zone = this.scene.add.zone(x + def.body.ox, y + def.body.oy, def.body.w, def.body.h);
        this.obstacles.add(zone);
        if (def.blocksBullets) this.bulletBlockers.add(zone);
        img.setDepth(y + def.body.oy + def.body.h / 2);
        // Props sólidos também bloqueiam a navegação dos zumbis.
        this.blockNav(x + def.body.ox, y + def.body.oy, def.body.w, def.body.h);
      } else {
        img.setDepth(DEPTH.corpses + 1);
      }
    }
  }
}
