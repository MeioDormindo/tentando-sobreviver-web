// Boss 1 — The Conductor (GDD §46): ex-funcionário do terminal, casaco de condutor,
// quepe, lanterna e um braço gigante mutado. Vista de cima, virado para +X.
import { blobPath, f, ik, line, linear, radial, raggedEllipse, rng, svgDoc } from './lib.mjs';

export const BOSS_FRAME = 224;
export const BOSS_COLUMNS = 10;
const C = 112;

const B = {
  coat: '#26324a',
  coatShade: '#141b2a',
  coatLight: '#3b4a68',
  brass: '#c9a33e',
  skin: '#7c8570',
  skinShade: '#4d5545',
  flesh: '#7a4c46',
  fleshShade: '#4a2622',
  bone: '#e4dcc4',
  pants: '#1d2433',
  boots: '#15120f',
};

const defs =
  radial('bc', [[0, B.coatLight], [0.6, B.coat], [1, B.coatShade]], '40%', '35%', '75%') +
  radial('bf', [[0, '#9a6660'], [0.6, B.flesh], [1, B.fleshShade]], '40%', '35%', '75%') +
  radial('bs', [[0, B.skin], [1, B.skinShade]], '60%', '40%') +
  radial('bl', [[0, '#fff3b0'], [0.4, '#ffc94a', 0.9], [1, '#ff9a1f', 0]], '50%', '50%', '50%') +
  radial('bb', [[0, '#5a0f0c', 0.9], [0.6, '#3d0907', 0.7], [1, '#3d0907', 0]], '50%', '50%', '50%') +
  linear('cap', [[0, '#2c3a55'], [1, '#161e2e']]);

function legs(phase, amp) {
  let s = '';
  for (const [hipY, sign] of [[96, 1], [128, -1]]) {
    const off = Math.sin(phase) * amp * sign;
    const foot = [106 + off, hipY + (hipY < C ? -3 : 3)];
    s += line([104, hipY], foot, '#0c0f16', 21) + line([104, hipY], foot, B.pants, 17);
    s += `<ellipse cx="${f(foot[0] + 5)}" cy="${f(foot[1])}" rx="12" ry="8" fill="${B.boots}" stroke="#050505" stroke-width="1.5"/>`;
  }
  return s;
}

/** Braço esquerdo (humano, magro, com garras). */
function normalArm(hand) {
  const shoulder = [104, 70];
  const { elbow, hand: h } = ik(shoulder, hand, 30, 32, -1);
  let s = line(shoulder, elbow, '#0c0f16', 16) + line(shoulder, elbow, B.coat, 13);
  s += line(elbow, h, '#1a1d16', 11) + line(elbow, h, B.skin, 8.5);
  const ang = Math.atan2(h[1] - elbow[1], h[0] - elbow[0]);
  for (const sp of [-0.5, 0, 0.5]) s += line(h, [h[0] + Math.cos(ang + sp) * 11, h[1] + Math.sin(ang + sp) * 11], B.skinShade, 3);
  return s + `<circle cx="${f(h[0])}" cy="${f(h[1])}" r="6.5" fill="${B.skin}" stroke="#1a1d16" stroke-width="1.2"/>`;
}

/** Braço direito mutado: enorme, carne exposta, espinhos de osso e garras longas. */
function mutatedArm(hand) {
  const shoulder = [104, 154];
  const { elbow, hand: h } = ik(shoulder, hand, 36, 40, 1);
  let s = line(shoulder, elbow, '#1b0c0a', 30) + line(shoulder, elbow, B.flesh, 26);
  s += line(elbow, h, '#1b0c0a', 26) + line(elbow, h, B.flesh, 22);
  s += line(shoulder, elbow, '#9a6660', 6, 'opacity=".5"') + line(elbow, h, '#9a6660', 5, 'opacity=".45"');
  // veias
  const mid = [(elbow[0] + h[0]) / 2, (elbow[1] + h[1]) / 2];
  s += line(elbow, mid, '#3a0d0a', 1.6, 'opacity=".8"') + line(shoulder, elbow, '#3a0d0a', 1.4, 'opacity=".7"');
  // espinhos de osso ao longo do braço
  for (const t of [0.25, 0.55, 0.85]) {
    for (const [a, b, side] of [[shoulder, elbow, 1], [elbow, h, 1]]) {
      const px = a[0] + (b[0] - a[0]) * t;
      const py = a[1] + (b[1] - a[1]) * t;
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]) + (side * Math.PI) / 2;
      const tip = [px + Math.cos(ang) * 14, py + Math.sin(ang) * 14];
      const back = [px - Math.cos(ang - Math.PI / 2) * 5, py - Math.sin(ang - Math.PI / 2) * 5];
      const fwd = [px + Math.cos(ang - Math.PI / 2) * 5, py + Math.sin(ang - Math.PI / 2) * 5];
      s += `<path d="M${f(back[0])} ${f(back[1])} L${f(tip[0])} ${f(tip[1])} L${f(fwd[0])} ${f(fwd[1])} Z" fill="${B.bone}" stroke="#6b6450" stroke-width="1"/>`;
    }
  }
  // mão com três garras longas
  const ang = Math.atan2(h[1] - elbow[1], h[0] - elbow[0]);
  for (const sp of [-0.55, 0, 0.55]) {
    const tip = [h[0] + Math.cos(ang + sp) * 26, h[1] + Math.sin(ang + sp) * 26];
    s += line(h, tip, '#1b0c0a', 6) + line(h, tip, B.bone, 3.6);
  }
  s += `<circle cx="${f(h[0])}" cy="${f(h[1])}" r="14" fill="url(#bf)" stroke="#1b0c0a" stroke-width="2"/>`;
  return s;
}

/** pose: phase, legAmp, lean, handL, handR, headFwd, rot */
function bossFrame(pose) {
  const r = rng(314);
  let s = legs(pose.phase, pose.legAmp);
  s += `<g transform="rotate(${f(pose.rot ?? 0)} ${C} ${C}) translate(${f(pose.lean)} 0)">`;
  // cauda do casaco rasgada (atrás)
  s += `<path d="${blobPath(84, C, 26, 0.45, 12, r)}" fill="${B.coatShade}" stroke="#07090e" stroke-width="1.5"/>`;
  // lanterna na cintura (brilha)
  s += `<circle cx="86" cy="64" r="16" fill="url(#bl)"/>`;
  s += `<rect x="80" y="58" width="12" height="13" rx="2" fill="#3a2e18" stroke="#120e06" stroke-width="1.5"/><rect x="82.5" y="60.5" width="7" height="8" fill="#ffe08a"/>`;
  // tronco (casaco)
  s += `<path d="${raggedEllipse(106, C, 31, 45, 0.06, 44, r)}" fill="url(#bc)" stroke="#07090e" stroke-width="2"/>`;
  s += `<path d="M118 76 Q130 ${C} 118 148" stroke="${B.coatShade}" stroke-width="3" fill="none"/>`;
  for (const y of [92, 104, 120, 132]) s += `<circle cx="125" cy="${y}" r="2.6" fill="${B.brass}" stroke="#5a4412" stroke-width="0.8"/>`;
  // dragonas douradas
  for (const y of [72, 152]) s += `<rect x="94" y="${y - 7}" width="20" height="14" rx="3" fill="${B.brass}" stroke="#5a4412" stroke-width="1.2"/>`;
  // manchas de sangue e rasgos
  for (let i = 0; i < 5; i++) s += `<ellipse cx="${f(r.range(92, 124))}" cy="${f(r.range(80, 146))}" rx="${f(r.range(6, 13))}" ry="${f(r.range(4, 9))}" fill="url(#bb)"/>`;
  // braços
  s += normalArm(pose.handL);
  s += mutatedArm(pose.handR);
  // cabeça com quepe de condutor
  const hx = 112 + pose.headFwd;
  s += `<circle cx="${f(hx + 4)}" cy="${C}" r="17" fill="url(#bs)" stroke="#1a1d16" stroke-width="1.5"/>`;
  s += `<circle cx="${f(hx)}" cy="${C}" r="19" fill="url(#cap)" stroke="#06080c" stroke-width="2"/>`;
  s += `<circle cx="${f(hx)}" cy="${C}" r="14" fill="none" stroke="${B.brass}" stroke-width="2.5" opacity=".9"/>`;
  s += `<path d="M${f(hx + 12)} ${C - 15} A19 19 0 0 1 ${f(hx + 12)} ${C + 15} L${f(hx + 22)} ${C + 9} A12 12 0 0 0 ${f(hx + 22)} ${C - 9} Z" fill="#0a0d14"/>`;
  s += `<rect x="${f(hx - 4)}" y="${C - 3}" width="8" height="6" rx="1" fill="${B.brass}"/>`;
  s += `</g>`;
  return s;
}

/** Poses: 0-7 andar · 8-11 golpe · 12-13 investida · 14-17 pancada no chão · 18-19 rugido */
function poses() {
  const list = [];
  for (let i = 0; i < 8; i++) {
    const p = (i / 8) * Math.PI * 2;
    list.push({ phase: p, legAmp: 16, lean: 0, headFwd: 2, rot: Math.sin(p) * 3, handL: [166 + Math.sin(p) * 6, 86], handR: [160 - Math.sin(p) * 8, 148] });
  }
  for (const h of [[112, 196], [172, 178], [198, 114], [162, 76]]) list.push({ phase: 0, legAmp: 16, lean: 4, headFwd: 4, handL: [158, 80], handR: h });
  for (const p of [0.8, 2.4]) list.push({ phase: p, legAmp: 20, lean: 12, headFwd: 8, handL: [84, 52], handR: [84, 176] });
  for (const [l, rr, lean] of [[[118, 28], [118, 196], -4], [[150, 36], [150, 188], 0], [[190, 92], [190, 134], 8], [[178, 98], [178, 128], 6]]) {
    list.push({ phase: 0, legAmp: 16, lean, headFwd: 4, handL: l, handR: rr });
  }
  for (const spread of [0, 6]) list.push({ phase: 0, legAmp: 16, lean: 2, headFwd: 8, handL: [112 - spread, 22 - spread], handR: [112 - spread, 202 + spread] });
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
  s += `<g transform="translate(150 112) rotate(90) translate(-112 -112)">${bossFrame({ phase: 0, legAmp: 0, lean: 0, headFwd: 0, handL: [150, 40], handR: [170, 196] })}</g>`;
  return svgDoc(288, 224, defs, s);
}
