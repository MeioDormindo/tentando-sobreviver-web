// Armas vistas de cima (apontando para +X) e poses de empunhadura do jogador.
import { f, line, linear, svgDoc } from './lib.mjs';

const STEEL = '#19191b';
const STEEL_LIGHT = '#45474c';
const POLYMER = '#23252a';
const WOOD = '#6b4526';
const WOOD_LIGHT = '#8a5d35';

// ───────────────────────────── Desenho das armas ─────────────────────────────

function pistolLocal(tint = STEEL) {
  return (
    `<rect x="-5" y="-3.4" width="26" height="6.8" rx="1.3" fill="${tint}"/>` +
    `<rect x="-3" y="-3.4" width="23" height="2.2" rx="1" fill="${STEEL_LIGHT}"/>` +
    `<rect x="19.5" y="-1.3" width="2.5" height="2.6" fill="#050505"/>` +
    `<rect x="-6" y="1.5" width="7" height="6" rx="1.5" fill="#222" transform="rotate(12 -2 4)"/>`
  );
}

/**
 * Arma longa em coordenadas locais: origem na traseira do receptor, eixo em +X.
 * spec: stock, receiver, guard (comprimentos), length (total até a boca), cores.
 */
function longGunLocal(spec) {
  const { stock, receiver, guard, length, body, furniture, thick = 7.5 } = spec;
  const h = thick / 2;
  let s = '';
  if (stock > 0) {
    s += `<path d="M0 ${-h + 0.5} L${-stock} ${-h - 0.5} Q${-stock - 2} 0 ${-stock} ${h + 0.5} L0 ${h - 0.5} Z" fill="${furniture}" stroke="#0b0b0b" stroke-width="0.8"/>`;
  }
  s += `<rect x="0" y="${-h}" width="${receiver}" height="${thick}" rx="1.2" fill="${body}" stroke="#0b0b0b" stroke-width="0.8"/>`;
  s += `<rect x="1" y="${-h}" width="${receiver - 2}" height="1.8" fill="${STEEL_LIGHT}" opacity=".7"/>`;
  s += `<rect x="${receiver}" y="${-h + 0.6}" width="${guard}" height="${thick - 1.2}" rx="1.5" fill="${furniture}" stroke="#0b0b0b" stroke-width="0.8"/>`;
  if (furniture === WOOD) s += line([receiver + 2, -1], [receiver + guard - 2, -1], WOOD_LIGHT, 1.2, 'opacity=".6"');
  s += `<rect x="${receiver + guard}" y="-1.5" width="${length - receiver - guard}" height="3" fill="${STEEL}"/>`;
  s += `<rect x="${length - 2}" y="-2" width="3" height="4" fill="#050505"/>`;
  // Mira no topo do receptor
  s += `<rect x="${receiver * 0.35}" y="-1.3" width="${receiver * 0.35}" height="2.6" rx="0.8" fill="#0d0d0e"/>`;
  return s;
}

export const GUN_SPECS = {
  smg: { stock: 8, receiver: 18, guard: 8, length: 36, body: POLYMER, furniture: POLYMER, thick: 7 },
  rifle: { stock: 16, receiver: 20, guard: 18, length: 52, body: STEEL, furniture: POLYMER },
  ak: { stock: 16, receiver: 20, guard: 16, length: 50, body: STEEL, furniture: WOOD },
  shotgun: { stock: 18, receiver: 14, guard: 16, length: 52, body: STEEL, furniture: WOOD, thick: 8 },
};

function place(x, y, angle, content) {
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(angle)})">${content}</g>`;
}

// ── Armas especiais (GDD §44), exclusivas da Mystery Box ──

/** Lança-granadas: cano grosso, tambor giratório e coronha. */
function launcherLocal() {
  let s = `<path d="M0 -3.5 L-14 -4.5 Q-16 0 -14 4.5 L0 3.5 Z" fill="#3b3f2e" stroke="#0b0b0b" stroke-width="0.8"/>`;
  s += `<rect x="0" y="-5" width="16" height="10" rx="2" fill="#2c3024" stroke="#0b0b0b" stroke-width="0.8"/>`;
  s += `<circle cx="9" cy="0" r="8" fill="#4a5038" stroke="#0b0b0b" stroke-width="1"/>`;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    s += `<circle cx="${(9 + Math.cos(a) * 4.5).toFixed(1)}" cy="${(Math.sin(a) * 4.5).toFixed(1)}" r="1.6" fill="#1a1c14"/>`;
  }
  s += `<rect x="16" y="-5.5" width="26" height="11" rx="3" fill="#353a2a" stroke="#0b0b0b" stroke-width="0.8"/>`;
  s += `<rect x="18" y="-5.5" width="22" height="2.2" fill="#6b7258" opacity=".7"/>`;
  s += `<circle cx="42" cy="0" r="4.2" fill="#0a0a0a"/>`;
  return s;
}

/** Lança-chamas: corpo, bico longo, cilindro de combustível e chama-piloto. */
function flamerLocal() {
  let s = `<rect x="-6" y="-3.5" width="22" height="7" rx="2" fill="#5a2a1c" stroke="#0b0b0b" stroke-width="0.8"/>`;
  s += `<rect x="2" y="3" width="16" height="9" rx="4" fill="#a8402a" stroke="#0b0b0b" stroke-width="0.8"/>`;
  s += `<rect x="4" y="4" width="12" height="2" fill="#e07a5a" opacity=".6"/>`;
  s += `<rect x="16" y="-2.5" width="28" height="5" rx="1.5" fill="#2a2a2c" stroke="#0b0b0b" stroke-width="0.8"/>`;
  for (const x of [22, 30, 38]) s += `<rect x="${x}" y="-3.2" width="2" height="6.4" fill="#4a4a4e"/>`;
  s += `<circle cx="45" cy="0" r="3" fill="#ffb347"/><circle cx="45.5" cy="0" r="1.5" fill="#fff2a0"/>`;
  return s;
}

/** Arc Gun: bobinas de cobre ao longo do cano e pontas azuis brilhantes. */
function arcLocal() {
  let s = `<path d="M0 -3 L-12 -4 Q-14 0 -12 4 L0 3 Z" fill="#23252a" stroke="#0b0b0b" stroke-width="0.8"/>`;
  s += `<rect x="0" y="-4.5" width="18" height="9" rx="2" fill="#2e3440" stroke="#0b0b0b" stroke-width="0.8"/>`;
  s += `<rect x="18" y="-2" width="24" height="4" fill="#1c1f24"/>`;
  for (let i = 0; i < 5; i++) s += `<rect x="${20 + i * 4.5}" y="-4.5" width="3" height="9" rx="1" fill="#b86b2a" stroke="#5a3010" stroke-width="0.6"/>`;
  s += `<circle cx="44" cy="-3" r="2.2" fill="#7fe7ff"/><circle cx="44" cy="3" r="2.2" fill="#7fe7ff"/>`;
  s += `<rect x="4" y="-1.5" width="10" height="3" rx="1" fill="#5ad0ff" opacity=".8"/>`;
  return s;
}

/** Energy Cannon: corpo largo futurista com núcleo ciano. */
function energyLocal() {
  let s = `<path d="M0 -5 L-12 -6 Q-15 0 -12 6 L0 5 Z" fill="#2a2f3a" stroke="#0b0b0b" stroke-width="0.8"/>`;
  s += `<path d="M0 -7 L34 -6 L42 -3 L42 3 L34 6 L0 7 Z" fill="#3a4250" stroke="#0b0b0b" stroke-width="1"/>`;
  s += `<rect x="4" y="-2.5" width="28" height="5" rx="2" fill="#0f1a22"/>`;
  s += `<rect x="6" y="-1.5" width="24" height="3" rx="1.5" fill="#6ff0ff"/>`;
  s += `<rect x="6" y="-6" width="20" height="1.8" fill="#8a96a8" opacity=".7"/>`;
  s += `<circle cx="44" cy="0" r="3.8" fill="#bff8ff" stroke="#2a6f80" stroke-width="1"/>`;
  return s;
}

// ── Armas do Hospital ──

/** Revólver .44: cano longo, tambor e cabo de madeira. */
function revolverLocal() {
  let s = `<path d="M-6 1 L-2 1 L0 9 L-5 10 Z" fill="${WOOD}" stroke="#0b0b0b" stroke-width="0.7"/>`;
  s += `<rect x="-4" y="-3.2" width="10" height="6.4" rx="1.2" fill="#8c8f94" stroke="#0b0b0b" stroke-width="0.8"/>`;
  s += `<circle cx="5" cy="0" r="4.6" fill="#6c6f74" stroke="#0b0b0b" stroke-width="0.8"/>`;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    s += `<circle cx="${(5 + Math.cos(a) * 2.6).toFixed(1)}" cy="${(Math.sin(a) * 2.6).toFixed(1)}" r="0.9" fill="#222"/>`;
  }
  s += `<rect x="9" y="-1.8" width="22" height="3.6" rx="0.8" fill="#9ea1a6" stroke="#0b0b0b" stroke-width="0.7"/>`;
  s += `<rect x="9" y="-1.8" width="22" height="1.1" fill="#e2e4e8" opacity=".5"/>`;
  s += `<rect x="30" y="-1.2" width="2" height="2.4" fill="#050505"/>`;
  return s;
}

/** Barrett .50: arma longa pesada com luneta grande e freio de boca. */
function sniperLocal() {
  let s = longGunLocal({ stock: 18, receiver: 24, guard: 14, length: 66, body: '#2e3238', furniture: '#1d2024', thick: 8 });
  s += `<rect x="4" y="-5.2" width="20" height="4.4" rx="2" fill="#15171a" stroke="#050505" stroke-width="0.6"/>`;
  s += `<circle cx="24" cy="-3" r="2.6" fill="#1d2d3a" stroke="#050505" stroke-width="0.6"/><circle cx="24" cy="-3" r="1.2" fill="#6fb6e8" opacity=".8"/>`;
  s += `<rect x="62" y="-3.2" width="6" height="6.4" rx="1" fill="#15171a"/>`;
  s += `<path d="M38 3 L34 11 M40 3 L44 11" stroke="#15171a" stroke-width="1.4"/>`;
  return s;
}

/** Uzi: compacta, carregador no punho. */
function uziLocal() {
  let s = `<rect x="-4" y="-3.6" width="22" height="7.2" rx="1.2" fill="${POLYMER}" stroke="#0b0b0b" stroke-width="0.7"/>`;
  s += `<rect x="-2" y="-3.6" width="18" height="2" fill="${STEEL_LIGHT}" opacity=".6"/>`;
  s += `<rect x="18" y="-1.3" width="7" height="2.6" fill="${STEEL}"/>`;
  s += `<rect x="4" y="2" width="4" height="9" rx="1" fill="#15161a"/>`;
  return s;
}

/** Minigun: seis canos em volta de um eixo, motor e caixa de munição. */
function minigunLocal() {
  let s = `<rect x="-8" y="-6" width="20" height="12" rx="3" fill="#3a3d42" stroke="#0b0b0b" stroke-width="0.9"/>`;
  s += `<rect x="-6" y="5" width="14" height="8" rx="2" fill="#4a5038" stroke="#0b0b0b" stroke-width="0.8"/>`;
  s += `<rect x="12" y="-5.5" width="36" height="11" rx="2" fill="#1d1f22"/>`;
  for (const y of [-4, -1.4, 1.4, 4]) s += `<rect x="12" y="${y - 0.9}" width="36" height="1.8" fill="#55595f"/>`;
  for (const x of [20, 34, 46]) s += `<rect x="${x}" y="-6.5" width="2.6" height="13" rx="1" fill="#2a2d31"/>`;
  s += `<circle cx="48" cy="0" r="5.5" fill="none" stroke="#0a0a0a" stroke-width="1.6"/>`;
  return s;
}

/** Canhão de Vento: boca em sino com turbina e aletas azuis brilhando. */
function windLocal() {
  let s = `<path d="M0 -4 L-12 -5 Q-15 0 -12 5 L0 4 Z" fill="#2a3440" stroke="#0b0b0b" stroke-width="0.8"/>`;
  s += `<rect x="0" y="-6" width="18" height="12" rx="3" fill="#39485a" stroke="#0b0b0b" stroke-width="0.9"/>`;
  s += `<path d="M18 -5 L34 -9 L44 -12 L44 12 L34 9 L18 5 Z" fill="#4c6078" stroke="#0b0b0b" stroke-width="1"/>`;
  for (const x of [22, 28, 34, 40]) s += `<path d="M${x} ${-6 - (x - 18) * 0.25} L${x} ${6 + (x - 18) * 0.25}" stroke="#9fe8ff" stroke-width="1.2" opacity=".75"/>`;
  s += `<ellipse cx="44" cy="0" rx="3" ry="12" fill="#0f1a22" stroke="#bff4ff" stroke-width="1.2"/>`;
  s += `<circle cx="9" cy="0" r="3.2" fill="#9fe8ff"/>`;
  return s;
}

const SPECIAL_DRAW = {
  launcher: launcherLocal, flamer: flamerLocal, arc: arcLocal, energy: energyLocal,
  revolver: revolverLocal, sniper: sniperLocal, akimbo: uziLocal, lmg: minigunLocal, wind: windLocal,
};

/** Desenha a arma do tipo `kind` na posição/ângulo dados (coordenadas do frame). */
export function drawGun(kind, x, y, angle) {
  if (kind === 'pistol') return place(x, y, angle, pistolLocal());
  if (SPECIAL_DRAW[kind]) return place(x, y, angle, SPECIAL_DRAW[kind]());
  return place(x, y, angle, longGunLocal(GUN_SPECS[kind]));
}

// ───────────────────────────── Poses ─────────────────────────────

/** Poses da pistola (frames: mirando, recuo, 5 de recarga). */
const PISTOL_POSES = [
  { left: [91, 60.5], right: [93, 66.5], gun: [92, 64, 0] },
  { left: [86, 60], right: [88, 66], gun: [87, 63.5, -9] },
  { left: [80, 84], right: [86, 71], gun: [85, 70, 38] },
  { left: [67, 93], right: [86, 71], gun: [85, 70, 38], mag: true },
  { left: [78, 86], right: [86, 71], gun: [85, 70, 38], mag: true },
  { left: [86, 75], right: [86, 71], gun: [85, 70, 38], mag: true },
  { left: [97, 61], right: [90, 67], gun: [89, 65.5, 8] },
];

/** Posições locais das mãos em cada arma longa (ao longo do eixo da arma). */
const GRIPS = {
  smg: { origin: [74, 71], right: 8, left: 22 },
  rifle: { origin: [70, 72], right: 9, left: 30 },
  ak: { origin: [70, 72], right: 9, left: 28 },
  shotgun: { origin: [70, 72], right: 7, left: 22 },
  launcher: { origin: [70, 72], right: 8, left: 26 },
  flamer: { origin: [72, 72], right: 8, left: 24 },
  arc: { origin: [70, 72], right: 8, left: 26 },
  energy: { origin: [70, 72], right: 9, left: 28 },
  sniper: { origin: [68, 72], right: 10, left: 34 },
  lmg: { origin: [68, 73], right: 6, left: 24 },
  wind: { origin: [70, 72], right: 8, left: 22 },
};

function onGun(origin, angleDeg, along, across) {
  const a = (angleDeg * Math.PI) / 180;
  return [origin[0] + Math.cos(a) * along - Math.sin(a) * across, origin[1] + Math.sin(a) * along + Math.cos(a) * across];
}

function longGunPoses(kind) {
  const g = GRIPS[kind];
  const pose = (dx, angle, leftOverride, mag = false) => {
    const origin = [g.origin[0] + dx, g.origin[1]];
    return {
      gun: [origin[0], origin[1], angle],
      right: onGun(origin, angle, g.right, 2.5),
      left: leftOverride ?? onGun(origin, angle, g.left, -2),
      mag,
    };
  };
  return [
    pose(0, -2),
    pose(-4, -6),
    pose(-2, 22, [82, 84]),
    pose(-2, 22, [68, 93], kind !== 'shotgun'),
    pose(-2, 22, [78, 86], kind !== 'shotgun'),
    pose(-2, 22, [83, 80], kind !== 'shotgun'),
    pose(0, 4, onGun([g.origin[0], g.origin[1]], 4, g.left - 6, -3)),
  ];
}

/**
 * Duas Uzis, uma em cada mão (mirando, recuo e recarga). `gun2` é a arma da mão esquerda.
 */
const AKIMBO_POSES = [
  { left: [88, 55], right: [88, 73], gun: [86, 73, 2], gun2: [86, 55, -2] },
  { left: [84, 55], right: [84, 73], gun: [82, 73, -4], gun2: [82, 55, 4] },
  { left: [80, 60], right: [82, 76], gun: [80, 76, 40], gun2: [78, 60, -40] },
  { left: [74, 62], right: [80, 78], gun: [78, 78, 50], gun2: [72, 62, -50], mag: true },
  { left: [78, 60], right: [82, 76], gun: [80, 76, 40], gun2: [76, 60, -40], mag: true },
  { left: [84, 57], right: [84, 75], gun: [82, 75, 20], gun2: [82, 57, -20] },
  { left: [88, 56], right: [88, 72], gun: [86, 72, 4], gun2: [86, 56, -4] },
];

export const WEAPON_KINDS = ['pistol', 'smg', 'rifle', 'ak', 'shotgun', 'launcher', 'flamer', 'arc', 'energy', 'revolver', 'sniper', 'akimbo', 'lmg', 'wind'];

export function posesFor(kind) {
  if (kind === 'pistol' || kind === 'revolver') return PISTOL_POSES;
  if (kind === 'akimbo') return AKIMBO_POSES;
  return longGunPoses(kind);
}

// ───────────────────────────── Pontos de compra ─────────────────────────────

const CASE_SHADOW = `<filter id="cs" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3"/></filter>`;

/** Maleta aberta com a arma à vista. 128x72 → 64x36 no mundo. */
export function weaponCase(kind) {
  const defs = CASE_SHADOW + linear('cf', [[0, '#4a4f47'], [1, '#33372f']]);
  let s = `<rect x="12" y="14" width="110" height="52" rx="5" fill="#000" opacity=".55" filter="url(#cs)"/>`;
  s += `<rect x="6" y="8" width="112" height="54" rx="5" fill="#3a3f36" stroke="#141612" stroke-width="2"/>`;
  s += `<rect x="11" y="13" width="102" height="44" rx="3" fill="url(#cf)"/>`;
  // espuma recortada
  for (let i = 0; i < 9; i++) s += `<circle cx="${18 + i * 11}" cy="50" r="2" fill="#141512" opacity=".6"/>`;
  s += `<rect x="4" y="30" width="4" height="10" rx="1" fill="#6d6f69"/><rect x="116" y="30" width="4" height="10" rx="1" fill="#6d6f69"/>`;
  const small = kind === 'pistol' || kind === 'revolver' || kind === 'akimbo';
  const gx = small ? 46 : kind === 'smg' ? 42 : kind === 'sniper' ? 30 : 36;
  const scale = small ? 1.3 : kind === 'sniper' ? 0.95 : 1;
  // Duas Uzis lado a lado na maleta
  const guns = kind === 'akimbo' ? drawGun(kind, 0, -7, 0) + drawGun(kind, 6, 7, 0) : drawGun(kind, 0, 0, 0);
  s += `<g transform="translate(${gx} 35) scale(${scale})">${guns}</g>`;
  s += `<rect x="6" y="8" width="112" height="3" rx="1.5" fill="#6a7063" opacity=".6"/>`;
  return svgDoc(128, 72, defs, s);
}

/** Caixa de munição aberta com cartuchos. 80x64 → 40x32 no mundo. */
export function ammoCrate() {
  const defs = CASE_SHADOW + linear('ac', [[0, '#4d5a38'], [1, '#34402a']], 0, 0, 1, 1);
  let s = `<rect x="12" y="14" width="62" height="46" rx="3" fill="#000" opacity=".55" filter="url(#cs)"/>`;
  s += `<rect x="6" y="8" width="64" height="48" rx="3" fill="url(#ac)" stroke="#1a2012" stroke-width="2"/>`;
  s += `<rect x="12" y="14" width="52" height="36" rx="2" fill="#1c2016"/>`;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 7; c++) {
      const x = 17 + c * 7;
      const y = 19 + r * 10;
      s += `<circle cx="${x}" cy="${y}" r="3" fill="#b8903a" stroke="#6b5220" stroke-width="0.8"/>`;
      s += `<circle cx="${x - 0.8}" cy="${y - 0.8}" r="1" fill="#f0d27a"/>`;
    }
  }
  s += `<rect x="6" y="8" width="64" height="3" fill="#7d8a5e" opacity=".5"/>`;
  s += `<rect x="26" y="52" width="24" height="4" fill="#d4b04a" opacity=".8"/>`;
  return svgDoc(80, 64, defs, s);
}
