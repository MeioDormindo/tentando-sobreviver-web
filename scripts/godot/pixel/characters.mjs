// Personagens em pixel art: peças do corpo, cores e animações (quadros-chave).
// Medidas em metros, no espaço do modelo: x = direita do personagem, y = frente, z = cima.
import { hex } from './raster.mjs';
import { mul, translate, rotX } from './raster.mjs';
import { weaponShape } from './weapons.mjs';

// ───────────────────────── Humanoide ─────────────────────────

export const HUMAN_BONES = [
  { name: 'hips', pivot: [0, 0, 0.92] },
  { name: 'spine', parent: 'hips', pivot: [0, 0, 1.05] },
  { name: 'head', parent: 'spine', pivot: [0, 0, 1.48] },
  { name: 'arm.R', parent: 'spine', pivot: [0.29, 0, 1.44], side: 1 },
  { name: 'arm.L', parent: 'spine', pivot: [-0.29, 0, 1.44], side: -1 },
  // Antebraços (cotovelo): sem pose ficam retos, como o braço inteiro de antes.
  { name: 'fore.R', parent: 'arm.R', pivot: [0.29, 0, 1.14], side: 1 },
  { name: 'fore.L', parent: 'arm.L', pivot: [-0.29, 0, 1.14], side: -1 },
  { name: 'leg.R', parent: 'hips', pivot: [0.12, 0, 0.92], side: 1 },
  { name: 'leg.L', parent: 'hips', pivot: [-0.12, 0, 0.92], side: -1 },
];

const box = (bone, at, size, color, extra = {}) => ({ bone, at, size, color, ...extra });
const darken = (c) => c.map((v) => Math.round(v * 0.45));

/**
 * Corpo humano em peças. c: {torso, sleeve, skin, pants, shoes, eyes}; bulk engorda o tronco.
 * extra(parts, c): acessórios.
 */
export function humanoid(c, { bulk = 1, extra = null, scale = 1 } = {}) {
  const w = 0.5 * bulk;
  const parts = [
    box('spine', [0, 0, 1.24], [w, 0.28 * bulk, 0.5], c.torso),
    box('hips', [0, 0, 0.98], [0.44 * bulk, 0.26 * bulk, 0.2], c.pants),
    box('spine', [0, 0, 1.5], [0.13, 0.13, 0.08], c.skin),
    box('head', [0, 0.01, 1.64], [0.27, 0.27, 0.3], c.skin, { shape: 'ellipsoid' }),
    box('head', [0, 0.13, 1.61], [0.05, 0.05, 0.06], c.skin, { shape: 'ellipsoid' }),  // nariz
    box('head', [0.065, 0.125, 1.675], [0.055, 0.03, 0.05], c.eyes, { flat: true, shape: 'ellipsoid' }),
    box('head', [-0.065, 0.125, 1.675], [0.055, 0.03, 0.05], c.eyes, { flat: true, shape: 'ellipsoid' }),
    box('head', [0.065, 0.12, 1.72], [0.07, 0.03, 0.018], c.brow || darken(c.skin), { flat: true }),  // sobrancelhas
    box('head', [-0.065, 0.12, 1.72], [0.07, 0.03, 0.018], c.brow || darken(c.skin), { flat: true }),
    box('head', [0, 0.125, 1.565], [0.08, 0.03, 0.02], c.mouth || darken(c.skin), { flat: true }),  // boca
    box('head', [0.14, 0, 1.64], [0.04, 0.07, 0.09], c.skin, { shape: 'ellipsoid' }),  // orelhas
    box('head', [-0.14, 0, 1.64], [0.04, 0.07, 0.09], c.skin, { shape: 'ellipsoid' }),
  ];
  for (const side of [1, -1]) {
    const arm = side > 0 ? 'arm.R' : 'arm.L';
    const fore = side > 0 ? 'fore.R' : 'fore.L';
    const leg = side > 0 ? 'leg.R' : 'leg.L';
    const x = side * (0.29 + (w - 0.5) * 0.5);
    parts.push(box(arm, [x, 0, 1.3], [0.13, 0.13, 0.32], c.sleeve));
    parts.push(box(arm, [x, 0, 1.16], [0.125, 0.125, 0.1], c.sleeve, { shape: 'ellipsoid' }));  // cotovelo
    parts.push(box(fore, [x, 0, 0.98], [0.11, 0.11, 0.32], c.forearm || c.skin));
    if (c.cuff) parts.push(box(fore, [x, 0, 0.87], [0.115, 0.115, 0.04], c.cuff));
    parts.push(box(fore, [x, 0.01, 0.8], [0.1, 0.11, 0.1], c.skin, { shape: 'ellipsoid' }));  // mão
    parts.push(box(leg, [side * 0.12, 0, 0.68], [0.17, 0.19, 0.48], c.pants));
    parts.push(box(leg, [side * 0.12, 0, 0.28], [0.15, 0.17, 0.36], c.pants));
    parts.push(box(leg, [side * 0.12, 0.04, 0.05], [0.16, 0.26, 0.1], c.shoes));
  }
  if (extra) extra(parts, c);
  return { bones: scaleBones(HUMAN_BONES, scale), parts: scaleParts(parts, scale), scale };
}

/** Escala o modelo inteiro (tanque, bosses): ossos e peças. */
function scaleParts(parts, s) {
  if (s === 1) return parts;
  return parts.map((p) => ({ ...p, at: p.at.map((v) => v * s), size: p.size.map((v) => v * s) }));
}

export function scaleBones(bones, s) {
  return bones.map((b) => ({ ...b, pivot: b.pivot.map((v) => v * s) }));
}

// ───────────────────────── Animações do humanoide ─────────────────────────

const key = (t, pose) => [t, pose];

/** Zumbi: braços esticados para a frente. */
export function zombieAnimations() {
  const reach = 1.35;
  const arms = (r, l, spread = 0) => ({ 'arm.R': { swing: r, spread }, 'arm.L': { swing: l, spread } });
  const walk = (phase) => ({
    ...arms(reach + 0.12 * phase, reach - 0.12 * phase),
    'leg.R': { swing: 0.45 * phase }, 'leg.L': { swing: -0.45 * phase },
    spine: { lean: 0.18, twist: 0.1 * phase }, head: { lean: 0.12 },
    hips: { loc: [0, 0, -0.03 * Math.abs(phase)] },
  });
  const run = (phase) => ({
    ...arms(reach * 0.7 + 0.35 * phase, reach * 0.7 - 0.35 * phase),
    'leg.R': { swing: 0.8 * phase }, 'leg.L': { swing: -0.8 * phase },
    spine: { lean: 0.35 }, head: { lean: -0.1 },
  });
  const crawl = (phase) => ({
    hips: { loc: [0, 0, -0.62], lean: 1.35 }, spine: { twist: 0.1 * phase }, head: { lean: -0.9 },
    ...arms(1.9 + 0.45 * phase, 1.9 - 0.45 * phase),
    'leg.R': { swing: -0.2 + 0.15 * phase }, 'leg.L': { swing: -0.2 - 0.15 * phase },
  });
  return [
    { name: 'Idle', frames: 4, fps: 4, loop: true, keys: [
      key(0, { ...arms(reach * 0.9, reach * 0.85), spine: { lean: 0.12 }, head: { lean: 0.1, twist: 0.1 } }),
      key(0.5, { ...arms(reach * 0.8, reach * 0.95), spine: { lean: 0.16 }, head: { lean: 0.05, twist: -0.1 } }),
      key(1, { ...arms(reach * 0.9, reach * 0.85), spine: { lean: 0.12 }, head: { lean: 0.1, twist: 0.1 } }),
    ] },
    { name: 'Walk', frames: 8, fps: 8, loop: true, keys: [key(0, walk(1)), key(0.25, walk(0)), key(0.5, walk(-1)), key(0.75, walk(0)), key(1, walk(1))] },
    { name: 'Run', frames: 6, fps: 12, loop: true, keys: [key(0, run(1)), key(0.5, run(-1)), key(1, run(1))] },
    { name: 'Attack', frames: 5, fps: 10, loop: false, keys: [
      key(0, { ...arms(reach, reach), spine: { lean: 0.15 } }),
      key(0.35, { ...arms(reach * 1.5, reach * 1.5, 0.3), spine: { lean: -0.1 } }),
      key(0.65, { ...arms(reach * 0.6, reach * 0.6, -0.1), spine: { lean: 0.45 } }),
      key(1, { ...arms(reach, reach), spine: { lean: 0.15 } }),
    ] },
    { name: 'Hurt', frames: 2, fps: 10, loop: false, keys: [
      key(0, { ...arms(reach * 0.7, reach * 0.9), spine: { lean: -0.3 }, head: { lean: -0.3 } }),
      key(1, { ...arms(reach, reach), spine: { lean: 0.1 } }),
    ] },
    ...deathAnimation(),
    { name: 'Crawl', frames: 8, fps: 8, loop: true, keys: [key(0, crawl(1)), key(0.5, crawl(-1)), key(1, crawl(1))] },
  ];
}

function deathAnimation() {
  return [{ name: 'Death', frames: 6, fps: 10, loop: false, keys: [
    key(0, {}),
    key(0.45, { hips: { loc: [0, 0, -0.35], lean: -0.6, twist: 0.1 }, 'arm.R': { swing: -0.5, spread: 0.6 }, 'arm.L': { swing: -0.3, spread: 0.5 }, 'leg.R': { swing: 0.4 }, head: { lean: -0.3 } }),
    key(1, { hips: { loc: [0, 0, -0.78], lean: -1.5, twist: 0.15 }, 'arm.R': { swing: -0.2, spread: 1.2 }, 'arm.L': { swing: -0.1, spread: 1.1 }, 'leg.R': { swing: 0.25 }, 'leg.L': { swing: -0.1 }, head: { lean: -0.2, twist: 0.4 } }),
  ] }];
}

/**
 * Posturas do jogador (ângulos achados levando cada mão ao ponto certo):
 * - fuzil ('rifle'): mão direita no cabo, na frente do peito, cotovelo junto ao corpo; a
 *   esquerda por baixo do cano;
 * - pistola ('pistol'): braços para a frente, as duas mãos juntas no cabo, na altura do peito.
 */
const STANCES = {
  rifle: {
    aim: (k = 0) => ({ 'arm.R': { swing: 0.05 * k, spread: -0.5 }, 'fore.R': { swing: 1.35 + 0.1 * k }, 'arm.L': { swing: 0.75 + 0.05 * k, spread: -0.9 }, 'fore.L': { swing: 0.05 } }),
    reload: [
      { 'arm.R': { swing: 0, spread: -0.35 }, 'fore.R': { swing: 0.65 }, 'arm.L': { swing: 0.35, spread: -0.7 }, 'fore.L': { swing: 0.05 }, head: { lean: 0.35 } },
      { 'arm.R': { swing: 0, spread: -0.35 }, 'fore.R': { swing: 0.65 }, 'arm.L': { swing: 0.2, spread: -0.4 }, 'fore.L': { swing: 0.9 }, head: { lean: 0.3 } },
    ],
  },
  pistol: {
    aim: (k = 0) => ({ 'arm.R': { swing: 0.6 + 0.12 * k, spread: -0.85 }, 'fore.R': { swing: 0.8 - 0.1 * k }, 'arm.L': { swing: 0.55 + 0.12 * k, spread: -0.9 }, 'fore.L': { swing: 0.55 - 0.1 * k } }),
    reload: [
      { 'arm.R': { swing: 0, spread: -0.45 }, 'fore.R': { swing: 1.1 }, 'arm.L': { swing: 0.05, spread: -0.6 }, 'fore.L': { swing: 0.6 }, head: { lean: 0.35 } },
      { 'arm.R': { swing: 0, spread: -0.45 }, 'fore.R': { swing: 1.1 }, 'arm.L': { swing: 0.1, spread: -0.2 }, 'fore.L': { swing: 1.2 }, head: { lean: 0.3 } },
    ],
  },
};

/** Armas que se seguram como pistola (uma mão no cabo, a outra por cima). */
export const PISTOLS = ['m1911', 'glock', 'magnum', 'uzi_dual'];

/** Animações que dependem da postura: nomes com o sufixo dela (Idle_pistol...). */
function stanceAnimations(stance, suffix) {
  const { aim, reload } = STANCES[stance];
  const run = (phase) => ({
    ...aim(), 'leg.R': { swing: 0.7 * phase }, 'leg.L': { swing: -0.7 * phase },
    spine: { lean: 0.12, twist: 0.05 * phase }, hips: { loc: [0, 0, 0.03 * Math.abs(phase)] },
  });
  const walk = (phase) => ({ ...aim(), 'leg.R': { swing: 0.4 * phase }, 'leg.L': { swing: -0.4 * phase }, spine: { lean: 0.05 } });
  return [
    { name: 'Idle', frames: 4, fps: 3, loop: true, keys: [key(0, { ...aim(), spine: { lean: 0.02 } }), key(0.5, { ...aim(-0.3), spine: { lean: 0.05 }, head: { lean: 0.04 } }), key(1, { ...aim(), spine: { lean: 0.02 } })] },
    { name: 'Walk', frames: 8, fps: 8, loop: true, keys: [key(0, walk(1)), key(0.25, walk(0)), key(0.5, walk(-1)), key(0.75, walk(0)), key(1, walk(1))] },
    { name: 'Run', frames: 6, fps: 12, loop: true, keys: [key(0, run(1)), key(0.5, run(-1)), key(1, run(1))] },
    { name: 'Shoot', frames: 3, fps: 20, loop: false, keys: [key(0, { ...aim(1), spine: { lean: -0.06 } }), key(1, { ...aim() })] },
    { name: 'Reload', frames: 6, fps: 8, loop: false, keys: [key(0, aim()), key(0.3, reload[0]), key(0.7, reload[1]), key(1, aim())] },
    { name: 'Hurt', frames: 2, fps: 10, loop: false, keys: [key(0, { ...aim(-0.5), spine: { lean: -0.25 }, head: { lean: -0.3 } }), key(1, aim())] },
  ].map((anim) => ({ ...anim, name: anim.name + suffix }));
}

/** Jogador: postura de fuzil (nomes normais), de pistola (sufixo _pistol), faca e o resto. */
export function playerAnimations() {
  const guard = { 'arm.L': { swing: 0.35, spread: -0.25 }, 'fore.L': { swing: 1.1 } };
  return [
    ...stanceAnimations('rifle', ''),
    { name: 'Knife', frames: 5, fps: 14, loop: false, keys: [
      key(0, { ...guard, 'arm.R': { swing: 0.25, spread: 0.1 }, 'fore.R': { swing: 1.1 } }),
      key(0.3, { ...guard, 'arm.R': { swing: 0.7, spread: 0.95 }, 'fore.R': { swing: 1.2 }, spine: { twist: 0.45 } }),
      key(0.65, { ...guard, 'arm.R': { swing: 1.5, spread: -0.7 }, 'fore.R': { swing: 0.1 }, spine: { twist: -0.4, lean: 0.2 } }),
      key(1, { ...guard, 'arm.R': { swing: 0.9, spread: -0.4 }, 'fore.R': { swing: 0.5 }, spine: { twist: -0.15 } }),
    ] },
    { name: 'Interact', frames: 4, fps: 6, loop: true, keys: [
      key(0, { 'arm.R': { swing: 0.6 }, 'arm.L': { swing: 1.1, spread: -0.1 }, spine: { lean: 0.25 }, head: { lean: 0.2 } }),
      key(0.5, { 'arm.R': { swing: 0.6 }, 'arm.L': { swing: 1.3, spread: -0.15 }, spine: { lean: 0.3 }, head: { lean: 0.25 } }),
      key(1, { 'arm.R': { swing: 0.6 }, 'arm.L': { swing: 1.1, spread: -0.1 }, spine: { lean: 0.25 }, head: { lean: 0.2 } }),
    ] },
    ...deathAnimation(),
    ...stanceAnimations('pistol', '_pistol'),
  ];
}

/** Bosses: animações do zumbi + rugido, murro no chão e investida. */
export function bossAnimations() {
  const charge = (phase) => ({
    spine: { lean: 0.55 }, head: { lean: -0.35 },
    'arm.R': { swing: -0.6, spread: 0.3 }, 'arm.L': { swing: -0.6, spread: 0.3 },
    'leg.R': { swing: 0.9 * phase }, 'leg.L': { swing: -0.9 * phase },
  });
  return [
    ...zombieAnimations().filter((a) => a.name !== 'Crawl'),
    { name: 'Roar', frames: 6, fps: 6, loop: false, keys: [
      key(0, { 'arm.R': { swing: 0.3 }, 'arm.L': { swing: 0.3 } }),
      key(0.3, { 'arm.R': { swing: 0.4, spread: 1.2 }, 'arm.L': { swing: 0.4, spread: 1.2 }, spine: { lean: -0.3 }, head: { lean: -0.5 } }),
      key(0.85, { 'arm.R': { swing: 0.5, spread: 1.25 }, 'arm.L': { swing: 0.5, spread: 1.25 }, spine: { lean: -0.35 }, head: { lean: -0.55 } }),
      key(1, { 'arm.R': { swing: 0.3 }, 'arm.L': { swing: 0.3 } }),
    ] },
    { name: 'Slam', frames: 6, fps: 10, loop: false, keys: [
      key(0, { 'arm.R': { swing: 0.3 }, 'arm.L': { swing: 0.3 } }),
      key(0.4, { 'arm.R': { swing: 2.9, spread: 0.2 }, 'arm.L': { swing: 2.9, spread: 0.2 }, spine: { lean: -0.25 } }),
      key(0.6, { 'arm.R': { swing: 1.1, spread: 0.1 }, 'arm.L': { swing: 1.1, spread: 0.1 }, spine: { lean: 0.6 }, hips: { loc: [0, 0, -0.15] } }),
      key(1, { 'arm.R': { swing: 0.3 }, 'arm.L': { swing: 0.3 } }),
    ] },
    { name: 'Charge', frames: 4, fps: 12, loop: true, keys: [key(0, charge(1)), key(0.5, charge(-1)), key(1, charge(1))] },
  ];
}

// ───────────────────────── Personagens ─────────────────────────

const BONE = hex(0xcfc6b0);
const BLOOD = hex(0x6a1a14);

/** Zumbi com as cores do tipo (dados exportados do jogo web). */
export function zombieModel(look) {
  const c = {
    torso: look.shirt, sleeve: look.shirt, skin: look.skin, pants: hex(0x35393a), shoes: hex(0x1d1b19),
    eyes: hex(0xff4a2a), mouth: hex(0x4a1210),
  };
  return humanoid(c, { scale: look.scale, extra: (parts) => {
    parts.push(box('spine', [0.13, 0.145, 0.97], [0.14, 0.03, 0.12], look.shirt, { rot: [0.3, 0, 0.25] }));  // aba rasgada
    for (let i = 0; i < 3; i++) parts.push(box('spine', [-0.13, 0.142, 1.16 + i * 0.07], [0.1, 0.02, 0.025], BONE));  // costelas
    parts.push(box('spine', [0.1, 0.143, 1.34], [0.08, 0.02, 0.06], BLOOD));  // sangue
    parts.push(box('head', [0, 0.14, 1.57], [0.13, 0.02, 0.03], BONE));  // dentes
    if (look.armored) {
      const metal = hex(0x3a3f48);
      parts.push(box('head', [0, 0, 1.8], [0.32, 0.32, 0.12], metal));
      parts.push(box('spine', [0, 0, 1.25], [0.58, 0.36, 0.46], metal));
    }
    if (look.glow) parts.push(box('spine', [0, 0.15, 1.1], [0.2, 0.02, 0.16], look.glow, { flat: true }));
  } });
}

/** Jogador com as cores do visual (jaqueta, mochila, cabelo) e as partes da arma por tipo. */
export function playerModel(skin) {
  const pouch = hex(0x4a4a38);
  const belt = hex(0x2a241c);
  // Jaqueta de manga comprida (punho mais escuro); só as mãos à mostra.
  const cuff = skin.jacket.map((v) => Math.round(v * 0.62));
  const c = { torso: skin.jacket, sleeve: skin.jacket, forearm: skin.jacket, cuff, skin: hex(0xc79a7a), pants: hex(0x2f3440), shoes: hex(0x231d18), eyes: hex(0x1a1a1a) };
  return humanoid(c, { extra: (parts) => {
    parts.push(box('spine', [0, -0.22, 1.2], [0.4, 0.18, 0.46], skin.pack));  // mochila
    parts.push(box('head', [0, -0.01, 1.81], [0.29, 0.28, 0.08], skin.hair));
    parts.push(box('head', [0, -0.13, 1.72], [0.29, 0.06, 0.16], skin.hair));
    parts.push(box('hips', [0, 0, 1.03], [0.52, 0.3, 0.07], belt));
    for (const x of [-0.14, 0.14]) parts.push(box('spine', [x, 0.0, 1.25], [0.05, 0.3, 0.48], belt));  // alças
    parts.push(box('hips', [0.2, 0.15, 1.0], [0.1, 0.07, 0.1], pouch));
    parts.push(box('leg.R', [0.12, 0.1, 0.55], [0.17, 0.05, 0.1], pouch));  // joelheiras
    parts.push(box('leg.L', [-0.12, 0.1, 0.55], [0.17, 0.05, 0.1], pouch));
  } });
}

// ───────────────────────── Armas (camada à parte) ─────────────────────────

/**
 * Peças da arma `id` (nível 0–2) presas à mão direita (camada 'weapon'). Armas de fogo
 * apontam para a frente do tronco, paralelas ao chão; a faca segue o antebraço (lâmina para
 * a frente da mão).
 */
export function weaponParts(id, level = 0) {
  const hand = [0.29, 0.0, 0.8];
  const knife = id === 'knife';
  return weaponShape(id, level).map((part) => ({
    ...part,
    layer: 'weapon',
    attach: (bones) => {
      const arm = bones['fore.R'];
      if (knife) {
        const at = [arm[0] * hand[0] + arm[1] * hand[1] + arm[2] * hand[2] + arm[3],
          arm[4] * hand[0] + arm[5] * hand[1] + arm[6] * hand[2] + arm[7],
          arm[8] * hand[0] + arm[9] * hand[1] + arm[10] * hand[2] + arm[11]];
        const turn = [arm[0], arm[1], arm[2], 0, arm[4], arm[5], arm[6], 0, arm[8], arm[9], arm[10], 0, 0, 0, 0, 1];
        // A lâmina (y da arma) continua o antebraço, um pouco inclinada para a frente.
        return mul(translate(at[0], at[1], at[2]), mul(turn, rotX(-1.25)));
      }
      const spine = bones.spine;
      const tip = [arm[0] * hand[0] + arm[1] * hand[1] + arm[2] * hand[2] + arm[3],
        arm[4] * hand[0] + arm[5] * hand[1] + arm[6] * hand[2] + arm[7],
        arm[8] * hand[0] + arm[9] * hand[1] + arm[10] * hand[2] + arm[11]];
      // Só a rotação do tronco (arma na horizontal), no ponto da mão, um pouco à frente.
      const rotation = [spine[0], spine[1], spine[2], 0, spine[4], spine[5], spine[6], 0, spine[8], spine[9], spine[10], 0, 0, 0, 0, 1];
      return mul(translate(tip[0], tip[1] + 0.04, tip[2] + 0.02), rotation);
    },
  }));
}

// ───────────────────────── Cão ─────────────────────────

export const HOUND_BONES = [
  { name: 'body', pivot: [0, 0, 0.62] },
  { name: 'head', parent: 'body', pivot: [0, 0.35, 0.68] },
  { name: 'tail', parent: 'body', pivot: [0, -0.38, 0.66] },
  { name: 'leg.FR', parent: 'body', pivot: [0.13, 0.28, 0.55], side: 1 },
  { name: 'leg.FL', parent: 'body', pivot: [-0.13, 0.28, 0.55], side: -1 },
  { name: 'leg.BR', parent: 'body', pivot: [0.13, -0.28, 0.55], side: 1 },
  { name: 'leg.BL', parent: 'body', pivot: [-0.13, -0.28, 0.55], side: -1 },
];

export function houndModel(look) {
  const fur = look.shirt, dark = look.skin, eyes = hex(0xff7a1a);
  const parts = [
    box('body', [0, 0, 0.62], [0.34, 0.8, 0.32], fur),
    box('body', [0, 0.3, 0.66], [0.3, 0.2, 0.3], fur),
    box('head', [0, 0.5, 0.74], [0.22, 0.3, 0.22], fur),
    box('head', [0, 0.7, 0.68], [0.14, 0.2, 0.12], dark),
    box('head', [0, 0.8, 0.64], [0.12, 0.03, 0.03], BONE),
    box('head', [0.08, 0.44, 0.9], [0.05, 0.08, 0.12], fur, { rot: [0.3, 0, 0.2] }),
    box('head', [-0.08, 0.44, 0.9], [0.05, 0.08, 0.12], fur, { rot: [0.3, 0, -0.2] }),
    box('head', [0.06, 0.645, 0.78], [0.05, 0.02, 0.04], eyes, { flat: true }),
    box('head', [-0.06, 0.645, 0.78], [0.05, 0.02, 0.04], eyes, { flat: true }),
    box('tail', [0, -0.55, 0.73], [0.05, 0.4, 0.05], fur, { rot: [0.4, 0, 0] }),
  ];
  for (let i = 0; i < 5; i++) parts.push(box('body', [0, -0.3 + i * 0.14, 0.8], [0.05, 0.06, 0.1], dark, { rot: [-0.4, 0, 0] }));
  for (const [name, x, y] of [['leg.FR', 0.13, 0.28], ['leg.FL', -0.13, 0.28], ['leg.BR', 0.13, -0.28], ['leg.BL', -0.13, -0.28]]) {
    parts.push(box(name, [x, y, 0.3], [0.08, 0.1, 0.5], fur));
    parts.push(box(name, [x, y + 0.02, 0.03], [0.09, 0.13, 0.05], dark));
  }
  return { bones: HOUND_BONES, parts, scale: 1 };
}

export function houndAnimations() {
  const run = (ph) => ({
    'leg.FR': { swing: 0.8 * ph }, 'leg.FL': { swing: 0.6 * ph }, 'leg.BR': { swing: -0.8 * ph }, 'leg.BL': { swing: -0.6 * ph },
    body: { loc: [0, 0, 0.04 * ph], lean: -0.08 * ph }, tail: { lean: 0.3 * ph },
  });
  return [
    { name: 'Idle', frames: 4, fps: 4, loop: true, keys: [key(0, { head: { twist: 0.1 }, tail: { twist: 0.3 } }), key(0.5, { head: { lean: 0.1, twist: -0.1 }, tail: { twist: -0.3 } }), key(1, { head: { twist: 0.1 }, tail: { twist: 0.3 } })] },
    { name: 'Run', frames: 6, fps: 14, loop: true, keys: [key(0, run(1)), key(0.5, run(-1)), key(1, run(1))] },
    { name: 'Attack', frames: 5, fps: 12, loop: false, keys: [
      key(0, {}), key(0.3, { head: { lean: -0.4 }, body: { loc: [0, 0.1, 0], lean: 0.15 } }),
      key(0.6, { head: { lean: 0.35 }, body: { loc: [0, 0.25, 0], lean: -0.1 } }), key(1, {}),
    ] },
    { name: 'Hurt', frames: 2, fps: 10, loop: false, keys: [key(0, { head: { lean: -0.3 }, body: { lean: 0.15 } }), key(1, {})] },
    { name: 'Death', frames: 5, fps: 10, loop: false, keys: [key(0, {}), key(1, { body: { loc: [0, 0, -0.38], twist: 0.3 }, 'leg.FR': { swing: 0.5, spread: 0.8 }, 'leg.BR': { swing: -0.5, spread: 0.8 }, head: { lean: 0.3 } })] },
  ];
}

// ───────────────────────── Bosses ─────────────────────────

export function conductorModel() {
  const uniform = hex(0x2c3a5a), cap = hex(0x1c2438), badge = hex(0xd9b240);
  const c = { torso: uniform, sleeve: uniform, skin: hex(0x7d8a6a), pants: hex(0x1e2230), shoes: hex(0x111111), eyes: hex(0xffcc4d) };
  return humanoid(c, { scale: 1.68, extra: (parts) => {
    parts.push(box('head', [0, 0.01, 1.82], [0.31, 0.31, 0.1], cap));
    parts.push(box('head', [0, 0.18, 1.78], [0.31, 0.16, 0.03], cap));
    parts.push(box('hips', [0, 0, 0.9], [0.58, 0.32, 0.5], uniform));
    parts.push(box('spine', [0.12, 0.155, 1.34], [0.06, 0.02, 0.06], badge, { flat: true }));
    for (let i = 0; i < 4; i++) parts.push(box('spine', [0, 0.152, 1.08 + i * 0.1], [0.03, 0.02, 0.03], badge, { flat: true }));
    parts.push(box('head', [0, 0.145, 1.585], [0.15, 0.03, 0.03], hex(0x5a5a58)));
    parts.push(box('arm.L', [-0.29, 0.02, 0.64], [0.1, 0.1, 0.14], hex(0xffb24a), { flat: true }));  // lampião
  } });
}

export function patientZeroModel() {
  const gown = hex(0x9bb0a8), skin = hex(0x8f9a7c), tumor = hex(0x8a4b52), bandage = hex(0xd8d2c0);
  const c = { torso: gown, sleeve: skin, skin, pants: gown, shoes: skin, eyes: hex(0xb4ff33) };
  return humanoid(c, { bulk: 1.25, scale: 1.68, extra: (parts) => {
    parts.push(box('hips', [0, 0, 0.95], [0.66, 0.4, 0.62], gown));
    parts.push(box('head', [0, 0.0, 1.47], [0.3, 0.3, 0.06], bandage));
    parts.push(box('spine', [0.16, 0.14, 1.32], [0.22, 0.18, 0.22], tumor));
    parts.push(box('spine', [-0.2, -0.14, 1.4], [0.15, 0.15, 0.15], tumor));
    parts.push(box('head', [0.1, 0.1, 1.72], [0.11, 0.11, 0.11], tumor));
    parts.push(box('spine', [0.1, 0.16, 1.1], [0.14, 0.02, 0.1], BLOOD));
  } });
}
