// Cenário do Templo dos Mortos (Mapa 3) em pixel art, 48 px/m: pisos de 4 m × 4 m que repetem
// sem costura (mosaico, pedra, mármore, catacumba, grama, rocha vulcânica), a lava e a parede
// de blocos de pedra. Paleta: pedra cinza e bege, verde escuro, azul noite, laranja das tochas.
import { rng, base, stain, crack, rect, hline, vline, bevel, mix, scale, hex, dither } from './paint.mjs';

const GRIME = hex(0x1a1714);
const wrap = (v, n) => ((v % n) + n) % n;

function grime(px, r, count, strength = 0.35, max = 10) {
  for (let i = 0; i < count; i++) stain(px, r, r() * px.width, r() * px.height, 3 + r() * max, GRIME, strength);
}

function cracks(px, r, count, length = 20) {
  for (let i = 0; i < count; i++) crack(px, r, r() * px.width, r() * px.height, length * (0.5 + r()), hex(0x14120f));
}

/** Lajes irregulares: fileiras de altura fixa, juntas verticais deslocadas (repete sem costura). */
function slabs(px, r, rowH, minW, maxW, grout, jitter = 0.08) {
  for (let y0 = 0; y0 < px.height; y0 += rowH) {
    let x = r.int(0, maxW);
    const start = x;
    while (x < start + px.width) {
      const w = r.int(minW, maxW);
      const k = 1 + (r() - 0.5) * 2 * jitter;
      for (let y = y0; y < y0 + rowH; y++) for (let i = x; i < x + w; i++) {
        const xx = wrap(i, px.width);
        px.set(xx, y, scale(px.rgb(xx, y), k));
      }
      for (let y = y0; y < y0 + rowH; y++) px.set(wrap(x, px.width), y, grout);
      for (let y = y0 + 1; y < y0 + rowH; y++) px.set(wrap(x + 1, px.width), y, scale(px.rgb(wrap(x + 1, px.width), y), 1.12));
      x += w;
    }
    hline(px, y0, grout);
    hline(px, y0 + 1, scale(px.rgb(0, y0 + 2), 1.1));
  }
}

export function templeFloors(S) {
  const out = {};
  let r;

  // Mosaico grego: pastilhas bege com a faixa de "chave grega" em volta de cada painel de 2 m.
  // O painel é uma unidade decorativa de tamanho real fixo (2 m) — ao contrário da sujeira, ela
  // deve repetir com essa frequência mesmo num piso maior, senão vira um único painel gigante.
  r = rng('mosaic');
  const mo = base(S, S, hex(0x9a8a6a), r, { amount: 0.08 });
  for (let y = 0; y < S; y += 4) for (let x = 0; x < S; x += 4) {
    const k = 1 + (r() - 0.5) * 0.18;
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) mo.set(x + i, y + j, (i === 3 || j === 3) ? hex(0x6a5c44) : scale(mo.rgb(x + i, y + j), k));
  }
  const P = 96;  // 2 m, sempre — não escala com S.
  for (let oy = 0; oy < S; oy += P) for (let ox = 0; ox < S; ox += P) {
    for (let t = 0; t < P; t += 12) {
      // Meandro (chave grega) em terracota, no contorno do painel.
      for (const [x0, y0, horiz] of [[ox + t, oy + 4, true], [ox + t, oy + P - 12, true], [ox + 4, oy + t, false], [ox + P - 12, oy + t, false]]) {
        const c = hex(0x8a3a24);
        if (horiz) { hline(mo, y0, c, x0, x0 + 9); vline(mo, x0 + 9, c, y0, y0 + 7); hline(mo, y0 + 7, c, x0 + 3, x0 + 9); vline(mo, x0 + 3, c, y0 + 3, y0 + 7); }
        else { vline(mo, x0, c, y0, y0 + 9); hline(mo, y0 + 9, c, x0, x0 + 7); vline(mo, x0 + 7, c, y0 + 3, y0 + 9); hline(mo, y0 + 3, c, x0 + 3, x0 + 7); }
      }
    }
    // Estrela de 8 pontas no meio do painel (azul-escuro).
    const cx = ox + P / 2, cy = oy + P / 2;
    for (let y = -18; y <= 18; y++) for (let x = -18; x <= 18; x++) {
      const a = Math.atan2(y, x), d = Math.hypot(x, y);
      if (d < 10 + 7 * Math.abs(Math.cos(a * 4))) mo.set(cx + x, cy + y, d < 6 ? hex(0xc8a24a) : hex(0x2e3e58));
    }
  }
  grime(mo, r, 60, 0.4, 12);
  for (let i = 0; i < 110; i++) { const x = r.int(0, S - 1), y = r.int(0, S - 1); rect(mo, x, y, 4, 4, hex(0x4a4234)); }  // pastilhas faltando
  cracks(mo, r, 18, 24);
  out.floor_mosaic = mo;

  // Pedra: lajes cinzentas desgastadas, com musgo nas juntas.
  r = rng('stone');
  const st = base(S, S, hex(0x6e6a60), r, { amount: 0.12, cells: 6 });
  slabs(st, r, 24, 20, 44, hex(0x3a372f), 0.1);
  for (let i = 0; i < 1625; i++) { const x = r.int(0, S - 1), y = r.int(0, S - 1); if (st.rgb(x, y)[0] < 70) st.set(x, y, hex(0x3e5a2a)); }
  grime(st, r, 50, 0.35);
  cracks(st, r, 19, 20);
  out.floor_stone = st;

  // Mármore: placas claras com veios cinza e juntas finas (templos).
  r = rng('marble');
  const ma = base(S, S, hex(0xb8b4a8), r, { amount: 0.05 });
  for (let v = 0; v < 18; v++) {  // veios
    let x = r() * S, y = r() * S;
    for (let i = 0; i < 400; i++) {
      x += Math.cos(i * 0.07 + v) * 0.9 + 0.5; y += Math.sin(i * 0.05 + v * 2) * 0.9;
      ma.set(wrap(Math.round(x), S), wrap(Math.round(y), S), hex(0x8a877e));
    }
  }
  for (let y = 0; y < S; y += 48) hline(ma, y, hex(0x8e8a80));
  for (let x = 0; x < S; x += 48) vline(ma, x, hex(0x8e8a80));
  grime(ma, r, 44, 0.3, 14);
  for (let i = 0; i < 3; i++) stain(ma, r, r() * S, r() * S, 10, hex(0x5a1a14), 0.4);
  cracks(ma, r, 13, 26);
  out.floor_marble = ma;

  // Catacumba: terra batida escura com ossinhos e lajes soltas.
  r = rng('catacomb');
  const ca = base(S, S, hex(0x4a4438), r, { amount: 0.16, cells: 5 });
  for (let i = 0; i < 56; i++) { const x = r.int(0, S - 30), y = r.int(0, S - 30); rect(ca, x, y, 26, 18, hex(0x5a5446)); bevel(ca, x, y, 26, 18, hex(0x6a6454), hex(0x2e2a22)); }
  for (let i = 0; i < 200; i++) {  // ossinhos
    const x = r.int(2, S - 8), y = r.int(2, S - 4);
    hline(ca, y, hex(0xcfc6aa), x, x + 5); ca.set(x - 1, y - 1, hex(0xcfc6aa)); ca.set(x + 6, y + 1, hex(0xcfc6aa));
  }
  grime(ca, r, 70, 0.45, 16);
  out.floor_catacomb = ca;

  // Grama: tufos verde-escuros com terra aparecendo e folhas caídas.
  r = rng('grass');
  const gr = base(S, S, hex(0x344a26), r, { amount: 0.2, cells: 8 });
  for (let i = 0; i < 16250; i++) { const x = r.int(0, S - 1), y = r.int(0, S - 2); gr.set(x, y, r() < 0.5 ? hex(0x4e6a34) : hex(0x243618)); if (r() < 0.3) gr.set(x, y + 1, hex(0x5e7a3e)); }
  for (let i = 0; i < 62; i++) stain(gr, r, r() * S, r() * S, 6 + r() * 10, hex(0x4a3a24), 0.55);  // terra
  for (let i = 0; i < 375; i++) gr.set(r.int(0, S - 1), r.int(0, S - 1), r() < 0.5 ? hex(0x8a5a24) : hex(0x6a3a1e));  // folhas
  out.floor_grass = gr;

  // Rocha vulcânica: basalto escuro com rachaduras que brilham em laranja.
  r = rng('volcanic');
  const vo = base(S, S, hex(0x33282a), r, { amount: 0.14, cells: 6 });
  for (let i = 0; i < 18; i++) {
    let x = r() * S, y = r() * S, dx = r() - 0.5, dy = r() - 0.5;
    for (let k = 0; k < 175; k++) {
      dx += (r() - 0.5) * 0.7; dy += (r() - 0.5) * 0.7;
      const l = Math.hypot(dx, dy) || 1; x += dx / l; y += dy / l;
      const xx = wrap(Math.round(x), S), yy = wrap(Math.round(y), S);
      vo.set(xx, yy, k % 9 < 3 ? hex(0xff8a2a) : hex(0xb8401a));
      vo.set(wrap(xx + 1, S), yy, hex(0x1e1416));
    }
  }
  grime(vo, r, 50, 0.35);
  out.floor_volcanic = vo;
  return out;
}

export function templeWalls(W, H) {
  const out = {};
  let r;

  // Parede de blocos de pedra (templo grego): fiadas de blocos, friso com meandro e rodapé.
  r = rng('wall_temple');
  const t = base(W, H, hex(0x7a7264), r, { amount: 0.08, cells: 6 });
  for (let y = 18; y < H - 10; y += 22) hline(t, y, hex(0x4a453c));
  for (let row = 0, y = 18; y < H - 10; y += 22, row++) for (let x = row % 2 ? 24 : 0; x < W; x += 48) vline(t, x, hex(0x4a453c), y, Math.min(H - 11, y + 21));
  rect(t, 0, 0, W, 18, hex(0x8a8272)); hline(t, 17, hex(0x4a453c));
  for (let x = 2; x < W; x += 12) {  // meandro do friso
    const c = hex(0x8a3a24);
    hline(t, 5, c, x, x + 9); vline(t, x + 9, c, 5, 12); hline(t, 12, c, x + 3, x + 9); vline(t, x + 3, c, 8, 12);
  }
  rect(t, 0, H - 10, W, 10, hex(0x3e3a32)); hline(t, H - 10, hex(0x5e584c));
  for (let i = 0; i < 15; i++) stain(t, r, r() * W, 30 + r() * 100, 5 + r() * 10, GRIME, 0.4);
  for (let i = 0; i < 270; i++) { const x = r.int(0, W - 1), y = r.int(H - 40, H - 11); if (dither(x, y, 0.4)) t.set(x, y, hex(0x3e5a2a)); }  // musgo embaixo
  for (let i = 0; i < 3; i++) crack(t, r, r() * W, 30, 26, hex(0x2a2620));
  out.wall_temple = t;

  // Lava: lateral (a margem baixa) e topo (rio brilhante com crosta).
  r = rng('lava');
  const lv = base(W, W, hex(0xd0441a), r, { amount: 0.25, cells: 6 });
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const v = Math.sin(x * 0.19 + Math.sin(y * 0.13) * 2) + Math.sin(y * 0.21 + x * 0.05);
    if (v > 1.1) lv.set(x, y, hex(0xffc050)); else if (v > 0.5) lv.set(x, y, hex(0xff8a2a)); else if (v < -1.2) lv.set(x, y, hex(0x3a1a14));
  }
  out.lava_top = lv;
  const ls = base(W, 48, hex(0x2a1e1c), r, { amount: 0.1 });
  for (let x = 0; x < W; x++) for (let y = 0; y < 10; y++) ls.set(x, y, mix(hex(0xff8a2a), hex(0x2a1e1c), y / 10));
  out.lava_side = ls;
  return out;
}
