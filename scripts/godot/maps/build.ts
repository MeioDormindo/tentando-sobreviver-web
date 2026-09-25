/**
 * Gera os mapas do Godot a partir da DSL (godot/data/maps/<id>.json) e uma prévia em PNG
 * de cada um (godot/build/maps/<id>.png: paredes, pisos, portas, janelas e marcadores).
 *
 *   npm run godot:maps
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { encodePng } from '../pixel/png.mjs';
import type { MapBuilder } from './dsl';
import { terminal } from './terminal';
import { hospital } from './hospital';
import { temple } from './temple';

const TILE = 6;
const COLORS: Record<string, number> = {
  '#': 0x1b1c1e, T: 0x3a5566, D: 0xd08a2a, W: 0x6ac8e8,
  t: 0x8a8272, c: 0x6a6a66, m: 0x5a646a, r: 0x4a3e34, u: 0x3a3f3a, w: 0x7a6a52,
  h: 0xb8c4c4, l: 0x8aa0a8, g: 0x6a7a80,
  o: 0xa89878, e: 0x7a7468, a: 0xc8c4b8, k: 0x4a4438, f: 0x3e5a2e, v: 0x3a2a26, V: 0xe0501a,
};
const MARKS: Array<[string, number]> = [
  ['spawns', 0xe03030], ['stations', 0xf0d040], ['machines', 0xd040d0], ['box_spots', 0xff80ff],
  ['interactions', 0x40e070], ['lamps', 0xfff4c0], ['boss_spawns', 0xff6000], ['props', 0x9a6a3a],
];

function preview(data: Record<string, any>): Buffer {
  const w = data.width * TILE, h = data.height * TILE;
  const rgba = new Uint8Array(w * h * 4);
  const put = (x: number, y: number, c: number): void => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = (y * w + x) * 4;
    rgba[i] = c >> 16; rgba[i + 1] = (c >> 8) & 255; rgba[i + 2] = c & 255; rgba[i + 3] = 255;
  };
  (data.cells as string[]).forEach((row, ty) => {
    for (let tx = 0; tx < row.length; tx++) {
      const c = COLORS[row[tx]] ?? 0xff00ff;
      for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) put(tx * TILE + x, ty * TILE + y, (x === 0 || y === 0) && row[tx] !== '#' ? c - 0x080808 : c);
    }
  });
  for (const [key, color] of MARKS) {
    for (const item of data[key] ?? []) {
      const x = Math.round((item.x ?? Number(item.tx) + 0.5) * TILE), y = Math.round((item.z ?? Number(item.ty) + 0.5) * TILE);
      const r = key === 'props' ? 1 : 2;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) put(x + dx, y + dy, color);
    }
  }
  return encodePng(w, h, rgba);
}

/**
 * Miniatura da planta para a escolha de mapa (godot/assets/ui/map_<id>.png): 3 px por tile,
 * paredes quase pretas com borda, pisos no tom de cada tipo, portas douradas e janelas.
 */
function thumbnail(data: Record<string, any>): Buffer {
  const T = 3;
  const w = data.width * T, h = data.height * T;
  const rgba = new Uint8Array(w * h * 4);
  const floorTone: Record<string, number> = { t: 0x6a6258, c: 0x55544f, m: 0x4a5258, r: 0x3e342c, u: 0x3a3f3a, w: 0x5e523e, h: 0x8a9696, l: 0x6a7a80, g: 0x56646a,
    o: 0x8a7a5e, e: 0x5e5a52, a: 0x9e9a90, k: 0x3e392f, f: 0x344a28, v: 0x33251f };
  const cells = data.cells as string[];
  const at = (x: number, y: number): string => cells[y]?.[x] ?? '#';
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const tx = Math.floor(x / T), ty = Math.floor(y / T), ch = at(tx, ty);
    let c: number;
    if (ch === '#') {
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => at(tx + a, ty + b) !== '#');
      c = edge ? 0x2a2c30 : 0x0d0e10;
    } else if (ch === 'D') c = 0xd9a640;
    else if (ch === 'W') c = 0x6ac8e8;
    else if (ch === 'T') c = 0x3a5566;
    else if (ch === 'V') c = (x * 7 + y * 3) % 5 === 0 ? 0xffb040 : 0xd0441a;
    else c = floorTone[ch] ?? 0x555555;
    // Pontilhado leve no chão (cara de pixel art).
    if (ch !== '#' && (x + y) % 6 === 0) c = c - 0x0a0a0a;
    const i = (y * w + x) * 4;
    rgba[i] = c >> 16; rgba[i + 1] = (c >> 8) & 255; rgba[i + 2] = c & 255; rgba[i + 3] = 255;
  }
  return encodePng(w, h, rgba);
}

for (const make of [terminal, hospital, temple] as Array<() => MapBuilder>) {
  const map = make();
  const data = map.build() as Record<string, any>;
  mkdirSync('godot/data/maps', { recursive: true });
  mkdirSync('godot/build/maps', { recursive: true });
  writeFileSync(`godot/data/maps/${map.id}.json`, JSON.stringify(data, null, 1) + '\n');
  writeFileSync(`godot/build/maps/${map.id}.png`, preview(data));
  mkdirSync('godot/assets/ui', { recursive: true });
  writeFileSync(`godot/assets/ui/map_${map.id}.png`, thumbnail(data));
  console.log(`  ${map.id}: ${data.width}×${data.height}, ${data.areas.length} áreas, ${data.doors.length} portas, ${data.spawns.length} spawns, ${data.props.length} objetos`);
}
