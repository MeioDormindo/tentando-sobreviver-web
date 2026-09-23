// Cenário: piso, paredes, props e decals. Tudo em escala 2x (1 px do mundo = 2 px da textura).
import { blobPath, f, line, linear, polyline, radial, rng, svgDoc } from './lib.mjs';

// ───────────────────────────── Piso ─────────────────────────────

/** Piso de pedra/concreto do terminal, contínuo (seamless), 512x512 = 256x256 no mundo. */
export function floorTerminal() {
  const size = 512;
  const tile = 128;
  const r = rng(7);
  const defs =
    `<filter id="grime" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.0078125" numOctaves="4" seed="4" stitchTiles="stitch"/>` +
    `<feColorMatrix type="matrix" values="0 0 0 0 0.05  0 0 0 0 0.045  0 0 0 0 0.035  -2.4 0 0 0 1.05"/></filter>` +
    `<filter id="grain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="2" seed="9" stitchTiles="stitch"/>` +
    `<feColorMatrix type="matrix" values="1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 0.11"/></filter>` +
    radial('stain', [[0, '#141310', 0.55], [1, '#141310', 0]], '50%', '50%', '50%');

  let s = `<rect width="${size}" height="${size}" fill="#1b1c19"/>`;
  const palette = ['#3d3e39', '#40413b', '#3a3b36', '#43443e', '#383934', '#3f3f39'];
  for (let ty = 0; ty < size / tile; ty++) {
    for (let tx = 0; tx < size / tile; tx++) {
      const x = tx * tile + 2;
      const y = ty * tile + 2;
      const w = tile - 4;
      s += `<rect x="${x}" y="${y}" width="${w}" height="${w}" fill="${r.pick(palette)}"/>`;
      s += `<path d="M${x} ${y + w} L${x} ${y} L${x + w} ${y}" stroke="#55564f" stroke-width="2" fill="none" opacity=".45"/>`;
      s += `<path d="M${x + w} ${y} L${x + w} ${y + w} L${x} ${y + w}" stroke="#141512" stroke-width="2" fill="none" opacity=".6"/>`;
      // lascas nos cantos
      if (r.next() > 0.6) {
        const cx = x + (r.next() > 0.5 ? 0 : w);
        const cy = y + (r.next() > 0.5 ? 0 : w);
        s += `<path d="${blobPath(cx, cy, r.range(4, 8), 0.6, 6, r)}" fill="#1e1f1b"/>`;
      }
    }
  }
  // Rachaduras, sempre dentro da textura para não quebrar a continuidade
  for (let i = 0; i < 6; i++) {
    let p = [r.range(40, size - 40), r.range(40, size - 40)];
    const pts = [p];
    let a = r.range(0, Math.PI * 2);
    for (let k = 0; k < 6; k++) {
      a += r.range(-0.8, 0.8);
      p = [p[0] + Math.cos(a) * r.range(8, 16), p[1] + Math.sin(a) * r.range(8, 16)];
      p = [Math.min(size - 8, Math.max(8, p[0])), Math.min(size - 8, Math.max(8, p[1]))];
      pts.push(p);
    }
    s += polyline(pts, '#151612', 1.6, 'opacity=".85"');
  }
  for (let i = 0; i < 5; i++) {
    const rx = r.range(25, 60);
    s += `<ellipse cx="${f(r.range(rx + 4, size - rx - 4))}" cy="${f(r.range(rx + 4, size - rx - 4))}" rx="${f(rx)}" ry="${f(rx * r.range(0.5, 0.9))}" fill="url(#stain)"/>`;
  }
  s += `<rect width="${size}" height="${size}" filter="url(#grime)"/>`;
  s += `<rect width="${size}" height="${size}" filter="url(#grain)"/>`;
  return svgDoc(size, size, defs, s);
}

// ───────────────────────────── Paredes ─────────────────────────────

const WALL_NOISE =
  `<filter id="wn" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">` +
  `<feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="3" seed="2"/>` +
  `<feColorMatrix type="matrix" values="1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 0.12"/></filter>`;

function wallCapContent() {
  return (
    `<rect width="64" height="64" fill="#262825"/>` +
    `<rect width="64" height="64" filter="url(#wn)"/>` +
    `<rect width="64" height="64" fill="url(#capg)"/>`
  );
}

const capGradient = linear('capg', [[0, '#ffffff', 0.04], [1, '#000000', 0.12]]);

/** Topo da parede (64x64) — usado quando há outra parede logo abaixo. */
export function wallCap() {
  return svgDoc(64, 64, WALL_NOISE + capGradient, wallCapContent());
}

/** Topo + face frontal (64x96): a face mostra a altura da parede na vista 3/4. */
export function wallFull() {
  const defs =
    WALL_NOISE + capGradient +
    linear('face', [[0, '#5b5c55'], [0.55, '#4a4b45'], [1, '#34352f']]) +
    linear('grime', [[0, '#000', 0], [1, '#0b0a08', 0.55]]);
  const s =
    wallCapContent() +
    `<rect y="64" width="64" height="32" fill="url(#face)"/>` +
    `<rect y="64" width="64" height="32" filter="url(#wn)"/>` +
    `<rect y="64" width="64" height="2" fill="#77786f" opacity=".7"/>` +
    `<rect y="76" width="64" height="1.5" fill="#2a2b27" opacity=".6"/>` +
    `<rect y="78" width="64" height="18" fill="url(#grime)"/>` +
    `<rect y="91" width="64" height="5" fill="#1d1e1b"/>`;
  return svgDoc(64, 96, defs, s);
}

/** Sombra projetada pela parede no chão logo abaixo dela. */
export function wallShadow() {
  const defs = linear('ws', [[0, '#000', 0.55], [1, '#000', 0]]);
  return svgDoc(64, 28, defs, `<rect width="64" height="28" fill="url(#ws)"/>`);
}

// ───────────────────────────── Props ─────────────────────────────

const PROP_SHADOW = `<filter id="ps" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.5"/></filter>`;

/** Banco da estação (2 tiles de largura). Textura 144x72 → 72x36 no mundo. */
export function propBench() {
  const defs = PROP_SHADOW + linear('wood', [[0, '#6e5236'], [1, '#4a3521']]);
  let s = `<rect x="12" y="16" width="128" height="48" rx="6" fill="#000" opacity=".5" filter="url(#ps)"/>`;
  s += `<rect x="12" y="14" width="10" height="44" rx="2" fill="#2d2f31"/><rect x="118" y="14" width="10" height="44" rx="2" fill="#2d2f31"/>`;
  for (let i = 0; i < 4; i++) {
    const y = 12 + i * 11.5;
    s += `<rect x="6" y="${y}" width="128" height="9" rx="2" fill="url(#wood)" stroke="#2a1d10" stroke-width="1"/>`;
    s += `<rect x="6" y="${y}" width="128" height="2" rx="1" fill="#8c6b49" opacity=".5"/>`;
    s += line([30 + i * 17, y + 4.5], [52 + i * 17, y + 4.5], '#3a2816', 0.8, 'opacity=".5"');
  }
  s += `<rect x="4" y="8" width="132" height="4" rx="2" fill="#3b3e41"/>`;
  return svgDoc(144, 72, defs, s);
}

/** Caixa de madeira (1 tile). Textura 80x80 → 40x40 no mundo. */
export function propCrate() {
  const defs = PROP_SHADOW + linear('cr', [[0, '#7d6443'], [1, '#56422a']], 0, 0, 1, 1);
  let s = `<rect x="12" y="14" width="62" height="62" rx="3" fill="#000" opacity=".55" filter="url(#ps)"/>`;
  s += `<rect x="8" y="8" width="60" height="60" rx="2" fill="url(#cr)" stroke="#2b1e10" stroke-width="2"/>`;
  for (let i = 1; i < 4; i++) s += line([8, 8 + i * 15], [68, 8 + i * 15], '#3b2a16', 1.4, 'opacity=".8"');
  s += `<rect x="8" y="8" width="60" height="60" rx="2" fill="none" stroke="#4a3620" stroke-width="7" opacity=".9"/>`;
  s += line([12, 12], [64, 64], '#4a3620', 7) + line([12, 12], [64, 64], '#8a6f4b', 1.4, 'opacity=".5"');
  for (const [x, y] of [[12, 12], [64, 12], [12, 64], [64, 64]]) s += `<circle cx="${x}" cy="${y}" r="1.6" fill="#1b1b1b"/>`;
  s += `<rect x="8" y="8" width="60" height="3" fill="#a08663" opacity=".35"/>`;
  return svgDoc(80, 80, defs, s);
}

/** Barril de metal enferrujado. Textura 72x72 → 36x36 no mundo. */
export function propBarrel() {
  const defs = PROP_SHADOW +
    radial('br', [[0, '#5d7182'], [0.7, '#3f4f5d'], [1, '#2a343d']], '38%', '35%') +
    radial('rust', [[0, '#6b3d1c', 0.8], [1, '#6b3d1c', 0]], '50%', '50%', '50%');
  let s = `<circle cx="38" cy="39" r="27" fill="#000" opacity=".55" filter="url(#ps)"/>`;
  s += `<circle cx="34" cy="34" r="26" fill="url(#br)" stroke="#161b20" stroke-width="2"/>`;
  s += `<circle cx="34" cy="34" r="20" fill="none" stroke="#2a343d" stroke-width="2"/>`;
  s += `<circle cx="34" cy="34" r="13" fill="none" stroke="#56687a" stroke-width="1.2" opacity=".6"/>`;
  s += `<circle cx="44" cy="26" r="3.5" fill="#1d242a" stroke="#6b7c8b" stroke-width="1"/>`;
  s += `<ellipse cx="24" cy="42" rx="10" ry="7" fill="url(#rust)"/><ellipse cx="42" cy="46" rx="6" ry="5" fill="url(#rust)"/>`;
  return svgDoc(72, 72, defs, s);
}

/** Lixeira pública. Textura 64x64 → 32x32 no mundo. */
export function propTrash() {
  const defs = PROP_SHADOW + linear('tb', [[0, '#4f5c47'], [1, '#34402f']], 0, 0, 1, 1);
  let s = `<rect x="10" y="12" width="48" height="48" rx="8" fill="#000" opacity=".55" filter="url(#ps)"/>`;
  s += `<rect x="7" y="7" width="46" height="46" rx="7" fill="url(#tb)" stroke="#1a2016" stroke-width="2"/>`;
  s += `<rect x="13" y="13" width="34" height="34" rx="4" fill="#232a1f"/>`;
  s += `<path d="${blobPath(30, 30, 13, 0.5, 9, rng(5))}" fill="#3a3a33"/>`;
  s += `<rect x="18" y="22" width="9" height="6" fill="#b9b3a0" opacity=".7" transform="rotate(-20 22 25)"/>`;
  s += `<rect x="28" y="30" width="8" height="5" fill="#8d4f33" opacity=".7"/>`;
  return svgDoc(64, 64, defs, s);
}

/** Mala abandonada (decorativa, sem colisão). Textura 64x48. */
export function propSuitcase() {
  const defs = PROP_SHADOW + linear('sc', [[0, '#5b2f2a'], [1, '#3b1d19']], 0, 0, 1, 1);
  let s = `<rect x="10" y="12" width="46" height="30" rx="4" fill="#000" opacity=".5" filter="url(#ps)"/>`;
  s += `<rect x="6" y="8" width="46" height="30" rx="4" fill="url(#sc)" stroke="#1f0f0c" stroke-width="1.5"/>`;
  s += `<rect x="22" y="3" width="14" height="6" rx="2" fill="none" stroke="#1f1f1f" stroke-width="2.5"/>`;
  s += line([6, 23], [52, 23], '#2a1411', 1.4) + `<rect x="10" y="10" width="38" height="3" fill="#7b4a42" opacity=".4"/>`;
  return svgDoc(64, 48, defs, s);
}

// ───────────────────────────── Decals ─────────────────────────────

/** Papéis espalhados no chão. 128x96. */
export function decalPapers() {
  const r = rng(31);
  let s = '';
  for (let i = 0; i < 7; i++) {
    const x = r.range(14, 100);
    const y = r.range(10, 70);
    const w = r.range(10, 18);
    const tone = r.pick(['#b8b3a3', '#a8a393', '#c4bfae', '#8e8a7d']);
    s += `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(w * 1.3)}" fill="${tone}" opacity=".75" transform="rotate(${f(r.range(-60, 60))} ${f(x)} ${f(y)})"/>`;
  }
  return svgDoc(128, 96, '', s);
}

/** Entulho e sujeira. 128x96. */
export function decalDebris() {
  const r = rng(47);
  const defs = radial('dirt', [[0, '#1a1712', 0.6], [1, '#1a1712', 0]], '50%', '50%', '50%');
  let s = `<ellipse cx="64" cy="48" rx="56" ry="38" fill="url(#dirt)"/>`;
  for (let i = 0; i < 14; i++) {
    s += `<path d="${blobPath(r.range(20, 108), r.range(18, 78), r.range(1.5, 5), 0.6, 6, r)}" fill="${r.pick(['#4d4b44', '#5a574f', '#34332e', '#6b665a'])}"/>`;
  }
  return svgDoc(128, 96, defs, s);
}

/** Respingos de sangue (3 variantes numa sheet de 96x96). */
export function decalBloodSplats() {
  const frames = [];
  for (let v = 0; v < 3; v++) {
    const r = rng(60 + v * 13);
    let s = `<path d="${blobPath(48, 48, r.range(12, 18), 0.6, 10, r)}" fill="#4d0b09" opacity=".9"/>`;
    for (let i = 0; i < 10; i++) {
      const a = r.range(0, Math.PI * 2);
      const d = r.range(18, 40);
      s += `<circle cx="${f(48 + Math.cos(a) * d)}" cy="${f(48 + Math.sin(a) * d)}" r="${f(r.range(1, 3.5))}" fill="#420907" opacity=".85"/>`;
    }
    frames.push(`<g transform="translate(${v * 96} 0)">${s}</g>`);
  }
  return svgDoc(288, 96, '', frames.join(''));
}

/** Poça de sangue sob os cadáveres. 160x128. */
export function decalBloodPool() {
  const r = rng(77);
  const defs = radial('bp', [[0, '#3b0705'], [0.75, '#300604'], [1, '#210403']], '45%', '45%', '60%');
  let s = `<path d="${blobPath(80, 64, 50, 0.45, 14, r)}" fill="url(#bp)" opacity=".92"/>`;
  s += `<path d="${blobPath(70, 58, 18, 0.5, 8, r)}" fill="#6a1511" opacity=".25"/>`;
  return svgDoc(160, 128, defs, s);
}
