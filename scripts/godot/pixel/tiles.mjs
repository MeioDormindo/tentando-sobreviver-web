// Superfícies do cenário em pixel art: pisos (repetem sem costura) e paredes (lateral 2 m ×
// 3 m e topo), a 48 px/m. Paleta escura e dessaturada, com sujeira, rachaduras e desgaste.
import { PPM, rng, base, stain, crack, rect, hline, vline, bevel, mix, scale, hex, dither, noise2 } from './paint.mjs';

const GRIME = hex(0x1a1714);
const CRACK = hex(0x14120f);

function tiles(px, r, size, grout, jitter = 0.06) {
  for (let ty = 0; ty < px.height; ty += size) {
    for (let tx = 0; tx < px.width; tx += size) {
      const k = 1 + (r() - 0.5) * 2 * jitter;
      for (let y = ty; y < ty + size; y++) for (let x = tx; x < tx + size; x++) px.set(x, y, scale(px.rgb(x, y), k));
      bevel(px, tx + 1, ty + 1, size - 1, size - 1, scale(px.rgb(tx + 2, ty + 2), 1.1), scale(px.rgb(tx + 2, ty + 2), 0.85));
      hline(px, ty, grout, tx, tx + size - 1);
      vline(px, tx, grout, ty, ty + size - 1);
    }
  }
}

function grime(px, r, count, strength = 0.35, max = 10) {
  for (let i = 0; i < count; i++) stain(px, r, r() * px.width, r() * px.height, 3 + r() * max, GRIME, strength);
}

function cracks(px, r, count, length = 20) {
  for (let i = 0; i < count; i++) crack(px, r, r() * px.width, r() * px.height, length * (0.5 + r()), CRACK);
}

/** Pisos: nome → Pixels (2 m × 2 m = 96 × 96, salvo onde o desenho pede mais). */
/** Pisos: nome → Pixels, 4 m × 4 m (192 × 192), repetindo sem costura. */
export function floors() {
  const out = {};
  // 4 m × 4 m (192 px): a repetição some numa tela de 20 m.
  const S = 4 * PPM;
  let r;

  r = rng('terminal');
  out.floor_terminal = base(S, S, hex(0x5b574f), r, { amount: 0.1 });
  tiles(out.floor_terminal, r, PPM, hex(0x2e2b27), 0.08);
  grime(out.floor_terminal, r, 9);
  cracks(out.floor_terminal, r, 2);

  r = rng('concrete');
  out.floor_concrete = base(S, S, hex(0x4e4f4c), r, { amount: 0.14, cells: 6 });
  hline(out.floor_concrete, 0, hex(0x2c2d2b));
  vline(out.floor_concrete, 0, hex(0x2c2d2b));
  grime(out.floor_concrete, r, 12, 0.4, 14);
  cracks(out.floor_concrete, r, 2, 26);

  r = rng('metal');
  out.floor_metal = base(S, S, hex(0x4a4f55), r, { amount: 0.08 });
  for (let y = 4; y < S; y += 8) for (let x = (y / 8) % 2 ? 0 : 4; x < S; x += 8) {
    out.floor_metal.set(x, y, hex(0x6c737b)); out.floor_metal.set(x + 1, y + 1, hex(0x6c737b)); out.floor_metal.set(x + 2, y + 1, hex(0x2a2e33));
  }
  hline(out.floor_metal, 0, hex(0x2a2d31)); vline(out.floor_metal, 0, hex(0x2a2d31));
  for (let i = 0; i < 12; i++) stain(out.floor_metal, r, r() * S, r() * S, 4 + r() * 8, hex(0x6a3a1e), 0.35);  // ferrugem

  r = rng('tracks');
  const tracks = base(S, S, hex(0x3d3a36), r, { amount: 0.25, cells: 24, steps: 3 });
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (r() < 0.12) tracks.set(x, y, scale(tracks.rgb(x, y), r() < 0.5 ? 0.7 : 1.3));
  for (let x = 6; x < S; x += 29) rect(tracks, x, 0, 12, S, hex(0x4a3524));  // dormentes
  for (const y of [22, 70, 118, 166]) { rect(tracks, 0, y, S, 4, hex(0x5a5e63)); hline(tracks, y, hex(0x9aa0a6)); hline(tracks, y + 3, hex(0x25272a)); }
  out.floor_tracks = tracks;

  r = rng('tunnel');
  out.floor_tunnel = base(S, S, hex(0x33342f), r, { amount: 0.16, cells: 5 });
  grime(out.floor_tunnel, r, 12, 0.45, 14);
  for (let i = 0; i < 8; i++) {  // poças com reflexo
    const cx = r() * S, cy = r() * S, rad = 6 + r() * 8;
    stain(out.floor_tunnel, r, cx, cy, rad, hex(0x1e2a33), 0.7);
    for (let j = 0; j < 4; j++) out.floor_tunnel.set(((Math.round(cx + (r() - 0.5) * rad) % S) + S) % S, ((Math.round(cy + (r() - 0.5) * rad) % S) + S) % S, hex(0x5d7486));
  }

  r = rng('wagon');
  out.floor_wagon = base(S, S, hex(0x3b3d3a), r, { amount: 0.08 });
  for (let x = 0; x < S; x += 6) vline(out.floor_wagon, x, hex(0x2a2c2a));
  grime(out.floor_wagon, r, 6);

  r = rng('hospital');
  out.floor_hospital = base(S, S, hex(0x9aa7a0), r, { amount: 0.06 });
  tiles(out.floor_hospital, r, PPM / 4, hex(0x6d7872), 0.04);
  grime(out.floor_hospital, r, 8, 0.3);
  for (let i = 0; i < 5; i++) stain(out.floor_hospital, r, r() * S, r() * S, 4 + r() * 6, hex(0x5a1a14), 0.45);  // sangue seco

  r = rng('linoleum');
  out.floor_linoleum = base(S, S, hex(0x6f8581), r, { amount: 0.07 });
  for (let i = 0; i < 1500; i++) out.floor_linoleum.set(r.int(0, S - 1), r.int(0, S - 1), r() < 0.5 ? hex(0x8fa39f) : hex(0x55665f));
  hline(out.floor_linoleum, 0, hex(0x4c5a57));
  grime(out.floor_linoleum, r, 8, 0.3);

  r = rng('morgue');
  out.floor_morgue = base(S, S, hex(0x5d6a70), r, { amount: 0.06 });
  tiles(out.floor_morgue, r, PPM / 2, hex(0x3a4347), 0.05);
  rect(out.floor_morgue, 90, 90, 12, 12, hex(0x2a3033));  // ralo
  for (let i = 92; i < 102; i += 3) hline(out.floor_morgue, i, hex(0x14181a), 91, 100);
  grime(out.floor_morgue, r, 6, 0.3);
  return out;
}

/** Paredes: lateral (2 m × 3 m = 96 × 144, de cima para baixo) e topo (96 × 96), por estilo. */
export function walls() {
  const out = {};
  const W = 2 * PPM, H = 3 * PPM;
  let r;

  // Terminal: azulejo creme em cima, faixa bordô, lambri escuro embaixo, rodapé.
  r = rng('wall_terminal');
  const t = base(W, H, hex(0x8a8170), r, { amount: 0.06 });
  tiles(t, r, 12, hex(0x5e574c), 0.05);
  rect(t, 0, 84, W, 8, hex(0x5c2a26)); hline(t, 84, hex(0x7d3b34)); hline(t, 91, hex(0x3a1a18));
  const lower = base(W, H - 92, hex(0x3f3d38), r, { amount: 0.08 });
  for (let y = 0; y < lower.height; y++) for (let x = 0; x < W; x++) t.set(x, 92 + y, lower.rgb(x, y));
  for (let x = 0; x < W; x += 24) vline(t, x, hex(0x2b2a26), 92, H - 1);
  rect(t, 0, H - 8, W, 8, hex(0x24221f)); hline(t, H - 8, hex(0x4a4640));
  for (let i = 0; i < 4; i++) stain(t, r, r() * W, 60 + r() * 80, 6 + r() * 10, GRIME, 0.4);
  cracks(t, r, 2, 18);
  out.wall_terminal = t;

  // Hospital: verde-claro, faixa de proteção branca, verde escuro embaixo.
  r = rng('wall_hospital');
  const h = base(W, H, hex(0x8fa597), r, { amount: 0.05 });
  rect(h, 0, 90, W, 10, hex(0xcfd3cc)); hline(h, 90, hex(0xeef0ea)); hline(h, 99, hex(0x8a8f88));
  const hl = base(W, H - 100, hex(0x56695d), r, { amount: 0.06 });
  for (let y = 0; y < hl.height; y++) for (let x = 0; x < W; x++) h.set(x, 100 + y, hl.rgb(x, y));
  rect(h, 0, H - 6, W, 6, hex(0x2c332e));
  for (let i = 0; i < 3; i++) stain(h, r, r() * W, 70 + r() * 70, 6 + r() * 8, GRIME, 0.35);
  stain(h, r, r() * W, 40 + r() * 60, 5, hex(0x5a1a14), 0.5);  // respingo
  cracks(h, r, 2, 14);
  out.wall_hospital = h;

  // Concreto industrial (túneis, manutenção): blocos, escorridos de umidade.
  r = rng('wall_concrete');
  const c = base(W, H, hex(0x55554f), r, { amount: 0.1, cells: 6 });
  for (let y = 0; y < H; y += 24) hline(c, y, hex(0x3a3a36));
  for (let y = 0; y < H; y += 24) for (let x = (y / 24) % 2 ? 24 : 0; x < W; x += 48) vline(c, x, hex(0x3a3a36), y, y + 23);
  for (let i = 0; i < 5; i++) {
    const x = r.int(0, W - 1), y0 = r.int(0, 40), len = r.int(30, 100);
    for (let y = y0; y < Math.min(H, y0 + len); y++) if (dither(x, y, 1 - (y - y0) / len)) c.set(x, y, scale(c.rgb(x, y), 0.7));
  }
  grime(c, r, 4, 0.4, 12);
  out.wall_concrete = c;

  // Topo das paredes (visto de cima): concreto escuro com borda clara.
  r = rng('wall_cap');
  const cap = base(W, W, hex(0x2c2b29), r, { amount: 0.12 });
  bevel(cap, 0, 0, W, W, hex(0x45433f), hex(0x1c1b19));
  out.wall_cap = cap;

  // Porta comprável: portão de aço de enrolar (ripas), moldura, placa de proibido e faixa
  // zebrada no pé; em cima, zebrado amarelo e preto (lê como passagem fechada vista do alto).
  r = rng('door_shutter');
  const d = base(W, H, hex(0x6a7074), r, { amount: 0.06 });
  for (let y = 10; y < H - 12; y += 6) { hline(d, y, hex(0x3e4346)); hline(d, y + 1, hex(0x8d9498)); }
  rect(d, 0, 0, W, 10, hex(0x2c2f31)); hline(d, 9, hex(0x1a1c1d));  // caixa do rolo
  rect(d, 0, 0, 4, H, hex(0x3a3d40)); rect(d, W - 4, 0, 4, H, hex(0x3a3d40));  // trilhos
  for (let y = H - 12; y < H; y++) for (let x = 4; x < W - 4; x++) d.set(x, y, ((x + y) >> 2) % 2 ? hex(0xd2a32a) : hex(0x1d1d1d));
  const cx = W / 2, cy = 56;  // placa redonda vermelha com faixa branca
  for (let y = cy - 14; y <= cy + 14; y++) for (let x = cx - 14; x <= cx + 14; x++) {
    const k = Math.hypot(x - cx, y - cy);
    if (k <= 14) d.set(x, y, k > 12 ? hex(0x6a1410) : hex(0xc4281f));
  }
  rect(d, cx - 9, cy - 2, 18, 5, hex(0xf2eee6));
  rect(d, cx - 16, cy + 22, 32, 10, hex(0x1d1e20)); for (let x = cx - 13; x < cx + 13; x += 4) rect(d, x, cy + 25, 2, 4, hex(0xd2a32a));  // plaqueta
  for (let i = 0; i < 4; i++) stain(d, r, r() * W, 20 + r() * 100, 4 + r() * 8, hex(0x6a3a1e), 0.45);  // ferrugem
  cracks(d, r, 1, 10);
  out.door_shutter = d;
  const dc = new (d.constructor)(W, W);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) dc.set(x, y, ((x + y) >> 3) % 2 ? hex(0xd2a32a) : hex(0x1d1d1d));
  bevel(dc, 0, 0, W, W, hex(0x45433f), hex(0x1c1b19));
  out.door_cap = dc;

  // Trem (parado na plataforma e o que passa no evento): lateral de 2 m com janela, faixa
  // laranja e a saia escura; o teto com as grades do ar-condicionado.
  r = rng('train_side');
  const TH = Math.round(2.6 * PPM);
  const ts = base(W, TH, hex(0x5a6a74), r, { amount: 0.05 });
  rect(ts, 0, 0, W, 10, hex(0x3e4a52)); hline(ts, 9, hex(0x2a3238));  // beirada do teto
  rect(ts, 8, 22, W - 16, 34, hex(0x1b2226)); bevel(ts, 8, 22, W - 16, 34, hex(0x101416), hex(0x7a8a94));  // janela
  for (let i = 0; i < 6; i++) { const x = 12 + i * 12; for (let k = 0; k < 8; k++) ts.set(x + k, 26 + k, hex(0x3a4a54)); }  // reflexo
  rect(ts, 0, 64, W, 8, hex(0xd2782a)); hline(ts, 64, hex(0xf0a050)); hline(ts, 71, hex(0x8a4a1a));  // faixa
  rect(ts, 0, TH - 18, W, 18, hex(0x2a2e31)); for (let x = 0; x < W; x += 8) vline(ts, x, hex(0x1c1f21), TH - 18, TH - 1);
  vline(ts, 0, hex(0x2c3438)); vline(ts, W - 1, hex(0x7a8a94));  // emenda dos painéis
  for (let i = 0; i < 3; i++) stain(ts, r, r() * W, 80 + r() * 20, 4 + r() * 6, GRIME, 0.35);
  out.train_side = ts;
  r = rng('train_roof');
  const tr = base(W, W, hex(0x4a565e), r, { amount: 0.06 });
  rect(tr, 20, 24, 56, 48, hex(0x3a4248)); bevel(tr, 20, 24, 56, 48, hex(0x6a7880), hex(0x22282c));
  for (let y = 30; y < 68; y += 4) hline(tr, y, hex(0x1e2326), 26, 70);  // grade do ar
  for (let x = 0; x < W; x += 16) vline(tr, x, hex(0x3c464c));
  out.train_roof = tr;
  return out;
}
