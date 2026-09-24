// Criaturas que não andam em pé (Hospital): Rastejante (sem pernas, se arrasta pelos braços)
// e Cão Infernal (quadrúpede em brasa). Mesma grade dos zumbis: 13 frames de 128 px
// (0–7 andar, 8–12 ataque), virados para +X.
import { blobPath, f, rng } from './lib.mjs';
import { head, limb } from './undead.mjs';

const OUT = '#0e0f0c';

// ───────────────────────────── Rastejante ─────────────────────────────

/**
 * Tronco deitado com a camisola arrastando, tocos das pernas deixando rastro de sangue
 * e os dois braços puxando o corpo para a frente.
 */
function crawlerFrame(v, id, pose) {
  const r = rng(v.seed);
  const cx = 52;
  const cy = 64;
  let s = '';
  // rastro de sangue e tocos das pernas
  s += `<path d="M${cx - 34} ${cy - 6} Q${cx - 50} ${cy} ${cx - 34} ${cy + 6}" stroke="#4a0906" stroke-width="7" fill="none" opacity=".55"/>`;
  for (const sgn of [-1, 1]) {
    s += limb([cx - 14, cy + sgn * 7], [cx - 30 - pose.drag, cy + sgn * 9], 9, 7, v.pants);
    s += `<ellipse cx="${f(cx - 31 - pose.drag)}" cy="${f(cy + sgn * 9)}" rx="4" ry="3.5" fill="#5a0f0b"/>`;
  }
  // tronco colado ao chão
  s += `<ellipse cx="${cx}" cy="${cy}" rx="24" ry="17" fill="url(#uc${id})" stroke="${OUT}" stroke-width="1.5"/>`;
  s += `<path d="M${cx - 14} ${cy - 13} Q${cx - 20} ${cy} ${cx - 14} ${cy + 13}" stroke="${v.clothShade}" stroke-width="1.5" fill="none"/>`;
  for (let i = 0; i < 8; i++) s += `<circle cx="${f(cx + r.range(-18, 16))}" cy="${f(cy + r.range(-12, 12))}" r="1.1" fill="${v.accent}" opacity=".55"/>`;
  s += `<ellipse cx="${cx - 4}" cy="${cy + 3}" rx="7" ry="5" fill="url(#ub${id})"/>`;
  // braços puxando (um à frente, outro recolhido, alternando)
  for (const [sgn, reach] of [[-1, pose.reachL], [1, pose.reachR]]) {
    const shoulder = [cx + 12, cy + sgn * 13];
    const hand = [cx + 20 + reach, cy + sgn * (22 - reach * 0.25)];
    const elbow = [(shoulder[0] + hand[0]) / 2 + 4, (shoulder[1] + hand[1]) / 2 + sgn * 6];
    s += limb(shoulder, elbow, 6, 5, `url(#uk${id})`);
    s += limb(elbow, hand, 5, 4.2, `url(#uk${id})`);
    for (let k = -1; k <= 1; k++) s += `<path d="M${f(hand[0])} ${f(hand[1] + k * 2)} l5 ${f(k * 1.5)}" stroke="${v.skinDark}" stroke-width="1.6" stroke-linecap="round"/>`;
  }
  // cabeça baixa, olhando para a frente
  s += head(v, id, cx + 26, cy + (pose.headTilt ?? 0), r, { jaw: pose.jaw, scale: 0.9 });
  return s;
}

/** 8 frames rastejando + 5 de bote. */
export function crawlerPoses() {
  const list = [];
  for (let i = 0; i < 8; i++) {
    const p = (i / 8) * Math.PI * 2;
    list.push({ reachL: 6 + 12 * Math.max(0, Math.sin(p)), reachR: 6 + 12 * Math.max(0, -Math.sin(p)), drag: 3 * Math.sin(p), jaw: 0.5, headTilt: Math.sin(p) * 1.5 });
  }
  for (const k of [0.2, 0.6, 1, 0.8, 0.4]) list.push({ reachL: 10 + 16 * k, reachR: 10 + 16 * k, drag: 0, jaw: 0.4 + 0.6 * k, headTilt: 0 });
  return list;
}

export const crawlerFrames = (v, id) => crawlerPoses().map((pose) => crawlerFrame(v, id, pose));

// ───────────────────────────── Cão Infernal ─────────────────────────────

const HOUND = { fur: '#2a1512', furShade: '#150908', ember: '#ff7a1a', emberHot: '#ffd36a', eye: '#ffe066' };

export function houndDefs() {
  return (
    `<radialGradient id="hb" cx="45%" cy="40%" r="70%"><stop offset="0" stop-color="#4a241c"/><stop offset=".7" stop-color="${HOUND.fur}"/><stop offset="1" stop-color="${HOUND.furShade}"/></radialGradient>` +
    `<radialGradient id="hg" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${HOUND.emberHot}" stop-opacity=".9"/><stop offset="1" stop-color="${HOUND.ember}" stop-opacity="0"/></radialGradient>`
  );
}

/** Quadrúpede magro: patas em galope, costelas em brasa, focinho aberto e cauda. */
function houndFrame(pose) {
  const r = rng(991);
  const cx = 58;
  const cy = 64;
  let s = `<ellipse cx="${cx}" cy="${cy}" rx="40" ry="22" fill="url(#hg)" opacity=".35"/>`;
  // patas (atrás do corpo): dianteiras e traseiras em fases opostas
  const legs = [
    [cx + 16, -1, pose.front], [cx + 16, 1, -pose.front],
    [cx - 18, -1, pose.back], [cx - 18, 1, -pose.back],
  ];
  for (const [x, sgn, swing] of legs) {
    const hip = [x, cy + sgn * 9];
    const paw = [x + swing * 14, cy + sgn * 17];
    s += limb(hip, paw, 6, 3.5, HOUND.furShade);
    s += `<ellipse cx="${f(paw[0] + 2)}" cy="${f(paw[1])}" rx="3.5" ry="2.6" fill="#0b0605"/>`;
  }
  // cauda
  s += `<path d="M${cx - 30} ${cy} Q${cx - 44} ${f(cy + pose.tail * 10)} ${cx - 52} ${f(cy + pose.tail * 4)}" stroke="${HOUND.fur}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
  // corpo (peito largo, cintura fina)
  s += `<path d="M${cx - 30} ${cy} Q${cx - 26} ${cy - 13} ${cx - 6} ${cy - 11} Q${cx + 14} ${cy - 15} ${cx + 26} ${cy - 8} Q${cx + 32} ${cy} ${cx + 26} ${cy + 8} Q${cx + 14} ${cy + 15} ${cx - 6} ${cy + 11} Q${cx - 26} ${cy + 13} ${cx - 30} ${cy} Z" fill="url(#hb)" stroke="${OUT}" stroke-width="1.5"/>`;
  // costelas e rachaduras em brasa
  for (let i = 0; i < 4; i++) s += `<path d="M${cx - 4 + i * 6} ${cy - 9} Q${cx - 1 + i * 6} ${cy} ${cx - 4 + i * 6} ${cy + 9}" stroke="${HOUND.ember}" stroke-width="1.4" fill="none" opacity="${f(0.55 + 0.35 * pose.glow)}"/>`;
  s += `<path d="${blobPath(cx - 16, cy + 2, 4, 0.6, 7, r)}" fill="${HOUND.emberHot}" opacity="${f(0.4 + 0.4 * pose.glow)}"/>`;
  // cabeça: crânio, orelhas pontudas, focinho com dentes e olhos amarelos
  const hx = cx + 34 + pose.lunge;
  s += `<path d="M${hx - 8} ${cy - 9} L${hx - 14} ${cy - 16} L${hx - 3} ${cy - 10} Z M${hx - 8} ${cy + 9} L${hx - 14} ${cy + 16} L${hx - 3} ${cy + 10} Z" fill="${HOUND.furShade}" stroke="${OUT}" stroke-width="1"/>`;
  s += `<ellipse cx="${hx}" cy="${cy}" rx="11" ry="9" fill="url(#hb)" stroke="${OUT}" stroke-width="1.4"/>`;
  const jaw = 3 + pose.jaw * 5;
  s += `<path d="M${hx + 6} ${cy - 5} L${hx + 20} ${cy - jaw / 2} L${hx + 20} ${cy + jaw / 2} L${hx + 6} ${cy + 5} Z" fill="#1c0b09" stroke="${OUT}" stroke-width="1.2"/>`;
  s += `<path d="M${hx + 8} ${cy - 2} L${hx + 19} ${cy - jaw / 2 + 1} M${hx + 8} ${cy + 2} L${hx + 19} ${cy + jaw / 2 - 1}" stroke="#e8e0c8" stroke-width="1.3" stroke-dasharray="1.5 1.5"/>`;
  s += `<path d="M${hx + 12} ${cy - 1} L${hx + 19} ${cy} L${hx + 12} ${cy + 1}" fill="${HOUND.ember}" opacity=".8"/>`;
  for (const sgn of [-1, 1]) s += `<circle cx="${hx + 5}" cy="${cy + sgn * 4.5}" r="2" fill="${HOUND.eye}"/>`;
  return s;
}

/** 8 frames de galope + 5 de mordida. */
export function houndFrames() {
  const list = [];
  for (let i = 0; i < 8; i++) {
    const p = (i / 8) * Math.PI * 2;
    list.push(houndFrame({ front: Math.sin(p), back: Math.sin(p + Math.PI * 0.8), tail: Math.sin(p * 2), jaw: 0.3, lunge: 0, glow: 0.5 + 0.5 * Math.sin(p) }));
  }
  for (const k of [0.2, 0.7, 1, 0.8, 0.3]) list.push(houndFrame({ front: -0.6 * k, back: 0.4 * k, tail: 0.5, jaw: k, lunge: 8 * k, glow: 1 }));
  return list;
}
