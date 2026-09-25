// Decoração em pixel art: peças de parede (vistas de frente: luminária, canos, duto, placas,
// quadro de avisos, caixa de força, cartaz, pichação, sangue) e decalques de chão (papéis,
// latas, garrafas, lixo, entulho, poça, rachadura, rastro de sangue). 48 px/m.
import { writeFileSync } from 'node:fs';
import { Pixels } from './raster.mjs';
import { PPM, rng, base, stain, crack, rect, hline, vline, bevel, mix, scale, hex, dither } from './paint.mjs';

const T = (w, h) => new Pixels(w, h);

function blobFill(p, cx, cy, rx, ry, r, color, rough = 0.35) {
  for (let y = 0; y < p.height; y++) for (let x = 0; x < p.width; x++) {
    const a = Math.atan2(y - cy, x - cx);
    const edge = 1 + Math.sin(a * 3 + r() * 6) * rough * 0.5 + Math.sin(a * 5 + 1.3) * rough * 0.3;
    if (Math.hypot((x - cx) / rx, (y - cy) / ry) <= edge) p.set(x, y, color);
  }
}

const WALL = {
  lamp: { size: [1.2, 0.25], glow: [1.0, 0.92, 0.72], draw: (r) => {
    const p = T(58, 12);
    rect(p, 0, 0, 58, 12, hex(0x3a3d40)); bevel(p, 0, 0, 58, 12, hex(0x5a5e62), hex(0x1c1d1f));
    rect(p, 3, 4, 52, 4, hex(0xfff2c4)); hline(p, 5, hex(0xffffff), 4, 53);
    return p;
  } },
  lamp_broken: { size: [1.2, 0.25], draw: (r) => {
    const p = T(58, 12);
    rect(p, 0, 0, 58, 12, hex(0x3a3d40)); bevel(p, 0, 0, 58, 12, hex(0x5a5e62), hex(0x1c1d1f));
    rect(p, 3, 4, 20, 4, hex(0x8a8670)); rect(p, 30, 4, 25, 4, hex(0x222222));
    return p;
  } },
  pipes: { size: [2.0, 0.3], draw: (r) => {
    const p = T(96, 14);
    for (const [y, c] of [[2, hex(0x6a6f72)], [8, hex(0x7a4a2e)]]) {
      rect(p, 0, y, 96, 4, c); hline(p, y, scale(c, 1.35)); hline(p, y + 3, scale(c, 0.55));
    }
    for (let x = 10; x < 96; x += 40) rect(p, x, 0, 3, 14, hex(0x2a2c2e));  // braçadeiras
    stain(p, r, 60, 8, 4, hex(0x6a3a1e), 0.5);
    return p;
  } },
  vent: { size: [0.7, 0.5], draw: () => {
    const p = T(34, 24);
    rect(p, 0, 0, 34, 24, hex(0x55595c)); bevel(p, 0, 0, 34, 24, hex(0x80858a), hex(0x2a2c2e));
    for (let y = 4; y < 21; y += 3) hline(p, y, hex(0x1a1b1c), 3, 30);
    return p;
  } },
  exit_sign: { size: [0.8, 0.3], glow: [0.4, 1.0, 0.5], draw: () => {
    const p = T(38, 14);
    rect(p, 0, 0, 38, 14, hex(0x1e7a3a)); bevel(p, 0, 0, 38, 14, hex(0x4ad27a), hex(0x0e3a1c));
    // pessoa correndo + seta
    for (const [x, y] of [[8, 3], [7, 5], [8, 5], [9, 5], [8, 7], [7, 9], [10, 9], [6, 10], [11, 10]]) p.set(x, y, hex(0xeaffea));
    for (let x = 16; x < 33; x++) p.set(x, 7, hex(0xeaffea));
    for (const d of [1, 2, 3]) { p.set(32 - d, 7 - d, hex(0xeaffea)); p.set(32 - d, 7 + d, hex(0xeaffea)); }
    return p;
  } },
  board: { size: [1.0, 0.75], draw: (r) => {
    const p = base(48, 36, hex(0x8a6a42), r, { amount: 0.12 });
    bevel(p, 0, 0, 48, 36, hex(0x5a3a22), hex(0x3a2412)); bevel(p, 1, 1, 46, 34, hex(0x5a3a22), hex(0x3a2412));
    for (let i = 0; i < 6; i++) {
      const x = r.int(3, 36), y = r.int(3, 24), w = r.int(7, 11), h = r.int(8, 11);
      rect(p, x, y, w, h, r.pick([hex(0xe8e4d4), hex(0xd8d0a0), hex(0xc8e0e8)]));
      for (let l = y + 2; l < y + h - 1; l += 2) hline(p, l, hex(0x6a6a6a), x + 1, x + w - 2);
      p.set(x + Math.floor(w / 2), y, hex(0xc03030));
    }
    return p;
  } },
  fusebox: { size: [0.5, 0.65], draw: (r) => {
    const p = base(24, 32, hex(0x6a6f5a), r, { amount: 0.08 });
    bevel(p, 0, 0, 24, 32, hex(0x8a8f78), hex(0x2a2c24));
    rect(p, 6, 4, 12, 8, hex(0xd2a32a)); for (let x = 6; x < 18; x += 2) p.set(x, 7, hex(0x1d1d1d));
    rect(p, 18, 16, 2, 4, hex(0x2a2a2a));
    return p;
  } },
  poster: { size: [0.6, 0.85], draw: (r) => {
    const p = base(29, 41, r.pick([hex(0x8a3a2a), hex(0x2a5a7a), hex(0xb08a3a)]), r, { amount: 0.1 });
    rect(p, 3, 3, 23, 20, hex(0xd8d0b0)); rect(p, 6, 8, 17, 10, scale(p.rgb(1, 1), 0.7));
    for (let y = 27; y < 37; y += 3) hline(p, y, hex(0xe8e0c8), 4, 24);
    for (let x = 18; x < 29; x++) for (let y = 30; y < 41; y++) if (dither(x, y, (x - 18) / 11 * 0.6)) p.set(x, y, [0, 0, 0], 0);  // rasgado
    return p;
  } },
  graffiti: { size: [1.4, 0.7], draw: (r) => {
    const p = T(67, 34);
    const color = r.pick([hex(0xc03030), hex(0x30a0c0), hex(0xe0c040), hex(0x60c050)]);
    let x = 4, y = 18;
    for (let i = 0; i < 180; i++) {
      p.set(Math.round(x), Math.round(y), color);
      p.set(Math.round(x) + 1, Math.round(y), color);
      x += 0.35 + (r() - 0.3) * 0.5;
      y += Math.sin(i * 0.4) * 1.4 + (r() - 0.5);
      y = Math.max(2, Math.min(31, y));
      if (x > 62) break;
    }
    return p;
  } },
  blood_smear: { size: [0.9, 0.9], draw: (r) => {
    const p = T(43, 43);
    blobFill(p, 20, 14, 8, 6, r, hex(0x6a1210), 0.6);
    for (let d = 0; d < 5; d++) { const x = r.int(14, 28); for (let y = 16; y < 16 + r.int(8, 26); y++) p.set(x, y, hex(0x5a0e0c)); }  // escorrido
    return p;
  } },
};

const FLOOR = {
  paper: { size: [0.3, 0.3], draw: (r) => { const p = T(14, 14); rect(p, 2, 3, 10, 8, hex(0xd8d2c0)); for (let y = 5; y < 10; y += 2) hline(p, y, hex(0x8a8678), 3, 10); return p; } },
  papers: { size: [0.6, 0.5], draw: (r) => { const p = T(29, 24); for (let i = 0; i < 5; i++) { const x = r.int(0, 18), y = r.int(0, 14); rect(p, x, y, 10, 8, r.pick([hex(0xd8d2c0), hex(0xc8c0a8), hex(0xe0dccc)])); hline(p, y + 3, hex(0x8a8678), x + 1, x + 8); } return p; } },
  can: { size: [0.2, 0.2], draw: () => { const p = T(10, 10); rect(p, 2, 3, 7, 4, hex(0xb03028)); hline(p, 3, hex(0xd8d8d8), 2, 8); p.set(8, 5, hex(0xd8d8d8)); return p; } },
  bottle: { size: [0.3, 0.2], draw: () => { const p = T(14, 10); rect(p, 1, 3, 9, 4, hex(0x3a7a4a)); rect(p, 10, 4, 3, 2, hex(0x3a7a4a)); hline(p, 3, hex(0x7ad29a), 2, 8); return p; } },
  trash: { size: [0.8, 0.6], draw: (r) => { const p = T(38, 29); for (let i = 0; i < 26; i++) { const x = r.int(2, 34), y = r.int(2, 25); rect(p, x, y, r.int(1, 4), r.int(1, 3), r.pick([hex(0x8a8678), hex(0x5a4a3a), hex(0x3a5a3a), hex(0xb03028), hex(0xd8d2c0)])); } return p; } },
  debris: { size: [0.9, 0.7], draw: (r) => { const p = T(43, 34); for (let i = 0; i < 14; i++) blobFill(p, r.int(6, 36), r.int(6, 28), r.int(2, 5), r.int(2, 4), r, r.pick([hex(0x5a5850), hex(0x6a675e), hex(0x45433c)]), 0.5); return p; } },
  puddle: { size: [1.3, 0.9], draw: (r) => { const p = T(62, 43); blobFill(p, 31, 21, 26, 16, r, hex(0x1c262c), 0.5); for (let i = 0; i < 10; i++) p.set(r.int(15, 45), r.int(12, 30), hex(0x5d7486)); return p; } },
  crack: { size: [1.4, 1.4], draw: (r) => { const p = T(67, 67); crack(p, r, 33, 33, 60, hex(0x14120f)); crack(p, r, 33, 33, 40, hex(0x14120f)); return p; } },
  blood_trail: { size: [1.6, 0.6], draw: (r) => { const p = T(77, 29); for (let x = 2; x < 74; x += r.int(3, 7)) blobFill(p, x, 14 + Math.sin(x * 0.15) * 4, r.int(2, 4), r.int(1, 3), r, hex(0x5a0e0c), 0.6); return p; } },
  casings: { size: [0.4, 0.3], draw: (r) => { const p = T(19, 14); for (let i = 0; i < 6; i++) { const x = r.int(1, 16), y = r.int(1, 12); p.set(x, y, hex(0xd9b048)); p.set(x + 1, y, hex(0x9a7a28)); } return p; } },
};

export function build(outDir, save) {
  const index = { wall: {}, floor: {} };
  for (const [group, table] of [['wall', WALL], ['floor', FLOOR]]) {
    for (const [name, item] of Object.entries(table)) {
      const pixels = item.draw(rng(name));
      save(`decor_${name}`, pixels);
      index[group][name] = { size: item.size, glow: item.glow || null };
    }
  }
  writeFileSync(`${outDir}/decor.json`, JSON.stringify(index) + '\n');
  console.log(`  decoração: ${Object.keys(WALL).length} de parede, ${Object.keys(FLOOR).length} de chão`);
}
