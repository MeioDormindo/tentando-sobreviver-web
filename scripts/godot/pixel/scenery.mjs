// Gera o cenário em pixel art (npm run godot:scenery): pisos, paredes, objetos e decoração,
// a 48 px/m, em godot/assets/tiles/ (+ JSON com as regiões de cada face dos objetos).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { encodePng } from './png.mjs';
import { floors, walls } from './tiles.mjs';

const OUT = 'godot/assets/tiles';
mkdirSync(OUT, { recursive: true });

function save(name, px) {
  writeFileSync(join(OUT, `${name}.png`), encodePng(px.width, px.height, px.data));
}

const surfaces = { ...floors(), ...walls() };
for (const [name, px] of Object.entries(surfaces)) save(name, px);
console.log(`  superfícies: ${Object.keys(surfaces).length}`);

const extra = process.argv.includes('--only-surfaces') ? [] : ['props', 'decor'];
for (const part of extra) {
  const mod = await import(`./${part}.mjs`).catch(() => null);
  if (mod && mod.build) mod.build(OUT, save);
}
