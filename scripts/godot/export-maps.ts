/**
 * Migração dos mapas: reproduz a grade de tiles do jogo web (mesma ordem de construção do
 * GameMap) e exporta cada mapa para godot/data/maps/<id>.json, com áreas, portas, janelas,
 * spawns, luzes, props, máquinas e compras na parede. 1 tile = 1 m.
 *
 *   npm run godot:data
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { LAYOUTS } from '../../src/map/registry';
import { PROP_DEFS } from '../../src/map/props';
import type { MapLayout, Rect } from '../../src/map/types';

const PX = 32;
const r3 = (n: number): number => Math.round(n * 1000) / 1000;
const m = (px: number): number => r3(px / PX);

/** Letra de cada tipo de piso na grade. Paredes '#', trem 'T', porta 'D', janela 'W'. */
const FLOOR_CHARS: Record<string, string> = {
  terminal: 't', concrete: 'c', metal: 'm', tracks: 'r', tunnel: 'u', wagon: 'w',
  hospital: 'h', linoleum: 'l', morgue: 'g',
};
const DEFAULT_FLOOR = 'c';

function buildGrid(layout: MapLayout): string[][] {
  const grid = Array.from({ length: layout.height }, () => Array<string>(layout.width).fill('#'));
  const set = (r: Rect, ch: string): void => {
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) if (y >= 0 && x >= 0 && y < layout.height && x < layout.width) grid[y][x] = ch;
    }
  };
  // Mesma ordem do GameMap do jogo web: áreas/bolsões → obstáculos → recortes → portas → janelas.
  for (const a of layout.areas) for (const r of a.rects) set(r, DEFAULT_FLOOR);
  for (const r of layout.pockets) set(r, DEFAULT_FLOOR);
  for (const o of layout.obstacles) set(o.rect, o.kind === 'train' ? 'T' : '#');
  for (const r of layout.carves) set(r, DEFAULT_FLOOR);
  for (const d of layout.doors) set(d.rect, 'D');
  for (const w of layout.windows) set(w.rect, 'W');
  // Tipo de piso (só visual): cada retângulo de piso pinta o chão que está embaixo.
  for (const f of layout.floors) {
    const ch = FLOOR_CHARS[f.kind] ?? DEFAULT_FLOOR;
    for (let y = f.rect.y; y < f.rect.y + f.rect.h; y++) {
      for (let x = f.rect.x; x < f.rect.x + f.rect.w; x++) {
        if (grid[y]?.[x] !== undefined && Object.values(FLOOR_CHARS).includes(grid[y][x])) grid[y][x] = ch;
      }
    }
  }
  return grid;
}

function exportMap(id: string, layout: MapLayout): void {
  const grid = buildGrid(layout);
  const props = layout.props.map((p) => {
    const def = PROP_DEFS[p.type];
    return {
      type: p.type,
      x: p.tx + 0.5,
      z: p.ty + 0.5,
      angle: p.angle ?? 0,
      body: def.body ? { w: m(def.body.w), d: m(def.body.h), ox: m(def.body.ox), oz: m(def.body.oy) } : null,
      blocks_bullets: def.blocksBullets,
      light: def.light ? { radius: m(def.light.radius), intensity: def.light.intensity, color: def.light.color } : null,
    };
  });
  const data = {
    id,
    width: layout.width,
    height: layout.height,
    legend: { wall: '#', train: 'T', door: 'D', window: 'W', floors: FLOOR_CHARS },
    cells: grid.map((row) => row.join('')),
    start_area: layout.startArea,
    player_start: { x: layout.playerStart.tx + 0.5, z: layout.playerStart.ty + 0.5 },
    outside_darkness: layout.outsideDarkness,
    areas: layout.areas.map((a) => ({ id: a.id, name: a.name, darkness: a.darkness, rects: a.rects })),
    doors: layout.doors,
    windows: layout.windows,
    spawns: layout.spawns.map((s) => ({ id: s.id, x: s.tx + 0.5, z: s.ty + 0.5, area: s.area, min_round: s.minWave })),
    stations: layout.stations.map((s) => ({ ...s, x: s.tx + 0.5, z: s.ty + 0.5 })),
    machines: layout.machines.map((mc) => ({ ...mc, x: mc.tx + 0.5, z: mc.ty + 0.5 })),
    box_spots: layout.boxSpots.map((b) => ({ x: b.tx + 0.5, z: b.ty + 0.5, area: b.area })),
    boss_spawns: layout.bossSpawns.map((b) => ({ x: b.tx + 0.5, z: b.ty + 0.5 })),
    lamps: layout.lamps.map((l) => ({ x: l.tx + 0.5, z: l.ty + 0.5, radius: m(l.radius), intensity: l.intensity, flicker: l.flicker, color: l.color ?? 0xffd6a0 })),
    interactions: layout.interactions,
    props,
  };
  mkdirSync('godot/data/maps', { recursive: true });
  const file = `godot/data/maps/${id}.json`;
  writeFileSync(file, JSON.stringify(data, null, 1) + '\n');
  console.log(`  ${file} (${layout.width}×${layout.height}, ${layout.areas.length} áreas, ${layout.doors.length} portas, ${layout.spawns.length} spawns)`);
}

export function exportMaps(): void {
  for (const [id, layout] of Object.entries(LAYOUTS)) if (layout) exportMap(id, layout);
}
