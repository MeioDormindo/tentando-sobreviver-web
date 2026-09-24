import Phaser from 'phaser';
import { ASSET_KEYS } from '../config/assets.config';
import { TEXTURE_KEYS, TILE_SIZE } from '../config/game.config';
import { ART_SCALE, DEPTH } from '../config/visual.config';
import { NavCost, NavGrid } from '../systems/pathfinding/NavGrid';
import type { SpawnPoint } from '../systems/SpawnSystem';
import type { AreaDef, DoorDef, FloorKind, MachinePlacement, MapLayout, Rect, WindowDef } from './types';
import { perks } from '../config/machines.config';
import { powerConfig } from '../config/power.config';
import { PROP_DEFS } from './props';
import { snapToWall } from './wallSnap';
import { wallBuyConfig } from '../config/weapons.config';

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
  hospital: ASSET_KEYS.floorHospital,
  linoleum: ASSET_KEYS.floorLinoleum,
  morgue: ASSET_KEYS.floorMorgue,
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
  /** Só acende com a energia ligada (máquinas de perk e Weapon Lab). */
  needsPower?: boolean;
}

/** Corpo sólido colocado em tempo de execução (pode ser removido). */
export interface SolidHandle {
  zone: Phaser.GameObjects.Zone;
  /** Tiles bloqueados e o custo de navegação que tinham antes. */
  tiles: Array<{ tx: number; ty: number; cost: number }>;
}

export type MachineDef = MachinePlacement & { x: number; y: number };

/** Onde o desenho de giz fica na parede (centro, rotação e profundidade). */
export interface WallDrawing {
  x: number;
  y: number;
  rotation: number;
  depth: number;
}

/** Ponto de compra na parede: (x, y) é o chão em frente, onde o jogador interage. */
export type StationDef = ({ type: 'weapon'; weaponId: string } | { type: 'ammo' }) & { x: number; y: number; wall: WallDrawing };

export type DecalStamper = (key: string, frame: number | undefined, x: number, y: number, rotation: number, alpha: number) => void;

/**
 * Mapa jogável (GDD §6–17): monta a grade a partir de um layout (Terminal, Hospital...),
 * cria colisão, navegação e visual (pisos, paredes 3/4, trem, props). Portas e barricadas
 * são entidades à parte (a porta aberta chama openDoorTiles).
 */
export class GameMap {
  readonly widthPx: number;
  readonly heightPx: number;
  readonly wallLayer: Phaser.Tilemaps.TilemapLayer;
  readonly obstacles: Phaser.Physics.Arcade.StaticGroup;
  readonly bulletBlockers: Phaser.Physics.Arcade.StaticGroup;
  readonly nav: NavGrid;
  readonly playerSpawn: Phaser.Math.Vector2;
  readonly spawnPoints: SpawnPoint[];
  readonly lamps: Lamp[];
  readonly stations: StationDef[];
  readonly machines: MachineDef[];
  /** Locais da Mystery Box (centro em px + área). */
  readonly boxSpots: Array<{ x: number; y: number; area: string }>;
  /** Pontos de surgimento do boss (centro do Hall). */
  readonly bossSpawns: Array<{ x: number; y: number }>;
  readonly doors: DoorDef[];
  readonly windows: WindowDef[];
  readonly areas: AreaDef[];
  /** Área onde o jogador começa (aberta desde o início). */
  readonly startArea: string;
  private readonly W: number;
  private readonly H: number;

  private readonly cells: Uint8Array;
  /** Luzes dos props luminosos (telas, placas, vitrines), somadas às luminárias. */
  private readonly propLights: Lamp[] = [];
  /** Índice da área de cada tile (-1 = fora de qualquer área). */
  private readonly areaIndex: Int8Array;

  constructor(private readonly scene: Phaser.Scene, readonly layout: MapLayout) {
    const MAP_WIDTH = layout.width;
    const MAP_HEIGHT = layout.height;
    this.W = MAP_WIDTH;
    this.H = MAP_HEIGHT;
    this.widthPx = MAP_WIDTH * TILE_SIZE;
    this.heightPx = MAP_HEIGHT * TILE_SIZE;
    this.doors = layout.doors;
    this.windows = layout.windows;
    this.areas = layout.areas;
    this.startArea = layout.startArea;
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
    this.playerSpawn = center(layout.playerStart.tx, layout.playerStart.ty);
    this.spawnPoints = layout.spawns.map((s) => {
      const p = center(s.tx, s.ty);
      return { id: s.id, x: p.x, y: p.y, sector: s.area, minWave: s.minWave, enabled: this.cell(s.tx, s.ty) === Cell.Floor };
    });
    this.stations = this.placeWallBuys(layout);
    this.lamps = layout.lamps.map((l) => ({ ...center(l.tx, l.ty), radius: l.radius, intensity: l.intensity, flicker: l.flicker, color: l.color }));
    this.lamps.push(...this.propLights);
    // Luz fraca sobre cada ponto de compra, para ser encontrado no escuro.
    for (const s of this.stations) this.lamps.push({ x: s.wall.x, y: s.wall.y + 8, radius: 70, intensity: 0.45, flicker: 0, emergency: true });
    this.machines = layout.machines.map((m) => ({ ...m, ...center(m.tx, m.ty) }));
    this.bossSpawns = layout.bossSpawns.map((s) => center(s.tx, s.ty));
    this.boxSpots = layout.boxSpots.map((s) => ({ x: s.tx * TILE_SIZE + TILE_SIZE / 2, y: s.ty * TILE_SIZE + TILE_SIZE / 2, area: s.area }));
    // Máquinas iluminadas com a cor delas (perks) ou luz roxa. A Mystery Box tem luz
    // própria (ela muda de lugar).
    for (const m of this.machines) {
      if (m.type === 'mystery_box') continue;
      const color = m.type === 'perk' ? perks[m.perkId].color : m.type === 'weapon_lab' ? 0x9b59d0 : 0xffd27a;
      const needsPower = !(m.type === 'perk' && powerConfig.worksWithoutPower.includes(m.perkId));
      this.lamps.push({ x: m.x, y: m.y, radius: 95, intensity: 0.6, flicker: 0.05, color, emergency: true, needsPower });
    }
  }

  /** Leva cada ponto de compra para a parede mais próxima (compra na parede, como no CoD). */
  private placeWallBuys(layout: MapLayout): StationDef[] {
    const pad = wallBuyConfig.clearance;
    const propPad = wallBuyConfig.propClearance;
    const blocked: Array<{ tx: number; ty: number }> = layout.machines.map((m) => ({ tx: Math.floor(m.tx), ty: Math.floor(m.ty) }));
    const props = layout.props.map((pr) => ({ tx: Math.floor(pr.tx), ty: Math.floor(pr.ty) }));
    const near = (list: Array<{ tx: number; ty: number }>, tx: number, ty: number, r: number): boolean =>
      list.some((b) => Math.abs(b.tx - tx) <= r && Math.abs(b.ty - ty) <= r);
    const nearBlocked = (tx: number, ty: number): boolean => {
      if (near(blocked, tx, ty, pad) || near(props, tx, ty, propPad)) return true;
      for (let dy = -propPad - 1; dy <= propPad + 1; dy++) {
        for (let dx = -propPad - 1; dx <= propPad + 1; dx++) {
          const c = this.cell(tx + dx, ty + dy);
          if (c === Cell.Door || c === Cell.Window) return true;
        }
      }
      return false;
    };
    const q = {
      isFloor: (tx: number, ty: number) => this.cell(tx, ty) === Cell.Floor,
      // A parede do vagão parado também serve (a Combat Shotgun fica dentro do trem).
      isWall: (tx: number, ty: number) => this.cell(tx, ty) === Cell.Wall || this.cell(tx, ty) === Cell.Train,
    };
    return layout.stations.map((s) => {
      const spot = snapToWall(s, q, nearBlocked);
      const tx = spot?.tx ?? s.tx;
      const ty = spot?.ty ?? s.ty;
      blocked.push({ tx: Math.floor(tx), ty: Math.floor(ty) });
      const x = tx * TILE_SIZE + TILE_SIZE / 2;
      const y = ty * TILE_SIZE + TILE_SIZE / 2;
      const top = ty * TILE_SIZE;
      // Face da parede de cima; nas outras, o topo da parede (desenho girado junto com ela).
      const wall: WallDrawing =
        spot?.side === 'south' ? { x, y: top + TILE_SIZE, rotation: 0, depth: top + 2 * TILE_SIZE + 1 }
        : spot?.side === 'west' ? { x: x - TILE_SIZE, y: top + TILE_SIZE / 2 - WALL_RISE, rotation: -Math.PI / 2, depth: top + TILE_SIZE + 1 }
        : spot?.side === 'east' ? { x: x + TILE_SIZE, y: top + TILE_SIZE / 2 - WALL_RISE, rotation: Math.PI / 2, depth: top + TILE_SIZE + 1 }
        : spot ? { x, y: top - WALL_RISE / 2, rotation: 0, depth: top + 1 }
        // Sem parede livre por perto: desenho no chão (não deveria acontecer).
        : { x, y, rotation: 0, depth: y };
      return s.type === 'weapon' ? { type: 'weapon', weaponId: s.weaponId, x, y, wall } : { type: 'ammo', x, y, wall };
    });
  }

  // ───────────────────────── Consultas ─────────────────────────

  cell(tx: number, ty: number): CellValue {
    if (tx < 0 || ty < 0 || tx >= this.W || ty >= this.H) return Cell.Wall;
    return this.cells[ty * this.W + tx] as CellValue;
  }

  areaAt(x: number, y: number): AreaDef | null {
    const tx = Math.floor(x / TILE_SIZE);
    const ty = Math.floor(y / TILE_SIZE);
    if (tx < 0 || ty < 0 || tx >= this.W || ty >= this.H) return null;
    const i = this.areaIndex[ty * this.W + tx];
    return i >= 0 ? this.areas[i] : null;
  }

  /**
   * Base do minimapa, um código por tile: 0 parede/vazio, 1 chão de área aberta, 2 chão
   * trancado ou de fora, 3 porta fechada, 4 trem, 5 janela.
   */
  minimapCells(isOpen: (area: string) => boolean): { cols: number; rows: number; cells: number[] } {
    const cells: number[] = new Array(this.W * this.H);
    for (let ty = 0; ty < this.H; ty++) {
      for (let tx = 0; tx < this.W; tx++) {
        const i = ty * this.W + tx;
        const c = this.cells[i];
        const area = this.areaIndex[i];
        cells[i] =
          c === Cell.Floor ? (area >= 0 && isOpen(this.areas[area].id) ? 1 : 2)
          : c === Cell.Door ? 3
          : c === Cell.Train ? 4
          : c === Cell.Window ? 5
          : 0;
      }
    }
    return { cols: this.W, rows: this.H, cells };
  }

  /** Tipo de piso num ponto (som dos passos). */
  floorAt(x: number, y: number): FloorKind {
    const tx = Math.floor(x / TILE_SIZE);
    const ty = Math.floor(y / TILE_SIZE);
    for (let i = this.layout.floors.length - 1; i >= 0; i--) {
      const r = this.layout.floors[i].rect;
      if (tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h) return this.layout.floors[i].kind;
    }
    return 'concrete';
  }

  /** Escuridão ambiente no ponto (varia por área, GDD §50). */
  readonly darknessAt = (x: number, y: number): number => this.areaAt(x, y)?.darkness ?? this.layout.outsideDarkness;

  // ───────────────────────── Mudanças dinâmicas ─────────────────────────

  /** Corpo sólido extra (máquinas, props): colide, bloqueia tiros e a navegação. */
  addSolid(cx: number, cy: number, w: number, h: number): SolidHandle {
    const zone = this.scene.add.zone(cx, cy, w, h);
    this.obstacles.add(zone);
    this.bulletBlockers.add(zone);
    return { zone, tiles: this.blockNav(cx, cy, w, h) };
  }

  /** Desfaz um addSolid (ex.: a Mystery Box mudou de lugar). */
  removeSolid(handle: SolidHandle): void {
    this.obstacles.remove(handle.zone);
    this.bulletBlockers.remove(handle.zone);
    handle.zone.destroy();
    for (const t of handle.tiles) this.nav.setCost(t.tx, t.ty, t.cost);
  }

  /** Todos os tiles cobertos pelo retângulo são chão livre? */
  isFree(cx: number, cy: number, w: number, h: number): boolean {
    return this.tilesUnder(cx, cy, w, h).every(([tx, ty]) => this.nav.getCost(tx, ty) === NavCost.Floor);
  }

  private tilesUnder(cx: number, cy: number, w: number, h: number): Array<[number, number]> {
    const t = (v: number) => Math.floor(v / TILE_SIZE);
    const tiles: Array<[number, number]> = [];
    for (let ty = t(cy - h / 2 + 4); ty <= t(cy + h / 2 - 4); ty++) {
      for (let tx = t(cx - w / 2 + 4); tx <= t(cx + w / 2 - 4); tx++) tiles.push([tx, ty]);
    }
    return tiles;
  }

  private blockNav(cx: number, cy: number, w: number, h: number): Array<{ tx: number; ty: number; cost: number }> {
    return this.tilesUnder(cx, cy, w, h).map(([tx, ty]) => {
      const cost = this.nav.getCost(tx, ty);
      this.nav.setCost(tx, ty, NavCost.Blocked);
      return { tx, ty, cost };
    });
  }

  /** Porta aberta: os tiles viram chão para colisão e navegação. */
  openDoorTiles(rect: Rect): void {
    this.forEachTile(rect, (x, y) => {
      this.cells[y * this.W + x] = Cell.Floor;
      this.wallLayer.putTileAt(EMPTY, x, y);
      this.nav.setCost(x, y, NavCost.Floor);
    });
  }

  /** Espalha sujeira, papéis e sangue antigo pelo chão das áreas (determinístico). */
  scatterDecals(stamp: DecalStamper): void {
    const rnd = new Phaser.Math.RandomDataGenerator([this.layout.decalSeed]);
    for (const area of this.areas) {
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
    const set = (r: Rect, value: CellValue) => this.forEachTile(r, (x, y) => (this.cells[y * this.W + x] = value));
    for (const a of this.areas) for (const r of a.rects) set(r, Cell.Floor);
    for (const r of this.layout.pockets) set(r, Cell.Floor);
    for (const o of this.layout.obstacles) set(o.rect, o.kind === 'train' ? Cell.Train : Cell.Wall);
    for (const r of this.layout.carves) set(r, Cell.Floor);
    for (const d of this.layout.doors) set(d.rect, Cell.Door);
    for (const w of this.layout.windows) set(w.rect, Cell.Window);

    this.areas.forEach((area, index) => {
      for (const r of area.rects) this.forEachTile(r, (x, y) => (this.areaIndex[y * this.W + x] = index));
    });
  }

  private forEachTile(r: Rect, fn: (x: number, y: number) => void): void {
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        if (x >= 0 && y >= 0 && x < this.W && y < this.H) fn(x, y);
      }
    }
  }

  private isSolidVisual(tx: number, ty: number): boolean {
    const c = this.cell(tx, ty);
    return c === Cell.Wall || c === Cell.Train;
  }

  private renderFloors(): void {
    for (const { rect, kind } of this.layout.floors) {
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

    for (let ty = 0; ty < this.H; ty++) {
      for (let tx = 0; tx < this.W; tx++) {
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
    const station = this.layout.station;
    if (!station) return;
    for (const e of station.edges) {
      const y = e.y * TILE_SIZE + (e.down ? -12 : 2);
      this.scene.add
        .tileSprite(e.x * TILE_SIZE, y, e.w * TILE_SIZE, 10, ASSET_KEYS.tactile)
        .setOrigin(0)
        .setTileScale(ART_SCALE)
        .setDepth(DEPTH.decals + 1);
    }
    // O teto do trem parado fica logo acima da última linha dele.
    const train = this.layout.obstacles.find((o) => o.kind === 'train')?.rect;
    const roofDepth = train ? (train.y + train.h) * TILE_SIZE + 1 : 0;
    for (const u of station.roofUnits) {
      this.scene.add
        .image(u.tx * TILE_SIZE, u.ty * TILE_SIZE - WALL_RISE, ASSET_KEYS.trainRoofUnit)
        .setScale(ART_SCALE)
        .setDepth(roofDepth);
    }
  }

  private renderProps(): void {
    for (const p of this.layout.props) {
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
