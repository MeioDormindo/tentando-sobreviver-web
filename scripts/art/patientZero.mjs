// Boss 2 — Paciente Zero (Hospital Santa Luzia): o primeiro infectado, gigante e mutado.
// Camisa de força rasgada com as fivelas soltas, tubos de soro ainda presos na pele, bolsas
// de ácido brilhando nas costas e um braço inchado em garra. Mesma grade de poses do
// Conductor (20 frames de 224 px, virado para +X).
import { blobPath, f, rng, svgDoc } from './lib.mjs';
import { BOSS_COLUMNS, BOSS_FRAME, poses } from './boss.mjs';
import { limb } from './undead.mjs';

const C = 112;
const OUT = '#07080b';

const P = {
  jacket: '#c9c2a8',
  jacketShade: '#8a846e',
  strap: '#5a4630',
  buckle: '#b8bcc0',
  skin: '#8f9a74',
  skinShade: '#5e6a4a',
  skinDark: '#3a4230',
  acid: '#9ccf2a',
  acidHot: '#e8ff8a',
  tube: '#d8e6d0',
  nail: '#e6dec6',
};

const defs =
  `<radialGradient id="pzj" cx="38%" cy="30%" r="80%"><stop offset="0" stop-color="#e2dcc4"/><stop offset=".6" stop-color="${P.jacket}"/><stop offset="1" stop-color="${P.jacketShade}"/></radialGradient>` +
  `<radialGradient id="pzs" cx="40%" cy="32%" r="75%"><stop offset="0" stop-color="${P.skin}"/><stop offset=".7" stop-color="${P.skinShade}"/><stop offset="1" stop-color="${P.skinDark}"/></radialGradient>` +
  `<radialGradient id="pza" cx="45%" cy="40%" r="55%"><stop offset="0" stop-color="${P.acidHot}"/><stop offset=".5" stop-color="${P.acid}"/><stop offset="1" stop-color="#3f5a10" stop-opacity=".9"/></radialGradient>` +
  `<radialGradient id="pzg" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${P.acidHot}" stop-opacity=".8"/><stop offset="1" stop-color="${P.acid}" stop-opacity="0"/></radialGradient>`;

const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** Pernas nuas e magras, com a barra da camisola rasgada. */
function legs(phase, amp) {
  let s = '';
  for (const [hipY, sign] of [[94, 1], [130, -1]]) {
    const off = Math.sin(phase) * amp * sign;
    const hip = [98, hipY];
    const foot = [100 + off, hipY + (hipY < C ? -4 : 4)];
    const knee = lerp(hip, foot, 0.5);
    s += limb(hip, knee, 19, 15, 'url(#pzs)', OUT, 2) + limb(knee, foot, 15, 12, 'url(#pzs)', OUT, 2);
    s += `<ellipse cx="${f(foot[0] + 6)}" cy="${f(foot[1])}" rx="13" ry="8" fill="${P.skinShade}" stroke="${OUT}" stroke-width="1.6"/>`;
    for (let k = -1; k <= 1; k++) s += `<path d="M${f(foot[0] + 16)} ${f(foot[1] + k * 3)} l5 ${f(k)}" stroke="${P.nail}" stroke-width="2" stroke-linecap="round"/>`;
  }
  return s;
}

/** Tronco inchado dentro da camisa de força rasgada; bolsas de ácido e tubos de soro nas costas. */
function torso(r) {
  let s = `<path d="${blobPath(100, C, 46, 0.12, 14, r)}" fill="url(#pzs)" stroke="${OUT}" stroke-width="2.2"/>`;
  // camisa de força: dois painéis com as tiras soltas
  s += `<path d="M66 72 Q100 60 132 76 L136 148 Q100 164 64 152 Z" fill="url(#pzj)" stroke="${OUT}" stroke-width="2"/>`;
  s += `<path d="${blobPath(112, 104, 12, 0.5, 9, r)}" fill="url(#pzs)" opacity=".95"/>`;
  s += `<path d="${blobPath(90, 136, 10, 0.5, 9, r)}" fill="url(#pzs)" opacity=".95"/>`;
  for (const y of [86, 112, 138]) {
    s += `<path d="M64 ${y} Q100 ${y + 6} 136 ${y - 2}" stroke="${P.strap}" stroke-width="5" fill="none"/>`;
    s += `<rect x="126" y="${y - 6}" width="8" height="8" rx="1.5" fill="${P.buckle}" stroke="${OUT}" stroke-width="1"/>`;
  }
  // tira solta balançando
  s += `<path d="M66 124 q-18 8 -26 22" stroke="${P.strap}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  // bolsas de ácido nas costas (brilham)
  for (const [x, y, rad] of [[70, 96, 11], [62, 118, 13], [72, 138, 9]]) {
    s += `<circle cx="${x}" cy="${y}" r="${rad + 6}" fill="url(#pzg)"/>`;
    s += `<circle cx="${x}" cy="${y}" r="${rad}" fill="url(#pza)" stroke="#2f4210" stroke-width="1.6"/>`;
  }
  // tubos de soro presos no corpo, pendurados para trás
  for (const [x, y, ex, ey] of [[104, 78, 60, 58], [110, 150, 54, 172], [96, 100, 40, 96]]) {
    s += `<path d="M${x} ${y} Q${(x + ex) / 2} ${(y + ey) / 2 + 10} ${ex} ${ey}" stroke="${P.tube}" stroke-width="2.6" fill="none" opacity=".85"/>`;
    s += `<circle cx="${x}" cy="${y}" r="3" fill="#6a120d"/>`;
  }
  return s;
}

/** Braço: magro (esquerdo) ou inchado em garra (direito). */
function arm(shoulder, hand, big) {
  const elbow = [(shoulder[0] + hand[0]) / 2 + 10, (shoulder[1] + hand[1]) / 2 + (hand[1] < C ? -8 : 8)];
  let s = limb(shoulder, elbow, big ? 22 : 14, big ? 18 : 11, 'url(#pzs)', OUT, 2);
  s += limb(elbow, hand, big ? 18 : 11, big ? 14 : 9, 'url(#pzs)', OUT, 2);
  if (big) for (let i = 0; i < 4; i++) s += `<circle cx="${f(elbow[0] - 6 + i * 5)}" cy="${f(elbow[1] + (i % 2 ? 4 : -4))}" r="3" fill="url(#pza)"/>`;
  const ang = Math.atan2(hand[1] - elbow[1], hand[0] - elbow[0]);
  for (let k = -1.5; k <= 1.5; k++) {
    const a = ang + k * 0.35;
    const len = big ? 22 : 14;
    s += `<path d="M${f(hand[0])} ${f(hand[1])} L${f(hand[0] + Math.cos(a) * len)} ${f(hand[1] + Math.sin(a) * len)}" stroke="${P.nail}" stroke-width="${big ? 4 : 2.6}" stroke-linecap="round"/>`;
  }
  return s;
}

/** Cabeça careca com tumores, olhos verdes brilhando e baba ácida. */
function head(hx, r) {
  let s = `<ellipse cx="${f(hx)}" cy="${C}" rx="26" ry="24" fill="url(#pzs)" stroke="${OUT}" stroke-width="2.2"/>`;
  for (let i = 0; i < 4; i++) s += `<path d="${blobPath(hx - 10 + r.range(-6, 6), C + r.range(-14, 14), r.range(4, 7), 0.4, 7, r)}" fill="${P.skinShade}" stroke="${OUT}" stroke-width="1"/>`;
  s += `<path d="M${f(hx - 18)} ${C - 4} q10 -12 22 -4" stroke="#2c1612" stroke-width="2" fill="none"/>`;
  // boca aberta com baba
  s += `<path d="M${f(hx + 16)} ${C - 10} Q${f(hx + 34)} ${C} ${f(hx + 16)} ${C + 10} Z" fill="#1a0b09" stroke="${OUT}" stroke-width="1.6"/>`;
  s += `<path d="M${f(hx + 26)} ${C + 3} q10 4 14 14" stroke="${P.acid}" stroke-width="3" fill="none" opacity=".9"/>`;
  for (const sgn of [-1, 1]) {
    s += `<circle cx="${f(hx + 12)}" cy="${C + sgn * 10}" r="6" fill="url(#pzg)"/>`;
    s += `<circle cx="${f(hx + 12)}" cy="${C + sgn * 10}" r="3" fill="${P.acidHot}"/>`;
  }
  return s;
}

function frame(pose) {
  const r = rng(419);
  let s = legs(pose.phase, pose.legAmp);
  s += `<g transform="rotate(${f(pose.rot ?? 0)} ${C} ${C}) translate(${f(pose.lean)} 0)">`;
  s += `<ellipse cx="102" cy="${C}" rx="38" ry="54" fill="#000" opacity=".25"/>`;
  s += torso(r);
  s += arm([118, 74], pose.handL, false);
  s += arm([118, 150], pose.handR, true);
  s += head(126 + pose.headFwd, r);
  s += `</g>`;
  return s;
}

export function patientZeroSheet() {
  const frames = poses().map(frame);
  const rows = Math.ceil(frames.length / BOSS_COLUMNS);
  const body = frames
    .map((content, i) => `<g transform="translate(${(i % BOSS_COLUMNS) * BOSS_FRAME} ${Math.floor(i / BOSS_COLUMNS) * BOSS_FRAME})">${content}</g>`)
    .join('');
  return svgDoc(BOSS_COLUMNS * BOSS_FRAME, rows * BOSS_FRAME, defs, body);
}

/** Corpo caído numa poça de ácido (288x224). */
export function patientZeroCorpse() {
  const r = rng(523);
  let s = `<path d="${blobPath(150, 112, 96, 0.35, 16, r)}" fill="#3f5a10" opacity=".7"/>`;
  s += `<g transform="translate(150 112) rotate(90) translate(-112 -112)">${frame({ phase: 0, legAmp: 0, lean: 0, headFwd: 0, handL: [150, 36], handR: [172, 198] })}</g>`;
  return svgDoc(288, 224, defs, s);
}
