// Boss 1 — The Conductor (GDD §46): ex-condutor do terminal transformado. Casaco longo de
// uniforme com abas rasgadas, quepe, lanterna acesa na mão esquerda e o braço direito
// mutado em uma massa de músculo com espinhos de osso. Vista de cima, virado para +X.
import { blobPath, f, ik, rng, svgDoc } from './lib.mjs';
import { limb } from './undead.mjs';

export const BOSS_FRAME = 224;
export const BOSS_COLUMNS = 10;
const C = 112;
const OUT = '#07080b';

const B = {
  coat: '#27344d',
  coatShade: '#141b2a',
  coatLight: '#41527a',
  brass: '#caa441',
  brassDark: '#6a5214',
  stripe: '#8e2a22',
  skin: '#86907a',
  skinShade: '#56604b',
  skinDark: '#383f31',
  flesh: '#8a4d45',
  fleshLight: '#b7766b',
  fleshShade: '#4a2420',
  bone: '#e6dec6',
  pants: '#1c2331',
  boots: '#141210',
};

const defs =
  `<radialGradient id="bc" cx="38%" cy="30%" r="80%"><stop offset="0" stop-color="${B.coatLight}"/><stop offset=".55" stop-color="${B.coat}"/><stop offset="1" stop-color="${B.coatShade}"/></radialGradient>` +
  `<radialGradient id="bf" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="${B.fleshLight}"/><stop offset=".6" stop-color="${B.flesh}"/><stop offset="1" stop-color="${B.fleshShade}"/></radialGradient>` +
  `<radialGradient id="bs" cx="40%" cy="32%" r="75%"><stop offset="0" stop-color="${B.skin}"/><stop offset=".7" stop-color="${B.skinShade}"/><stop offset="1" stop-color="${B.skinDark}"/></radialGradient>` +
  `<radialGradient id="bl" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff6c0"/><stop offset=".35" stop-color="#ffcf55" stop-opacity=".85"/><stop offset="1" stop-color="#ff9a1f" stop-opacity="0"/></radialGradient>` +
  `<radialGradient id="bb" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#5c0d0a" stop-opacity=".95"/><stop offset=".6" stop-color="#3f0806" stop-opacity=".75"/><stop offset="1" stop-color="#3f0806" stop-opacity="0"/></radialGradient>` +
  `<radialGradient id="cap" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#34466a"/><stop offset="1" stop-color="#121a2a"/></radialGradient>`;

const pt = (p) => `${f(p[0])} ${f(p[1])}`;
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const angle = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);
const polar = (p, ang, d) => [p[0] + Math.cos(ang) * d, p[1] + Math.sin(ang) * d];

function legs(phase, amp) {
  let s = '';
  for (const [hipY, sign] of [[94, 1], [130, -1]]) {
    const off = Math.sin(phase) * amp * sign;
    const hip = [98, hipY];
    const foot = [100 + off, hipY + (hipY < C ? -4 : 4)];
    const knee = lerp(hip, foot, 0.5);
    s += limb(hip, knee, 21, 18, B.pants, OUT, 2) + limb(knee, foot, 18, 15, B.pants, OUT, 2);
    // faixa vermelha do uniforme
    s += `<path d="M${pt(hip)} L${pt(foot)}" stroke="${B.stripe}" stroke-width="2.4" opacity=".85"/>`;
    s += `<ellipse cx="${f(foot[0] + 7)}" cy="${f(foot[1])}" rx="15" ry="9.5" fill="${B.boots}" stroke="${OUT}" stroke-width="1.8"/>`;
    s += `<ellipse cx="${f(foot[0] + 10)}" cy="${f(foot[1] - 2.5)}" rx="6" ry="2.2" fill="#fff" opacity=".08"/>`;
  }
  return s;
}

/** Braço esquerdo: manga do casaco, mão cinzenta segurando a lanterna acesa. */
function lanternArm(hand) {
  const shoulder = [108, 72];
  const { elbow, hand: h } = ik(shoulder, hand, 30, 32, -1);
  let s = limb(elbow, h, 12, 10, 'url(#bs)', OUT, 1.8);
  s += limb(shoulder, lerp(elbow, h, 0.2), 20, 16, 'url(#bc)', OUT, 2);
  // punho dourado da manga
  const cuff = lerp(elbow, h, 0.2);
  s += `<circle cx="${f(cuff[0])}" cy="${f(cuff[1])}" r="7.5" fill="none" stroke="${B.brass}" stroke-width="2.2" opacity=".85"/>`;
  // lanterna pendurada (brilho + corpo)
  const ang = angle(elbow, h);
  const lamp = polar(h, ang + 0.2, 13);
  s += `<circle cx="${f(lamp[0])}" cy="${f(lamp[1])}" r="26" fill="url(#bl)"/>`;
  s += `<path d="M${pt(h)} L${pt(lamp)}" stroke="#2a2418" stroke-width="2"/>`;
  s += `<rect x="${f(lamp[0] - 7)}" y="${f(lamp[1] - 8)}" width="14" height="16" rx="2.5" fill="#3a2e18" stroke="#120e06" stroke-width="1.8"/>`;
  s += `<rect x="${f(lamp[0] - 4)}" y="${f(lamp[1] - 5)}" width="8" height="10" rx="1" fill="#ffe594"/>`;
  s += `<circle cx="${f(lamp[0])}" cy="${f(lamp[1])}" r="2.4" fill="#fffbe0"/>`;
  // mão fechada na alça
  s += `<ellipse cx="${f(h[0])}" cy="${f(h[1])}" rx="7" ry="6" fill="${B.skin}" stroke="${OUT}" stroke-width="1.5"/>`;
  for (const sp of [-0.5, -0.1, 0.3]) s += `<circle cx="${f(polar(h, ang + sp, 5.5)[0])}" cy="${f(polar(h, ang + sp, 5.5)[1])}" r="2.4" fill="${B.skinShade}" stroke="${OUT}" stroke-width=".8"/>`;
  return s;
}

/** Braço direito mutado: manga arrancada, músculo exposto, espinhos de osso e garras. */
function mutatedArm(hand, r) {
  const shoulder = [104, 152];
  const { elbow, hand: h } = ik(shoulder, hand, 38, 42, 1);
  let s = '';
  // massa muscular (ombro inchado → antebraço grosso)
  s += limb(shoulder, elbow, 38, 32, 'url(#bf)', '#1b0907', 2.4);
  s += limb(elbow, h, 32, 24, 'url(#bf)', '#1b0907', 2.4);
  // fibras musculares
  for (const [a, b, n] of [[shoulder, elbow, 4], [elbow, h, 3]]) {
    const ang = angle(a, b);
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * 5.5;
      const p0 = polar(lerp(a, b, 0.12), ang + Math.PI / 2, off);
      const p1 = polar(lerp(a, b, 0.88), ang + Math.PI / 2, off * 0.8);
      s += `<path d="M${pt(p0)} Q${pt(polar(lerp(p0, p1, 0.5), ang + Math.PI / 2, 2.5))} ${pt(p1)}" stroke="${B.fleshShade}" stroke-width="1.3" fill="none" opacity=".7"/>`;
    }
  }
  // espinhos de osso saindo da parte de fora do braço
  for (const [a, b] of [[shoulder, elbow], [elbow, h]]) {
    const ang = angle(a, b);
    for (const t of [0.2, 0.5, 0.8]) {
      const base = polar(lerp(a, b, t), ang + Math.PI / 2, 12);
      const tip = polar(base, ang + Math.PI / 2 - 0.45, 17 + r.range(-3, 4));
      const b1 = polar(base, ang, -5.5);
      const b2 = polar(base, ang, 5.5);
      s += `<path d="M${pt(b1)} L${pt(tip)} L${pt(b2)} Z" fill="${B.bone}" stroke="#6b6450" stroke-width="1.2"/>`;
      s += `<path d="M${pt(base)} L${pt(lerp(base, tip, 0.7))}" stroke="#b3aa90" stroke-width="1"/>`;
    }
  }
  // restos da manga rasgada no ombro
  s += `<path d="${blobPath(shoulder[0], shoulder[1] - 4, 15, 0.6, 9, r)}" fill="url(#bc)" stroke="${OUT}" stroke-width="1.5"/>`;
  // mão: três garras longas de osso
  const ang = angle(elbow, h);
  for (const sp of [-0.6, 0, 0.6]) {
    const knuckle = polar(h, ang + sp, 9);
    const tip = polar(knuckle, ang + sp * 0.6, 24);
    s += `<path d="M${pt(knuckle)} L${pt(tip)}" stroke="#1b0907" stroke-width="7" stroke-linecap="round"/>`;
    s += `<path d="M${pt(knuckle)} L${pt(tip)}" stroke="${B.bone}" stroke-width="4.2" stroke-linecap="round"/>`;
  }
  s += `<circle cx="${f(h[0])}" cy="${f(h[1])}" r="15" fill="url(#bf)" stroke="#1b0907" stroke-width="2.2"/>`;
  s += `<circle cx="${f(h[0] - 3)}" cy="${f(h[1] - 3)}" r="4" fill="${B.fleshLight}" opacity=".5"/>`;
  return s;
}

/** Tronco: casaco longo com abas rasgadas, fileiras de botões, dragonas e corrente do apito. */
function coat(r) {
  let s = '';
  // abas do casaco atrás (rasgadas, balançando)
  s += `<path d="${blobPath(76, C, 30, 0.5, 14, r)}" fill="${B.coatShade}" stroke="${OUT}" stroke-width="1.8"/>`;
  for (const y of [C - 22, C, C + 22]) s += `<path d="M78 ${y} L${f(50 + r.range(-4, 4))} ${f(y + r.range(-6, 6))}" stroke="#0b1018" stroke-width="2" opacity=".8"/>`;
  // corpo (costas largas e peito)
  const pts = [[70, 80], [84, 62], [106, 58], [124, 70], [132, 92], [134, C], [132, 132], [124, 154], [106, 166], [84, 162], [70, 144], [66, C]];
  let d = '';
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    const n = pts[(i + 2) % pts.length];
    if (i === 0) d += `M${pt([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2])}`;
    d += ` Q${pt(q)} ${pt([(q[0] + n[0]) / 2, (q[1] + n[1]) / 2])}`;
  }
  s += `<path d="${d} Z" fill="url(#bc)" stroke="${OUT}" stroke-width="2.2"/>`;
  // costura das costas e cinto
  s += `<path d="M82 76 Q72 ${C} 82 148" stroke="${B.coatShade}" stroke-width="3" fill="none"/>`;
  s += `<path d="M96 60 L96 164" stroke="#10151f" stroke-width="5" opacity=".65"/>`;
  s += `<rect x="92" y="${C - 6}" width="9" height="12" rx="2" fill="${B.brass}" stroke="${B.brassDark}" stroke-width="1"/>`;
  // duas fileiras de botões de latão no peito
  for (const x of [118, 127]) for (const y of [86, 100, 124, 138]) s += `<circle cx="${x}" cy="${y}" r="2.8" fill="${B.brass}" stroke="${B.brassDark}" stroke-width=".9"/>`;
  // corrente do apito atravessando o peito
  s += `<path d="M112 78 Q126 96 124 116" stroke="${B.brass}" stroke-width="1.6" stroke-dasharray="2 1.5" fill="none"/>`;
  s += `<rect x="120" y="114" width="8" height="5" rx="2" fill="#d9d2b8" stroke="#6b6450" stroke-width=".8"/>`;
  // dragonas com franjas
  for (const y of [70, 154]) {
    s += `<ellipse cx="104" cy="${y}" rx="13" ry="9" fill="${B.brass}" stroke="${B.brassDark}" stroke-width="1.4"/>`;
    for (let i = -3; i <= 3; i++) s += `<path d="M${104 + i * 3.4} ${y + (y < C ? -7 : 7)} l0 ${y < C ? -5 : 5}" stroke="${B.brass}" stroke-width="1.6"/>`;
  }
  // rasgo lateral com costelas aparecendo e sangue
  s += `<path d="${blobPath(112, 140, 10, 0.5, 9, r)}" fill="url(#bs)" stroke="${OUT}" stroke-width="1"/>`;
  for (let i = -1; i <= 1; i++) s += `<path d="M104 ${140 + i * 4} q8 -2 16 0" stroke="${B.skinDark}" stroke-width="1.2" fill="none"/>`;
  for (let i = 0; i < 6; i++) s += `<ellipse cx="${f(r.range(80, 128))}" cy="${f(r.range(74, 152))}" rx="${f(r.range(6, 13))}" ry="${f(r.range(4, 9))}" fill="url(#bb)"/>`;
  // luz de borda
  s += `<path d="M84 64 Q104 54 124 68" stroke="#fff" stroke-width="2" fill="none" opacity=".14"/>`;
  return s;
}

/** Cabeça com quepe de condutor (aba para a frente) e mandíbula aparecendo sob a aba. */
function headWithCap(hx) {
  let s = '';
  // pescoço grosso
  s += limb([100, C], [hx - 6, C], 20, 18, 'url(#bs)', OUT, 1.8);
  // mandíbula aberta à frente da aba
  s += `<path d="M${f(hx + 14)} ${C - 12} Q${f(hx + 30)} ${C} ${f(hx + 14)} ${C + 12} Z" fill="${B.skinDark}" stroke="${OUT}" stroke-width="1.5"/>`;
  s += `<path d="M${f(hx + 16)} ${C - 8} Q${f(hx + 26)} ${C} ${f(hx + 16)} ${C + 8} Z" fill="#1a0806"/>`;
  for (let i = -3; i <= 3; i++) s += `<rect x="${f(hx + 16.5)}" y="${f(C + i * 2.4 - 0.9)}" width="2.6" height="1.8" fill="#dcd3b2"/>`;
  // orelhas
  for (const sgn of [-1, 1]) s += `<ellipse cx="${f(hx - 2)}" cy="${f(C + sgn * 18)}" rx="4.5" ry="3.2" fill="${B.skinShade}" stroke="${OUT}" stroke-width="1.2"/>`;
  // quepe: copa redonda, faixa dourada, distintivo e aba escura à frente
  s += `<path d="M${f(hx + 10)} ${C - 18} Q${f(hx + 30)} ${C} ${f(hx + 10)} ${C + 18} Q${f(hx + 18)} ${C} ${f(hx + 10)} ${C - 18} Z" fill="#090c14" stroke="${OUT}" stroke-width="1.5"/>`;
  s += `<circle cx="${f(hx)}" cy="${C}" r="19" fill="url(#cap)" stroke="${OUT}" stroke-width="2"/>`;
  s += `<circle cx="${f(hx)}" cy="${C}" r="15.5" fill="none" stroke="${B.brass}" stroke-width="3"/>`;
  s += `<circle cx="${f(hx - 4)}" cy="${C - 5}" r="6" fill="#fff" opacity=".07"/>`;
  s += `<path d="M${f(hx + 9)} ${C - 4} L${f(hx + 15)} ${C} L${f(hx + 9)} ${C + 4} L${f(hx + 5)} ${C} Z" fill="${B.brass}" stroke="${B.brassDark}" stroke-width=".9"/>`;
  return s;
}

/** pose: phase, legAmp, lean, handL, handR, headFwd, rot */
function bossFrame(pose) {
  const r = rng(314);
  let s = legs(pose.phase, pose.legAmp);
  s += `<g transform="rotate(${f(pose.rot ?? 0)} ${C} ${C}) translate(${f(pose.lean)} 0)">`;
  s += `<ellipse cx="102" cy="${C}" rx="36" ry="52" fill="#000" opacity=".25"/>`;
  s += coat(r);
  s += lanternArm(pose.handL);
  s += mutatedArm(pose.handR, r);
  s += headWithCap(116 + pose.headFwd);
  s += `</g>`;
  return s;
}

/** Poses: 0-7 andar · 8-11 golpe · 12-13 investida · 14-17 pancada no chão · 18-19 rugido */
function poses() {
  const list = [];
  for (let i = 0; i < 8; i++) {
    const p = (i / 8) * Math.PI * 2;
    list.push({ phase: p, legAmp: 16, lean: 0, headFwd: 2, rot: Math.sin(p) * 3, handL: [160 + Math.sin(p) * 6, 78], handR: [158 - Math.sin(p) * 8, 156] });
  }
  for (const h of [[112, 200], [176, 182], [204, 116], [166, 76]]) list.push({ phase: 0, legAmp: 16, lean: 4, headFwd: 4, handL: [150, 70], handR: h });
  for (const p of [0.8, 2.4]) list.push({ phase: p, legAmp: 20, lean: 12, headFwd: 8, handL: [80, 48], handR: [82, 178] });
  for (const [l, rr, lean] of [[[118, 26], [118, 200], -4], [[150, 34], [150, 192], 0], [[192, 90], [192, 136], 8], [[180, 96], [180, 130], 6]]) {
    list.push({ phase: 0, legAmp: 16, lean, headFwd: 4, handL: l, handR: rr });
  }
  for (const spread of [0, 6]) list.push({ phase: 0, legAmp: 16, lean: 2, headFwd: 8, handL: [112 - spread, 20 - spread], handR: [112 - spread, 204 + spread] });
  return list;
}

export function bossSheet() {
  const frames = poses().map(bossFrame);
  const rows = Math.ceil(frames.length / BOSS_COLUMNS);
  const body = frames
    .map((content, i) => `<g transform="translate(${(i % BOSS_COLUMNS) * BOSS_FRAME} ${Math.floor(i / BOSS_COLUMNS) * BOSS_FRAME})">${content}</g>`)
    .join('');
  return svgDoc(BOSS_COLUMNS * BOSS_FRAME, rows * BOSS_FRAME, defs, body);
}

/** Corpo do boss caído (288x224). */
export function bossCorpse() {
  const r = rng(271);
  let s = `<path d="${blobPath(150, 112, 92, 0.35, 16, r)}" fill="#300604" opacity=".85"/>`;
  s += `<g transform="translate(150 112) rotate(90) translate(-112 -112)">${bossFrame({ phase: 0, legAmp: 0, lean: 0, headFwd: 0, handL: [150, 36], handR: [172, 198] })}</g>`;
  return svgDoc(288, 224, defs, s);
}
