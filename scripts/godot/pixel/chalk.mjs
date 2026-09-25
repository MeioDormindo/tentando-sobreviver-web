// Desenhos de giz das compras na parede (como no CoD / jogo web): a silhueta de perfil de
// cada arma vira traço de giz (contorno quebrado e hachura por dentro), mais a caixa de
// munição e o quadro-negro com moldura de madeira. Saída: godot/assets/sprites/chalk/.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { encodePng } from './png.mjs';
import { renderIcon } from './rig.mjs';
import { weaponShape } from './weapons.mjs';

const CHALK = [236, 233, 222];

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function hash(text) {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** Converte uma máscara (true = arma) em giz: contorno de 1–2 px quebrado e hachura. */
function chalkFrom(mask, w, h, seed) {
  const r = rng(seed);
  const pad = 3;
  const W = w + pad * 2, H = h + pad * 2;
  const rgba = new Uint8Array(W * H * 4);
  const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x];
  const put = (x, y, a) => {
    const i = ((y + pad) * W + x + pad) * 4;
    const k = 0.85 + r() * 0.15;
    rgba[i] = CHALK[0] * k; rgba[i + 1] = CHALK[1] * k; rgba[i + 2] = CHALK[2] * k;
    rgba[i + 3] = Math.max(rgba[i + 3], a);
  };
  for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) {
    const inside = on(x, y);
    const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => on(x + a, y + b) !== inside);
    if (edge && !inside && r() < 0.88) put(x, y, 235);          // traço de fora
    else if (edge && inside && r() < 0.35) put(x, y, 170);      // engrossa um pouco
    else if (inside && (x + y) % 4 === 0 && r() < 0.7) put(x, y, 120);  // hachura
  }
  // Poeira de giz em volta.
  for (let i = 0; i < (W * H) / 90; i++) {
    const x = Math.floor(r() * W) - pad, y = Math.floor(r() * H) - pad;
    put(Math.max(-pad, Math.min(w + pad - 1, x)), Math.max(-pad, Math.min(h + pad - 1, y)), 60);
  }
  return { width: W, height: H, data: rgba };
}

function weaponChalk(id) {
  const icon = renderIcon(weaponShape(id, 0), { pitch: 6, ppm: 44, dir: 2, size: 200 });
  const mask = new Array(icon.width * icon.height);
  for (let y = 0; y < icon.height; y++) for (let x = 0; x < icon.width; x++) mask[y * icon.width + x] = icon.alpha(x, y) > 0;
  return chalkFrom(mask, icon.width, icon.height, hash(id));
}

/** Caixa de munição com três balas em pé, desenhada à mão. */
function ammoChalk() {
  const w = 44, h = 30;
  const mask = new Array(w * h).fill(false);
  const fill = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) mask[y * w + x] = true; };
  fill(2, 14, 41, 29);                       // caixa
  for (const x of [8, 18, 28]) {
    fill(x, 5, x + 5, 13);                   // cápsula
    fill(x + 1, 2, x + 4, 4);                // ponta
    fill(x + 2, 0, x + 3, 1);
  }
  return chalkFrom(mask, w, h, 7);
}

/** Quadro-negro 1,5 × 1,0 m (48 px/m): verde-escuro com manchas de apagador e moldura. */
function board() {
  const W = 72, H = 48;
  const r = rng(99);
  const rgba = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const frame = x < 3 || y < 3 || x >= W - 3 || y >= H - 3;
    let c;
    if (frame) c = (x + y) % 5 === 0 ? [74, 48, 26] : x < 1 || y < 1 || x >= W - 1 || y >= H - 1 ? [40, 26, 14] : [104, 70, 40];
    else {
      const smear = Math.sin(x * 0.21 + y * 0.05) * 0.5 + Math.sin(x * 0.07 - y * 0.3) * 0.5;
      const k = 1 + smear * 0.06 + (r() - 0.5) * 0.05;
      c = [34 * k, 58 * k, 44 * k];
    }
    rgba[i] = c[0]; rgba[i + 1] = c[1]; rgba[i + 2] = c[2]; rgba[i + 3] = 255;
  }
  // Suporte de giz embaixo.
  for (let x = 10; x < W - 10; x++) { const i = ((H - 4) * W + x) * 4; rgba[i] = 120; rgba[i + 1] = 84; rgba[i + 2] = 50; }
  return { width: W, height: H, data: rgba };
}

export function buildChalk(outDir, weaponIds) {
  mkdirSync(outDir, { recursive: true });
  const save = (name, img) => writeFileSync(join(outDir, `${name}.png`), encodePng(img.width, img.height, img.data));
  for (const id of weaponIds) save(`chalk_${id}`, weaponChalk(id));
  save('chalk_ammo', ammoChalk());
  save('chalkboard', board());
  console.log(`  giz: ${weaponIds.length} armas, munição e o quadro`);
}
