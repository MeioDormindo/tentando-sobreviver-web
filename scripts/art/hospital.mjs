// Arte do Hospital Santa Luzia (Mapa 2): pisos contínuos (512x512) e props vistos de cima.
// Escala 2x (1 px do mundo = 2 px da textura).
import { f, line, linear, polyline, radial, rng, svgDoc } from './lib.mjs';

const SIZE = 512;

function noise(id, freq, octaves, seed, matrix) {
  return (
    `<filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">` +
    `<feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="${octaves}" seed="${seed}" stitchTiles="stitch"/>` +
    `<feColorMatrix type="matrix" values="${matrix}"/></filter>`
  );
}

const GRIME = noise('hgrime', 0.0078125, 4, 31, '0 0 0 0 0.05  0 0 0 0 0.055  0 0 0 0 0.05  -2.6 0 0 0 1.0');
const GRAIN = noise('hgrain', 0.5, 2, 17, '1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 0.08');
const OVERLAYS = `<rect width="${SIZE}" height="${SIZE}" filter="url(#hgrime)"/><rect width="${SIZE}" height="${SIZE}" filter="url(#hgrain)"/>`;
const SHADOW = `<filter id="hs" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.5"/></filter>`;
const shadowRect = (x, y, w, h, rx = 4) => `<rect x="${x + 5}" y="${y + 7}" width="${w}" height="${h}" rx="${rx}" fill="#000" opacity=".5" filter="url(#hs)"/>`;

/** Manchas secas (sangue velho / água) espalhadas no piso. */
function stains(r, count, color) {
  let s = '';
  for (let i = 0; i < count; i++) {
    const rx = r.range(20, 50);
    s += `<ellipse cx="${f(r.range(rx + 4, SIZE - rx - 4))}" cy="${f(r.range(rx + 4, SIZE - rx - 4))}" rx="${f(rx)}" ry="${f(rx * r.range(0.5, 0.9))}" fill="${color}" opacity="${f(r.range(0.12, 0.3))}"/>`;
  }
  return s;
}

// ───────────────────────────── Pisos ─────────────────────────────

/** Azulejo verde-água e branco em xadrez (Recepção, Refeitório, Centro Cirúrgico). */
export function floorHospital() {
  const r = rng(611);
  const tile = 64;
  let s = `<rect width="${SIZE}" height="${SIZE}" fill="#5e6d68"/>`;
  for (let y = 0; y < SIZE; y += tile) {
    for (let x = 0; x < SIZE; x += tile) {
      const light = ((x + y) / tile) % 2 === 0;
      const base = light ? r.pick(['#8b9690', '#86918b', '#8f9a94']) : r.pick(['#5f7872', '#5b746e', '#627b75']);
      s += `<rect x="${x + 1.5}" y="${y + 1.5}" width="${tile - 3}" height="${tile - 3}" fill="${base}"/>`;
      s += `<rect x="${x + 3}" y="${y + 3}" width="${tile - 6}" height="4" fill="#fff" opacity=".07"/>`;
      if (r.next() < 0.12) s += polyline([[x + r.range(6, 20), y + r.range(6, 20)], [x + r.range(24, 40), y + r.range(24, 40)], [x + r.range(40, 58), y + r.range(30, 58)]], '#394541', 1.2, 'opacity=".7"');
    }
  }
  s += stains(r, 6, '#3a1d18');
  return svgDoc(SIZE, SIZE, GRIME + GRAIN, s + OVERLAYS);
}

/** Linóleo claro manchado com emendas (Enfermaria, UTI, Pediatria, Radiologia, Farmácia). */
export function floorLinoleum() {
  const r = rng(622);
  let s = `<rect width="${SIZE}" height="${SIZE}" fill="#8f9a8c"/>`;
  s += `<rect width="${SIZE}" height="${SIZE}" filter="url(#speck)"/>`;
  for (let i = 0; i <= 2; i++) s += line([0, i * 256], [SIZE, i * 256], '#5f685c', 2) + line([i * 256, 0], [i * 256, SIZE], '#5f685c', 1.2);
  // marcas de rodinhas de maca
  for (let i = 0; i < 5; i++) {
    const y = r.range(30, SIZE - 30);
    s += line([0, y], [SIZE, y + r.range(-10, 10)], '#4a5248', 1.5).replace('/>', ' opacity=".25"/>');
  }
  s += stains(r, 5, '#402a1c');
  const defs = GRIME + GRAIN + noise('speck', 0.9, 1, 44, '0 0 0 0 0.2  0 0 0 0 0.22  0 0 0 0 0.2  2.2 0 0 0 -1.35');
  return svgDoc(SIZE, SIZE, defs, s + OVERLAYS);
}

/** Azulejo pequeno branco-acinzentado com ralo (Necrotério). */
export function floorMorgue() {
  const r = rng(633);
  const tile = 32;
  let s = `<rect width="${SIZE}" height="${SIZE}" fill="#4b5250"/>`;
  for (let y = 0; y < SIZE; y += tile) {
    for (let x = 0; x < SIZE; x += tile) {
      s += `<rect x="${x + 1}" y="${y + 1}" width="${tile - 2}" height="${tile - 2}" fill="${r.pick(['#8d9794', '#879290', '#929c99'])}"/>`;
    }
  }
  for (const [cx, cy] of [[256, 256]]) {
    s += `<circle cx="${cx}" cy="${cy}" r="18" fill="#2a2f2e" stroke="#1a1d1c" stroke-width="3"/>`;
    for (let k = -12; k <= 12; k += 6) s += line([cx - 12, cy + k], [cx + 12, cy + k], '#111', 2);
  }
  s += stains(r, 8, '#4a1510');
  return svgDoc(SIZE, SIZE, GRIME + GRAIN, s + OVERLAYS);
}

// ───────────────────────────── Props ─────────────────────────────

/** Leito hospitalar com lençol amarrotado (128x72 → 64x36). */
export function hospitalBed() {
  const defs = SHADOW + linear('hbm', [[0, '#c9d0cc'], [1, '#9aa39e']]);
  let s = shadowRect(6, 8, 116, 56);
  s += `<rect x="6" y="8" width="116" height="56" rx="6" fill="#6d7571" stroke="#2c302e" stroke-width="2"/>`;
  s += `<rect x="12" y="12" width="104" height="48" rx="5" fill="url(#hbm)"/>`;
  s += `<rect x="92" y="16" width="20" height="40" rx="6" fill="#e6ebe8" stroke="#8a928e" stroke-width="1.5"/>`;
  s += `<path d="M16 14 L84 12 Q90 30 82 58 L18 58 Q12 36 16 14 Z" fill="#b9c7cf" stroke="#7d8c94" stroke-width="1.5"/>`;
  s += `<path d="M28 20 Q48 30 40 50 M56 18 Q64 34 58 54" stroke="#8a9ba5" stroke-width="2" fill="none" opacity=".7"/>`;
  s += `<ellipse cx="50" cy="40" rx="10" ry="7" fill="#5a0f0b" opacity=".55"/>`;
  s += `<rect x="2" y="8" width="6" height="56" rx="2" fill="#4a514e"/><rect x="120" y="8" width="6" height="56" rx="2" fill="#4a514e"/>`;
  return svgDoc(128, 72, defs, s);
}

/** Cadeira de rodas tombada de leve (64x64 → 32x32). */
export function wheelchair() {
  let s = `<ellipse cx="36" cy="40" rx="24" ry="20" fill="#000" opacity=".45" filter="url(#hs)"/>`;
  for (const y of [10, 54]) s += `<rect x="8" y="${y - 4}" width="48" height="8" rx="4" fill="#1b1d1f" stroke="#050606" stroke-width="1.5"/>`;
  s += `<rect x="16" y="14" width="32" height="36" rx="4" fill="#2f4a6a" stroke="#101a26" stroke-width="2"/>`;
  s += `<rect x="12" y="16" width="8" height="32" rx="3" fill="#1d2f45"/>`;
  s += line([48, 18], [58, 14], '#9aa3a8', 3) + line([48, 46], [58, 50], '#9aa3a8', 3);
  return svgDoc(64, 64, SHADOW, s);
}

/** Suporte de soro com bolsa (48x48 → 24x24). */
export function ivStand() {
  let s = `<circle cx="27" cy="28" r="14" fill="#000" opacity=".4" filter="url(#hs)"/>`;
  for (let a = 0; a < 5; a++) {
    const ang = (a / 5) * Math.PI * 2;
    s += line([24, 24], [24 + Math.cos(ang) * 16, 24 + Math.sin(ang) * 16], '#6b7377', 2.5);
  }
  s += `<circle cx="24" cy="24" r="4" fill="#b8c0c4"/>`;
  s += `<rect x="16" y="14" width="16" height="20" rx="4" fill="#cfe6d6" opacity=".85" stroke="#6c8a76" stroke-width="1.5"/>`;
  s += `<rect x="18" y="24" width="12" height="8" rx="2" fill="#9ccf6a" opacity=".7"/>`;
  return svgDoc(48, 48, SHADOW, s);
}

/** Maca com lençol e mancha (128x56 → 64x28). */
export function gurney() {
  let s = shadowRect(8, 8, 112, 40);
  s += `<rect x="8" y="8" width="112" height="40" rx="5" fill="#7a8286" stroke="#2c3033" stroke-width="2"/>`;
  s += `<rect x="12" y="11" width="104" height="34" rx="4" fill="#d9dfdc"/>`;
  s += `<path d="M20 12 Q60 20 110 12 L112 44 Q70 36 18 44 Z" fill="#c2cbc7" opacity=".8"/>`;
  s += `<ellipse cx="70" cy="30" rx="16" ry="8" fill="#6a120d" opacity=".5"/>`;
  for (const [x, y] of [[12, 6], [112, 6], [12, 46], [112, 46]]) s += `<circle cx="${x}" cy="${y}" r="4" fill="#1b1d1f"/>`;
  return svgDoc(128, 56, SHADOW, s);
}

/** Armário de remédios com portas de vidro (112x44 → 56x22). */
export function medCabinet() {
  const defs = SHADOW + linear('mc', [[0, '#dfe4e1'], [1, '#b3bab6']]);
  let s = shadowRect(4, 4, 104, 36);
  s += `<rect x="4" y="4" width="104" height="36" rx="3" fill="url(#mc)" stroke="#5a625e" stroke-width="2"/>`;
  s += `<rect x="10" y="10" width="44" height="24" fill="#8fb6c4" opacity=".55" stroke="#5a625e" stroke-width="1.5"/>`;
  s += `<rect x="58" y="10" width="44" height="24" fill="#8fb6c4" opacity=".55" stroke="#5a625e" stroke-width="1.5"/>`;
  const r = rng(707);
  for (let i = 0; i < 12; i++) s += `<rect x="${f(r.range(12, 96))}" y="${f(r.range(12, 26))}" width="5" height="7" rx="1.5" fill="${r.pick(['#c0392b', '#e8e2c8', '#2e86c1', '#d4ac0d'])}"/>`;
  s += `<path d="M50 20 h12 M56 14 v12" stroke="#c0392b" stroke-width="4"/>`;
  return svgDoc(112, 44, defs, s);
}

/** Gavetas refrigeradas do necrotério (192x56 → 96x28). */
export function morgueDrawers() {
  const defs = SHADOW + linear('md', [[0, '#a7aeb0'], [1, '#6f777a']]);
  let s = shadowRect(4, 4, 184, 48, 3);
  s += `<rect x="4" y="4" width="184" height="48" rx="3" fill="#4a5154" stroke="#1d2123" stroke-width="2"/>`;
  for (let i = 0; i < 4; i++) {
    const x = 10 + i * 45;
    s += `<rect x="${x}" y="10" width="40" height="36" rx="2" fill="url(#md)" stroke="#2b3133" stroke-width="1.5"/>`;
    s += `<rect x="${x + 14}" y="22" width="12" height="4" rx="2" fill="#2b3133"/>`;
    s += `<rect x="${x + 4}" y="13" width="14" height="6" fill="#e8e2c8" opacity=".8"/>`;
  }
  // uma gaveta aberta com lençol
  s += `<rect x="100" y="44" width="40" height="10" fill="#d9dfdc" stroke="#8a928e" stroke-width="1"/>`;
  return svgDoc(192, 56, defs, s);
}

/** Bancada de laboratório com tubos de ensaio brilhando (160x64 → 80x32). */
export function labBench() {
  const defs = SHADOW + linear('lb', [[0, '#3c4347'], [1, '#262b2e']]);
  let s = shadowRect(4, 6, 152, 52);
  s += `<rect x="4" y="6" width="152" height="52" rx="4" fill="url(#lb)" stroke="#121517" stroke-width="2"/>`;
  s += `<rect x="10" y="12" width="140" height="40" rx="3" fill="#1c2023"/>`;
  const r = rng(808);
  for (let i = 0; i < 9; i++) {
    const x = 18 + i * 14;
    const c = r.pick(['#9ccf6a', '#6fe0d8', '#e0c95a', '#d65a8a']);
    s += `<rect x="${x}" y="18" width="8" height="18" rx="4" fill="${c}" opacity=".85"/><rect x="${x}" y="18" width="8" height="4" fill="#dfe8e6" opacity=".8"/>`;
  }
  s += `<rect x="110" y="36" width="36" height="12" rx="2" fill="#2e3a40" stroke="#6fe0d8" stroke-width="1.5"/>`;
  s += `<circle cx="36" cy="44" r="6" fill="#303a3e" stroke="#9aa3a8" stroke-width="1.5"/>`;
  return svgDoc(160, 64, defs, s);
}

/** Máquina de venda de lanches (80x56 → 40x28). */
export function vending() {
  let s = shadowRect(4, 4, 72, 48);
  s += `<rect x="4" y="4" width="72" height="48" rx="4" fill="#7a1f1c" stroke="#2a0a09" stroke-width="2"/>`;
  s += `<rect x="10" y="10" width="44" height="36" rx="2" fill="#9fc3d1" opacity=".6"/>`;
  const r = rng(909);
  for (let y = 14; y < 44; y += 8) for (let x = 13; x < 52; x += 8) s += `<rect x="${x}" y="${y}" width="6" height="5" fill="${r.pick(['#e0c95a', '#c0392b', '#2e86c1', '#27ae60'])}"/>`;
  s += `<rect x="58" y="12" width="12" height="18" rx="2" fill="#1b1d1f"/><rect x="60" y="36" width="10" height="6" fill="#0c0d0e"/>`;
  return svgDoc(80, 56, SHADOW, s);
}

/** Foco cirúrgico visto de cima (96x96 → 48x48, decorativo e luminoso). */
export function surgicalLight() {
  const defs = radial('sl', [[0, '#ffffff'], [0.4, '#dff4ff'], [1, '#7f97a3']], '45%', '45%', '60%');
  let s = `<circle cx="48" cy="48" r="40" fill="#1d2326" opacity=".35"/>`;
  for (const [cx, cy] of [[32, 36], [62, 34], [48, 62]]) {
    s += `<circle cx="${cx}" cy="${cy}" r="17" fill="#5f6a70" stroke="#23292c" stroke-width="2"/>`;
    s += `<circle cx="${cx}" cy="${cy}" r="12" fill="url(#sl)"/>`;
  }
  s += line([48, 48], [48, 6], '#3a4246', 5);
  return svgDoc(96, 96, defs, s);
}

/** Fileira de cadeiras de espera (160x44 → 80x22). */
export function waitingChairs() {
  let s = shadowRect(4, 6, 152, 32);
  s += `<rect x="4" y="30" width="152" height="6" rx="2" fill="#2d3134"/>`;
  for (let i = 0; i < 4; i++) {
    const x = 8 + i * 37;
    s += `<rect x="${x}" y="6" width="32" height="26" rx="5" fill="#2f6f8f" stroke="#0f2833" stroke-width="2"/>`;
    s += `<rect x="${x + 3}" y="8" width="26" height="6" rx="3" fill="#4d93b5" opacity=".7"/>`;
  }
  return svgDoc(160, 44, SHADOW, s);
}

// ───────────────────────────── Missão: O Soro do Dr. Almeida ─────────────────────────────

/** Geladeira de amostras da UTI (72x56 → 36x28), com luz azul e frascos. */
export function sampleFridge() {
  let s = shadowRect(4, 4, 64, 48);
  s += `<rect x="4" y="4" width="64" height="48" rx="4" fill="#d9dfdc" stroke="#4a524e" stroke-width="2"/>`;
  s += `<rect x="10" y="10" width="52" height="34" rx="2" fill="#9fd6ef" opacity=".55" stroke="#4a524e" stroke-width="1.5"/>`;
  for (let i = 0; i < 6; i++) s += `<rect x="${14 + i * 8}" y="16" width="5" height="12" rx="2" fill="${i % 2 ? '#c0392b' : '#9ccf2a'}"/>`;
  s += `<rect x="12" y="32" width="48" height="2" fill="#6d8290"/>`;
  s += `<circle cx="60" cy="48" r="2.5" fill="#3ce0ff"/>`;
  return svgDoc(72, 56, SHADOW, s);
}

/** Cadeado grande do armário da Farmácia (32x32 → 16x16). */
export function padlock() {
  let s = `<path d="M9 14 V9 Q16 1 23 9 V14" stroke="#9aa3a8" stroke-width="3" fill="none"/>`;
  s += `<rect x="6" y="13" width="20" height="15" rx="3" fill="#c9a227" stroke="#3a2e0a" stroke-width="1.6"/>`;
  s += `<circle cx="16" cy="20" r="2.4" fill="#3a2e0a"/><rect x="15" y="21" width="2" height="4" fill="#3a2e0a"/>`;
  return svgDoc(32, 32, '', s);
}

/** Centrífuga do Laboratório (96x80 → 48x40): tambor com tubos e painel. */
export function centrifuge() {
  const defs = SHADOW + radial('cfg', [[0, '#e8ecee'], [1, '#8a9398']], '40%', '35%', '70%');
  let s = shadowRect(6, 6, 84, 68, 8);
  s += `<rect x="6" y="6" width="84" height="68" rx="8" fill="#5a6368" stroke="#1d2224" stroke-width="2"/>`;
  s += `<circle cx="40" cy="40" r="26" fill="url(#cfg)" stroke="#1d2224" stroke-width="2"/>`;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    s += `<circle cx="${f(40 + Math.cos(a) * 16)}" cy="${f(40 + Math.sin(a) * 16)}" r="4.5" fill="#9ccf2a" stroke="#2f4210" stroke-width="1.2"/>`;
  }
  s += `<circle cx="40" cy="40" r="5" fill="#2a3034"/>`;
  s += `<rect x="72" y="16" width="12" height="48" rx="2" fill="#1d2224"/>`;
  for (const [y, c] of [[24, '#3ce0ff'], [36, '#9ccf2a'], [48, '#e0503c']]) s += `<circle cx="78" cy="${y}" r="3" fill="${c}"/>`;
  return svgDoc(96, 80, defs, s);
}

/** Cartão de acesso do Blindado (40x28 → 20x14). */
export function keycard() {
  let s = `<rect x="2" y="2" width="36" height="24" rx="3" fill="#e8e2c8" stroke="#3a3a3a" stroke-width="1.6"/>`;
  s += `<rect x="2" y="2" width="36" height="7" rx="3" fill="#c0392b"/>`;
  s += `<rect x="6" y="12" width="10" height="11" rx="1" fill="#8a96a8"/>`;
  s += `<rect x="19" y="13" width="15" height="2.4" fill="#555"/><rect x="19" y="18" width="11" height="2.4" fill="#555"/>`;
  return svgDoc(40, 28, '', s);
}

/** Frasco do soro pronto (32x48 → 16x24), brilhando. */
export function serumVial() {
  const defs = radial('srm', [[0, '#e8ff8a'], [1, '#6fe0d8']], '45%', '40%', '60%');
  let s = `<rect x="10" y="4" width="12" height="6" rx="1.5" fill="#6d7571"/>`;
  s += `<path d="M9 10 H23 V38 Q23 44 16 44 Q9 44 9 38 Z" fill="url(#srm)" stroke="#1d3a38" stroke-width="1.6"/>`;
  s += `<rect x="11" y="14" width="3" height="20" rx="1.5" fill="#fff" opacity=".45"/>`;
  return svgDoc(32, 48, defs, s);
}
