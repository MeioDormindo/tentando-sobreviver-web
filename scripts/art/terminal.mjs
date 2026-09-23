// Arte do mapa Terminal Central: pisos por área, trem, portas, barricadas e props técnicos.
// Escala 2x (1 px do mundo = 2 px da textura). Pisos têm 512x512 e são contínuos (seamless).
import { blobPath, f, line, linear, polyline, radial, rng, svgDoc } from './lib.mjs';

const SIZE = 512;

function noiseFilter(id, freq, octaves, seed, alphaRow, stitch = true) {
  return (
    `<filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">` +
    `<feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="${octaves}" seed="${seed}"${stitch ? ' stitchTiles="stitch"' : ''}/>` +
    `<feColorMatrix type="matrix" values="${alphaRow}"/></filter>`
  );
}

/** Manchas escuras grandes + granulação fina (base de quase todos os pisos). */
const GRIME = noiseFilter('grime', 0.0078125, 4, 4, '0 0 0 0 0.05  0 0 0 0 0.045  0 0 0 0 0.035  -2.4 0 0 0 1.05');
const GRAIN = noiseFilter('grain', 0.5, 2, 9, '1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 0.1');

function cracks(r, count, color = '#141512') {
  let s = '';
  for (let i = 0; i < count; i++) {
    let p = [r.range(40, SIZE - 40), r.range(40, SIZE - 40)];
    const pts = [p];
    let a = r.range(0, Math.PI * 2);
    for (let k = 0; k < 6; k++) {
      a += r.range(-0.8, 0.8);
      p = [Math.min(SIZE - 8, Math.max(8, p[0] + Math.cos(a) * r.range(8, 16))), Math.min(SIZE - 8, Math.max(8, p[1] + Math.sin(a) * r.range(8, 16)))];
      pts.push(p);
    }
    s += polyline(pts, color, 1.5, 'opacity=".8"');
  }
  return s;
}

function stains(r, count, id = 'stain') {
  let s = '';
  for (let i = 0; i < count; i++) {
    const rx = r.range(25, 60);
    s += `<ellipse cx="${f(r.range(rx + 4, SIZE - rx - 4))}" cy="${f(r.range(rx + 4, SIZE - rx - 4))}" rx="${f(rx)}" ry="${f(rx * r.range(0.5, 0.9))}" fill="url(#${id})"/>`;
  }
  return s;
}

const STAIN = radial('stain', [[0, '#141310', 0.5], [1, '#141310', 0]], '50%', '50%', '50%');
const overlays = `<rect width="${SIZE}" height="${SIZE}" filter="url(#grime)"/><rect width="${SIZE}" height="${SIZE}" filter="url(#grain)"/>`;

/** Concreto liso com juntas de dilatação (plataforma, bolsões externos). */
export function floorConcrete() {
  const r = rng(101);
  let s = `<rect width="${SIZE}" height="${SIZE}" fill="#3b3c38"/>`;
  s += `<rect width="${SIZE}" height="${SIZE}" filter="url(#mottle)"/>`;
  for (let i = 0; i <= 2; i++) {
    s += line([0, i * 256], [SIZE, i * 256], '#22231f', 2.5) + line([i * 256, 0], [i * 256, SIZE], '#22231f', 2.5);
  }
  s += cracks(r, 5) + stains(r, 4);
  const defs = GRIME + GRAIN + STAIN + noiseFilter('mottle', 0.03125, 3, 12, '1 0 0 0 -0.3  1 0 0 0 -0.3  1 0 0 0 -0.3  0 0 0 0 0.12');
  return svgDoc(SIZE, SIZE, defs, s + overlays);
}

/** Chapas de metal xadrez (área técnica, manutenção). */
export function floorMetal() {
  const r = rng(202);
  let s = `<rect width="${SIZE}" height="${SIZE}" fill="#33363a"/>`;
  const plate = 128;
  for (let y = 0; y < SIZE; y += plate) {
    for (let x = 0; x < SIZE; x += plate) {
      s += `<rect x="${x + 1.5}" y="${y + 1.5}" width="${plate - 3}" height="${plate - 3}" fill="${r.pick(['#393c40', '#35383c', '#3d4044'])}"/>`;
      // relevo em "grão de arroz"
      for (let py = 8; py < plate; py += 16) {
        for (let px = 8 + ((py / 16) % 2) * 8; px < plate; px += 16) {
          const rot = ((px + py) / 16) % 2 ? 45 : -45;
          s += `<rect x="${x + px - 4}" y="${y + py - 1.2}" width="8" height="2.4" rx="1.2" fill="#4a4e53" transform="rotate(${rot} ${x + px} ${y + py})"/>`;
        }
      }
      for (const [cx, cy] of [[6, 6], [plate - 6, 6], [6, plate - 6], [plate - 6, plate - 6]]) {
        s += `<circle cx="${x + cx}" cy="${y + cy}" r="2" fill="#1d1f22"/>`;
      }
    }
  }
  s += stains(r, 5);
  const defs = GRIME + GRAIN + radial('stain', [[0, '#1a1208', 0.45], [1, '#1a1208', 0]], '50%', '50%', '50%');
  return svgDoc(SIZE, SIZE, defs, s + overlays);
}

/** Leito dos trilhos: brita + dormentes + dois trilhos horizontais (contínuo em X e Y). */
export function floorTracks() {
  const r = rng(303);
  let s = `<rect width="${SIZE}" height="${SIZE}" fill="#2c2a26"/>`;
  s += `<rect width="${SIZE}" height="${SIZE}" filter="url(#gravel)"/>`;
  for (let band = 0; band < 2; band++) {
    const top = band * 256;
    for (let x = 8; x < SIZE; x += 32) {
      s += `<rect x="${x + r.range(-1, 1)}" y="${top + 40}" width="14" height="176" rx="2" fill="#3b2d20" stroke="#1d160f" stroke-width="1.5"/>`;
    }
    for (const ry of [top + 78, top + 178]) {
      s += `<rect x="0" y="${ry - 5}" width="${SIZE}" height="10" fill="#4b4d51"/>`;
      s += `<rect x="0" y="${ry - 2}" width="${SIZE}" height="3" fill="#8a8d92" opacity=".8"/>`;
      s += `<rect x="0" y="${ry + 5}" width="${SIZE}" height="3" fill="#000" opacity=".4"/>`;
    }
  }
  const defs = GRIME + GRAIN + noiseFilter('gravel', 0.25, 2, 21, '1 0 0 0 -0.25  1 0 0 0 -0.27  1 0 0 0 -0.3  0 0 0 0 0.6');
  return svgDoc(SIZE, SIZE, defs, s + overlays);
}

/** Concreto molhado e sujo dos túneis. */
export function floorTunnel() {
  const r = rng(404);
  let s = `<rect width="${SIZE}" height="${SIZE}" fill="#2d2f2c"/>`;
  s += `<rect width="${SIZE}" height="${SIZE}" filter="url(#mottle)"/>`;
  for (let i = 0; i < 6; i++) {
    const cx = r.range(70, SIZE - 70);
    const cy = r.range(70, SIZE - 70);
    s += `<path d="${blobPath(cx, cy, r.range(25, 55), 0.5, 10, r)}" fill="#1b2224" opacity=".55"/>`;
    s += `<path d="${blobPath(cx - 6, cy - 6, r.range(8, 16), 0.5, 7, r)}" fill="#8fa3a8" opacity=".08"/>`;
  }
  s += cracks(r, 8, '#111210');
  const defs = GRIME + GRAIN + noiseFilter('mottle', 0.03125, 3, 31, '1 0 0 0 -0.35  1 0 0 0 -0.33  1 0 0 0 -0.32  0 0 0 0 0.18');
  return svgDoc(SIZE, SIZE, defs, s + overlays);
}

/** Piso de borracha do vagão. 256x256. */
export function floorWagon() {
  let s = `<rect width="256" height="256" fill="#2a2d33"/>`;
  for (let y = 0; y < 256; y += 16) {
    for (let x = (y / 16) % 2 ? 8 : 0; x < 256; x += 16) s += `<circle cx="${x + 4}" cy="${y + 4}" r="3" fill="#353941"/>`;
  }
  const defs = noiseFilter('grain', 0.25, 2, 9, '1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 0.08');
  return svgDoc(256, 256, defs, s + `<rect width="256" height="256" filter="url(#grain)"/>`);
}

/** Faixa tátil amarela da borda da plataforma. 64x20 (repete em X). */
export function tactileStrip() {
  let s = `<rect width="64" height="20" fill="#9c8424"/>`;
  for (let x = 4; x < 64; x += 8) for (const y of [5, 14]) s += `<circle cx="${x}" cy="${y}" r="2.4" fill="#b99d2e"/>`;
  s += `<rect width="64" height="20" fill="#000" opacity=".25"/>`;
  return svgDoc(64, 20, '', s);
}

// ───────────────────────────── Trem ─────────────────────────────

const METAL_NOISE = noiseFilter('mn', 0.12, 3, 6, '1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 0.1', false);

/** Teto do trem (64x64) — pintura azul-acinzentada desgastada. */
export function trainCap() {
  const defs = METAL_NOISE + linear('tc', [[0, '#51606b'], [1, '#3e4a53']]);
  const s =
    `<rect width="64" height="64" fill="url(#tc)"/>` +
    `<rect width="64" height="64" filter="url(#mn)"/>` +
    `<rect x="0" y="30" width="64" height="4" fill="#2f383f" opacity=".6"/>`;
  return svgDoc(64, 64, defs, s);
}

/** Teto + lateral do trem (64x96): faixa amarela e janelas. */
export function trainFull() {
  const defs = METAL_NOISE + linear('tc', [[0, '#51606b'], [1, '#3e4a53']]) + linear('side', [[0, '#6f7c86'], [1, '#48535b']]);
  const s =
    `<rect width="64" height="64" fill="url(#tc)"/>` +
    `<rect width="64" height="64" filter="url(#mn)"/>` +
    `<rect x="0" y="30" width="64" height="4" fill="#2f383f" opacity=".6"/>` +
    `<rect y="64" width="64" height="32" fill="url(#side)"/>` +
    `<rect x="6" y="68" width="52" height="12" rx="2" fill="#1b2227"/>` +
    `<rect x="8" y="69" width="20" height="3" fill="#6f8da0" opacity=".35"/>` +
    `<rect y="84" width="64" height="4" fill="#b28f2a"/>` +
    `<rect y="92" width="64" height="4" fill="#1c2125"/>` +
    `<rect y="64" width="64" height="32" filter="url(#mn)"/>`;
  return svgDoc(64, 96, defs, s);
}

/** Unidade de ar-condicionado no teto do vagão. 96x64. */
export function trainRoofUnit() {
  let s = `<rect x="6" y="6" width="84" height="52" rx="4" fill="#3a444b" stroke="#1f262b" stroke-width="2"/>`;
  for (let i = 0; i < 6; i++) s += `<rect x="${14 + i * 12}" y="14" width="6" height="36" rx="2" fill="#262e33"/>`;
  s += `<circle cx="48" cy="32" r="3" fill="#1a1f23"/>`;
  s += `<path d="${blobPath(30, 44, 10, 0.5, 8, rng(9))}" fill="#6b3d1c" opacity=".45"/>`;
  return svgDoc(96, 64, '', s);
}

/** Banco duplo do vagão (decorativo). 64x36. */
export function wagonSeat() {
  const defs = linear('ws', [[0, '#5a3b3b'], [1, '#402828']]);
  let s = `<rect x="2" y="2" width="60" height="32" rx="5" fill="url(#ws)" stroke="#1d1212" stroke-width="2"/>`;
  s += line([32, 4], [32, 32], '#2a1a1a', 2) + `<rect x="2" y="2" width="60" height="6" rx="3" fill="#6b4848"/>`;
  return svgDoc(64, 36, defs, s);
}

// ───────────────────────────── Portas e barricadas ─────────────────────────────

/** Porta de enrolar (64x64, repete). */
export function doorShutter() {
  const defs = linear('sh', [[0, '#7a7f82'], [0.5, '#5d6265'], [1, '#474b4e']]);
  let s = `<rect width="64" height="64" fill="#3f4346"/>`;
  for (let y = 0; y < 64; y += 8) {
    s += `<rect y="${y + 0.5}" width="64" height="7" fill="url(#sh)"/>`;
    s += `<rect y="${y + 6.5}" width="64" height="1.5" fill="#26292b"/>`;
  }
  s += `<path d="${blobPath(20, 40, 9, 0.6, 8, rng(3))}" fill="#6b3d1c" opacity=".35"/>`;
  return svgDoc(64, 64, defs, s);
}

/** Faixa zebrada de aviso (64x12, repete). */
export function hazardStripe() {
  let s = `<rect width="64" height="12" fill="#c9a227"/>`;
  for (let x = -12; x < 64; x += 16) s += `<path d="M${x} 12 L${x + 8} 0 L${x + 16} 0 L${x + 8} 12 Z" fill="#1b1b1b"/>`;
  return svgDoc(64, 12, '', s);
}

/** Tábua da barricada. 80x16. */
export function plank() {
  const defs = linear('pl', [[0, '#8a6a45'], [1, '#5c4329']], 0, 0, 0, 1);
  let s = `<rect x="1" y="1" width="78" height="14" rx="2" fill="url(#pl)" stroke="#2c1e10" stroke-width="1.5"/>`;
  s += line([8, 6], [70, 7], '#4a3520', 0.9, 'opacity=".6"') + line([14, 10], [60, 11], '#4a3520', 0.8, 'opacity=".5"');
  s += `<circle cx="7" cy="8" r="1.8" fill="#222"/><circle cx="73" cy="8" r="1.8" fill="#222"/>`;
  return svgDoc(80, 16, defs, s);
}

/** Vão da janela visto de cima (64x64 por tile): peitoril escuro com moldura. */
export function windowSill() {
  const defs = linear('sill', [[0, '#1d1f1c'], [1, '#121311']]);
  let s = `<rect width="64" height="64" fill="url(#sill)"/>`;
  s += `<rect x="0" y="0" width="8" height="64" fill="#4a3a28"/><rect x="56" y="0" width="8" height="64" fill="#4a3a28"/>`;
  s += `<rect x="8" y="0" width="48" height="64" fill="#000" opacity=".3"/>`;
  return svgDoc(64, 64, defs, s);
}

// ───────────────────────────── Props técnicos ─────────────────────────────

/** Gerador industrial. 112x80 → 56x40 no mundo. */
export function propGenerator() {
  const defs =
    `<filter id="ps" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.5"/></filter>` +
    linear('gb', [[0, '#5d6b3c'], [1, '#3f4a28']], 0, 0, 1, 1);
  let s = `<rect x="12" y="14" width="96" height="62" rx="4" fill="#000" opacity=".55" filter="url(#ps)"/>`;
  s += `<rect x="6" y="8" width="96" height="60" rx="4" fill="url(#gb)" stroke="#1d2412" stroke-width="2"/>`;
  for (let i = 0; i < 7; i++) s += `<rect x="${14 + i * 8}" y="16" width="4" height="30" rx="1.5" fill="#2b3319"/>`;
  s += `<circle cx="82" cy="30" r="12" fill="#2b3319" stroke="#1a1f10" stroke-width="2"/><circle cx="82" cy="30" r="4" fill="#12150b"/>`;
  s += `<rect x="14" y="52" width="40" height="8" rx="2" fill="#c9a227"/>`;
  s += `<rect x="60" y="52" width="10" height="8" rx="1" fill="#b33a3a"/>`;
  s += line([102, 40], [110, 60], '#151515', 3);
  return svgDoc(112, 80, defs, s);
}

/** Mancha de explosão do Exploder: queimado + gosma esverdeada. 192x192. */
export function decalBurst() {
  const r = rng(909);
  const defs = radial('burn', [[0, '#0b0a08', 0.85], [0.6, '#16140f', 0.6], [1, '#16140f', 0]], '50%', '50%', '50%');
  let s = `<circle cx="96" cy="96" r="88" fill="url(#burn)"/>`;
  s += `<path d="${blobPath(96, 96, 44, 0.55, 14, r)}" fill="#4d5a1f" opacity=".75"/>`;
  s += `<path d="${blobPath(96, 96, 26, 0.6, 10, r)}" fill="#7d8f2a" opacity=".55"/>`;
  for (let i = 0; i < 18; i++) {
    const a = r.range(0, Math.PI * 2);
    const d = r.range(40, 86);
    s += `<circle cx="${f(96 + Math.cos(a) * d)}" cy="${f(96 + Math.sin(a) * d)}" r="${f(r.range(2, 6))}" fill="${r.pick(['#5c6b22', '#3f0a08', '#6d7d26'])}" opacity=".85"/>`;
  }
  return svgDoc(192, 192, defs, s);
}
