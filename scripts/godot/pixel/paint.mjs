// Pintura de texturas em pixel art (cenário): ruído que emenda nas bordas, pontilhado,
// manchas, rachaduras e rampas de cor curtas. Tudo determinístico (semente por nome).
import { Pixels } from './raster.mjs';

export const PPM = 48; // pixels por metro (a mesma densidade dos personagens)

export function rng(seed) {
  let a = typeof seed === 'string' ? [...seed].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0 : seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
  next.pick = (list) => list[Math.floor(next() * list.length)];
  return next;
}

/** Ruído de valor que emenda (a textura repete sem costura). */
export function noise2(r, w, h, cells) {
  const cw = cells, ch = Math.max(1, Math.round(cells * (h / w)));
  const grid = Array.from({ length: ch }, () => Array.from({ length: cw }, () => r()));
  return (x, y) => {
    const fx = (x / w) * cw, fy = (y / h) * ch;
    const x0 = Math.floor(fx) % cw, y0 = Math.floor(fy) % ch;
    const x1 = (x0 + 1) % cw, y1 = (y0 + 1) % ch;
    let tx = fx - Math.floor(fx), ty = fy - Math.floor(fy);
    tx = tx * tx * (3 - 2 * tx);
    ty = ty * ty * (3 - 2 * ty);
    const a = grid[y0][x0] * (1 - tx) + grid[y0][x1] * tx;
    const b = grid[y1][x0] * (1 - tx) + grid[y1][x1] * tx;
    return a * (1 - ty) + b * ty;
  };
}

export const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
export const dither = (x, y, v) => v > (BAYER[y & 3][x & 3] + 0.5) / 16;

export const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
export const scale = (c, k) => c.map((v) => Math.max(0, Math.min(255, Math.round(v * k))));
export function hex(value) {
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** Tela com uma cor base e variação de ruído em degraus (pixel art). */
export function base(w, h, color, r, { cells = 8, amount = 0.12, steps = 4 } = {}) {
  const px = new Pixels(w, h);
  // Três escalas: manchas grandes e suaves (desgaste irregular pelo espaço), o ruído médio de
  // sempre e o grão fino — sem a macro, texturas grandes liam como "papel de parede" repetindo.
  const macro = noise2(r, w, h, Math.max(2, Math.round(cells / 3)));
  const n = noise2(r, w, h, cells);
  const fine = noise2(r, w, h, Math.max(2, Math.round(w / 3)));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = (macro(x, y) * 0.4 + n(x, y) * 0.4 + fine(x, y) * 0.2 - 0.5) * 2 * amount;
      const q = Math.round(v * steps) / steps;
      px.set(x, y, scale(color, 1 + q));
    }
  }
  return px;
}

/** Mancha escura irregular (sujeira, umidade, sangue seco), com borda pontilhada. */
export function stain(px, r, cx, cy, radius, color, strength = 0.5) {
  const n = noise2(r, 64, 64, 6);
  for (let y = Math.floor(cy - radius * 1.4); y <= cy + radius * 1.4; y++) {
    for (let x = Math.floor(cx - radius * 1.4); x <= cx + radius * 1.4; x++) {
      const d = Math.hypot(x - cx, y - cy) / radius + (n((x * 3) & 63, (y * 3) & 63) - 0.5) * 0.9;
      if (d > 1) continue;
      const wx = ((x % px.width) + px.width) % px.width, wy = ((y % px.height) + px.height) % px.height;
      if (d > 0.7 && !dither(wx, wy, (1 - d) / 0.3)) continue;
      px.set(wx, wy, mix(px.rgb(wx, wy), color, strength));
    }
  }
}

/** Rachadura: um caminho de pixels escuros que vai se ramificando. */
export function crack(px, r, x, y, length, color) {
  let dx = r() - 0.5, dy = r() - 0.5;
  for (let i = 0; i < length; i++) {
    const wx = ((Math.round(x) % px.width) + px.width) % px.width, wy = ((Math.round(y) % px.height) + px.height) % px.height;
    px.set(wx, wy, color);
    dx += (r() - 0.5) * 0.8;
    dy += (r() - 0.5) * 0.8;
    const l = Math.hypot(dx, dy) || 1;
    x += dx / l;
    y += dy / l;
    if (r() < 0.06) crack(px, r, x, y, length / 3, color);
  }
}

export function rect(px, x, y, w, h, color) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) px.set(i, j, color);
}

export function hline(px, y, color, x0 = 0, x1 = px.width - 1) {
  for (let x = x0; x <= x1; x++) px.set(x, y, color);
}

export function vline(px, x, color, y0 = 0, y1 = px.height - 1) {
  for (let y = y0; y <= y1; y++) px.set(x, y, color);
}

/** Moldura com luz em cima/esquerda e sombra embaixo/direita (bisel de pixel art). */
export function bevel(px, x, y, w, h, light, dark) {
  hline(px, y, light, x, x + w - 1);
  vline(px, x, light, y, y + h - 1);
  hline(px, y + h - 1, dark, x, x + w - 1);
  vline(px, x + w - 1, dark, y, y + h - 1);
}
