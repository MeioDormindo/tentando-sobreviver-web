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

const TILE = 6;
const COLORS: Record<string, number> = {
  '#': 0x1b1c1e, T: 0x3a5566, D: 0xd08a2a, W: 0x6ac8e8,
  t: 0x8a8272, c: 0x6a6a66, m: 0x5a646a, r: 0x4a3e34, u: 0x3a3f3a, w: 0x7a6a52,
  h: 0xb8c4c4, l: 0x8aa0a8, g: 0x6a7a80,
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

for (const make of [terminal, hospital] as Array<() => MapBuilder>) {
  const map = make();
  const data = map.build() as Record<string, any>;
  mkdirSync('godot/data/maps', { recursive: true });
  mkdirSync('godot/build/maps', { recursive: true });
  writeFileSync(`godot/data/maps/${map.id}.json`, JSON.stringify(data, null, 1) + '\n');
  writeFileSync(`godot/build/maps/${map.id}.png`, preview(data));
  console.log(`  ${map.id}: ${data.width}×${data.height}, ${data.areas.length} áreas, ${data.doors.length} portas, ${data.spawns.length} spawns, ${data.props.length} objetos`);
}
