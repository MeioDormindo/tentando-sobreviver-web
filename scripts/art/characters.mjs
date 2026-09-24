// Personagens vistos de cima, virados para +X (direita). Frames de 128x128 (escala 2x do mundo).
import { blobPath, f, ik, line, linear, polyline, radial, raggedEllipse, rng, sheet } from './lib.mjs';
import { drawGun, posesFor } from './weapons.mjs';
import { head, UNDEAD, undeadCorpse, undeadDefs, undeadFrame, undeadPoses } from './undead.mjs';
import { crawlerFrames, houndDefs, houndFrames } from './beasts.mjs';

export const CHAR_FRAME = 128;
const C = 64;

// ───────────────────────────── Jogador ─────────────────────────────

const P = {
  jacket: '#4b5140',
  jacketShade: '#30341f',
  jacketLight: '#6a7254',
  jacketLine: '#1b1e14',
  pants: '#3a3e45',
  pantsShade: '#262a30',
  shoes: '#2a2420',
  pack: '#5d4731',
  packShade: '#3c2d1d',
  strap: '#2a2016',
  glove: '#232323',
  skin: '#c49c7c',
  hair: '#35271b',
  hairLight: '#54402d',
  gun: '#19191b',
  gunLight: '#44464b',
};

const playerDefs =
  radial('pjk', [[0, P.jacketLight], [0.55, P.jacket], [1, P.jacketShade]]) +
  radial('ppk', [[0, '#7a5f42'], [0.6, P.pack], [1, P.packShade]]) +
  radial('phr', [[0, P.hairLight], [0.7, P.hair], [1, '#1f160f']], '60%', '35%') +
  radial('psk', [[0, '#dcb799'], [1, '#a47e60']], '70%', '40%');

function arm(shoulder, hand, bend) {
  const { elbow, hand: h } = ik(shoulder, hand, 19, 20, bend);
  return {
    hand: h,
    svg:
      line(shoulder, elbow, P.jacketLine, 11.5) +
      line(shoulder, elbow, P.jacket, 9) +
      line(elbow, h, P.jacketLine, 10) +
      line(elbow, h, P.jacket, 7.8) +
      line([elbow[0] * 0.6 + h[0] * 0.4, elbow[1] * 0.6 + h[1] * 0.4], elbow, P.jacketLight, 2.2, 'opacity=".35"'),
  };
}

/**
 * Tronco do jogador. pose: posição das mãos, da arma e se segura um carregador.
 */
function playerTorso(pose, kind) {
  const SL = [61, 45];
  const SR = [61, 83];
  let s = '';

  // Mochila + saco de dormir
  s += `<rect x="31" y="51" width="7" height="26" rx="3.5" fill="#3d4632" stroke="#1d2218" stroke-width="1"/>`;
  s += line([32, 58], [37, 58], '#262c1f', 1.4) + line([32, 70], [37, 70], '#262c1f', 1.4);
  s += `<rect x="36" y="47" width="19" height="34" rx="5.5" fill="url(#ppk)" stroke="#20170e" stroke-width="1.3"/>`;
  s += `<rect x="38.5" y="51" width="9" height="26" rx="3" fill="${P.packShade}" opacity=".55"/>`;
  s += line([40, 64], [46, 64], '#1c140c', 1.2, 'opacity=".7"');

  // Tronco (ombros vistos de cima)
  s += `<ellipse cx="61" cy="64" rx="15.5" ry="25" fill="url(#pjk)" stroke="${P.jacketLine}" stroke-width="1.5"/>`;
  s += `<path d="M66 44 Q72 64 66 84" stroke="${P.jacketShade}" stroke-width="1.4" fill="none" opacity=".6"/>`;
  // Alças da mochila
  s += `<path d="M47 50 Q57 45.5 70 49" stroke="${P.strap}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`;
  s += `<path d="M47 78 Q57 82.5 70 79" stroke="${P.strap}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`;
  // Gola/capuz
  s += `<path d="M53.5 54 Q49 64 53.5 74" stroke="${P.jacketShade}" stroke-width="5" fill="none" stroke-linecap="round"/>`;

  // Braços
  const left = arm(SL, pose.left, -1);
  const right = arm(SR, pose.right, 1);
  s += left.svg + right.svg;

  // Arma entre os braços e as luvas
  s += drawGun(kind, pose.gun[0], pose.gun[1], pose.gun[2]);

  // Carregador na mão (recarga)
  if (pose.mag) {
    s += `<rect x="${f(left.hand[0] - 2.5)}" y="${f(left.hand[1] - 6)}" width="5" height="11" rx="1" fill="#111" transform="rotate(20 ${f(left.hand[0])} ${f(left.hand[1])})"/>`;
  }

  // Luvas
  s += `<circle cx="${f(left.hand[0])}" cy="${f(left.hand[1])}" r="5" fill="${P.glove}" stroke="#0e0e0e" stroke-width="1"/>`;
  s += `<circle cx="${f(right.hand[0])}" cy="${f(right.hand[1])}" r="5.2" fill="${P.glove}" stroke="#0e0e0e" stroke-width="1"/>`;

  // Cabeça: pele na frente, cabelo cobrindo o topo/nuca
  s += `<ellipse cx="62" cy="52.6" rx="2.6" ry="2" fill="#a47e60"/><ellipse cx="62" cy="75.4" rx="2.6" ry="2" fill="#a47e60"/>`;
  s += `<circle cx="63.5" cy="64" r="11.6" fill="url(#psk)" stroke="#2b1f16" stroke-width="1.2"/>`;
  s += `<path d="M71 56.5 Q64 64 71 71.5 L60 76.5 Q50 64 60 51.5 Z" fill="url(#phr)"/>`;
  s += `<circle cx="61" cy="64" r="10.6" fill="url(#phr)"/>`;
  s += polyline([[54, 59], [60, 60.5], [66, 59]], '#20170f', 1, 'opacity=".6"');
  s += polyline([[54, 69], [60, 67.5], [66, 69]], '#20170f', 1, 'opacity=".6"');
  s += polyline([[53, 64], [62, 64.5]], '#6b523b', 1, 'opacity=".5"');
  return s;
}

/** Frames: 0 = mirando · 1 = recuo do tiro · 2..6 = recarga (poses por tipo de arma). */
export function playerTorsoSheet(kind) {
  return sheet(CHAR_FRAME, CHAR_FRAME, playerDefs, posesFor(kind).map((pose) => playerTorso(pose, kind)));
}

/** Pernas: ciclo de caminhada de 8 frames (frame 0 = parado). */
function legsFrame(phase, amp, colors, dragRight = 1) {
  const hipL = [60, 55.5];
  const hipR = [60, 72.5];
  const sL = Math.sin(phase) * amp;
  const sR = -Math.sin(phase) * amp * dragRight;
  let s = '';
  const leg = (hip, off, lift) => {
    const foot = [hip[0] + off, hip[1] + (hip[1] < 64 ? -1 : 1) * lift];
    return (
      line(hip, foot, colors.pantsShade, 11) +
      line(hip, foot, colors.pants, 8.5) +
      `<ellipse cx="${f(foot[0] + 3)}" cy="${f(foot[1])}" rx="7.2" ry="4.6" fill="${colors.shoes}" stroke="#110e0c" stroke-width="1"/>`
    );
  };
  const liftL = Math.max(0, Math.cos(phase)) * 1.2;
  const liftR = Math.max(0, -Math.cos(phase)) * 1.2;
  s += leg(hipL, sL, liftL) + leg(hipR, sR, liftR);
  return s;
}

export function playerLegsSheet() {
  const frames = [];
  for (let i = 0; i < 8; i++) frames.push(legsFrame((i / 8) * Math.PI * 2, 15, P));
  return sheet(CHAR_FRAME, CHAR_FRAME, '', frames);
}

// ───────────────────────────── Zumbis ─────────────────────────────

export const ZOMBIE_VARIANTS = {
  a: { shirt: '#5e5343', shirtShade: '#3a3228', pants: '#3c4048', pantsShade: '#272a30', shoes: '#231e19', skin: '#6c765f', skinShade: '#454d3d', hair: '#2a241e', seed: 11, bald: false },
  b: { shirt: '#3d4a58', shirtShade: '#242d37', pants: '#2e2e2c', pantsShade: '#1c1c1b', shoes: '#2c241c', skin: '#77806b', skinShade: '#4b5344', hair: '#6a5838', seed: 23, bald: false },
  c: { shirt: '#6b4a3a', shirtShade: '#43291e', pants: '#4a3f33', pantsShade: '#2f281f', shoes: '#1d1a17', skin: '#66705a', skinShade: '#3f4737', hair: '#1d1a17', seed: 37, bald: true },
  // Runner: magro, roupa em farrapos ensanguentada, corre inclinado (GDD §55)
  runner: { shirt: '#5a2e2a', shirtShade: '#35191a', pants: '#2c2e33', pantsShade: '#1b1c20', shoes: '#1a1614', skin: '#5f6953', skinShade: '#394032', hair: '#15120f', seed: 53, bald: false, rx: 13.5, ry: 23, gait: 'run', bloody: true },
  // Tank: corpo maior com proteção improvisada e capacete (GDD §55)
  tank: { shirt: '#3d4238', shirtShade: '#262a22', pants: '#33372f', pantsShade: '#20231d', shoes: '#191714', skin: '#6c7560', skinShade: '#444c3b', hair: '#1d1a17', seed: 67, bald: true, rx: 19, ry: 28, armor: true, helmet: true, scale: 1.375 },
  // Exploder: inchado, com pústulas brilhantes — sinal claro de infecção (GDD §55)
  // Hospital: as mesmas proporções dos tipos originais
  h_a: { scale: 1 },
  h_b: { scale: 1 },
  h_c: { scale: 1 },
  h_runner: { scale: 1 },
  h_tank: { scale: 1.375 },
  h_exploder: { scale: 1, noCorpse: true },
  // Inimigos novos do Hospital (body = desenho próprio, sem cabeça grande)
  crawler: { scale: 1, noCorpse: true, body: 'crawler' },
  spitter: { scale: 1 },
  armored: { scale: 1.125 },
  armored_broken: { scale: 1.125 },
  hound: { scale: 1, noCorpse: true, body: 'hound' },
  exploder: { shirt: '#4f5a36', shirtShade: '#303822', pants: '#3a3a2c', pantsShade: '#23231a', shoes: '#1d1a17', skin: '#7f8c56', skinShade: '#4f5a32', hair: '#1d1a17', seed: 79, bald: true, rx: 19.5, ry: 27, pustules: true, noCorpse: true },
};

function zombieDefs(v, id) {
  return (
    radial(`zs${id}`, [[0, v.shirt], [0.7, v.shirt], [1, v.shirtShade]]) +
    radial(`zk${id}`, [[0, v.skin], [1, v.skinShade]], '65%', '40%') +
    radial(`zb${id}`, [[0, '#5a0f0c', 0.9], [0.6, '#3d0907', 0.75], [1, '#3d0907', 0]], '50%', '50%', '50%') +
    radial(`zp${id}`, [[0, '#fff6a0'], [0.35, '#d7e04a'], [0.75, '#8fa82a', 0.9], [1, '#4f5a32', 0]], '45%', '40%', '55%') +
    linear(`zm${id}`, [[0, '#7c8288'], [1, '#4a4f55']], 0, 0, 1, 1)
  );
}

function zombieArm(v, shoulder, hand, bend, r) {
  const { elbow, hand: h } = ik(shoulder, hand, 19, 20, bend);
  const tear = [elbow[0] * 0.92 + h[0] * 0.08, elbow[1] * 0.92 + h[1] * 0.08];
  let s =
    line(shoulder, tear, '#141410', 11.5) +
    line(shoulder, tear, v.shirt, 9.2) +
    line(shoulder, tear, v.shirtShade, 3, 'opacity=".5"') +
    line(tear, h, '#1a1d16', 8.6) +
    line(tear, h, v.skin, 6.6) +
    line(tear, h, '#2c2a1f', 6.6, 'opacity=".25"') +
    line(elbow, h, v.skinShade, 2, 'opacity=".5"');
  // Mão com dedos em garra
  const ang = Math.atan2(h[1] - elbow[1], h[0] - elbow[0]);
  for (const spread of [-0.55, -0.15, 0.25]) {
    const a = ang + spread;
    s += line(h, [h[0] + Math.cos(a) * 7, h[1] + Math.sin(a) * 7], v.skinShade, 2.3);
  }
  s += `<circle cx="${f(h[0])}" cy="${f(h[1])}" r="4.4" fill="${v.skin}" stroke="#1a1d16" stroke-width="1"/>`;
  if (r.next() > 0.5) s += `<circle cx="${f(h[0] - 1)}" cy="${f(h[1] + 1)}" r="2" fill="#4a0d0a" opacity=".8"/>`;
  return s;
}

function zombieFrame(v, id, pose) {
  const r = rng(v.seed); // mesmo "rasgo" em todos os frames da variante
  let s = legsFrame(pose.phase, pose.legAmp, v, 0.55);
  s += `<g transform="rotate(${f(pose.sway)} 62 64) translate(${f(pose.lean)} 0)">`;

  // Tronco com roupa rasgada
  const rx = v.rx ?? 15.5;
  const ry = v.ry ?? 25;
  s += `<path d="${raggedEllipse(61, 64, rx, ry, 0.12, 36, r)}" fill="url(#zs${id})" stroke="#15130f" stroke-width="1.4"/>`;
  // Buracos na roupa mostrando pele e manchas de sangue
  for (let i = 0; i < 3; i++) {
    const cx = r.range(52, 70);
    const cy = r.range(46, 82);
    s += `<path d="${blobPath(cx, cy, r.range(2.5, 4.5), 0.6, 7, r)}" fill="${v.skinShade}" opacity=".9"/>`;
  }
  for (let i = 0; i < (v.bloody ? 7 : 4); i++) {
    s += `<ellipse cx="${f(r.range(50, 72))}" cy="${f(r.range(44, 84))}" rx="${f(r.range(4, 9))}" ry="${f(r.range(3, 7))}" fill="url(#zb${id})"/>`;
  }
  // Proteção improvisada: placas de metal nos ombros e peito, presas por tiras
  if (v.armor) {
    for (const [px, py, w, h, rot] of [[48, 38, 22, 14, -8], [48, 76, 22, 14, 8], [60, 55, 12, 18, 0]]) {
      s += `<rect x="${px}" y="${py}" width="${w}" height="${h}" rx="2" fill="url(#zm${id})" stroke="#1b1d20" stroke-width="1.5" transform="rotate(${rot} ${px + w / 2} ${py + h / 2})"/>`;
      s += `<circle cx="${px + 3}" cy="${py + 3}" r="1.2" fill="#2a2d31"/><circle cx="${px + w - 3}" cy="${py + h - 3}" r="1.2" fill="#2a2d31"/>`;
    }
    s += line([46, 50], [74, 78], '#2a2016', 3.5) + line([46, 78], [74, 50], '#2a2016', 3.5);
  }
  // Pústulas brilhantes
  if (v.pustules) {
    for (let i = 0; i < 7; i++) {
      const cx = r.range(48, 74);
      const cy = r.range(42, 86);
      const rad = r.range(3, 6.5);
      s += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(rad + 1.5)}" fill="#3a4422" opacity=".6"/>`;
      s += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(rad)}" fill="url(#zp${id})"/>`;
    }
    for (let i = 0; i < 5; i++) {
      const a = r.range(0, Math.PI * 2);
      s += line([61 + Math.cos(a) * 6, 64 + Math.sin(a) * 10], [61 + Math.cos(a) * rx * 0.9, 64 + Math.sin(a) * ry * 0.9], '#3b4a1c', 1.1, 'opacity=".7"');
    }
  }

  s += zombieArm(v, [60, 43.5], pose.handL, -1, r);
  s += zombieArm(v, [60, 84.5], pose.handR, 1, r);

  // Cabeça, um pouco caída para a frente
  const hx = 64 + pose.headFwd;
  s += `<circle cx="${f(hx)}" cy="64.5" r="11.2" fill="url(#zk${id})" stroke="#1a1d16" stroke-width="1.2"/>`;
  if (v.helmet) {
    s += `<circle cx="${f(hx - 1.5)}" cy="64.5" r="11.8" fill="#b8932a" stroke="#1c1608" stroke-width="1.5"/>`;
    s += `<path d="M${f(hx - 12)} 64.5 A12 12 0 0 1 ${f(hx + 9)} 60" stroke="#d9b447" stroke-width="2" fill="none" opacity=".7"/>`;
    s += line([hx - 12, 64.5], [hx + 10, 64.5], '#6e5716', 2);
  } else if (!v.bald) {
    s += `<path d="${blobPath(hx - 3.5, 64, 9.2, 0.35, 9, r)}" fill="${v.hair}" opacity=".95"/>`;
    s += `<circle cx="${f(hx - 1)}" cy="58" r="2.4" fill="${v.skinShade}"/>`;
  } else {
    s += `<ellipse cx="${f(hx - 3)}" cy="61" rx="4" ry="2.6" fill="#b2baa2" opacity=".35"/>`;
  }
  // Ferida na cabeça
  s += `<path d="${blobPath(hx + r.range(-4, 2), r.range(58, 70), 3.2, 0.7, 7, r)}" fill="#5a0e0b"/>`;
  s += `</g>`;
  return s;
}

/** Tamanho do frame de uma variante (o Tank é maior). */
export const zombieFrameSize = (id) => Math.round(CHAR_FRAME * (ZOMBIE_VARIANTS[id].scale ?? 1));

/** Frames 0-7: andar (arrastado ou correndo) · 8-12: ataque. Arte em undead.mjs. */
/** Easter egg "modo cabeção": só a cabeça da variante, bem grande (72x72, virada para +X). */
export function zombieBigHead(id) {
  const u = UNDEAD[id];
  return sheet(72, 72, undeadDefs(u, id), [head(u, id, 34, 36, rng(u.seed + 5), { scale: 2.2, jaw: 0.7 })]);
}

export function zombieSheet(id) {
  const v = ZOMBIE_VARIANTS[id];
  const u = UNDEAD[id];
  if (v.body === 'hound') return sheet(zombieFrameSize(id), zombieFrameSize(id), houndDefs(), houndFrames());
  const frames = v.body === 'crawler' ? crawlerFrames(u, id) : undeadPoses(u).map((pose) => undeadFrame(u, id, pose));
  const size = zombieFrameSize(id);
  const scale = v.scale ?? 1;
  const scaled = scale === 1 ? frames : frames.map((fr) => `<g transform="scale(${scale})">${fr}</g>`);
  return sheet(size, size, undeadDefs(u, id), scaled);
}

/** Variantes que deixam cadáver (o Exploder explode). */
export const CORPSE_IDS = Object.keys(ZOMBIE_VARIANTS).filter((id) => !ZOMBIE_VARIANTS[id].noCorpse);

// ───────────────────────────── Cadáveres ─────────────────────────────

export const CORPSE_W = 176;
export const CORPSE_H = 144;

/** Corpo caído de bruços, cabeça para +X. Um frame por variante (a, b, c). */
function corpseFrame(v, id, seed) {
  const r = rng(seed);
  const cx = 88;
  const cy = 72;
  let s = '';
  // Pernas
  const legA = [[cx - 12, cy - 7], [cx - 58, cy - 16 + r.range(-6, 4)]];
  const legB = [[cx - 12, cy + 7], [cx - 56, cy + 14 + r.range(-4, 8)]];
  for (const [hip, foot] of [legA, legB]) {
    s += line(hip, foot, v.pantsShade, 13) + line(hip, foot, v.pants, 10.5);
    s += `<ellipse cx="${f(foot[0] - 3)}" cy="${f(foot[1])}" rx="5" ry="7" fill="${v.shoes}"/>`;
  }
  // Braços abertos
  const armA = [[cx + 18, cy - 20], [cx + 30 + r.range(-6, 10), cy - 44 + r.range(-4, 6)]];
  const armB = [[cx + 16, cy + 20], [cx - 4 + r.range(-8, 6), cy + 42]];
  for (const [sh, h] of [armA, armB]) {
    s += line(sh, h, '#15130f', 10) + line(sh, h, v.skin, 7.5);
    s += `<circle cx="${f(h[0])}" cy="${f(h[1])}" r="4.2" fill="${v.skinShade}"/>`;
  }
  // Tronco (costas)
  s += `<path d="${raggedEllipse(cx + 4, cy, 27, 19, 0.1, 40, r)}" fill="url(#zs${id})" stroke="#15130f" stroke-width="1.4"/>`;
  s += `<ellipse cx="${f(cx + r.range(-6, 10))}" cy="${f(cy + r.range(-6, 6))}" rx="11" ry="8" fill="url(#zb${id})"/>`;
  s += `<ellipse cx="${f(cx + r.range(-10, 6))}" cy="${f(cy + r.range(-8, 8))}" rx="8" ry="6" fill="url(#zb${id})"/>`;
  // Cabeça
  s += `<circle cx="${cx + 40}" cy="${f(cy + r.range(-3, 3))}" r="11" fill="url(#zk${id})" stroke="#1a1d16" stroke-width="1.2"/>`;
  if (!v.bald) s += `<path d="${blobPath(cx + 38, cy, 9, 0.35, 9, r)}" fill="${v.hair}"/>`;
  return s;
}

export function corpseSheet() {
  const ids = CORPSE_IDS;
  const defs = ids.map((id) => undeadDefs(UNDEAD[id], id)).join('');
  const frames = ids.map((id, i) => {
    const content = undeadCorpse(UNDEAD[id], id, 100 + i * 17);
    const scale = ZOMBIE_VARIANTS[id].scale ?? 1;
    return scale === 1 ? content : `<g transform="translate(88 72) scale(${scale * 0.95}) translate(-88 -72)">${content}</g>`;
  });
  return sheet(CORPSE_W, CORPSE_H, defs, frames);
}

// ───────────────────────────── Sombra ─────────────────────────────

export function softShadow() {
  const defs = `<filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><defs>${defs}</defs>` +
    `<ellipse cx="48" cy="48" rx="28" ry="28" fill="#000" opacity=".55" filter="url(#b)"/></svg>\n`;
}

export { linear };
