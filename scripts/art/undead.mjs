// Mortos-vivos vistos de cima (virados para +X), desenhados do zero com anatomia simples:
// pernas em passada, tronco com ombros, braços cônicos com cotovelo, mãos em garra e
// cabeça caída para a frente mostrando testa, olhos, nariz e mandíbula aberta.
import { blobPath, f, ik, rng } from './lib.mjs';

const OUT = '#0e0f0c';

// ───────────────────────────── Primitivas ─────────────────────────────

const pt = (p) => `${f(p[0])} ${f(p[1])}`;

/** Membro cônico de a até b (larguras w1 → w2), com pontas arredondadas. */
export function limb(a, b, w1, w2, fill, stroke = OUT, sw = 1.4, extra = '') {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const a1 = [a[0] + (nx * w1) / 2, a[1] + (ny * w1) / 2];
  const a2 = [a[0] - (nx * w1) / 2, a[1] - (ny * w1) / 2];
  const b1 = [b[0] + (nx * w2) / 2, b[1] + (ny * w2) / 2];
  const b2 = [b[0] - (nx * w2) / 2, b[1] - (ny * w2) / 2];
  const d = `M${pt(a1)} L${pt(b1)} A${f(w2 / 2)} ${f(w2 / 2)} 0 0 0 ${pt(b2)} L${pt(a2)} A${f(w1 / 2)} ${f(w1 / 2)} 0 0 0 ${pt(a1)} Z`;
  return `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" ${extra}/>`;
}

const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const angle = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);
const polar = (p, ang, d) => [p[0] + Math.cos(ang) * d, p[1] + Math.sin(ang) * d];

/** Contorno suave passando pelos pontos (curva fechada). */
function smoothClosed(points) {
  const n = points.length;
  let d = '';
  for (let i = 0; i < n; i++) {
    const p = points[i];
    const q = points[(i + 1) % n];
    const mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    d += i === 0 ? `M${pt(mid)}` : '';
    const r = points[(i + 2) % n];
    d += ` Q${pt(q)} ${pt([(q[0] + r[0]) / 2, (q[1] + r[1]) / 2])}`;
  }
  return d + ' Z';
}

// ───────────────────────────── Paletas ─────────────────────────────

/**
 * Variantes (GDD §55). outfit: roupa comum / moletom / colete refletivo / farrapos /
 * blindado / inchado. Pele esverdeada acinzentada em tons diferentes.
 */
export const UNDEAD = {
  a: { outfit: 'office', cloth: '#b9b4a2', clothShade: '#7d786a', accent: '#6a1f1c', pants: '#2f343c', pantsShade: '#1f2228', shoes: '#1b1714', skin: '#8a9478', skinShade: '#58604b', skinDark: '#3a4031', hair: '#2b241c', seed: 11, hairStyle: 'short' },
  b: { outfit: 'hoodie', cloth: '#3f5570', clothShade: '#26354a', accent: '#8a9ab0', pants: '#3b3a36', pantsShade: '#262522', shoes: '#2a2620', skin: '#7f8a6f', skinShade: '#525b46', skinDark: '#353b2d', hair: '#5a4630', seed: 23, hairStyle: 'hood' },
  c: { outfit: 'vest', cloth: '#5a5d52', clothShade: '#393b33', accent: '#d8892a', pants: '#34404f', pantsShade: '#222a35', shoes: '#1d1a17', skin: '#8e977c', skinShade: '#5c6450', skinDark: '#3c4234', hair: '#1d1a17', seed: 37, hairStyle: 'bald' },
  runner: { outfit: 'rags', cloth: '#6e3530', clothShade: '#431e1b', accent: '#2a0a08', pants: '#2c2e33', pantsShade: '#1b1c20', shoes: '#1a1614', skin: '#7a8466', skinShade: '#4d5540', skinDark: '#30362a', hair: '#15120f', seed: 53, hairStyle: 'long', thin: true },
  tank: { outfit: 'armor', cloth: '#454a3e', clothShade: '#2b2f26', accent: '#b8932a', pants: '#383c33', pantsShade: '#23261f', shoes: '#191714', skin: '#7d8770', skinShade: '#4f5745', skinDark: '#343a2d', hair: '#1d1a17', seed: 67, hairStyle: 'helmet', bulk: 1.3 },
  // ── Hospital Santa Luzia: mesmos tipos, roupas do hospital ──
  // Paciente de camisola (walker)
  h_a: { outfit: 'gown', cloth: '#9fb4bf', clothShade: '#6d8290', accent: '#d8e2e8', pants: '#7c866f', pantsShade: '#555d4b', shoes: '#9aa0a0', skin: '#8a9478', skinShade: '#58604b', skinDark: '#3a4031', hair: '#2b241c', seed: 113, hairStyle: 'short' },
  // Enfermeira de uniforme verde (walker)
  h_b: { outfit: 'scrubs', cloth: '#4f8a7a', clothShade: '#2f5a4e', accent: '#d8e2e0', pants: '#467b6c', pantsShade: '#2c5147', shoes: '#d0d4cf', skin: '#7f8a6f', skinShade: '#525b46', skinDark: '#353b2d', hair: '#5a4630', seed: 127, hairStyle: 'long' },
  // Médico de jaleco (walker)
  h_c: { outfit: 'labcoat', cloth: '#cfd3cc', clothShade: '#8f958c', accent: '#2e86c1', pants: '#2f343c', pantsShade: '#1f2228', shoes: '#1b1714', skin: '#8e977c', skinShade: '#5c6450', skinDark: '#3c4234', hair: '#8a8a82', seed: 139, hairStyle: 'short' },
  // Paciente magro de camisola rasgada (runner)
  h_runner: { outfit: 'gown', cloth: '#b7a9b8', clothShade: '#7e7080', accent: '#e2d8e2', pants: '#7a8466', pantsShade: '#4d5540', shoes: '#7a8466', skin: '#7a8466', skinShade: '#4d5540', skinDark: '#30362a', hair: '#15120f', seed: 151, hairStyle: 'long', thin: true },
  // Segurança do hospital, enorme, com colete (tank)
  h_tank: { outfit: 'security', cloth: '#26324a', clothShade: '#161e2e', accent: '#c9a227', pants: '#1f2533', pantsShade: '#141822', shoes: '#111', skin: '#7d8770', skinShade: '#4f5745', skinDark: '#343a2d', hair: '#1d1a17', seed: 163, hairStyle: 'bald', bulk: 1.3 },
  // Paciente inchado ligado ao soro (exploder)
  h_exploder: { outfit: 'bloated', cloth: '#9fb4bf', clothShade: '#6d8290', accent: '#d7e04a', pants: '#96a466', pantsShade: '#63703f', shoes: '#96a466', skin: '#96a466', skinShade: '#63703f', skinDark: '#3f4a27', hair: '#1d1a17', seed: 179, hairStyle: 'bald', bloat: true },
  // ── Inimigos novos do Hospital ──
  // Rastejante: paciente sem pernas, camisola rasgada (desenhado por beasts.mjs)
  crawler: { outfit: 'gown', cloth: '#8ea1ab', clothShade: '#5d707b', accent: '#d8e2e8', pants: '#5d6650', pantsShade: '#3a4031', shoes: '#5d6650', skin: '#737d62', skinShade: '#4a5240', skinDark: '#2f3428', hair: '#15120f', seed: 191, hairStyle: 'long' },
  // Cuspidor: paciente com bolsas de ácido inchadas na garganta
  spitter: { outfit: 'gown', cloth: '#a8b39a', clothShade: '#6f7a62', accent: '#c8ff5a', pants: '#7c8a55', pantsShade: '#4f5a32', shoes: '#7c8a55', skin: '#8a9a5a', skinShade: '#5a6838', skinDark: '#394224', hair: '#1d1a17', seed: 203, hairStyle: 'bald', spitter: true },
  // Blindado: tropa de choque do hospital com colete e capacete com viseira
  armored: { outfit: 'riot', cloth: '#1f242b', clothShade: '#101317', accent: '#e8e2c8', pants: '#1c2026', pantsShade: '#111418', shoes: '#0b0c0d', skin: '#7d8770', skinShade: '#4f5745', skinDark: '#343a2d', hair: '#1d1a17', seed: 217, hairStyle: 'riot', bulk: 1.15 },
  // Blindado depois que a armadura caiu: camisa rasgada, sem capacete
  armored_broken: { outfit: 'security', cloth: '#26324a', clothShade: '#161e2e', accent: '#c9a227', pants: '#1c2026', pantsShade: '#111418', shoes: '#0b0c0d', skin: '#7d8770', skinShade: '#4f5745', skinDark: '#343a2d', hair: '#1d1a17', seed: 229, hairStyle: 'bald', bulk: 1.15 },
  exploder: { outfit: 'bloated', cloth: '#5a6440', clothShade: '#383f27', accent: '#d7e04a', pants: '#3a3a2c', pantsShade: '#23231a', shoes: '#1d1a17', skin: '#96a466', skinShade: '#63703f', skinDark: '#3f4a27', hair: '#1d1a17', seed: 79, hairStyle: 'bald', bloat: true },
};

export function undeadDefs(v, id) {
  return (
    `<radialGradient id="uc${id}" cx="38%" cy="30%" r="80%"><stop offset="0" stop-color="${v.cloth}"/><stop offset=".65" stop-color="${v.cloth}"/><stop offset="1" stop-color="${v.clothShade}"/></radialGradient>` +
    `<radialGradient id="uk${id}" cx="40%" cy="32%" r="75%"><stop offset="0" stop-color="${v.skin}"/><stop offset=".7" stop-color="${v.skinShade}"/><stop offset="1" stop-color="${v.skinDark}"/></radialGradient>` +
    `<radialGradient id="ub${id}" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#5c0d0a" stop-opacity=".95"/><stop offset=".55" stop-color="#3f0806" stop-opacity=".8"/><stop offset="1" stop-color="#3f0806" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="up${id}" cx="45%" cy="40%" r="55%"><stop offset="0" stop-color="#fff8b0"/><stop offset=".35" stop-color="#e2ea52"/><stop offset=".75" stop-color="#94ad2c" stop-opacity=".9"/><stop offset="1" stop-color="#4f5a32" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="um${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8a9097"/><stop offset="1" stop-color="#4c5157"/></linearGradient>` +
    `<radialGradient id="ug${id}" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff2c0"/><stop offset="1" stop-color="#ffd060" stop-opacity="0"/></radialGradient>`
  );
}

// ───────────────────────────── Partes do corpo ─────────────────────────────

/** Perna com calça (coxa → canela) e sapato; `drag` arrasta o pé virado para dentro. */
function leg(v, hip, foot, side, drag = 0) {
  const knee = lerp(hip, foot, 0.5);
  knee[1] += side * 1.5;
  const w = v.thin ? 8 : v.bulk ? 11.5 : 9.5;
  let s = limb(hip, knee, w + 1, w - 0.5, v.pantsShade);
  s += limb(knee, foot, w - 0.5, w - 2, v.pants);
  // barra rasgada
  const cuff = lerp(knee, foot, 0.72);
  s += `<path d="${blobPath(cuff[0], cuff[1], w * 0.42, 0.7, 6, rng(Math.round(hip[1] * 7)))}" fill="${v.pantsShade}"/>`;
  // sapato (bico para a frente; arrastado vira para dentro)
  const rot = drag * side * -25;
  s += `<g transform="rotate(${f(rot)} ${pt(foot)})"><ellipse cx="${f(foot[0] + 3.5)}" cy="${f(foot[1])}" rx="7.8" ry="${f(w * 0.48)}" fill="${v.shoes}" stroke="${OUT}" stroke-width="1.2"/>` +
    `<ellipse cx="${f(foot[0] + 5)}" cy="${f(foot[1] - 1.2)}" rx="3.5" ry="1.4" fill="#fff" opacity=".08"/></g>`;
  return s;
}

/** Braço: manga (rasgada no cotovelo), antebraço com veias/osso e mão em garra. */
function arm(v, r, shoulder, hand, bend, opts = {}) {
  const upper = opts.upper ?? 18;
  const fore = opts.fore ?? 19;
  const k = opts.scale ?? 1;
  const { elbow, hand: h } = ik(shoulder, hand, upper, fore, bend);
  const w = (v.thin ? 6.2 : v.bulk ? 9.5 : 7.4) * k;
  const sleeveEnd = lerp(elbow, h, opts.sleeve ?? 0.18);
  let s = '';
  // antebraço (pele)
  s += limb(elbow, h, w * 0.92, w * 0.72, `url(#uk${opts.id})`);
  // veias escuras e osso exposto num dos braços
  const mid = lerp(elbow, h, 0.55);
  s += `<path d="M${pt(lerp(elbow, h, 0.25))} Q${pt([mid[0] + 1.5, mid[1] - 1])} ${pt(lerp(elbow, h, 0.85))}" stroke="${v.skinDark}" stroke-width=".9" fill="none" opacity=".75"/>`;
  if (opts.bone) {
    const b0 = lerp(elbow, h, 0.35);
    const b1 = lerp(elbow, h, 0.7);
    s += limb(b0, b1, 3.4, 2.8, '#ddd6bf', '#6f6a58', 0.9);
    s += `<path d="${blobPath(b0[0], b0[1], 3.4, 0.6, 6, r)}" fill="#6a1512"/>`;
  }
  // manga
  if (!opts.bare) {
    s += limb(shoulder, sleeveEnd, w * 1.3, w * 1.08, opts.sleeveFill ?? `url(#uc${opts.id})`);
    // borda esfarrapada da manga
    const ang = angle(elbow, h);
    for (const off of [-0.45, 0, 0.45]) {
      const p = polar(sleeveEnd, ang + Math.PI / 2, off * w * 1.2);
      s += `<path d="M${pt(polar(p, ang + Math.PI / 2, -1.6))} L${pt(polar(p, ang, 3.2))} L${pt(polar(p, ang + Math.PI / 2, 1.6))} Z" fill="${v.clothShade}"/>`;
    }
  } else {
    s += limb(shoulder, elbow, w * 1.1, w * 0.95, `url(#uk${opts.id})`);
  }
  // mão: palma + quatro dedos em garra com unhas escuras
  const ang = angle(elbow, h);
  const palm = polar(h, ang, 1.5);
  for (const [sp, len] of [[-0.62, 6.5], [-0.2, 8], [0.2, 8.2], [0.6, 6.8]]) {
    const a = ang + sp;
    const knuckle = polar(palm, a, 3.4 * k);
    const tipA = polar(knuckle, a + 0.35 * Math.sign(sp || 1), len * 0.55 * k);
    s += `<path d="M${pt(palm)} L${pt(knuckle)} L${pt(tipA)}" stroke="${OUT}" stroke-width="${f(3.3 * k)}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
    s += `<path d="M${pt(palm)} L${pt(knuckle)} L${pt(tipA)}" stroke="${v.skinShade}" stroke-width="${f(1.9 * k)}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
    s += `<circle cx="${f(tipA[0])}" cy="${f(tipA[1])}" r="${f(0.9 * k)}" fill="#1a1510"/>`;
  }
  // polegar
  const thumb = polar(palm, ang - Math.sign(bend) * 1.3, 4.5 * k);
  s += `<path d="M${pt(palm)} L${pt(thumb)}" stroke="${OUT}" stroke-width="${f(3.4 * k)}" stroke-linecap="round"/><path d="M${pt(palm)} L${pt(thumb)}" stroke="${v.skinShade}" stroke-width="${f(2 * k)}" stroke-linecap="round"/>`;
  s += `<ellipse cx="${f(palm[0])}" cy="${f(palm[1])}" rx="${f(4.4 * k)}" ry="${f(3.8 * k)}" transform="rotate(${f((ang * 180) / Math.PI)} ${pt(palm)})" fill="${v.skin}" stroke="${OUT}" stroke-width="1.1"/>`;
  if (opts.bloodyHand) s += `<circle cx="${f(palm[0] + 1)}" cy="${f(palm[1] + 0.5)}" r="2.2" fill="#5a0d0a" opacity=".85"/>`;
  return s;
}

/**
 * Tronco visto de cima: costas arredondadas (esquerda), peito (direita) e deltoides
 * marcados nos ombros. w = meia largura (ombro a ombro no eixo Y), d = meia profundidade.
 */
function torsoPath(cx, cy, w, d, r, ragged = 0.08) {
  const pts = [
    [cx - d * 0.95, cy - w * 0.55], [cx - d * 0.55, cy - w * 0.95], [cx + d * 0.05, cy - w * 1.02],
    [cx + d * 0.6, cy - w * 0.86], [cx + d * 0.95, cy - w * 0.4], [cx + d * 1.02, cy],
    [cx + d * 0.95, cy + w * 0.4], [cx + d * 0.6, cy + w * 0.86], [cx + d * 0.05, cy + w * 1.02],
    [cx - d * 0.55, cy + w * 0.95], [cx - d * 0.95, cy + w * 0.55], [cx - d * 1.05, cy],
  ].map((p, i) => (i % 2 === 0 ? [p[0] + r.range(-ragged, ragged) * d, p[1] + r.range(-ragged, ragged) * w] : p));
  return smoothClosed(pts);
}

function clothingDetails(v, id, cx, cy, w, d, r) {
  let s = '';
  // dobras/costuras e sombra das costas
  s += `<path d="M${f(cx - d * 0.35)} ${f(cy - w * 0.8)} Q${f(cx - d * 0.6)} ${f(cy)} ${f(cx - d * 0.35)} ${f(cy + w * 0.8)}" stroke="${v.clothShade}" stroke-width="1.4" fill="none" opacity=".7"/>`;
  s += `<path d="M${f(cx - d * 0.9)} ${f(cy - w * 0.45)} Q${f(cx - d * 1.05)} ${f(cy)} ${f(cx - d * 0.9)} ${f(cy + w * 0.45)}" stroke="#000" stroke-width="3" fill="none" opacity=".18"/>`;
  if (v.outfit === 'office') {
    // colarinho, gravata solta e mancha de sangue no peito
    s += `<path d="M${f(cx + d * 0.55)} ${f(cy - 6)} L${f(cx + d * 0.85)} ${f(cy)} L${f(cx + d * 0.55)} ${f(cy + 6)}" stroke="${v.clothShade}" stroke-width="2" fill="none"/>`;
    s += `<path d="M${f(cx + d * 0.7)} ${f(cy - 1.5)} L${f(cx + d * 0.25)} ${f(cy + 3)} L${f(cx + d * 0.2)} ${f(cy + 0.5)} Z" fill="${v.accent}" stroke="${OUT}" stroke-width=".8"/>`;
  } else if (v.outfit === 'hoodie') {
    // capuz caído nas costas e bolso canguru
    s += `<path d="${blobPath(cx - d * 0.55, cy, w * 0.42, 0.25, 8, r)}" fill="${v.clothShade}" stroke="${OUT}" stroke-width="1"/>`;
    s += `<path d="${blobPath(cx - d * 0.52, cy, w * 0.25, 0.3, 7, r)}" fill="#161d27" opacity=".8"/>`;
    s += `<path d="M${f(cx + d * 0.4)} ${f(cy - 5)} L${f(cx + d * 0.9)} ${f(cy - 3)}" stroke="${v.accent}" stroke-width="1" opacity=".6"/>`;
  } else if (v.outfit === 'vest') {
    // colete refletivo laranja com faixas prateadas
    for (const sgn of [-1, 1]) {
      s += `<path d="M${f(cx - d * 0.7)} ${f(cy + sgn * w * 0.25)} L${f(cx + d * 0.75)} ${f(cy + sgn * w * 0.3)} L${f(cx + d * 0.6)} ${f(cy + sgn * w * 0.82)} L${f(cx - d * 0.45)} ${f(cy + sgn * w * 0.85)} Z" fill="${v.accent}" opacity=".95"/>`;
      s += `<path d="M${f(cx - d * 0.1)} ${f(cy + sgn * w * 0.3)} L${f(cx - d * 0.05)} ${f(cy + sgn * w * 0.84)}" stroke="#d8dcd0" stroke-width="2.4" opacity=".8"/>`;
    }
  } else if (v.outfit === 'gown') {
    // camisola hospitalar: estampa de bolinhas e amarras soltas nas costas
    const dots = rng(v.seed + 3);
    for (let i = 0; i < 16; i++) s += `<circle cx="${f(cx + dots.range(-d * 0.8, d * 0.8))}" cy="${f(cy + dots.range(-w * 0.85, w * 0.85))}" r="1.1" fill="${v.accent}" opacity=".6"/>`;
    for (const sgn of [-1, 1]) s += `<path d="M${f(cx - d * 0.95)} ${f(cy + sgn * 3)} q-6 ${f(sgn * 2)} -9 ${f(sgn * 6)}" stroke="${v.clothShade}" stroke-width="1.4" fill="none"/>`;
    // pulseira de identificação
    s += `<path d="M${f(cx + d * 0.2)} ${f(cy - w * 0.95)} l4 -1" stroke="#f4efe2" stroke-width="2"/>`;
  } else if (v.outfit === 'scrubs') {
    // gola em V, bolso no peito com caneta
    s += `<path d="M${f(cx + d * 0.5)} ${f(cy - 7)} L${f(cx + d * 0.95)} ${f(cy)} L${f(cx + d * 0.5)} ${f(cy + 7)}" stroke="${v.clothShade}" stroke-width="2" fill="none"/>`;
    s += `<rect x="${f(cx + d * 0.05)}" y="${f(cy - w * 0.62)}" width="7" height="6" fill="${v.clothShade}" opacity=".8"/>`;
    s += `<path d="M${f(cx + d * 0.1)} ${f(cy - w * 0.62)} l0 -3" stroke="${v.accent}" stroke-width="1.4"/>`;
  } else if (v.outfit === 'labcoat') {
    // jaleco branco aberto: lapelas, crachá e estetoscópio no pescoço
    for (const sgn of [-1, 1]) s += `<path d="M${f(cx + d * 0.85)} ${f(cy + sgn * 2)} L${f(cx + d * 0.1)} ${f(cy + sgn * w * 0.55)}" stroke="${v.clothShade}" stroke-width="2.2"/>`;
    s += `<path d="M${f(cx + d * 0.85)} ${f(cy)} L${f(cx - d * 0.2)} ${f(cy)}" stroke="#3a4b5c" stroke-width="3" opacity=".8"/>`;
    s += `<path d="M${f(cx + d * 0.7)} ${f(cy - w * 0.4)} Q${f(cx + d * 0.1)} ${f(cy)} ${f(cx + d * 0.7)} ${f(cy + w * 0.4)}" stroke="#20262b" stroke-width="1.6" fill="none"/>`;
    s += `<circle cx="${f(cx + d * 0.1)}" cy="${f(cy + 1)}" r="2.2" fill="#9aa3a8"/>`;
    s += `<rect x="${f(cx + d * 0.2)}" y="${f(cy + w * 0.5)}" width="6" height="8" rx="1" fill="${v.accent}"/>`;
  } else if (v.outfit === 'security') {
    // camisa escura com distintivo, rádio no ombro e cinto de utilidades
    s += `<path d="M${f(cx + d * 0.1)} ${f(cy - w * 0.62)} l3 2 l-3 2 l-3 -2 Z" fill="${v.accent}"/>`;
    s += `<rect x="${f(cx - d * 0.2)}" y="${f(cy + w * 0.62)}" width="7" height="5" rx="1" fill="#111"/>`;
    s += `<path d="M${f(cx - d * 0.95)} ${f(cy - w * 0.9)} L${f(cx - d * 0.95)} ${f(cy + w * 0.9)}" stroke="#3a2a16" stroke-width="3"/>`;
    // colete à prova de facada
    for (const sgn of [-1, 1]) s += `<path d="M${f(cx - d * 0.6)} ${f(cy + sgn * w * 0.2)} L${f(cx + d * 0.6)} ${f(cy + sgn * w * 0.25)} L${f(cx + d * 0.5)} ${f(cy + sgn * w * 0.8)} L${f(cx - d * 0.4)} ${f(cy + sgn * w * 0.82)} Z" fill="#1a1f29" opacity=".85"/>`;
  } else if (v.outfit === 'riot') {
    // colete de choque: placas grossas, ombreiras e a palavra SEGURANÇA nas costas
    for (const sgn of [-1, 1]) {
      s += `<path d="M${f(cx - d * 0.75)} ${f(cy + sgn * w * 0.15)} L${f(cx + d * 0.8)} ${f(cy + sgn * w * 0.2)} L${f(cx + d * 0.65)} ${f(cy + sgn * w * 0.9)} L${f(cx - d * 0.6)} ${f(cy + sgn * w * 0.92)} Z" fill="#2a3038" stroke="#07080a" stroke-width="1.4"/>`;
      s += `<ellipse cx="${f(cx + d * 0.1)}" cy="${f(cy + sgn * w * 0.98)}" rx="${f(d * 0.45)}" ry="${f(w * 0.26)}" fill="#353c45" stroke="#07080a" stroke-width="1.3"/>`;
    }
    s += `<rect x="${f(cx - d * 0.85)}" y="${f(cy - 3)}" width="${f(d * 0.5)}" height="6" fill="${v.accent}" opacity=".7"/>`;
  } else if (v.outfit === 'rags') {
    // camiseta em farrapos: costelas aparecendo
    s += `<path d="${blobPath(cx + d * 0.3, cy + w * 0.1, w * 0.45, 0.5, 9, r)}" fill="url(#uk${id})"/>`;
    for (let i = -2; i <= 2; i++) s += `<path d="M${f(cx + d * 0.05)} ${f(cy + w * 0.1 + i * 3.4)} Q${f(cx + d * 0.35)} ${f(cy + w * 0.1 + i * 3.4 - 1.2)} ${f(cx + d * 0.62)} ${f(cy + w * 0.1 + i * 3.4)}" stroke="${v.skinDark}" stroke-width="1" fill="none"/>`;
  }
  // rasgos com pele por baixo
  for (let i = 0; i < 3; i++) {
    const p = [cx + r.range(-d * 0.6, d * 0.6), cy + r.range(-w * 0.7, w * 0.7)];
    s += `<path d="${blobPath(p[0], p[1], r.range(2.2, 3.8), 0.7, 7, r)}" fill="url(#uk${id})" stroke="${v.clothShade}" stroke-width=".6"/>`;
  }
  // sangue
  for (let i = 0; i < (v.outfit === 'rags' ? 6 : 4); i++) {
    s += `<ellipse cx="${f(cx + r.range(-d * 0.7, d * 0.8))}" cy="${f(cy + r.range(-w * 0.8, w * 0.8))}" rx="${f(r.range(3.5, 8))}" ry="${f(r.range(2.5, 6))}" fill="url(#ub${id})"/>`;
  }
  return s;
}

/** Placas improvisadas (Tank): porta de carro, placa de trânsito e tiras de couro. */
function armor(v, id, cx, cy, w, d) {
  let s = '';
  for (const [x, y, pw, ph, rot] of [[cx - d * 0.55, cy - w * 0.95, d * 0.9, w * 0.5, -10], [cx - d * 0.55, cy + w * 0.45, d * 0.9, w * 0.5, 10]]) {
    s += `<rect x="${f(x)}" y="${f(y)}" width="${f(pw)}" height="${f(ph)}" rx="3" fill="url(#um${id})" stroke="#1b1d20" stroke-width="1.6" transform="rotate(${rot} ${f(x + pw / 2)} ${f(y + ph / 2)})"/>`;
    s += `<circle cx="${f(x + 3)}" cy="${f(y + 3)}" r="1.3" fill="#2a2d31"/><circle cx="${f(x + pw - 3)}" cy="${f(y + ph - 3)}" r="1.3" fill="#2a2d31"/>`;
  }
  // placa de trânsito amarela no peito
  s += `<path d="M${f(cx + d * 0.2)} ${f(cy - w * 0.32)} L${f(cx + d * 0.72)} ${f(cy)} L${f(cx + d * 0.2)} ${f(cy + w * 0.32)} L${f(cx - d * 0.3)} ${f(cy)} Z" fill="#c9a227" stroke="#3a2e0a" stroke-width="1.5"/>`;
  s += `<path d="M${f(cx + d * 0.2)} ${f(cy - w * 0.2)} L${f(cx + d * 0.5)} ${f(cy)} L${f(cx + d * 0.2)} ${f(cy + w * 0.2)} L${f(cx - d * 0.1)} ${f(cy)} Z" fill="none" stroke="#1b1b1b" stroke-width="1.4"/>`;
  s += `<path d="M${f(cx - d * 0.9)} ${f(cy - w * 0.5)} L${f(cx + d * 0.8)} ${f(cy + w * 0.55)} M${f(cx - d * 0.9)} ${f(cy + w * 0.5)} L${f(cx + d * 0.8)} ${f(cy - w * 0.55)}" stroke="#3a2a16" stroke-width="3.2" opacity=".9"/>`;
  return s;
}

/** Barriga inchada com pústulas brilhantes e veias (Exploder). */
function bloat(v, id, cx, cy, w, d, r) {
  let s = `<ellipse cx="${f(cx + d * 0.35)}" cy="${f(cy)}" rx="${f(d * 0.75)}" ry="${f(w * 0.72)}" fill="url(#uk${id})" stroke="${OUT}" stroke-width="1.2"/>`;
  for (let i = 0; i < 6; i++) {
    const a = r.range(0, Math.PI * 2);
    s += `<path d="M${pt([cx + d * 0.35, cy])} Q${pt([cx + d * 0.35 + Math.cos(a + 0.4) * d * 0.4, cy + Math.sin(a + 0.4) * w * 0.4])} ${pt([cx + d * 0.35 + Math.cos(a) * d * 0.7, cy + Math.sin(a) * w * 0.7])}" stroke="#3b4a1c" stroke-width="1.1" fill="none" opacity=".8"/>`;
  }
  for (let i = 0; i < 8; i++) {
    const p = [cx + r.range(-d * 0.5, d * 0.95), cy + r.range(-w * 0.85, w * 0.85)];
    const rad = r.range(2.6, 5.6);
    s += `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="${f(rad + 1.4)}" fill="#3a4422" opacity=".65"/><circle cx="${f(p[0])}" cy="${f(p[1])}" r="${f(rad)}" fill="url(#up${id})"/>`;
  }
  return s;
}

/**
 * Cabeça caída para a frente: crânio/cabelo por cima, orelhas nos lados e, na borda
 * da frente, sobrancelha, olhos opacos, nariz e mandíbula aberta com dentes.
 */
export function head(v, id, hx, hy, r, opts = {}) {
  const R = (v.bulk ? 12.2 : 11) * (opts.scale ?? 1);
  const jaw = opts.jaw ?? 0.4;
  let s = '';
  // orelhas
  for (const sgn of [-1, 1]) s += `<ellipse cx="${f(hx - 1)}" cy="${f(hy + sgn * R * 0.95)}" rx="3" ry="2.2" fill="${v.skinShade}" stroke="${OUT}" stroke-width="1"/>`;
  // mandíbula aberta (projeta à frente)
  const jx = hx + R * 0.72;
  s += `<path d="M${f(jx - 2)} ${f(hy - R * 0.5)} Q${f(jx + 6 + jaw * 5)} ${f(hy)} ${f(jx - 2)} ${f(hy + R * 0.5)} Z" fill="${v.skinDark}" stroke="${OUT}" stroke-width="1.2"/>`;
  s += `<path d="M${f(jx)} ${f(hy - R * 0.32)} Q${f(jx + 3.5 + jaw * 4)} ${f(hy)} ${f(jx)} ${f(hy + R * 0.32)}" fill="#1a0806"/>`;
  for (let i = -2; i <= 2; i++) s += `<rect x="${f(jx + 0.4)}" y="${f(hy + i * 2.2 - 0.8)}" width="2" height="1.6" fill="#d8cfae"/>`;
  // crânio
  s += `<ellipse cx="${f(hx)}" cy="${f(hy)}" rx="${f(R)}" ry="${f(R * 0.94)}" fill="url(#uk${id})" stroke="${OUT}" stroke-width="1.3"/>`;
  // cabelo / capacete / capuz
  if (v.hairStyle === 'riot') {
    // capacete de choque preto com viseira escura na frente
    s += `<ellipse cx="${f(hx - 1.5)}" cy="${f(hy)}" rx="${f(R * 1.08)}" ry="${f(R * 1.04)}" fill="#1b1f24" stroke="#050607" stroke-width="1.6"/>`;
    s += `<path d="M${f(hx + R * 0.35)} ${f(hy - R * 0.85)} Q${f(hx + R * 1.2)} ${f(hy)} ${f(hx + R * 0.35)} ${f(hy + R * 0.85)}" fill="#2c3e4c" stroke="#0a0c0e" stroke-width="1.4" opacity=".92"/>`;
    s += `<path d="M${f(hx + R * 0.55)} ${f(hy - R * 0.5)} Q${f(hx + R * 0.95)} ${f(hy - R * 0.1)} ${f(hx + R * 0.8)} ${f(hy + R * 0.3)}" stroke="#9fc3d1" stroke-width="1.4" fill="none" opacity=".5"/>`;
    s += `<path d="M${f(hx - R)} ${f(hy)} L${f(hx + R * 0.3)} ${f(hy)}" stroke="#2c3238" stroke-width="2"/>`;
  } else if (v.hairStyle === 'helmet') {
    s += `<ellipse cx="${f(hx - 1.5)}" cy="${f(hy)}" rx="${f(R * 1.02)}" ry="${f(R * 1.0)}" fill="#c89f2e" stroke="#1c1608" stroke-width="1.6"/>`;
    s += `<path d="M${f(hx - R)} ${f(hy)} L${f(hx + R * 0.7)} ${f(hy)}" stroke="#8a6d1c" stroke-width="2.2"/>`;
    s += `<path d="M${f(hx - R * 0.7)} ${f(hy - R * 0.62)} A${f(R)} ${f(R)} 0 0 1 ${f(hx + R * 0.5)} ${f(hy - R * 0.75)}" stroke="#ecc860" stroke-width="2" fill="none" opacity=".75"/>`;
    s += `<path d="M${f(hx + R * 0.72)} ${f(hy - R * 0.85)} Q${f(hx + R * 1.28)} ${f(hy)} ${f(hx + R * 0.72)} ${f(hy + R * 0.85)}" stroke="#a88322" stroke-width="3" fill="none"/>`;
  } else if (v.hairStyle === 'bald') {
    s += `<ellipse cx="${f(hx - 3)}" cy="${f(hy - 3)}" rx="${f(R * 0.4)}" ry="${f(R * 0.25)}" fill="#e2e8cc" opacity=".25"/>`;
    s += `<path d="M${f(hx - R * 0.6)} ${f(hy + 2)} q4 -3 8 0" stroke="${v.skinDark}" stroke-width="1" fill="none" opacity=".8"/>`;
  } else {
    const long = v.hairStyle === 'long';
    s += `<path d="${blobPath(hx - R * (long ? 0.42 : 0.34), hy, R * (long ? 0.95 : 0.78), long ? 0.5 : 0.35, long ? 11 : 9, r)}" fill="${v.hair}" stroke="${OUT}" stroke-width=".8" opacity=".96"/>`;
    // falhas no couro cabeludo
    s += `<ellipse cx="${f(hx - 1)}" cy="${f(hy - R * 0.35)}" rx="2.6" ry="2" fill="${v.skinShade}"/>`;
    if (long) for (const sgn of [-1, 1]) s += `<path d="M${f(hx - 3)} ${f(hy + sgn * R * 0.6)} q-7 ${f(sgn * 3)} -12 ${f(sgn * 2)}" stroke="${v.hair}" stroke-width="2.4" fill="none"/>`;
    if (v.hairStyle === 'hood') s += `<path d="M${f(hx - R * 1.05)} ${f(hy - R * 0.8)} Q${f(hx - R * 1.5)} ${f(hy)} ${f(hx - R * 1.05)} ${f(hy + R * 0.8)}" stroke="#26354a" stroke-width="3.5" fill="none"/>`;
  }
  // ferida com osso aparecendo, na lateral de trás
  if (v.hairStyle !== 'helmet') {
    const sgn = r.next() > 0.5 ? 1 : -1;
    const w = [hx - R * 0.35, hy + sgn * R * 0.5];
    s += `<path d="${blobPath(w[0], w[1], 3, 0.6, 8, r)}" fill="${v.skinDark}" opacity=".85"/><path d="${blobPath(w[0], w[1], 1.4, 0.5, 6, r)}" fill="#2a1512" opacity=".9"/>`;
  }
  // testa/sobrancelha e olhos opacos na borda da frente
  s += `<path d="M${f(hx + R * 0.55)} ${f(hy - R * 0.62)} Q${f(hx + R * 0.98)} ${f(hy)} ${f(hx + R * 0.55)} ${f(hy + R * 0.62)}" stroke="${v.skinDark}" stroke-width="2.2" fill="none"/>`;
  for (const sgn of [-1, 1]) {
    s += `<ellipse cx="${f(hx + R * 0.72)}" cy="${f(hy + sgn * R * 0.36)}" rx="1.9" ry="2.4" fill="#141009"/>`;
    s += `<circle cx="${f(hx + R * 0.77)}" cy="${f(hy + sgn * R * 0.36)}" r="1.2" fill="#e8e27a" opacity=".9"/>`;
  }
  s += `<path d="M${f(hx + R * 0.85)} ${f(hy - 1.4)} L${f(hx + R * 1.08)} ${f(hy)} L${f(hx + R * 0.85)} ${f(hy + 1.4)} Z" fill="${v.skinShade}" stroke="${OUT}" stroke-width=".8"/>`;

  return s;
}

/** Cuspidor: bolsas de ácido brilhando nos lados do pescoço e baba escorrendo. */
function spitterSacs(hx, hy, jaw) {
  let s = '';
  for (const sgn of [-1, 1]) {
    s += `<ellipse cx="${f(hx - 7)}" cy="${f(hy + sgn * 9)}" rx="6.5" ry="5" fill="#9ccf2a" stroke="#3a4a10" stroke-width="1.2" opacity=".95"/>`;
    s += `<ellipse cx="${f(hx - 8)}" cy="${f(hy + sgn * 8)}" rx="2.4" ry="1.6" fill="#f4ffb0" opacity=".8"/>`;
  }
  s += `<path d="M${f(hx + 12)} ${f(hy - 1)} q${f(4 + jaw * 4)} 1 ${f(6 + jaw * 5)} 5" stroke="#c8ff5a" stroke-width="2" fill="none" opacity=".8"/>`;
  return s;
}

// ───────────────────────────── Frame completo ─────────────────────────────

/**
 * Pose: phase (ciclo da passada), stride, sway (graus), lean (px para a frente),
 * headFwd, jaw (0..1), handL/handR (alvo das mãos), gait ('walk' | 'run').
 */
export function undeadFrame(v, id, pose) {
  const r = rng(v.seed);
  const bulk = v.bulk ?? 1;
  const cx = 57;
  const cy = 64;
  const w = (v.thin ? 19.5 : 21.5) * bulk;
  const d = (v.thin ? 13 : 15.5) * bulk * (v.bloat ? 1.15 : 1);
  const hipDy = 7.5 * bulk;
  let s = '';

  // Pernas (atrás do tronco; o pé que pisa vai à frente)
  const stride = pose.stride;
  const sinP = Math.sin(pose.phase);
  const footL = [cx - 4 + sinP * stride, cy - hipDy - 1.5];
  const footR = [cx - 4 - sinP * stride * (pose.gait === 'run' ? 1 : 0.75), cy + hipDy + 1.5];
  s += leg(v, [cx - 6, cy - hipDy], footL, -1, 0);
  s += leg(v, [cx - 6, cy + hipDy], footR, 1, pose.gait === 'run' ? 0 : 0.6);

  s += `<g transform="rotate(${f(pose.sway)} ${cx} ${cy}) translate(${f(pose.lean)} 0)">`;
  // sombra de contato do tronco sobre as pernas
  s += `<ellipse cx="${cx - 1}" cy="${cy}" rx="${f(d * 1.1)}" ry="${f(w * 1.02)}" fill="#000" opacity=".22"/>`;
  s += `<path d="${torsoPath(cx, cy, w, d, r)}" fill="url(#uc${id})" stroke="${OUT}" stroke-width="1.5"/>`;
  s += clothingDetails(v, id, cx, cy, w, d, r);
  if (v.outfit === 'armor') s += armor(v, id, cx, cy, w, d);
  if (v.bloat) s += bloat(v, id, cx, cy, w, d, r);
  // luz de borda (topo-esquerda)
  s += `<path d="M${f(cx - d * 0.6)} ${f(cy - w * 0.9)} Q${f(cx + d * 0.1)} ${f(cy - w * 1.05)} ${f(cx + d * 0.6)} ${f(cy - w * 0.82)}" stroke="#fff" stroke-width="1.4" fill="none" opacity=".16"/>`;

  // Braços por cima do tronco; a mão direita do Tank é enorme
  const armOpts = { id, upper: 18 * bulk, fore: 19 * bulk };
  s += arm(v, r, [cx + 3, cy - w * 0.74], pose.handL, -1, { ...armOpts, bone: v.outfit === 'office', bloodyHand: true, bare: v.outfit === 'rags' || v.outfit === 'gown' });
  s += arm(v, r, [cx + 3, cy + w * 0.74], pose.handR, 1, { ...armOpts, scale: v.bulk ? 1.25 : 1, bare: v.outfit === 'rags' || v.outfit === 'gown' || v.bloat, bone: v.outfit === 'rags' });

  // Pescoço e cabeça caída para a frente
  const hx = cx + d * 0.72 + pose.headFwd;
  s += limb([cx + d * 0.2, cy], [hx - 5, cy], 9.5 * bulk, 8.5 * bulk, `url(#uk${id})`);
  s += head(v, id, hx, cy + (pose.headTilt ?? 0), r, { jaw: pose.jaw ?? 0.4 });
  if (v.spitter) s += spitterSacs(hx, cy + (pose.headTilt ?? 0), pose.jaw ?? 0.4);
  s += `</g>`;
  return s;
}

/** Poses de andar (8) + ataque (5) para uma variante. */
export function undeadPoses(v) {
  const list = [];
  const run = v.outfit === 'rags' || !!v.thin;
  const bulk = v.bulk ?? 1;
  const reach = (x) => 64 + (x - 64) * bulk;
  for (let i = 0; i < 8; i++) {
    const p = (i / 8) * Math.PI * 2;
    list.push(run
      ? {
          // Corrida: passada longa, corpo inclinado e braços bombeando
          gait: 'run', phase: p, stride: 17, sway: Math.sin(p) * 8, lean: 4, headFwd: 3, jaw: 0.7, headTilt: Math.sin(p) * 1.5,
          handL: [reach(80 + Math.sin(p) * 14), 36 + Math.cos(p) * 2],
          handR: [reach(80 - Math.sin(p) * 14), 92 - Math.cos(p) * 2],
        }
      : {
          // Arrastado: um braço estendido, o outro mais baixo, cabeça balançando
          gait: 'walk', phase: p, stride: 10 * bulk, sway: Math.sin(p) * 7, lean: 0, headFwd: 1 + Math.sin(p * 2) * 0.8, jaw: 0.35 + 0.25 * Math.abs(Math.sin(p)),
          headTilt: Math.sin(p) * 2,
          handL: [reach(100 + Math.sin(p) * 4), 45 - Math.cos(p) * 2],
          handR: [reach(92 - Math.sin(p) * 3), 86 + Math.cos(p) * 3],
        });
  }
  const attack = [
    { handL: [90, 38], handR: [88, 90], lean: -3, headFwd: -1, jaw: 0.3 },
    { handL: [84, 36], handR: [82, 92], lean: -5, headFwd: -2, jaw: 0.5 },
    { handL: [114, 54], handR: [113, 74], lean: 6, headFwd: 6, jaw: 1 },
    { handL: [110, 57], handR: [109, 71], lean: 5, headFwd: 5, jaw: 0.9 },
    { handL: [100, 50], handR: [98, 78], lean: 1, headFwd: 2, jaw: 0.5 },
  ];
  for (const a of attack) list.push({ gait: 'walk', phase: 0, stride: 6, sway: 0, headTilt: 0, ...a, handL: [reach(a.handL[0]), a.handL[1]], handR: [reach(a.handR[0]), a.handR[1]] });
  return list;
}

/** Corpo caído de bruços (cabeça para +X) para a sheet de cadáveres (176x144). */
export function undeadCorpse(v, id, seed) {
  const r = rng(seed);
  const pose = {
    gait: 'walk', phase: Math.PI / 2, stride: 26, sway: r.range(-8, 8), lean: 0, headFwd: 4, jaw: 1, headTilt: r.range(-3, 3),
    handL: [96 + r.range(-8, 14), 20 + r.range(-4, 8)],
    handR: [70 + r.range(-10, 6), 112 + r.range(-6, 6)],
  };
  let s = `<g transform="translate(24 8)">${undeadFrame(v, id, pose)}</g>`;
  s += `<ellipse cx="${f(92 + r.range(-8, 8))}" cy="${f(72 + r.range(-6, 6))}" rx="13" ry="9" fill="url(#ub${id})"/>`;
  return s;
}
