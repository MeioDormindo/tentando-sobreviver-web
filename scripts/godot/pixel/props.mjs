// Objetos do cenário em pixel art 2.5D: cada objeto é uma receita de caixas e cilindros; cada
// face recebe uma textura pixel pintada no tamanho real dela (48 px/m). As faces de um objeto
// vão para um atlas PNG + JSON com as regiões (a PropFactory do Godot monta a malha).
// Partes "tint" recebem a cor na hora (máquina de perk na cor do perk).
import { writeFileSync } from 'node:fs';
import { Pixels } from './raster.mjs';
import { PPM, rng, base, stain, rect, hline, vline, bevel, mix, scale, hex, dither } from './paint.mjs';

const px = (m) => Math.max(2, Math.round(m * PPM));
const GRIME = hex(0x1a1714);

// ───────────────────────── Pintores de face ─────────────────────────
// Cada um: (w, h, r) em pixels → Pixels.

const paint = {
  wood: (color = hex(0x6d4a2c), dir = 'h') => (w, h, r) => {
    const p = base(w, h, color, r, { amount: 0.1 });
    const step = 8;
    if (dir === 'h') for (let y = 0; y < h; y += step) { hline(p, y, scale(color, 0.55)); hline(p, y + 1, scale(color, 1.15)); }
    else for (let x = 0; x < w; x += step) { vline(p, x, scale(color, 0.55)); vline(p, x + 1, scale(color, 1.15)); }
    for (let i = 0; i < (w * h) / 60; i++) p.set(r.int(0, w - 1), r.int(0, h - 1), scale(color, 0.8));
    return p;
  },
  crate: (color = hex(0x7a5431)) => (w, h, r) => {
    const p = paint.wood(color)(w, h, r);
    rect(p, 0, 0, w, 3, scale(color, 0.7)); rect(p, 0, h - 3, w, 3, scale(color, 0.7));
    rect(p, 0, 0, 3, h, scale(color, 0.7)); rect(p, w - 3, 0, 3, h, scale(color, 0.7));
    for (let t = 0; t < Math.max(w, h); t++) {  // travessa em diagonal
      const x = Math.round((t / Math.max(w, h)) * w), y = Math.round((t / Math.max(w, h)) * h);
      for (let k = -1; k <= 1; k++) p.set(x + k, y, scale(color, 0.85));
    }
    bevel(p, 0, 0, w, h, scale(color, 1.2), scale(color, 0.45));
    return p;
  },
  metal: (color = hex(0x4c5258), { rivets = true, stripes = 0, rust = 0.3 } = {}) => (w, h, r) => {
    const p = base(w, h, color, r, { amount: 0.08 });
    if (stripes) for (let y = Math.floor(h / (stripes + 1)); y < h - 2; y += Math.floor(h / (stripes + 1))) { hline(p, y, scale(color, 0.6)); hline(p, y + 1, scale(color, 1.25)); }
    if (rivets) for (const [x, y] of [[2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3]]) p.set(x, y, scale(color, 1.45));
    for (let i = 0; i < Math.round((w * h) / 900 * rust * 10); i++) stain(p, r, r() * w, r() * h, 2 + r() * 4, hex(0x6a3a1e), 0.4);
    bevel(p, 0, 0, w, h, scale(color, 1.25), scale(color, 0.55));
    return p;
  },
  painted: (color) => (w, h, r) => {
    const p = paint.metal(color, { rivets: false, rust: 0.2 })(w, h, r);
    for (let i = 0; i < 3; i++) stain(p, r, r() * w, r() * h, 2 + r() * 3, hex(0x55524c), 0.5);  // tinta descascada
    return p;
  },
  barrel: (color = hex(0x7a2e22)) => (w, h, r) => {
    const p = paint.metal(color, { rivets: false, stripes: 2, rust: 0.6 })(w, h, r);
    if (h > 12) rect(p, Math.floor(w * 0.3), Math.floor(h * 0.4), Math.max(4, Math.floor(w * 0.15)), Math.max(3, Math.floor(h * 0.18)), hex(0xd9b93c));  // etiqueta
    return p;
  },
  cap: (color) => (w, h, r) => {
    const p = base(w, h, scale(color, 0.85), r, { amount: 0.06 });
    const cx = w / 2, cy = h / 2;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / (w / 2);
      if (d > 0.8 && d < 0.92) p.set(x, y, scale(color, 1.3));
    }
    p.set(Math.round(cx * 1.4), Math.round(cy * 0.7), hex(0x222222));
    return p;
  },
  fabric: (color) => (w, h, r) => {
    const p = base(w, h, color, r, { amount: 0.1, cells: 4 });
    for (let y = 0; y < h; y += 2) for (let x = y % 4 === 0 ? 0 : 1; x < w; x += 2) p.set(x, y, scale(p.rgb(x, y), 0.92));
    stain(p, r, r() * w, r() * h, 3 + r() * 4, GRIME, 0.3);
    bevel(p, 0, 0, w, h, scale(color, 1.2), scale(color, 0.6));
    return p;
  },
  sheet: (color = hex(0xc9cdc6), blood = true) => (w, h, r) => {
    const p = base(w, h, color, r, { amount: 0.06 });
    for (let i = 0; i < 4; i++) { const y = r.int(2, h - 3); for (let x = r.int(0, w / 3); x < w - r.int(0, w / 3); x++) if (dither(x, y, 0.6)) p.set(x, y, scale(color, 0.82)); }
    if (blood) stain(p, r, r() * w, r() * h, 3 + r() * 4, hex(0x6a1a14), 0.6);
    return p;
  },
  screen: (glow = hex(0x6fd3a0)) => (w, h, r) => {
    const p = new Pixels(w, h);
    rect(p, 0, 0, w, h, hex(0x16181a));
    rect(p, 2, 2, w - 4, h - 4, scale(glow, 0.35));
    for (let y = 3; y < h - 3; y += 2) for (let x = 3; x < w - 3 - r.int(0, w / 2); x++) p.set(x, y, scale(glow, 0.8 + r() * 0.2));
    return p;
  },
  glass: (tint = hex(0x5d7a86)) => (w, h, r) => {
    const p = new Pixels(w, h);
    rect(p, 0, 0, w, h, scale(tint, 0.6));
    for (let i = 0; i < w + h; i += 7) for (let k = 0; k < 3; k++) { const x = i - k, y = k; for (let t = 0; t < h; t++) { const xx = x - t; if (xx >= 0 && xx < w) p.set(xx, t, scale(tint, 1.1)); } }
    bevel(p, 0, 0, w, h, hex(0x9aa4a8), hex(0x2a2e30));
    return p;
  },
  shelves: (items) => (w, h, r) => {  // armário com vidro e frascos
    const p = paint.metal(hex(0xb8bdb6), { rivets: false, rust: 0 })(w, h, r);
    for (let row = 1; row < 4; row++) {
      const y = Math.floor((h * row) / 4);
      hline(p, y, hex(0x7c827b));
      for (let x = 3; x < w - 3; x += r.int(3, 6)) rect(p, x, y - r.int(3, 6), 2, 3, r.pick(items));
    }
    return p;
  },
  locker: (color = hex(0x4b5a63)) => (w, h, r) => {
    const p = paint.painted(color)(w, h, r);
    const doors = Math.max(1, Math.round(w / 20));
    for (let d = 0; d < doors; d++) {
      const x0 = Math.floor((w * d) / doors);
      vline(p, x0, scale(color, 0.5));
      for (let y = 6; y < 16 && y < h; y += 3) hline(p, y, scale(color, 0.6), x0 + 4, x0 + Math.floor(w / doors) - 4);  // ventilação
      p.set(x0 + Math.floor(w / doors) - 4, Math.floor(h / 2), hex(0xc9c2a0));  // puxador
    }
    return p;
  },
  drawers: () => (w, h, r) => {  // gavetas do necrotério
    const p = paint.metal(hex(0x8a9396), { rivets: false, rust: 0.1 })(w, h, r);
    const cols = Math.max(1, Math.round(w / 40)), rows = Math.max(1, Math.round(h / 22));
    for (let c = 0; c < cols; c++) for (let rr = 0; rr < rows; rr++) {
      const x = Math.floor((w * c) / cols) + 2, y = Math.floor((h * rr) / rows) + 2, cw = Math.floor(w / cols) - 4, ch = Math.floor(h / rows) - 4;
      bevel(p, x, y, cw, ch, hex(0xb4bcbf), hex(0x4c5456));
      rect(p, x + Math.floor(cw / 2) - 3, y + Math.floor(ch / 2), 6, 1, hex(0x2a2e30));
    }
    return p;
  },
  vending: (glow = hex(0xe8d27a)) => (w, h, r) => {
    const p = paint.painted(hex(0x2f5d7c))(w, h, r);
    const gx = 3, gy = 4, gw = Math.floor(w * 0.66), gh = Math.floor(h * 0.62);
    rect(p, gx, gy, gw, gh, scale(glow, 0.35));
    for (let y = gy + 3; y < gy + gh - 2; y += 6) for (let x = gx + 2; x < gx + gw - 3; x += 5) rect(p, x, y, 3, 4, r.pick([hex(0xd24a3a), hex(0x3aa0d2), hex(0xe0c040), hex(0x7ad24a)]));
    rect(p, gx + gw + 2, gy + 4, w - gx - gw - 5, 6, hex(0x151515));
    return p;
  },
  hazard: () => (w, h) => {
    const p = new Pixels(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) p.set(x, y, ((x + y) >> 2) % 2 ? hex(0xd2a32a) : hex(0x1d1d1d));
    return p;
  },
  stripes: (a = hex(0xc2372c), b = hex(0xd8d4c8)) => (w, h) => {
    const p = new Pixels(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) p.set(x, y, Math.floor((x + y) / 6) % 2 ? a : b);
    bevel(p, 0, 0, w, h, hex(0xeeeeee), hex(0x333333));
    return p;
  },
  generator: () => (w, h, r) => {
    const p = paint.painted(hex(0x5e6b3a))(w, h, r);
    for (let y = 4; y < h - 8; y += 3) hline(p, y, hex(0x2d3320), Math.floor(w * 0.55), w - 4);  // grade
    rect(p, 3, h - 6, w - 6, 3, hex(0xd2a32a));
    return p;
  },
  mystery: () => (w, h, r) => {
    const p = paint.wood(hex(0x6b4a24), 'h')(w, h, r);
    rect(p, 0, 0, w, 3, hex(0xd9a640)); rect(p, 0, h - 3, w, 3, hex(0xd9a640));
    rect(p, 0, 0, 3, h, hex(0xd9a640)); rect(p, w - 3, 0, 3, h, hex(0xd9a640));
    // "?" brilhante no meio
    const cx = Math.floor(w / 2), cy = Math.floor(h / 2);
    const q = ['.###.', '#...#', '...#.', '..#..', '..#..', '.....', '..#..'];
    q.forEach((row, j) => [...row].forEach((c, i) => { if (c === '#') rect(p, cx - 5 + i * 2, cy - 7 + j * 2, 2, 2, hex(0xffe08a)); }));
    return p;
  },
  lab: () => (w, h, r) => {
    const p = paint.metal(hex(0x3a3d42), { rust: 0.1 })(w, h, r);
    rect(p, Math.floor(w * 0.55), 3, Math.floor(w * 0.35), Math.floor(h * 0.4), hex(0x14181c));
    for (let y = 5; y < Math.floor(h * 0.4); y += 2) hline(p, y, hex(0x62d7ff), Math.floor(w * 0.57), Math.floor(w * 0.57) + r.int(4, Math.floor(w * 0.3)));
    return p;
  },
  perk: () => (w, h, r) => {  // neutro: a cor do perk entra no Godot (tint)
    const p = base(w, h, hex(0xb0b0b0), r, { amount: 0.08 });
    rect(p, 3, 4, w - 6, Math.floor(h * 0.45), hex(0xf0f0f0));  // vitrine clara
    for (let y = 8; y < Math.floor(h * 0.45); y += 6) for (let x = 6; x < w - 8; x += 6) rect(p, x, y, 3, 4, hex(0x8a8a8a));  // latas
    rect(p, Math.floor(w * 0.3), Math.floor(h * 0.7), Math.floor(w * 0.4), 4, hex(0x333333));
    bevel(p, 0, 0, w, h, hex(0xdddddd), hex(0x555555));
    return p;
  },
  concrete: () => (w, h, r) => { const p = base(w, h, hex(0x7a766c), r, { amount: 0.14 }); for (let i = 0; i < (w * h) / 80; i++) p.set(r.int(0, w - 1), r.int(0, h - 1), hex(0x5a574f)); bevel(p, 0, 0, w, h, hex(0x9a968c), hex(0x45433d)); return p; },
  black: () => (w, h, r) => base(w, h, hex(0x1d1e20), r, { amount: 0.1 }),
  /** Frente de painel de parede: caixa de aço, faixa da cor do painel, símbolo e botões. */
  panel: (color, symbol) => (w, h, r) => {
    const p = paint.metal(hex(0x464b4f), { rust: 0.25 })(w, h, r);
    rect(p, 3, 3, w - 6, 8, color); hline(p, 3, scale(color, 1.3)); hline(p, 10, scale(color, 0.55));  // faixa
    const cx = Math.floor(w / 2), cy = Math.floor(h * 0.45);
    rect(p, cx - 12, cy - 12, 24, 24, hex(0x1b1d1f)); bevel(p, cx - 12, cy - 12, 24, 24, hex(0x0e0f10), hex(0x5a5f63));
    const glyph = SYMBOLS[symbol] || [];
    glyph.forEach((row, j) => [...row].forEach((c, i) => { if (c === '#') rect(p, cx - 9 + i * 2, cy - 9 + j * 2, 2, 2, scale(color, 1.2)); }));
    // Botões e alavanca embaixo.
    for (let i = 0; i < 3; i++) rect(p, 6 + i * 7, h - 16, 4, 4, [hex(0x3ac25a), hex(0xd2a32a), hex(0xd23a2a)][i]);
    rect(p, w - 14, h - 22, 4, 14, hex(0x2a2c2e)); rect(p, w - 16, h - 24, 8, 4, hex(0xc23a2a));
    for (let x = 4; x < w - 4; x += 8) p.set(x, h - 6, hex(0x1a1a1a));  // ventilação
    return p;
  },
  /** Caixa de suprimentos (evento): madeira verde-oliva, cintas amarelas e estêncil. */
  supply: (stencil = true) => (w, h, r) => {
    const olive = hex(0x4f5b34);
    const p = paint.wood(olive, 'h')(w, h, r);
    bevel(p, 0, 0, w, h, scale(olive, 1.35), scale(olive, 0.45));
    for (const x of [Math.floor(w * 0.2), Math.floor(w * 0.8) - 4]) { rect(p, x, 0, 4, h, hex(0xd2a32a)); vline(p, x, hex(0xf0c850)); vline(p, x + 3, hex(0x8a6a1a)); }
    if (stencil && w > 30 && h > 20) {
      const cx = Math.floor(w / 2), cy = Math.floor(h / 2);
      rect(p, cx - 6, cy - 2, 12, 4, hex(0xe8e2cc)); rect(p, cx - 2, cy - 6, 4, 12, hex(0xe8e2cc));  // cruz branca
      for (let x = cx - 10; x < cx + 10; x += 3) p.set(x, cy + 9, hex(0xd8d2bc));  // estêncil
    }
    return p;
  },
  /** Geladeira de amostras: porta de vidro com frascos coloridos iluminados. */
  fridge: () => (w, h, r) => {
    const p = paint.metal(hex(0xd8dcd8), { rust: 0.05 })(w, h, r);
    rect(p, 4, 6, w - 8, Math.floor(h * 0.62), hex(0x9fd6e0)); bevel(p, 4, 6, w - 8, Math.floor(h * 0.62), hex(0x5a8a94), hex(0xe8fbff));
    for (let y = 12; y < Math.floor(h * 0.62); y += 10) {
      hline(p, y + 6, hex(0x6a9aa4), 6, w - 7);
      for (let x = 8; x < w - 10; x += 5) rect(p, x, y, 3, 6, r.pick([hex(0x9bd02a), hex(0xd24a3a), hex(0x3aa0d2)]));
    }
    rect(p, w - 9, Math.floor(h * 0.3), 3, 16, hex(0x7a7e7a));  // puxador
    rect(p, 6, h - 14, w - 12, 6, hex(0x2a2c2e)); for (let x = 8; x < w - 8; x += 3) p.set(x, h - 11, hex(0x62d7ff));  // visor
    return p;
  },
  /** Mystery Box: madeira escura em tábuas, faixas e cantoneiras douradas com rebites. */
  chest: (withLock = false) => (w, h, r) => {
    const wood = hex(0x3a2414), gold = hex(0xd9a640);
    const p = paint.wood(wood, 'h')(w, h, r);
    const band = (x0) => { rect(p, x0, 0, 5, h, gold); vline(p, x0, scale(gold, 1.35)); vline(p, x0 + 4, scale(gold, 0.55)); for (let y = 3; y < h; y += 7) p.set(x0 + 2, y, hex(0xfff0b0)); };
    band(Math.floor(w * 0.18)); band(Math.floor(w * 0.82) - 5);
    rect(p, 0, 0, w, 3, gold); rect(p, 0, h - 3, w, 3, gold);
    for (const [x, y] of [[0, 0], [w - 7, 0], [0, h - 7], [w - 7, h - 7]]) { rect(p, x, y, 7, 7, scale(gold, 0.9)); bevel(p, x, y, 7, 7, scale(gold, 1.3), scale(gold, 0.5)); }
    if (withLock) { const cx = Math.floor(w / 2); rect(p, cx - 4, h - 16, 9, 11, gold); bevel(p, cx - 4, h - 16, 9, 11, scale(gold, 1.3), scale(gold, 0.5)); rect(p, cx, h - 13, 1, 4, hex(0x1a1008)); }
    return p;
  },
  /** Tampa: fundo escuro com runas acesas em volta e um grande "?" no meio. */
  runes: () => (w, h, r) => {
    const p = base(w, h, hex(0x2a1a10), r, { amount: 0.08 });
    bevel(p, 0, 0, w, h, hex(0xd9a640), hex(0x6a4a18));
    for (let x = 6; x < w - 6; x += 6) { const y = r() < 0.5 ? 3 : h - 5; rect(p, x, y, 2, 2, hex(0x7fe7ff)); if (r() < 0.5) p.set(x + 2, y + 1, hex(0x7fe7ff)); }
    const cx = Math.floor(w / 2), cy = Math.floor(h / 2);
    const q = ['.###.', '#...#', '...#.', '..#..', '..#..', '.....', '..#..'];
    q.forEach((row, j) => [...row].forEach((c, i) => { if (c === '#') rect(p, cx - 5 + i * 2, cy - 7 + j * 2, 2, 2, hex(0xffe08a)); }));
    return p;
  },
  /** Medalhão com "?" (a peça que brilha). */
  emblem: () => (w, h) => {
    const p = new Pixels(w, h);
    const cx = w / 2, cy = h / 2;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / (w / 2);
      if (d < 1) p.set(x, y, d > 0.82 ? hex(0xd9a640) : d > 0.72 ? hex(0x6a4a18) : hex(0x1a1030));
    }
    const q = ['.###.', '#...#', '...#.', '..#..', '..#..', '.....', '..#..'];
    const k = Math.max(1, Math.floor(w / 12));
    q.forEach((row, j) => [...row].forEach((c, i) => { if (c === '#') rect(p, Math.floor(cx - 2.5 * k) + i * k, Math.floor(cy - 3.5 * k) + j * k, k, k, hex(0xfff0b0)); }));
    return p;
  },
  /** Máquina de perk (neutra: a cor do perk entra pelo tint): vitrine de latas, saída e moedeiro. */
  perkBody: () => (w, h, r) => {
    const p = base(w, h, hex(0xd8d8d8), r, { amount: 0.05 });
    for (let x = 4; x < w - 4; x += 10) vline(p, x, hex(0xbcbcbc), 0, h - 1);  // frisos
    const gx = 5, gy = Math.floor(h * 0.12), gw = w - 10, gh = Math.floor(h * 0.42);
    rect(p, gx, gy, gw, gh, hex(0x242424)); bevel(p, gx, gy, gw, gh, hex(0x101010), hex(0xf4f4f4));
    for (let y = gy + 4; y < gy + gh - 6; y += 9) {  // prateleiras com latas
      hline(p, y + 7, hex(0x8a8a8a), gx + 2, gx + gw - 3);
      for (let x = gx + 4; x < gx + gw - 5; x += 6) { rect(p, x, y, 4, 7, hex(0xf0f0f0)); hline(p, y + 1, hex(0x9a9a9a), x, x + 3); p.set(x + 1, y + 3, hex(0x505050)); }
    }
    for (let x = gx + 2; x < gx + gw - 2; x += 3) p.set(x, gy + 2, hex(0xffffff));  // reflexo
    const sy = Math.floor(h * 0.62);
    rect(p, 6, sy, w - 12, 5, hex(0xf8f8f8)); hline(p, sy, hex(0xffffff));  // faixa
    rect(p, Math.floor(w * 0.18), Math.floor(h * 0.75), Math.floor(w * 0.45), Math.floor(h * 0.12), hex(0x161616));  // saída
    bevel(p, Math.floor(w * 0.18), Math.floor(h * 0.75), Math.floor(w * 0.45), Math.floor(h * 0.12), hex(0x080808), hex(0x9a9a9a));
    rect(p, Math.floor(w * 0.72), Math.floor(h * 0.72), 6, 12, hex(0x3a3a3a)); rect(p, Math.floor(w * 0.72) + 2, Math.floor(h * 0.72) + 3, 2, 6, hex(0x0a0a0a));  // moedeiro
    bevel(p, 0, 0, w, h, hex(0xffffff), hex(0x6a6a6a));
    return p;
  },
  /** Letreiro de neon da máquina de perk (brilha na cor do perk). */
  neon: () => (w, h) => {
    const p = new Pixels(w, h);
    rect(p, 0, 0, w, h, hex(0x303030));
    rect(p, 2, 2, w - 4, h - 4, hex(0xf6f6f6));
    for (let x = 4; x < w - 4; x += 5) p.set(x, Math.floor(h / 2), hex(0xb0b0b0));
    return p;
  },
  /** Painel de ferramentas perfurado do Weapon Lab. */
  pegboard: () => (w, h, r) => {
    const p = base(w, h, hex(0x8a6a44), r, { amount: 0.08 });
    for (let y = 3; y < h; y += 5) for (let x = 3; x < w; x += 5) p.set(x, y, hex(0x4a3420));
    const tools = [[0.12, hex(0x9aa0a4), 3, 22], [0.25, hex(0xc2372c), 4, 16], [0.4, hex(0x6a6f72), 10, 6], [0.55, hex(0xd2a32a), 3, 20], [0.7, hex(0x9aa0a4), 12, 4], [0.85, hex(0x3a3d40), 5, 14]];
    for (const [fx, c, tw, th] of tools) { const x = Math.floor(fx * w); rect(p, x, 6, tw, th, c); hline(p, 6, scale(c, 1.3), x, x + tw - 1); }
    bevel(p, 0, 0, w, h, hex(0xa88a60), hex(0x3a2414));
    return p;
  },
  /** Cofre da Bilheteria: aço escuro, dial, maçaneta e dobradiças. */
  safe: () => (w, h, r) => {
    const p = paint.metal(hex(0x3c4246), { rust: 0.3 })(w, h, r);
    bevel(p, 3, 3, w - 6, h - 6, hex(0x5a6064), hex(0x1c1f21));
    const cx = Math.floor(w * 0.42), cy = Math.floor(h * 0.45), rad = Math.floor(Math.min(w, h) * 0.16);
    for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) { const d = Math.hypot(x, y); if (d <= rad) p.set(cx + x, cy + y, d > rad - 2 ? hex(0xd9a640) : hex(0x2a2c2e)); }
    for (let a = 0; a < 12; a++) p.set(Math.round(cx + Math.cos(a * 0.52) * (rad - 3)), Math.round(cy + Math.sin(a * 0.52) * (rad - 3)), hex(0xd8d4c8));
    rect(p, Math.floor(w * 0.72), cy - 2, Math.floor(w * 0.16), 4, hex(0xb8bdb6));
    for (const y of [Math.floor(h * 0.2), Math.floor(h * 0.75)]) rect(p, 2, y, 3, 6, hex(0x8a8f92));
    return p;
  },
  /** Cabeça do sinal ferroviário: três lentes (vermelha, âmbar, verde) com viseira. */
  signalHead: () => (w, h) => {
    const p = new Pixels(w, h);
    rect(p, 0, 0, w, h, hex(0x1a1c1e));
    const lens = [hex(0xff3a2a), hex(0xffb84a), hex(0x4aff7a)];
    lens.forEach((c, i) => {
      const cx = w / 2, cy = (h / 4) * (i + 1), rr = Math.min(w, h / 3) * 0.32;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy); if (d < rr) p.set(x, y, d < rr * 0.5 ? scale(c, 1.2) : c); }
    });
    return p;
  },
  /** Disjuntor principal: armário grande com fileiras de chaves e a alavanca. */
  breaker: () => (w, h, r) => {
    const p = paint.metal(hex(0x55604a), { rust: 0.4 })(w, h, r);
    rect(p, 4, 4, w - 8, 10, hex(0xd2a32a));
    for (let x = 6; x < w - 6; x += 6) rect(p, x, 7, 3, 4, hex(0x1d1d1d));  // "ALTA TENSÃO"
    for (let row = 0; row < 4; row++) for (let x = 7; x < w - 20; x += 7) {
      const y = 22 + row * 12;
      rect(p, x, y, 5, 8, hex(0x1d1e20)); rect(p, x + 1, y + (r() < 0.5 ? 1 : 4), 3, 3, hex(0xd8d4c8));
    }
    rect(p, w - 16, 22, 8, 44, hex(0x2a2c2e)); rect(p, w - 19, 24, 14, 6, hex(0xc23a2a));  // alavanca
    rect(p, 0, h - 8, w, 8, hex(0x1d1d1d));  // faixa zebrada no pé
    for (let x = 0; x < w; x++) for (let y = h - 8; y < h; y++) if (((x + y) >> 2) % 2) p.set(x, y, hex(0xd2a32a));
    return p;
  },
  plastic: (color) => (w, h, r) => { const p = base(w, h, color, r, { amount: 0.05 }); bevel(p, 0, 0, w, h, scale(color, 1.25), scale(color, 0.6)); return p; },
};

// ───────────────────────── Receitas ─────────────────────────
// Medidas em metros: size [largura x, altura y, profundidade z], at = centro (y a partir do chão).

/** Símbolos 9×9 dos painéis (# = aceso). */
const SYMBOLS = {
  bolt: ['....##...', '...##....', '..##.....', '.#######.', '....##...', '...##....', '..##.....', '.##......', '#........'],
  bell: ['....#....', '...###...', '..#####..', '..#####..', '..#####..', '.#######.', '#########', '.........', '....#....'],
  power: ['....#....', '.#..#..#.', '#...#...#', '#...#...#', '#.......#', '#.......#', '.#.....#.', '..#####..', '.........'],
  train: ['.#######.', '#.......#', '#.##.##.#', '#.##.##.#', '#.......#', '#########', '#.#...#.#', '.#.....#.', '#.......#'],
};

const box = (size, at, tex, extra = {}) => ({ shape: 'box', size, at, tex, ...extra });
const cyl = (d, h, at, tex, extra = {}) => ({ shape: 'cyl', size: [d, h, d], at, tex, ...extra });
const all = (t) => ({ top: t, front: t, side: t });

const WOOD = hex(0x6d4a2c);
const STEEL = hex(0x8e9699);

export const RECIPES = {
  crate: [box([0.9, 0.9, 0.9], [0, 0.45, 0], all(paint.crate()))],
  pallet: [box([1.2, 0.15, 1.2], [0, 0.075, 0], { top: paint.wood(hex(0x8a6a42), 'v'), front: paint.wood(hex(0x6a4e30)), side: paint.wood(hex(0x6a4e30)) }),
    box([0.8, 0.5, 0.8], [0, 0.4, 0], all(paint.fabric(hex(0x7c7a6a))))],
  barrel: [cyl(0.75, 0.95, [0, 0.475, 0], { top: paint.cap(hex(0x7a2e22)), side: paint.barrel() })],
  trash: [cyl(0.65, 0.85, [0, 0.425, 0], { top: paint.cap(hex(0x3c5a3a)), side: paint.metal(hex(0x3c5a3a), { stripes: 1 }) })],
  bench: [box([2.0, 0.08, 0.6], [0, 0.45, 0], { top: paint.wood(WOOD), front: paint.wood(WOOD), side: paint.wood(WOOD) }),
    box([2.0, 0.5, 0.08], [0, 0.75, -0.26], all(paint.wood(WOOD))),
    box([0.08, 0.45, 0.55], [-0.85, 0.22, 0], all(paint.metal(hex(0x2c2e30)))), box([0.08, 0.45, 0.55], [0.85, 0.22, 0], all(paint.metal(hex(0x2c2e30))))],
  waiting_chairs: [box([2.4, 0.08, 0.5], [0, 0.45, 0], all(paint.plastic(hex(0x2f5d7c)))), box([2.4, 0.45, 0.06], [0, 0.72, -0.22], all(paint.plastic(hex(0x2f5d7c)))),
    box([2.4, 0.06, 0.06], [0, 0.2, 0], all(paint.metal(hex(0x55595c))))],
  generator: [box([1.45, 1.0, 0.9], [0, 0.5, 0], { top: paint.metal(hex(0x4e5a30)), front: paint.generator(), side: paint.generator() }),
    cyl(0.2, 0.4, [0.5, 1.2, -0.2], { top: paint.cap(hex(0x333333)), side: paint.metal(hex(0x333333)) })],
  luggage_cart: [box([1.8, 0.1, 0.9], [0, 0.35, 0], all(paint.metal(hex(0x6a6f72)))),
    box([0.7, 0.45, 0.6], [-0.4, 0.62, 0], all(paint.fabric(hex(0x5a3a2a)))), box([0.6, 0.35, 0.5], [0.45, 0.57, 0], all(paint.fabric(hex(0x2a4a5a))))],
  suitcase: [box([0.6, 0.25, 0.4], [0, 0.125, 0], all(paint.fabric(hex(0x5a3a2a))))],
  sign_stand: [box([1.2, 1.1, 0.12], [0, 0.95, 0], { top: paint.metal(hex(0x333333)), front: paint.screen(hex(0x7ad24a)), side: paint.metal(hex(0x333333)) }, { glow: hex(0x7ad24a) }),
    box([0.08, 0.4, 0.08], [0, 0.2, 0], all(paint.metal(hex(0x2c2e30))))],
  extinguisher: [cyl(0.2, 0.55, [0, 0.275, 0], { top: paint.cap(hex(0xb02820)), side: paint.painted(hex(0xb02820)) })],
  barrier: [box([1.85, 0.4, 0.15], [0, 0.75, 0], { top: paint.stripes(), front: paint.stripes(), side: paint.stripes() }),
    box([0.1, 0.55, 0.4], [-0.8, 0.28, 0], all(paint.metal(hex(0x2c2e30)))), box([0.1, 0.55, 0.4], [0.8, 0.28, 0], all(paint.metal(hex(0x2c2e30))))],
  desk_computer: [box([1.8, 0.08, 0.95], [0, 0.75, 0], all(paint.wood(hex(0x5a4a38)))), box([1.7, 0.7, 0.9], [0, 0.35, 0], all(paint.metal(hex(0x3a3d40)))),
    box([0.55, 0.4, 0.05], [0.2, 1.0, -0.2], { top: paint.black(), front: paint.screen(), side: paint.black() }, { glow: hex(0x6fd3a0) })],
  chair: [box([0.5, 0.06, 0.5], [0, 0.45, 0], all(paint.plastic(hex(0x3a3d40)))), box([0.5, 0.45, 0.06], [0, 0.7, -0.22], all(paint.plastic(hex(0x3a3d40))))],
  vitrine: [box([1.85, 0.9, 0.9], [0, 0.45, 0], { top: paint.glass(), front: paint.shelves([hex(0xd2a040), hex(0xa04a3a), hex(0x4a7ad2)]), side: paint.metal(hex(0x4c5258)) }, { glow: hex(0xe8d27a) })],
  locker: [box([1.6, 1.9, 0.65], [0, 0.95, 0], { top: paint.metal(hex(0x3b474e)), front: paint.locker(), side: paint.painted(hex(0x4b5a63)) })],
  wagon_seat: [box([1.0, 0.45, 0.5], [0, 0.23, 0], all(paint.fabric(hex(0x5a2a2a)))), box([1.0, 0.5, 0.12], [0, 0.65, -0.2], all(paint.fabric(hex(0x5a2a2a))))],
  cables: [box([1.2, 0.05, 0.3], [0, 0.03, 0], all(paint.black()))],
  floor_pipe: [cyl(0.3, 2.0, [0, 0.15, 0], { top: paint.cap(hex(0x6a6f72)), side: paint.metal(hex(0x6a6f72), { stripes: 3 }) }, { rot: [0, 0, 90] })],
  // Hospital
  iv_stand: [cyl(0.05, 1.7, [0, 0.85, 0], { top: paint.metal(STEEL), side: paint.metal(STEEL) }), box([0.2, 0.3, 0.08], [0.08, 1.55, 0], all(paint.glass(hex(0xa0c8b8))))],
  gurney: [box([1.8, 0.12, 0.65], [0, 0.8, 0], { top: paint.sheet(), front: paint.metal(STEEL), side: paint.metal(STEEL) }), box([1.7, 0.7, 0.08], [0, 0.4, 0], all(paint.metal(hex(0x5a6064))))],
  wheelchair: [box([0.55, 0.08, 0.55], [0, 0.5, 0], all(paint.fabric(hex(0x2a2d30)))), box([0.55, 0.5, 0.06], [0, 0.8, -0.25], all(paint.fabric(hex(0x2a2d30)))),
    cyl(0.6, 0.05, [-0.32, 0.3, 0], { top: paint.cap(hex(0x55595c)), side: paint.metal(hex(0x55595c)) }, { rot: [0, 0, 90] }),
    cyl(0.6, 0.05, [0.32, 0.3, 0], { top: paint.cap(hex(0x55595c)), side: paint.metal(hex(0x55595c)) }, { rot: [0, 0, 90] })],
  vending: [box([1.15, 1.9, 0.8], [0, 0.95, 0], { top: paint.metal(hex(0x2f5d7c)), front: paint.vending(), side: paint.painted(hex(0x2f5d7c)) }, { glow: hex(0xe8d27a) })],
  surgical_light: [cyl(0.7, 0.2, [0, 2.2, 0], { top: paint.metal(STEEL), side: paint.metal(STEEL) }), cyl(0.06, 1.2, [0, 2.9, 0], { top: paint.metal(STEEL), side: paint.metal(STEEL) })],
  med_cabinet: [box([1.65, 1.9, 0.6], [0, 0.95, 0], { top: paint.metal(hex(0xb8bdb6)), front: paint.shelves([hex(0xd24a3a), hex(0xe8e8e8), hex(0x3aa0d2), hex(0xe0c040)]), side: paint.painted(hex(0xb8bdb6)) })],
  hospital_bed: [box([1.9, 0.25, 0.95], [0, 0.6, 0], { top: paint.sheet(), front: paint.sheet(hex(0xc9cdc6), false), side: paint.sheet(hex(0xc9cdc6), false) }),
    box([0.08, 0.9, 0.95], [-0.93, 0.5, 0], all(paint.metal(STEEL))), box([1.9, 0.35, 0.9], [0, 0.25, 0], all(paint.metal(hex(0x5a6064)))),
    box([0.45, 0.1, 0.6], [-0.65, 0.78, 0], all(paint.sheet(hex(0xe2e4de), false)))],
  morgue_drawers: [box([2.9, 1.9, 0.8], [0, 0.95, 0], { top: paint.metal(hex(0x6a7275)), front: paint.drawers(), side: paint.metal(hex(0x8a9396)) })],
  lab_bench: [box([2.4, 0.08, 0.85], [0, 0.9, 0], all(paint.metal(hex(0x2a2d30)))), box([2.3, 0.85, 0.8], [0, 0.43, 0], all(paint.painted(hex(0xb8bdb6)))),
    cyl(0.12, 0.25, [-0.6, 1.07, 0], { top: paint.glass(hex(0x7ad24a)), side: paint.glass(hex(0x7ad24a)) }, { glow: hex(0x7ad24a) }),
    box([0.4, 0.35, 0.3], [0.6, 1.1, 0], { top: paint.black(), front: paint.screen(hex(0x62d7ff)), side: paint.black() }, { glow: hex(0x62d7ff) })],
  centrifuge: [cyl(1.0, 1.0, [0, 0.5, 0], { top: paint.cap(hex(0xb8bdb6)), side: paint.metal(hex(0xb8bdb6), { stripes: 2, rust: 0 }) })],
  // Painéis de parede (evento, armadilha, trem) e o disjuntor principal.
  panel_alarm: [box([0.9, 1.3, 0.26], [0, 0.95, 0.12], { top: paint.metal(hex(0x3a3e42)), front: paint.panel(hex(0xd23a2a), 'bell'), side: paint.metal(hex(0x3a3e42)) }),
    box([0.5, 0.44, 0.03], [0, 1.12, -0.02], all(paint.screen(hex(0xff5a4a))), { glow: hex(0xff5a4a) }),
    box([0.08, 0.08, 0.04], [0.33, 1.52, -0.02], all(paint.black()), { glow: hex(0xff5a4a), name: 'led' }),
    box([0.06, 0.6, 0.06], [-0.3, 0.3, 0.2], all(paint.metal(hex(0x2a2c2e))))],
  panel_power: [box([0.9, 1.3, 0.26], [0, 0.95, 0.12], { top: paint.metal(hex(0x3a3e42)), front: paint.panel(hex(0xe0b030), 'power'), side: paint.metal(hex(0x3a3e42)) }),
    box([0.5, 0.44, 0.03], [0, 1.12, -0.02], all(paint.screen(hex(0xffd35a))), { glow: hex(0xffd35a) }),
    box([0.08, 0.08, 0.04], [0.33, 1.52, -0.02], all(paint.black()), { glow: hex(0xffd35a), name: 'led' }),
    box([0.06, 0.6, 0.06], [-0.3, 0.3, 0.2], all(paint.metal(hex(0x2a2c2e))))],
  panel_trap: [box([0.9, 1.3, 0.26], [0, 0.95, 0.12], { top: paint.metal(hex(0x3a3e42)), front: paint.panel(hex(0x4ab8f0), 'bolt'), side: paint.metal(hex(0x3a3e42)) }),
    box([0.5, 0.44, 0.03], [0, 1.12, -0.02], all(paint.screen(hex(0x7fd8ff))), { glow: hex(0x7fd8ff) }),
    box([0.08, 0.08, 0.04], [0.33, 1.52, -0.02], all(paint.black()), { glow: hex(0x7fd8ff), name: 'led' }),
    box([0.06, 0.6, 0.06], [-0.3, 0.3, 0.2], all(paint.metal(hex(0x2a2c2e))))],
  panel_train: [box([0.9, 1.3, 0.26], [0, 0.95, 0.12], { top: paint.metal(hex(0x3a3e42)), front: paint.panel(hex(0xe89a3a), 'train'), side: paint.metal(hex(0x3a3e42)) }),
    box([0.5, 0.44, 0.03], [0, 1.12, -0.02], all(paint.screen(hex(0xffb85a))), { glow: hex(0xffb85a) }),
    box([0.08, 0.08, 0.04], [0.33, 1.52, -0.02], all(paint.black()), { glow: hex(0xffb85a), name: 'led' }),
    box([0.06, 0.6, 0.06], [-0.3, 0.3, 0.2], all(paint.metal(hex(0x2a2c2e))))],
  breaker: [box([1.2, 1.7, 0.3], [0, 0.95, 0.1], { top: paint.metal(hex(0x55604a)), front: paint.breaker(), side: paint.painted(hex(0x55604a)) }),
    box([0.08, 0.08, 0.04], [0.48, 1.7, -0.07], all(paint.black()), { glow: hex(0xff4a3a), name: 'led' })],
  sample_fridge: [box([0.9, 1.7, 0.7], [0, 0.85, 0], { top: paint.metal(hex(0xd8dcd8), { rust: 0 }), front: paint.fridge(), side: paint.painted(hex(0xd8dcd8)) }, { glow: hex(0xbfefff) })],
  gas_pipe: [cyl(0.3, 1.6, [0, 0.2, 0], { top: paint.cap(hex(0x8a8f5a)), side: paint.metal(hex(0x8a8f5a), { stripes: 2, rust: 0.8 }) }, { rot: [0, 0, 90] }),
    cyl(0.12, 0.35, [0, 0.45, 0], { top: paint.cap(hex(0x6a6f72)), side: paint.metal(hex(0x6a6f72)) }),
    cyl(0.5, 0.06, [0, 0.66, 0], { top: paint.cap(hex(0xc2372c)), side: paint.painted(hex(0xc2372c)) })],
  rubble: [box([0.7, 0.3, 0.5], [0, 0.15, 0], all(paint.concrete())), box([0.45, 0.22, 0.4], [0.35, 0.11, 0.25], all(paint.concrete()), { rot: [0, 35, 0] }),
    box([0.35, 0.18, 0.3], [-0.35, 0.09, -0.2], all(paint.concrete()), { rot: [0, -20, 0] }), box([0.9, 0.06, 0.08], [0.1, 0.33, 0], all(paint.metal(hex(0x6a3a1e))), { rot: [0, 20, 10] })],
  safe: [box([0.8, 0.95, 0.6], [0, 0.475, 0], { top: paint.metal(hex(0x3c4246)), front: paint.safe(), side: paint.metal(hex(0x3c4246), { stripes: 1 }) })],
  signal_cabinet: [box([0.8, 1.2, 0.55], [0, 0.6, 0], { top: paint.metal(hex(0x2f4a36)), front: paint.panel(hex(0xe89a3a), 'train'), side: paint.painted(hex(0x2f4a36)) }),
    box([0.12, 1.0, 0.12], [0, 1.7, 0], all(paint.metal(hex(0x2a2c2e)))),
    box([0.42, 0.9, 0.2], [0, 2.4, -0.02], { top: paint.black(), front: paint.signalHead(), side: paint.black() }, { glow: hex(0xffe0a0), name: 'head' })],
  supply_crate: [box([1.0, 0.7, 0.8], [0, 0.35, 0], { top: paint.supply(), front: paint.supply(), side: paint.supply(false) }),
    cyl(0.08, 0.22, [0.38, 0.81, 0.25], { top: paint.cap(hex(0xff4a3a)), side: paint.metal(hex(0xc2372c), { rivets: false }) }, { glow: hex(0xff4a3a) })],
  // Máquinas
  mystery_box: [box([2.0, 0.78, 1.1], [0, 0.39, 0], { top: paint.chest(), front: paint.chest(true), side: paint.chest() }),
    box([0.46, 0.46, 1.14], [0, 0.42, 0], all(paint.emblem()), { glow: hex(0xffd878) }),
    ...[[-0.97, -0.52], [0.97, -0.52], [-0.97, 0.52], [0.97, 0.52]].map(([x, z]) => box([0.1, 0.84, 0.1], [x, 0.42, z], all(paint.metal(hex(0xd9a640), { rust: 0 })))),
    box([2.08, 0.16, 1.18], [0, 0.86, 0], { top: paint.runes(), front: paint.metal(hex(0xd9a640), { rust: 0, stripes: 1 }), side: paint.metal(hex(0xd9a640), { rust: 0 }) }, { name: 'lid', glow: hex(0x9fe8ff) })],
  perk_machine: [box([1.2, 1.86, 0.86], [0, 1.0, 0], { top: paint.metal(hex(0x9a9a9a), { rust: 0 }), front: paint.perkBody(), side: paint.painted(hex(0xc8c8c8)) }, { tint: true }),
    box([1.28, 0.36, 0.92], [0, 2.08, 0], { top: paint.metal(hex(0x2a2a2a)), front: paint.neon(), side: paint.metal(hex(0x2a2a2a)) }, { glow: hex(0xffffff), tint: true, name: 'sign' }),
    box([1.26, 0.1, 0.9], [0, 0.05, 0], all(paint.metal(hex(0x2a2c2e)))),
    box([0.1, 1.8, 0.1], [-0.6, 1.0, -0.43], all(paint.metal(hex(0xc8ccd0), { rust: 0 }))), box([0.1, 1.8, 0.1], [0.6, 1.0, -0.43], all(paint.metal(hex(0xc8ccd0), { rust: 0 })))],
  weapon_lab: [box([1.7, 0.1, 1.0], [0, 0.95, 0], all(paint.metal(hex(0x55504a)))), box([1.6, 0.9, 0.9], [0, 0.45, 0], { top: paint.metal(hex(0x3a3d42)), front: paint.lab(), side: paint.metal(hex(0x3a3d42)) }),
    box([1.7, 1.1, 0.06], [0, 1.55, 0.47], { top: paint.metal(hex(0x3a2414)), front: paint.pegboard(), side: paint.metal(hex(0x3a2414)) }),
    box([0.34, 0.26, 0.3], [-0.52, 1.13, -0.1], all(paint.metal(hex(0x2f5d7c)))), box([0.08, 0.06, 0.4], [-0.52, 1.28, -0.1], all(paint.metal(hex(0xb8bdb6), { rust: 0 }))),
    box([0.4, 0.14, 0.2], [0.05, 1.07, 0.05], all(paint.metal(hex(0x2a2c2e)))),
    box([0.46, 0.34, 0.06], [0.52, 1.2, 0.15], { top: paint.black(), front: paint.screen(hex(0x62d7ff)), side: paint.black() }, { glow: hex(0x62d7ff) })],
};

// ───────────────────────── Atlas ─────────────────────────

/** Tamanho em pixels de cada face de uma peça. */
function faceSizes(part) {
  const [w, h, d] = part.size;
  if (part.shape === 'cyl') return { top: [px(w), px(d)], side: [px(Math.PI * w), px(h)] };
  return { top: [px(w), px(d)], front: [px(w), px(h)], side: [px(d), px(h)] };
}

export function build(outDir, save) {
  const index = {};
  for (const [name, parts] of Object.entries(RECIPES)) {
    const r = rng(name);
    const faces = [];
    parts.forEach((part, i) => {
      for (const [face, [fw, fh]] of Object.entries(faceSizes(part))) {
        const painter = part.tex[face] || part.tex.side;
        faces.push({ part: i, face, pixels: painter(Math.min(fw, 512), Math.min(fh, 512), r) });
      }
    });
    // Empacota em prateleiras (largura máxima 512).
    let x = 0, y = 0, shelf = 0, width = 0;
    for (const f of faces) {
      if (x + f.pixels.width > 512) { x = 0; y += shelf; shelf = 0; }
      f.rect = [x, y, f.pixels.width, f.pixels.height];
      x += f.pixels.width;
      shelf = Math.max(shelf, f.pixels.height);
      width = Math.max(width, x);
    }
    const atlas = new Pixels(width, y + shelf);
    for (const f of faces) atlas.blit(f.pixels, f.rect[0], f.rect[1]);
    save(`prop_${name}`, atlas);
    index[name] = {
      atlas: [atlas.width, atlas.height],
      parts: parts.map((part, i) => ({
        shape: part.shape, size: part.size, at: part.at, rot: part.rot || [0, 0, 0], name: part.name || '',
        tint: !!part.tint, glow: part.glow ? part.glow.map((v) => +(v / 255).toFixed(3)) : null,
        faces: Object.fromEntries(faces.filter((f) => f.part === i).map((f) => [f.face, f.rect])),
      })),
    };
  }
  writeFileSync(`${outDir}/props.json`, JSON.stringify(index) + '\n');
  console.log(`  objetos: ${Object.keys(index).length}`);
}
