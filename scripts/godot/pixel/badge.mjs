// Selo hexagonal da HUD (power-ups e perks): moldura metálica + anel colorido (tingido no
// Godot por power-up/perk) + placa escura de fundo pro ícone. Substitui o ícone "pelado" que
// tínhamos antes por um selo no espírito do HUD de referência (Cold War Zombies).
import { writeFileSync } from 'node:fs';
import { encodePng } from './png.mjs';
import { Pixels, hex } from './raster.mjs';

const SIZE = 48;
const CX = SIZE / 2, CY = SIZE / 2;

/** Vértices de um hexágono de ponta para cima, centro (cx,cy), raio r (centro→vértice). */
function hexPoints(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = (-90 + i * 60) * (Math.PI / 180);
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

/** true se (x,y) está dentro do hexágono de raio r (mesma orientação de hexPoints). */
function inHex(x, y, cx, cy, r) {
  const pts = hexPoints(cx, cy, r);
  for (let i = 0; i < 6; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % 6];
    if ((x1 - x0) * (y - y0) - (y1 - y0) * (x - x0) < 0) return false;
  }
  return true;
}

function ring(px, rOuter, rInner, paint) {
  for (let y = 0; y < px.height; y++) {
    for (let x = 0; x < px.width; x++) {
      const cx = x + 0.5, cy = y + 0.5;
      if (inHex(cx, cy, CX, CY, rOuter) && !inHex(cx, cy, CX, CY, rInner)) paint(px, x, y, cx, cy);
    }
  }
}

function fill(px, r, paint) {
  for (let y = 0; y < px.height; y++) {
    for (let x = 0; x < px.width; x++) {
      const cx = x + 0.5, cy = y + 0.5;
      if (inHex(cx, cy, CX, CY, r)) paint(px, x, y, cx, cy);
    }
  }
}

/** Sombreamento angular (luz de cima-esquerda) pra dar volume ao aro metálico, em pixel art. */
function lightAt(cx, cy) {
  const dx = (cx - CX) / (SIZE / 2), dy = (cy - CY) / (SIZE / 2);
  const l = -0.6, m = -0.8, len = Math.hypot(l, m);
  return 0.72 + 0.34 * Math.max(0, (dx * l + dy * m) / (Math.hypot(dx, dy) * len || 1));
}

function scale(c, k) { return c.map((v) => Math.max(0, Math.min(255, Math.round(v * k)))); }

export function build(save) {
  // Moldura metálica: aro escuro com volume (não é tingido — sempre a mesma cor neutra).
  const frame = new Pixels(SIZE, SIZE);
  const STEEL = hex(0x2a2d31);
  ring(frame, 23, 18.5, (p, x, y, cx, cy) => p.set(x, y, scale(STEEL, lightAt(cx, cy))));
  // Contorno de 1 px só por fora do aro (não pode invadir o miolo — é aí que entram o anel
  // colorido e a placa do ícone, compostos depois por cima deste frame).
  ring(frame, 24.5, 23, (p, x, y) => p.set(x, y, hex(0x0e0f10)));
  save('badge_frame', frame);

  // Anel colorido: branco liso — o Godot tinge (self_modulate) com a cor do power-up/perk.
  const band = new Pixels(SIZE, SIZE);
  ring(band, 18.5, 15, (p, x, y) => p.set(x, y, [255, 255, 255]));
  save('badge_ring', band);

  // Placa de fundo: hexágono escuro translúcido onde o ícone entra por cima.
  const back = new Pixels(SIZE, SIZE);
  fill(back, 15, (p, x, y, cx, cy) => p.set(x, y, scale(hex(0x14161a), 0.85 + 0.25 * lightAt(cx, cy)), 235));
  save('badge_back', back);
}
