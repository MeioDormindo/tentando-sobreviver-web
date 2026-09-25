/**
 * Arte do jogo web para o Godot: rasteriza as SVGs de public/assets (chão, paredes, props,
 * máquinas, eventos) em PNG, na escala do jogo web (32 px = 1 m), para godot/assets/web/.
 * Usa o resvg (suporta os filtros de ruído das SVGs, que o importador do Godot ignora).
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const FOLDERS = ['map', 'props', 'machines', 'events'];

export function exportWebArt(): void {
  let count = 0;
  for (const folder of FOLDERS) {
    const source = join('public/assets', folder);
    const target = join('godot/assets/web', folder);
    mkdirSync(target, { recursive: true });
    for (const file of readdirSync(source)) {
      if (!file.endsWith('.svg')) continue;
      const png = new Resvg(readFileSync(join(source, file), 'utf8')).render().asPng();
      writeFileSync(join(target, file.replace(/\.svg$/, '.png')), png);
      count++;
    }
  }
  console.log(`  godot/assets/web: ${count} imagens da arte do jogo web`);
}
