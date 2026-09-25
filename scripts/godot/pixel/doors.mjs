// Portas compráveis em pixel art, uma por ambiente que a porta abre (door.gd, STYLE_BY_AREA):
// uma porta só do tamanho do vão (door_<estilo>_3m / _4m, 3 m de altura; nada de portões
// repetidos lado a lado) e o topo visto de cima, listrado nas cores do estilo (lê como passagem
// fechada). 48 px/m, como as paredes.
import { rng, base, stain, crack, rect, hline, vline, bevel, mix, scale, hex } from './paint.mjs';

const Y = hex(0xd2a32a), K = hex(0x1d1d1d);

function disc(px, cx, cy, radius, color, inner = 0) {
  for (let y = Math.floor(cy - radius); y <= cy + radius; y++) for (let x = Math.floor(cx - radius); x <= cx + radius; x++) {
    const k = Math.hypot(x - cx, y - cy);
    if (k <= radius && k >= inner && x >= 0 && y >= 0 && x < px.width && y < px.height) px.set(x, y, color);
  }
}

function zebra(px, x0, y0, w, h, a, b, band = 4) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) px.set(x, y, Math.floor((x + y) / band) % 2 ? a : b);
}

function cracks(px, r, count, length) {
  for (let i = 0; i < count; i++) crack(px, r, r() * px.width, r() * px.height, length * (0.5 + r()), hex(0x14120f));
}

/** Batente: marco escuro nas laterais e em cima (encaixa na parede ao lado). */
function jamb(px, color, top = 6) {
  rect(px, 0, 0, 4, px.height, color); rect(px, px.width - 4, 0, 4, px.height, color);
  if (top > 0) { rect(px, 0, 0, px.width, top, color); hline(px, top, scale(color, 0.6), 4, px.width - 5); }
  vline(px, 4, scale(color, 0.6), top); vline(px, px.width - 5, scale(color, 0.6), top);
}

/** Folha de porta com bisel. */
function leaf(px, x, y, w, h, color) {
  rect(px, x, y, w, h, color);
  bevel(px, x, y, w, h, scale(color, 1.25), scale(color, 0.62));
}

/** Topo visto de cima: listras diagonais nas duas cores do estilo. */
function cap(W, a, b) {
  const c = base(W, W, a, rng('cap'), { amount: 0.04 });
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (((x + y) >> 3) % 2) c.set(x, y, b);
  bevel(c, 0, 0, W, W, hex(0x45433f), hex(0x1c1b19));
  return c;
}

/** Porta dupla de vaivém (hospital): folhas, visores, barra de empurrar e chapa de chute. */
function swing(name, W, H, color, kick, extra) {
  const r = rng(name);
  const px = base(W, H, color, r, { amount: 0.04 });
  jamb(px, hex(0x4d5a57));
  leaf(px, 5, 7, W / 2 - 5, H - 7, color); leaf(px, W / 2, 7, W / 2 - 5, H - 7, color);
  const glass = hex(0x2c4a58);
  const ww = Math.round(W / 2 - 34);
  for (const x0 of [17, W / 2 + 12]) {
    rect(px, x0, 22, ww, 34, hex(0x2f3a3c)); bevel(px, x0, 22, ww, 34, hex(0x1b2224), hex(0xb9c4c0));
    rect(px, x0 + 2, 24, ww - 4, 30, glass); for (let k = 0; k < 10; k++) px.set(x0 + 4 + k, 26 + k, scale(glass, 1.6));
    rect(px, x0 - 4, 78, ww + 8, 4, hex(0xb7bcbe)); hline(px, 81, hex(0x5f6466), x0 - 4, x0 + ww + 3);
  }
  rect(px, 6, H - 18, W - 12, 18, kick); for (let x = 10; x < W - 10; x += 8) px.set(x, H - 10, scale(kick, 0.7));
  if (extra) extra(px, r);
  return px;
}

/** Larguras de vão das portas dos mapas (m). */
export const DOOR_WIDTHS = [3, 4];

export function doors(PPM, H) {
  const out = {};
  for (const m of DOOR_WIDTHS) {
    const faces = doorFaces(m * PPM, H);
    for (const [name, px] of Object.entries(faces)) out[name.endsWith('_cap') ? name : `${name}_${m}m`] = px;
  }
  return out;
}

function doorFaces(W, H) {
  const out = {};
  let r, cx, cy;

  // Bilheteria e lojas: portão de aço de enrolar (ripas), placa de proibido e zebrado no pé.
  r = rng('door_shutter');
  const d = base(W, H, hex(0x6a7074), r, { amount: 0.06 });
  for (let y = 10; y < H - 12; y += 6) { hline(d, y, hex(0x3e4346)); hline(d, y + 1, hex(0x8d9498)); }
  rect(d, 0, 0, W, 10, hex(0x2c2f31)); hline(d, 9, hex(0x1a1c1d));  // caixa do rolo
  rect(d, 0, 0, 4, H, hex(0x3a3d40)); rect(d, W - 4, 0, 4, H, hex(0x3a3d40));  // trilhos
  zebra(d, 4, H - 12, W - 8, 12, Y, K);
  cx = W / 2; cy = 56;
  disc(d, cx, cy, 14, hex(0x6a1410)); disc(d, cx, cy, 12, hex(0xc4281f));
  rect(d, cx - 9, cy - 2, 18, 5, hex(0xf2eee6));
  rect(d, cx - 16, cy + 22, 32, 10, hex(0x1d1e20)); for (let x = cx - 13; x < cx + 13; x += 4) rect(d, x, cy + 25, 2, 4, Y);
  for (let i = 0; i < 4; i++) stain(d, r, r() * W, 20 + r() * 100, 4 + r() * 8, hex(0x6a3a1e), 0.45);  // ferrugem
  cracks(d, r, 1, 10);
  out.door_shutter = d;
  out.door_cap = cap(W, Y, K);

  // Plataforma: grade de embarque (barras) com o painel azul de EMBARQUE e a seta.
  r = rng('door_boarding');
  const bo = base(W, H, hex(0x16181b), r, { amount: 0.1 });
  for (let x = 6; x < W - 4; x += 7) { vline(bo, x, hex(0x8b9298), 22); vline(bo, x + 1, hex(0x4b5156), 22); }
  for (const y of [48, 96, H - 16]) { rect(bo, 0, y, W, 4, hex(0x6d747a)); hline(bo, y, hex(0x9aa1a7)); hline(bo, y + 3, hex(0x33383c)); }
  rect(bo, 0, 0, W, 22, hex(0x1e3a66)); bevel(bo, 0, 0, W, 22, hex(0x3e6aa8), hex(0x0f1d33));
  for (let x = 12; x < W - 32; x += 6) rect(bo, x, 8, 4, 6, hex(0xe8e4d6));  // letreiro
  for (let i = 0; i < 4; i++) vline(bo, W - 22 + i, Y, 7 + i, 14 - i);  // seta
  rect(bo, W - 28, 10, 6, 2, Y);
  jamb(bo, hex(0x2c3034), 0);
  for (let i = 0; i < 3; i++) stain(bo, r, r() * W, 40 + r() * 90, 3 + r() * 6, hex(0x6a3a1e), 0.4);
  out.door_boarding = bo;
  out.door_boarding_cap = cap(W, hex(0x1e3a66), hex(0x8b9298));

  // Área técnica: porta de serviço de aço, placa de perigo, faixa zebrada e maçaneta.
  r = rng('door_service');
  const sv = base(W, H, hex(0x2a2d30), r, { amount: 0.05 });
  jamb(sv, hex(0x2a2d30));
  leaf(sv, 8, 10, W - 16, H - 10, hex(0x5a6166));
  for (let y = 30; y < H - 20; y += 22) hline(sv, y, hex(0x464c50), 12, W - 13);
  zebra(sv, 9, 82, W - 18, 10, Y, K);
  for (let y = 0; y < 22; y++) for (let x = -y; x <= y; x++) sv.set(W / 2 + Math.round(x * 0.9), 36 + y, y > 19 || Math.abs(x) > y - 3 ? K : Y);
  rect(sv, W / 2 - 1, 44, 3, 8, K); rect(sv, W / 2 - 1, 54, 3, 2, K);  // "!"
  vline(sv, W / 2, hex(0x383d41), 10); vline(sv, W / 2 + 1, hex(0x7a8287), 10);  // duas folhas
  rect(sv, W / 2 - 12, 100, 8, 3, hex(0xb9bfc3)); rect(sv, W / 2 + 4, 100, 8, 3, hex(0xb9bfc3));
  for (let i = 0; i < 3; i++) stain(sv, r, r() * W, 60 + r() * 80, 4 + r() * 7, hex(0x6a3a1e), 0.35);
  cracks(sv, r, 1, 12);
  out.door_service = sv;
  out.door_service_cap = cap(W, Y, K);

  // Túneis e manutenção: comporta blindada redonda com rebites, volante e ferrugem.
  r = rng('door_blast');
  const bl = base(W, H, hex(0x3a3a36), r, { amount: 0.14, cells: 6 });
  cx = W / 2; cy = 72;
  const R = Math.min(W * 0.4, 62), wheel = Math.round(R * 0.36);
  disc(bl, cx, cy, R + 3, hex(0x22221f)); disc(bl, cx, cy, R, hex(0x6b6456)); disc(bl, cx, cy, R - 7, hex(0x575246));
  disc(bl, cx, cy, R, hex(0x877e6b), R - 1);
  for (let a = 0; a < 20; a++) { const t = a / 20 * Math.PI * 2; disc(bl, cx + Math.cos(t) * (R - 3.5), cy + Math.sin(t) * (R - 3.5), 1.5, hex(0xa39a84)); }
  disc(bl, cx, cy, wheel, hex(0x2a2824), wheel - 3); disc(bl, cx, cy, 3, hex(0x2a2824));
  for (let a = 0; a < 4; a++) { const t = a / 4 * Math.PI * 2 + 0.4; for (let k = 3; k < wheel; k++) disc(bl, cx + Math.cos(t) * k, cy + Math.sin(t) * k, 1, hex(0x2a2824)); }
  rect(bl, 8, cy - 6, 10, 12, hex(0x4a463d)); rect(bl, W - 18, cy - 6, 10, 12, hex(0x4a463d));  // dobradiça e trinco
  zebra(bl, 0, H - 10, W, 10, Y, K);
  for (let i = 0; i < 8; i++) stain(bl, r, r() * W, r() * H, 4 + r() * 9, hex(0x6a3a1e), 0.5);
  cracks(bl, r, 2, 14);
  out.door_blast = bl;
  out.door_blast_cap = cap(W, hex(0x6a3a1e), K);

  // Recepção, UTI, cirurgia, enfermaria: porta dupla verde-clara com a cruz e marcas de sangue.
  out.door_ward = swing('door_ward', W, H, hex(0x7fa596), hex(0x8e9496), (px, rr) => {
    for (let i = 0; i < 4; i++) stain(px, rr, 20 + rr() * 56, 60 + rr() * 50, 3 + rr() * 5, hex(0x5a1a14), 0.55);
    disc(px, W / 2, 13, 5, hex(0xe8e4d6)); rect(px, W / 2 - 1, 9, 3, 9, hex(0xc4281f)); rect(px, W / 2 - 4, 12, 9, 3, hex(0xc4281f));
  });
  out.door_ward_cap = cap(W, hex(0x7fa596), hex(0xe8e4d6));

  // Pediatria: porta amarela com arco-íris, bolinhas coloridas e estrela.
  out.door_pediatric = swing('door_pediatric', W, H, hex(0xd6b95a), hex(0x4b77a8), (px, rr) => {
    const colors = [hex(0xc4281f), hex(0x3b7ac2), hex(0x4f9a45), hex(0xe07a2a), hex(0x8a4fb0)];
    colors.forEach((c, i) => hline(px, 58 + i, c, 8, W - 9));
    for (let i = 0; i < 10; i++) disc(px, 12 + rr() * (W - 24), 88 + rr() * 30, 2 + rr() * 3, colors[i % colors.length]);
    for (let k = -5; k <= 5; k++) { px.set(W / 2 + k, 13, Y); px.set(W / 2, 13 + k, Y); px.set(W / 2 + Math.trunc(k * 0.7), 13 + Math.trunc(k * 0.7), Y); px.set(W / 2 - Math.trunc(k * 0.7), 13 + Math.trunc(k * 0.7), Y); }
    stain(px, rr, 30 + rr() * 30, 100, 5, hex(0x5a1a14), 0.5);
  });
  out.door_pediatric_cap = cap(W, hex(0xd6b95a), hex(0x3b7ac2));

  // Refeitório: porta vaivém de inox escovado com visores redondos.
  r = rng('door_kitchen');
  const kt = base(W, H, hex(0x9ea4a7), r, { amount: 0.05 });
  jamb(kt, hex(0x4a4f52));
  leaf(kt, 5, 7, W / 2 - 5, H - 7, hex(0x9ea4a7)); leaf(kt, W / 2, 7, W / 2 - 5, H - 7, hex(0x9ea4a7));
  for (let y = 10; y < H - 4; y += 3) for (let x = 6; x < W - 6; x++) if (r() < 0.12) kt.set(x, y, hex(0xaab0b3));
  for (const x0 of [W / 4 + 2, W * 3 / 4 - 2]) { disc(kt, x0, 36, 12, hex(0x5d6366)); disc(kt, x0, 36, 10, hex(0x243a40)); for (let k = 0; k < 6; k++) kt.set(x0 - 5 + k, 31 + k, hex(0x4f7680)); }
  rect(kt, 6, H - 22, W - 12, 22, hex(0x6c7275));
  for (let i = 0; i < 4; i++) stain(kt, r, r() * W, 60 + r() * 70, 3 + r() * 6, hex(0x5c4a2a), 0.4);
  out.door_kitchen = kt;
  out.door_kitchen_cap = cap(W, hex(0x9ea4a7), hex(0x4a4f52));

  // Radiologia: porta de chumbo com o trifólio de radiação e a luz vermelha "em uso".
  r = rng('door_radiation');
  const ra = base(W, H, hex(0x3c3a36), r, { amount: 0.05 });
  jamb(ra, hex(0x262522), 14);
  leaf(ra, 6, 15, W / 2 - 6, H - 15, hex(0x5b5852)); leaf(ra, W / 2, 15, W / 2 - 6, H - 15, hex(0x5b5852));
  rect(ra, W / 2 - 10, 3, 20, 8, hex(0x4a0d0a)); rect(ra, W / 2 - 8, 4, 16, 6, hex(0xe0301f)); hline(ra, 5, hex(0xff8a70), W / 2 - 6, W / 2 + 5);
  cx = W / 2; cy = 58;
  disc(ra, cx, cy, 20, K); disc(ra, cx, cy, 18, Y);
  for (let y = cy - 16; y <= cy + 16; y++) for (let x = cx - 16; x <= cx + 16; x++) {
    const k = Math.hypot(x - cx, y - cy), t = (Math.atan2(y - cy, x - cx) * 180 / Math.PI + 450) % 120;
    if (k < 3.5 || (k > 5.5 && k < 16 && t < 60)) ra.set(x, y, K);
  }
  rect(ra, W / 2 - 12, 96, 8, 3, hex(0xb9bfc3)); rect(ra, W / 2 + 4, 96, 8, 3, hex(0xb9bfc3));
  zebra(ra, 7, H - 10, W - 14, 10, Y, K);
  for (let i = 0; i < 3; i++) stain(ra, r, r() * W, 80 + r() * 50, 3 + r() * 6, hex(0x1a1714), 0.4);
  out.door_radiation = ra;
  out.door_radiation_cap = cap(W, Y, hex(0x3c3a36));

  // Farmácia: grade pantográfica (losangos) sobre a loja escura e a cruz verde acesa em cima.
  r = rng('door_pharmacy');
  const ph = base(W, H, hex(0x1b211f), r, { amount: 0.1 });
  for (let y = 22; y < H - 6; y++) for (let x = 4; x < W - 4; x++) if ((x + y) % 12 === 0 || (x - y + 480) % 12 === 0) ph.set(x, y, hex(0x8a9094));
  for (let x = 4; x < W - 4; x += 12) vline(ph, x, hex(0x5d6367), 22);
  rect(ph, 0, 0, W, 22, hex(0x28302d)); bevel(ph, 0, 0, W, 22, hex(0x3f4a46), hex(0x141816));
  rect(ph, W / 2 - 3, 3, 7, 17, hex(0x3fc46a)); rect(ph, W / 2 - 9, 8, 19, 7, hex(0x3fc46a)); hline(ph, 11, hex(0xa6f0bd), W / 2 - 8, W / 2 + 9);
  rect(ph, 0, H - 6, W, 6, hex(0x4a5054));
  jamb(ph, hex(0x2c3034), 0);
  for (let i = 0; i < 3; i++) stain(ph, r, r() * W, 40 + r() * 90, 3 + r() * 6, hex(0x6a3a1e), 0.35);
  out.door_pharmacy = ph;
  out.door_pharmacy_cap = cap(W, hex(0x3fc46a), hex(0x1b211f));

  // Necrotério: câmara fria branca e isolada, trava de alavanca, termômetro e geada nas bordas.
  r = rng('door_cold');
  const co = base(W, H, hex(0xb9c0c2), r, { amount: 0.04 });
  jamb(co, hex(0x5d6569), 8);
  leaf(co, 8, 12, W - 16, H - 14, hex(0xc3cacc));
  bevel(co, 12, 16, W - 24, H - 22, hex(0x8f989b), hex(0xe1e6e7));
  rect(co, W - 28, 60, 18, 8, hex(0x6c7477)); rect(co, W - 30, 62, 22, 4, hex(0x9aa3a6)); rect(co, W - 14, 52, 5, 24, hex(0x4a5256));  // alavanca
  for (const y of [24, H - 26]) rect(co, 9, y, 7, 14, hex(0x7c8487));  // dobradiças
  rect(co, W / 2 - 12, 26, 24, 8, hex(0x2c4a58)); for (let x = W / 2 - 10; x < W / 2 + 10; x += 3) rect(co, x, 28, 2, 4, hex(0x8fd0e8));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const edge = Math.min(x, W - 1 - x, y, H - 1 - y);
    if (edge < 9 && r() < (9 - edge) / 30) co.set(x, y, mix(co.rgb(x, y), hex(0xeaf6fb), 0.5));
  }
  for (let i = 0; i < 3; i++) stain(co, r, 20 + r() * 56, 90 + r() * 40, 3 + r() * 5, hex(0x5a1a14), 0.4);
  out.door_cold = co;
  out.door_cold_cap = cap(W, hex(0xb9c0c2), hex(0x8fd0e8));

  // Laboratório: porta selada verde-oliva, risco biológico, luz vermelha e zebrado.
  r = rng('door_biohazard');
  const bh = base(W, H, hex(0x2f3528), r, { amount: 0.06 });
  jamb(bh, hex(0x1d2119), 14);
  leaf(bh, 6, 15, W - 12, H - 15, hex(0x4d5a3c));
  vline(bh, W / 2, hex(0x262c1f), 15); vline(bh, W / 2 + 1, hex(0x6a7a52), 15);
  rect(bh, W / 2 - 10, 3, 20, 8, hex(0x4a0d0a)); rect(bh, W / 2 - 8, 4, 16, 6, hex(0xe0301f));
  cx = W / 2; cy = 58;
  const O = hex(0xe07a2a);
  disc(bh, cx, cy, 21, K);
  for (let a = 0; a < 3; a++) { const t = a / 3 * Math.PI * 2 - Math.PI / 2; disc(bh, cx + Math.cos(t) * 8, cy + Math.sin(t) * 8, 11, O, 6); }
  disc(bh, cx, cy, 8, O, 5.5); disc(bh, cx, cy, 2.5, O);
  zebra(bh, 7, H - 12, W - 14, 12, Y, K);
  zebra(bh, 7, 88, W - 14, 4, Y, K, 3);
  for (let i = 0; i < 4; i++) stain(bh, r, r() * W, 70 + r() * 60, 3 + r() * 6, hex(0x6fa03a), 0.35);  // respingo verde
  out.door_biohazard = bh;
  out.door_biohazard_cap = cap(W, O, K);

  return out;
}
