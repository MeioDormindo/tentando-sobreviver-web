// Efeitos em pixel art (clarão, faísca, explosão, fumaça, sangue, plasma, granada, chama,
// vento): animações 2D desenhadas por código, com rampas de cor curtas e pixels nítidos.
// Cada efeito vira uma tira horizontal de quadros + JSON (quadro, quantidade, fps, repete).
import { Pixels } from './raster.mjs';

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Escolhe a cor da rampa pelo valor 0..1 (0 = frio/escuro, 1 = quente/claro). */
const ramp = (colors, v) => colors[Math.max(0, Math.min(colors.length - 1, Math.floor(v * colors.length)))];
const FIRE = [[90, 24, 16], [168, 44, 20], [232, 96, 28], [255, 168, 48], [255, 226, 120], [255, 252, 220]];
const SMOKE = [[34, 32, 34], [52, 50, 52], [74, 72, 72], [98, 96, 94]];
const BLOOD = [[70, 8, 8], [112, 16, 14], [150, 26, 20], [186, 44, 34]];
const PLASMA = [[20, 60, 110], [40, 120, 200], [90, 200, 255], [200, 245, 255], [255, 255, 255]];
const WIND = [[120, 170, 190], [170, 220, 235], [220, 248, 255]];
const ACID = [[40, 70, 10], [80, 130, 20], [140, 200, 40], [200, 245, 110], [240, 255, 200]];
/** Cinza claro: recebe a cor no jogo (modulate), para poça de ácido e nuvem de gás. */
const GRAY = [[110, 110, 110], [150, 150, 150], [190, 190, 190], [225, 225, 225], [255, 255, 255]];
const OLIVE = [[40, 48, 26], [70, 84, 42], [104, 122, 64], [150, 168, 100]];

function strip(frames, w, h, draw) {
  const sheet = new Pixels(w * frames, h);
  for (let i = 0; i < frames; i++) {
    const frame = new Pixels(w, h);
    draw(frame, i, frames);
    sheet.blit(frame, i * w, 0);
  }
  return sheet;
}

/** Disco com borda irregular (ruído por ângulo), pintado por uma função da distância. */
function blob(px, cx, cy, radius, noise, paint) {
  for (let y = 0; y < px.height; y++) {
    for (let x = 0; x < px.width; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      const a = Math.atan2(dy, dx);
      const edge = radius * (1 + noise(a));
      const d = Math.hypot(dx, dy);
      if (d <= edge) {
        const c = paint(d / Math.max(edge, 0.01), x, y);
        if (c) px.set(x, y, c);
      }
    }
  }
}

function angularNoise(r, amount, lobes = 7) {
  const phases = Array.from({ length: lobes }, () => r() * Math.PI * 2);
  const weights = Array.from({ length: lobes }, () => r());
  return (a) => phases.reduce((s, ph, i) => s + Math.sin(a * (i + 2) + ph) * weights[i], 0) / lobes * amount;
}

const bayer = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const dither = (x, y, v) => v > (bayer[y & 3][x & 3] + 0.5) / 16;

export function buildFx() {
  const out = {};
  // Clarão de disparo: estrela com miolo branco que encolhe.
  out.muzzle = { fps: 30, loop: false, sheet: strip(4, 28, 28, (px, i, n) => {
    const r = rng(11 + i);
    const k = 1 - i / n;
    const spikes = angularNoise(r, 1.4, 5);
    blob(px, 14, 14, 9 * k + 2, (a) => Math.max(-0.5, spikes(a)), (t) => ramp(FIRE, 1 - t * 0.85));
  }) };
  // Faísca de impacto.
  out.spark = { fps: 24, loop: false, sheet: strip(4, 16, 16, (px, i) => {
    const r = rng(23);
    for (let j = 0; j < 7; j++) {
      const a = r() * Math.PI * 2, v = 1.5 + r() * 2.5;
      const x = Math.round(8 + Math.cos(a) * v * (i + 1)), y = Math.round(8 + Math.sin(a) * v * (i + 1));
      px.set(x, y, ramp(FIRE, 1 - i * 0.2));
      if (i < 2) px.set(x - Math.sign(Math.cos(a)), y - Math.sign(Math.sin(a)), ramp(FIRE, 0.7));
    }
  }) };
  // Explosão: bola de fogo que cresce, esfria e vira fumaça que se desfaz.
  out.explosion = { fps: 16, loop: false, sheet: strip(9, 72, 72, (px, i, n) => {
    const r = rng(37 + i * 3);
    const t = i / (n - 1);
    const radius = 10 + 24 * Math.sqrt(t);
    const noise = angularNoise(r, 0.5, 9);
    blob(px, 36, 38 - t * 6, radius, noise, (d, x, y) => {
      const heat = (1 - d) * (1 - t * 1.1) + 0.25 * (1 - t);
      if (heat > 0.18) return ramp(FIRE, Math.min(1, heat * 1.3));
      const fade = 1 - t * 0.9;
      return dither(x, y, fade + 0.2) ? ramp(SMOKE, 0.9 - d * 0.6) : null;
    });
  }) };
  // Fumaça.
  out.smoke = { fps: 10, loop: false, sheet: strip(6, 28, 28, (px, i, n) => {
    const r = rng(51);
    const t = i / (n - 1);
    blob(px, 14, 16 - t * 5, 5 + 8 * t, angularNoise(r, 0.35, 5), (d, x, y) => (dither(x, y, 1 - t * 0.85) ? ramp(SMOKE, 1 - d * 0.7) : null));
  }) };
  // Respingo de sangue.
  out.blood_splat = { fps: 20, loop: false, sheet: strip(5, 28, 28, (px, i) => {
    const r = rng(61);
    for (let j = 0; j < 12; j++) {
      const a = r() * Math.PI * 2, v = 1 + r() * 2.2, size = r() < 0.3 ? 2 : 1;
      const x = Math.round(14 + Math.cos(a) * v * (i + 1.2)), y = Math.round(14 + Math.sin(a) * v * (i + 1.2) + i * i * 0.4);
      for (let s = 0; s < size; s++) px.set(x + s, y, ramp(BLOOD, 0.3 + r() * 0.7));
    }
  }) };
  // Poças de sangue (decalques no chão, 4 variações num quadro cada).
  out.blood_pool = { fps: 1, loop: false, sheet: strip(4, 40, 40, (px, i) => {
    const r = rng(71 + i * 17);
    blob(px, 20, 20, 9 + r() * 5, angularNoise(r, 0.45, 8), (d) => ramp(BLOOD, 0.95 - d * 0.8));
    for (let j = 0; j < 6; j++) {
      const a = r() * Math.PI * 2, v = 12 + r() * 6;
      blob(px, 20 + Math.cos(a) * v, 20 + Math.sin(a) * v, 1 + r() * 2, () => 0, () => ramp(BLOOD, 0.4));
    }
  }) };
  // Plasma: esfera pulsando.
  out.plasma = { fps: 14, loop: true, sheet: strip(4, 24, 24, (px, i) => {
    const r = rng(81 + i);
    blob(px, 12, 12, 7 + (i % 2), angularNoise(r, 0.2, 6), (d) => ramp(PLASMA, 1 - d * 0.9));
  }) };
  // Granada: girando (reflexo muda de lugar).
  out.grenade = { fps: 12, loop: true, sheet: strip(4, 14, 14, (px, i) => {
    blob(px, 7, 7, 4.5, () => 0, (d, x, y) => {
      const a = (i / 4) * Math.PI * 2;
      const hx = 7 + Math.cos(a) * 2, hy = 7 + Math.sin(a) * 2;
      return Math.hypot(x + 0.5 - hx, y + 0.5 - hy) < 1.6 ? OLIVE[3] : ramp(OLIVE, 0.75 - d * 0.6);
    });
  }) };
  // Chama: bola de fogo que sobe e esfria.
  out.flame = { fps: 18, loop: false, sheet: strip(6, 24, 24, (px, i, n) => {
    const r = rng(91 + i);
    const t = i / (n - 1);
    blob(px, 12, 13 - t * 4, 6 + 3 * Math.sin(t * Math.PI), angularNoise(r, 0.55, 7), (d, x, y) => {
      const heat = (1 - d) * (1 - t * 0.8);
      return heat > 0.1 || dither(x, y, 1 - t) ? ramp(FIRE, heat * 1.4 + 0.1) : null;
    });
  }) };
  // Vento: redemoinho de arcos claros.
  out.wind = { fps: 16, loop: false, sheet: strip(6, 36, 36, (px, i, n) => {
    const t = i / (n - 1);
    for (let arc = 0; arc < 3; arc++) {
      const radius = 5 + arc * 5 + t * 6;
      for (let s = 0; s < 18; s++) {
        const a = arc * 2.1 + t * 5 + (s / 18) * Math.PI * 1.2;
        const x = Math.round(18 + Math.cos(a) * radius), y = Math.round(18 + Math.sin(a) * radius * 0.7);
        if ((s + i) % 5 !== 0) px.set(x, y, ramp(WIND, 1 - s / 18 - t * 0.4));
      }
    }
  }) };
  // Feixe da Mystery Box: coluna de luz dourada que sobe, com faíscas (repete). Quadro 24×96.
  out.box_beam = { fps: 10, loop: true, frame: [24, 96], sheet: strip(6, 24, 96, (px, i) => {
    const r = rng(141 + i);
    for (let y = 0; y < 96; y++) {
      const fade = y / 95;  // 0 no alto, 1 embaixo
      const half = 6 + fade * 5 + Math.sin(y * 0.3 + i) * 0.8;
      for (let x = 0; x < 24; x++) {
        const d = Math.abs(x + 0.5 - 12) / half;
        if (d > 1) continue;
        const v = Math.min(1, (1 - d) * (0.55 + fade * 0.6) + 0.15);
        if (dither(x, y + i * 2, v)) px.set(x, y, d < 0.35 ? [255, 250, 220] : [255, 214, 110]);
      }
    }
    for (let k = 0; k < 7; k++) {
      const y = Math.floor((r() * 96 + (96 - i * 16)) % 96), x = Math.floor(4 + r() * 16);
      px.set(x, y, [255, 255, 235]);
    }
  }) };
  // Corte da faca: meia-lua que varre da esquerda para a direita e some (deitada no chão,
  // a frente do golpe é o alto da imagem).
  out.slash = { fps: 24, loop: false, sheet: strip(5, 48, 48, (px, i, n) => {
    const t = i / (n - 1);
    const from = Math.PI * (1.05 + t * 0.5), to = Math.PI * (1.45 + t * 0.55);
    for (let a = from; a <= to; a += 0.01) {
      const k = (a - from) / (to - from);  // 0 na cauda, 1 na ponta
      for (let r = 0; r < 4 * (0.4 + k) * (1 - t * 0.5); r++) {
        const radius = 20 - r;
        const x = Math.round(24 + Math.cos(a) * radius), y = Math.round(40 + Math.sin(a) * radius * 0.9);
        if (x < 0 || y < 0 || x > 47 || y > 47) continue;
        const color = r === 0 ? [255, 255, 255] : k > 0.6 ? [255, 236, 170] : [200, 210, 225];
        if (k > 0.25 || (x + y) % 2 === 0) px.set(x, y, color);
      }
    }
  }) };
  // Cuspe ácido: bolha verde tremendo, com gotas escorrendo.
  out.acid = { fps: 12, loop: true, sheet: strip(4, 18, 18, (px, i) => {
    const r = rng(101 + i);
    blob(px, 9, 9, 5.5 + (i % 2) * 0.6, angularNoise(r, 0.35, 6), (d) => ramp(ACID, 1 - d * 0.85));
    px.set(8 + (i % 3), 15, ACID[1]); px.set(8 + (i % 3), 16, ACID[0]);
  }) };
  // Poça (ácido, gás no chão): mancha irregular com bolhas que estouram; cinza, tingida no jogo.
  out.pool = { fps: 6, loop: true, sheet: strip(4, 48, 48, (px, i) => {
    const r = rng(113);
    const noise = angularNoise(r, 0.3, 8);
    blob(px, 24, 24, 19, noise, (d, x, y) => (d > 0.86 ? GRAY[4] : dither(x, y, 0.55 + (1 - d) * 0.4) ? ramp(GRAY, 0.25 + (1 - d) * 0.5) : GRAY[1]));
    const b = rng(127);
    for (let j = 0; j < 7; j++) {
      const bx = 10 + b() * 28, by = 10 + b() * 28, phase = (j + i) % 4;
      if (phase < 3) blob(px, bx, by, 1 + phase * 0.8, () => 0, (d) => (d > 0.6 ? GRAY[4] : null));
    }
  }) };
  // Nuvem de gás: fumaça pontilhada que rola; cinza, tingida no jogo.
  out.gas = { fps: 8, loop: true, sheet: strip(6, 40, 40, (px, i, n) => {
    const r = rng(131);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + (i / n) * Math.PI * 0.6;
      const cx = 20 + Math.cos(a) * 7, cy = 21 + Math.sin(a) * 5;
      blob(px, cx, cy, 8 + ((k + i) % 3), angularNoise(r, 0.3, 5), (d, x, y) => (dither(x + i, y, 0.75 - d * 0.55) ? ramp(GRAY, 0.9 - d * 0.6) : null));
    }
  }) };
  // Onda de choque (boss): anel que se abre e some, deitado no chão.
  out.shockwave = { fps: 18, loop: false, sheet: strip(7, 64, 64, (px, i, n) => {
    const t = i / (n - 1);
    const radius = 6 + t * 25, width = 4 - t * 2.5;
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const d = Math.hypot(x + 0.5 - 32, y + 0.5 - 32);
      if (Math.abs(d - radius) < width && dither(x, y, 1 - t * 0.8)) px.set(x, y, ramp(GRAY, 1 - Math.abs(d - radius) / width * 0.6));
      else if (d < radius - width && d > radius - width - 3 && dither(x, y, 0.3 - t * 0.3)) px.set(x, y, GRAY[1]);
    }
  }) };
  return out;
}
