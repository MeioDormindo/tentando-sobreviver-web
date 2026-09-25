// Personagens do Templo dos Mortos (Mapa 3) em pixel art: a arqueóloga (personagem do mapa, 4
// visuais), os inimigos novos (Hoplita, Hoplita com Escudo, Esqueleto, Esqueleto Arqueiro), o
// Minotauro e as roupas gregas dos zumbis que também existem nos outros mapas (_temple).
// Medidas em metros, no espaço do modelo: x = direita, y = frente, z = cima.
import { hex } from './raster.mjs';
import { humanoid } from './characters.mjs';

const box = (bone, at, size, color, extra = {}) => ({ bone, at, size, color, ...extra });
const scale = (c, k) => c.map((v) => Math.max(0, Math.min(255, Math.round(v * k))));

const BONE = hex(0xd8d0b8), BONE_D = hex(0x9a927a), BRONZE = hex(0xa87a32), BRONZE_D = hex(0x6a4a1a);
const CRIMSON = hex(0x8a2a1e), LEATHER = hex(0x5a3a22), IRON = hex(0x4a4d52), GOLD = hex(0xd8a24a);

// ───────────────────────── Roupas gregas dos zumbis comuns ─────────────────────────

/** Acessórios por tipo (zombieModel chama look.extra(parts)). */
export const TEMPLE_LOOKS = {
  // Arqueólogo da escavação: camisa cáqui, colete com bolsos, chapéu de abas.
  walker: { shirt: hex(0x9a8a62), pants: hex(0x5a4a34), extra: (parts) => {
    parts.push(box('spine', [0, 0.02, 1.24], [0.54, 0.31, 0.44], hex(0x6a5a3a)));  // colete
    for (const x of [-0.12, 0.12]) parts.push(box('spine', [x, 0.17, 1.2], [0.1, 0.02, 0.09], hex(0x4a3e28)));
    parts.push(box('head', [0, 0, 1.8], [0.44, 0.44, 0.04], hex(0x8a7a52)));
    parts.push(box('head', [0, 0, 1.86], [0.26, 0.26, 0.1], hex(0x8a7a52)));
  } },
  // Cultista: túnica escura com capuz e cordão vermelho.
  runner: { shirt: hex(0x2e2a3a), pants: hex(0x2e2a3a), extra: (parts) => {
    parts.push(box('hips', [0, 0, 0.78], [0.48, 0.3, 0.36], hex(0x2e2a3a)));
    parts.push(box('head', [0, -0.03, 1.68], [0.34, 0.34, 0.36], hex(0x24202e), { shape: 'ellipsoid' }));
    parts.push(box('hips', [0, 0.02, 1.04], [0.5, 0.3, 0.05], CRIMSON));
  } },
  // Gladiador: peitoral de couro, ombreira de bronze, elmo com crista.
  tank: { shirt: LEATHER, pants: hex(0x6a2a20), extra: (parts) => {
    parts.push(box('spine', [0, 0, 1.25], [0.56, 0.34, 0.46], LEATHER));
    parts.push(box('arm.R', [0.33, 0, 1.42], [0.2, 0.2, 0.1], BRONZE));
    parts.push(box('head', [0, 0, 1.72], [0.32, 0.32, 0.3], BRONZE));
    parts.push(box('head', [0, 0.14, 1.66], [0.18, 0.04, 0.1], hex(0x1a1612), { flat: true }));  // grade do rosto
    parts.push(box('head', [0, -0.02, 1.93], [0.06, 0.34, 0.12], CRIMSON));  // crista
  } },
  // Portador de ânfora: túnica curta e uma ânfora de fogo grego nas costas (o brilho do Exploder).
  exploder: { shirt: hex(0xb8a88a), pants: hex(0x7a6a52), extra: (parts) => {
    parts.push(box('hips', [0, 0, 0.84], [0.46, 0.28, 0.24], hex(0xb8a88a)));
    parts.push(box('spine', [0, -0.26, 1.24], [0.3, 0.3, 0.5], hex(0xb0602a), { shape: 'ellipsoid' }));
    parts.push(box('spine', [0, -0.26, 1.24], [0.31, 0.31, 0.1], hex(0x1d1612)));
  } },
  // Rastejante: múmia envolta em faixas.
  crawler: { shirt: hex(0xc8bca0), pants: hex(0xb0a488), extra: (parts) => {
    for (let i = 0; i < 5; i++) parts.push(box('spine', [0, 0, 1.04 + i * 0.1], [0.52, 0.3, 0.025], hex(0x9a8e72)));
    parts.push(box('head', [0, 0.005, 1.66], [0.29, 0.29, 0.05], hex(0x9a8e72)));
  } },
  // Cuspidor: sacerdote do veneno, manto verde e colar dourado.
  spitter: { shirt: hex(0x3e5a2a), pants: hex(0x2e3e22), extra: (parts) => {
    parts.push(box('hips', [0, 0, 0.8], [0.48, 0.3, 0.3], hex(0x3e5a2a)));
    parts.push(box('spine', [0, 0.14, 1.44], [0.3, 0.03, 0.06], GOLD));
  } },
  // Blindado: hoplita de bronze (elmo coríntio e couraça); _bare sem a armadura.
  armored: { shirt: CRIMSON, pants: hex(0x5a2a20), extra: (parts, look) => {
    if (!look.armored) return;
    parts.push(box('head', [0, 0, 1.72], [0.34, 0.34, 0.36], BRONZE));
    parts.push(box('head', [0, 0.16, 1.68], [0.12, 0.03, 0.16], hex(0x1a1612), { flat: true }));
    parts.push(box('head', [0, -0.03, 1.96], [0.07, 0.4, 0.16], CRIMSON));
    parts.push(box('spine', [0, 0, 1.25], [0.6, 0.38, 0.48], BRONZE));
  } },
};

/** Cão de Hades (o cão comum no Templo): pelagem negra, olhos e brasas roxas. */
export const TEMPLE_HOUND = { shirt: hex(0x1e1a24), skin: hex(0x5a3a7a) };

// ───────────────────────── Inimigos novos ─────────────────────────

/** Hoplita morto: couraça de bronze, saiote de tiras, elmo com crista e lança; com escudo redondo. */
export function hopliteModel(look, shield = false) {
  const skin = look.skin || hex(0x7d8266);
  const c = { torso: BRONZE, sleeve: skin, skin, pants: skin, shoes: LEATHER, eyes: hex(0x7ad8ff), mouth: hex(0x2a1a14) };
  return humanoid(c, { scale: look.scale || 1, extra: (parts) => {
    for (let i = 0; i < 6; i++) parts.push(box('hips', [-0.2 + i * 0.08, 0, 0.82], [0.07, 0.3, 0.3], i % 2 ? CRIMSON : LEATHER));  // saiote
    parts.push(box('spine', [0, 0.15, 1.24], [0.4, 0.02, 0.36], scale(BRONZE, 1.2), { flat: true }));  // músculos da couraça
    parts.push(box('head', [0, 0, 1.7], [0.32, 0.32, 0.36], BRONZE));
    parts.push(box('head', [0, 0.16, 1.66], [0.1, 0.03, 0.16], hex(0x1a1612), { flat: true }));
    parts.push(box('head', [0, -0.03, 1.96], [0.06, 0.42, 0.18], look.shirt || CRIMSON));
    parts.push(box('fore.R', [0.29, 0.1, 0.8], [0.04, 1.6, 0.04], hex(0x6a4a2a), { rot: [0.1, 0, 0] }));  // lança
    parts.push(box('fore.R', [0.29, 0.92, 0.84], [0.07, 0.18, 0.05], IRON));
    for (let i = 0; i < 3; i++) parts.push(box('spine', [0.1 - i * 0.1, 0.16, 1.1], [0.05, 0.02, 0.04], BONE, { flat: true }));
    if (shield) {  // escudo redondo de bronze com o lambda, no braço esquerdo
      parts.push(box('fore.L', [-0.36, 0.14, 1.0], [0.08, 0.62, 0.62], BRONZE, { shape: 'ellipsoid', rot: [0, 0, 0.1] }));
      parts.push(box('fore.L', [-0.41, 0.14, 1.0], [0.02, 0.4, 0.4], CRIMSON, { shape: 'ellipsoid', flat: true }));
      parts.push(box('fore.L', [-0.42, 0.14, 1.0], [0.02, 0.06, 0.24], GOLD, { flat: true }));
    }
  } });
}

/** Esqueleto: ossos à mostra (costelas, crânio com órbitas vazias), trapos e espada ou arco. */
export function skeletonModel(look, archer = false) {
  const c = { torso: BONE_D, sleeve: BONE, forearm: BONE, skin: BONE, pants: BONE, shoes: BONE_D, eyes: hex(0x1a1612), mouth: hex(0x1a1612), brow: BONE };
  return humanoid(c, { bulk: 0.72, scale: look.scale || 1, extra: (parts) => {
    for (let i = 0; i < 5; i++) parts.push(box('spine', [0, 0.1, 1.08 + i * 0.075], [0.34, 0.06, 0.03], BONE));  // costelas
    parts.push(box('spine', [0, 0.1, 1.24], [0.04, 0.08, 0.4], BONE));  // esterno
    parts.push(box('head', [0.065, 0.13, 1.67], [0.07, 0.03, 0.07], hex(0x0e0c0a), { flat: true }));  // órbitas
    parts.push(box('head', [-0.065, 0.13, 1.67], [0.07, 0.03, 0.07], hex(0x0e0c0a), { flat: true }));
    parts.push(box('head', [0.065, 0.14, 1.67], [0.025, 0.02, 0.025], hex(0x7ad8ff), { flat: true }));  // brilho nos olhos
    parts.push(box('head', [-0.065, 0.14, 1.67], [0.025, 0.02, 0.025], hex(0x7ad8ff), { flat: true }));
    parts.push(box('head', [0, 0.13, 1.56], [0.14, 0.03, 0.04], BONE_D));  // dentes
    parts.push(box('hips', [0, 0, 0.88], [0.4, 0.24, 0.22], look.shirt || hex(0x5a4a32)));  // trapo
    if (archer) {
      parts.push(box('fore.L', [-0.3, 0.1, 0.9], [0.04, 0.05, 1.1], hex(0x6a4a2a), { rot: [0, 0, 0] }));  // arco
      parts.push(box('fore.L', [-0.3, 0.02, 0.9], [0.01, 0.01, 1.0], hex(0xe8e0c8), { flat: true }));
      parts.push(box('spine', [0.12, -0.16, 1.3], [0.12, 0.1, 0.4], LEATHER, { rot: [0, 0.3, 0] }));  // aljava
      for (const x of [0.1, 0.14]) parts.push(box('spine', [x, -0.16, 1.55], [0.02, 0.02, 0.12], hex(0xd8d0b8)));
    } else {
      parts.push(box('fore.R', [0.29, 0.25, 0.8], [0.04, 0.6, 0.06], IRON));  // espada curta
      parts.push(box('fore.R', [0.29, 0.0, 0.8], [0.12, 0.03, 0.04], BRONZE));
    }
  } });
}

/** O Minotauro: corpo enorme, cabeça de touro com chifres, pelagem escura e machado duplo. */
export function minotaurModel() {
  const fur = hex(0x3a2a22), hide = hex(0x5a4032), horn = hex(0xe0d4b0);
  const c = { torso: hide, sleeve: fur, skin: hide, pants: fur, shoes: hex(0x1a1410), eyes: hex(0xff3a1a), mouth: hex(0x1a0e0a) };
  return humanoid(c, { bulk: 1.35, scale: 1.85, extra: (parts) => {
    parts.push(box('head', [0, 0.03, 1.64], [0.34, 0.34, 0.34], fur, { shape: 'ellipsoid' }));  // cabeça de touro
    parts.push(box('head', [0, 0.18, 1.58], [0.2, 0.18, 0.16], hex(0x6a4a3a)));  // focinho
    parts.push(box('head', [0, 0.28, 1.58], [0.1, 0.02, 0.04], hex(0x1a0e0a), { flat: true }));  // narinas
    parts.push(box('head', [0, 0.27, 1.52], [0.12, 0.03, 0.08], GOLD, { shape: 'ellipsoid' }));  // argola
    for (const s of [1, -1]) {
      parts.push(box('head', [s * 0.22, 0.02, 1.76], [0.18, 0.07, 0.07], horn, { rot: [0, 0, s * -0.4] }));  // chifres
      parts.push(box('head', [s * 0.33, 0.06, 1.86], [0.07, 0.06, 0.16], horn, { rot: [0.3, 0, s * 0.3] }));
    }
    parts.push(box('spine', [0, -0.02, 1.4], [0.64, 0.4, 0.16], fur));  // corcova
    parts.push(box('hips', [0, 0, 0.9], [0.5, 0.32, 0.26], hex(0x6a2a20)));  // tanga
    parts.push(box('hips', [0, 0.02, 1.02], [0.54, 0.34, 0.05], BRONZE));
    parts.push(box('fore.R', [0.29, 0.0, 0.8], [0.05, 0.05, 1.1], hex(0x4a3222)));  // cabo do machado
    parts.push(box('fore.R', [0.29, 0.0, 1.28], [0.04, 0.46, 0.3], IRON, { shape: 'ellipsoid' }));  // lâminas
    for (const s of [1, -1]) parts.push(box(s > 0 ? 'arm.R' : 'arm.L', [s * 0.36, 0, 1.44], [0.2, 0.22, 0.1], BRONZE));  // ombreiras
  } });
}

// ───────────────────────── A arqueóloga ─────────────────────────

/**
 * Personagem do Templo: a Dra. Helena, arqueóloga. look.style: field (camisa cáqui, colete,
 * chapéu), hunter (couro, capuz e aljava), priestess (túnica branca e dourada, coroa de louros),
 * underworld (manto roxo, cabelo branco e brasas).
 */
export function archaeologistModel(look) {
  const skinTone = hex(0xc49474);
  const style = look.style || 'field';
  const main = look.jacket, accent = look.pack, hair = look.hair;
  const robe = style === 'priestess' || style === 'underworld';
  const c = {
    torso: main, sleeve: main, forearm: robe ? skinTone : main, skin: skinTone,
    pants: robe ? main : hex(0x4a3e2c), shoes: style === 'priestess' ? GOLD : hex(0x3a2a1a), eyes: hex(0x1a1a1a),
    cuff: robe ? undefined : scale(main, 0.7),
  };
  return humanoid(c, { extra: (parts) => {
    // Cabelo preso (rabo de cavalo) e franja.
    parts.push(box('head', [0, -0.02, 1.8], [0.29, 0.28, 0.07], hair));
    parts.push(box('head', [0, -0.15, 1.66], [0.1, 0.1, 0.24], hair, { shape: 'ellipsoid' }));
    parts.push(box('head', [0, 0.1, 1.76], [0.24, 0.06, 0.05], hair));
    parts.push(box('spine', [0.18, 0.02, 1.1], [0.05, 0.3, 0.05], accent, { rot: [0, 0, 0.6] }));  // alça da bolsa
    parts.push(box('hips', [-0.25, 0.02, 1.0], [0.14, 0.18, 0.16], accent));  // bolsa
    if (style === 'field') {
      parts.push(box('spine', [0, 0.02, 1.24], [0.53, 0.31, 0.44], scale(main, 0.72)));  // colete
      for (const x of [-0.12, 0.12]) parts.push(box('spine', [x, 0.17, 1.18], [0.1, 0.02, 0.09], scale(main, 0.55)));
      // Chapéu de abas: aba redonda e fina acima da testa, copa baixa com fita.
      parts.push(box('head', [0, -0.01, 1.815], [0.4, 0.4, 0.025], hex(0x8a6a3a), { shape: 'ellipsoid', flat: true }));
      parts.push(box('head', [0, -0.01, 1.87], [0.25, 0.25, 0.09], hex(0x8a6a3a), { shape: 'ellipsoid' }));
      parts.push(box('head', [0, -0.01, 1.835], [0.26, 0.26, 0.025], hex(0x4a2a1a)));
    } else if (style === 'hunter') {
      parts.push(box('head', [0, -0.03, 1.7], [0.34, 0.34, 0.34], main, { shape: 'ellipsoid' }));  // capuz
      parts.push(box('spine', [0.12, -0.18, 1.3], [0.12, 0.1, 0.42], accent, { rot: [0, 0.3, 0] }));  // aljava
      for (const x of [0.1, 0.14]) parts.push(box('spine', [x, -0.18, 1.56], [0.02, 0.02, 0.12], hex(0xd8d0b8)));
    } else if (style === 'priestess') {
      parts.push(box('hips', [0, 0, 0.62], [0.5, 0.32, 0.66], main));  // túnica longa
      parts.push(box('spine', [0, 0.02, 1.34], [0.52, 0.3, 0.06], GOLD));
      parts.push(box('head', [0, 0, 1.8], [0.3, 0.3, 0.04], hex(0x6a8a3a)));  // louros
    } else if (style === 'underworld') {
      parts.push(box('hips', [0, 0, 0.62], [0.52, 0.34, 0.66], main));  // manto
      parts.push(box('spine', [0, -0.12, 1.2], [0.56, 0.12, 0.6], scale(main, 0.8)));
      parts.push(box('spine', [0, 0.15, 1.3], [0.08, 0.02, 0.08], hex(0xff6a1a), { flat: true }));  // brasa
    }
  } });
}

// ───────────────────────── Cérbero ─────────────────────────

const CERBERUS_BONES = [
  { name: 'body', pivot: [0, 0, 0.62] },
  { name: 'head', parent: 'body', pivot: [0, 0.35, 0.72] },
  { name: 'head.L', parent: 'body', pivot: [-0.2, 0.3, 0.7], side: -1 },
  { name: 'head.R', parent: 'body', pivot: [0.2, 0.3, 0.7], side: 1 },
  { name: 'tail', parent: 'body', pivot: [0, -0.38, 0.66] },
  { name: 'leg.FR', parent: 'body', pivot: [0.15, 0.28, 0.55], side: 1 },
  { name: 'leg.FL', parent: 'body', pivot: [-0.15, 0.28, 0.55], side: -1 },
  { name: 'leg.BR', parent: 'body', pivot: [0.15, -0.28, 0.55], side: 1 },
  { name: 'leg.BL', parent: 'body', pivot: [-0.15, -0.28, 0.55], side: -1 },
];

/** Cérbero: cão gigante de três cabeças (mordida, fogo, investida), pelagem negra e brasas. */
export function cerberusModel() {
  const fur = hex(0x46343a), dark = hex(0x241a1e), ember = hex(0xff6a1a), eyes = hex(0xffd060), collar = hex(0x8a7a6a);
  const s = 2.3;
  const parts = [
    box('body', [0, 0, 0.62], [0.42, 0.86, 0.38], fur),
    box('body', [0, 0.28, 0.7], [0.46, 0.26, 0.38], fur),
    box('body', [0, 0.28, 0.72], [0.5, 0.1, 0.4], collar),  // coleira de ferro
  ];
  for (let i = 0; i < 6; i++) parts.push(box('body', [0, -0.32 + i * 0.12, 0.84], [0.06, 0.07, 0.12], ember, { rot: [-0.4, 0, 0] }));  // crista em brasa
  // Três cabeças: a do meio morde, a da esquerda cospe fogo (boca acesa), a da direita investe.
  for (const [bone, x, mouth] of [['head', 0, BONE], ['head.L', -0.2, ember], ['head.R', 0.2, BONE]]) {
    parts.push(box(bone, [x, 0.52, 0.8], [0.2, 0.28, 0.2], fur));
    parts.push(box(bone, [x, 0.7, 0.75], [0.13, 0.18, 0.1], dark));
    parts.push(box(bone, [x, 0.79, 0.71], [0.11, 0.03, 0.03], mouth));
    parts.push(box(bone, [x + 0.06, 0.46, 0.94], [0.04, 0.07, 0.11], fur, { rot: [0.3, 0, 0.2] }));
    parts.push(box(bone, [x - 0.06, 0.46, 0.94], [0.04, 0.07, 0.11], fur, { rot: [0.3, 0, -0.2] }));
    parts.push(box(bone, [x + 0.05, 0.665, 0.83], [0.04, 0.02, 0.035], eyes, { flat: true }));
    parts.push(box(bone, [x - 0.05, 0.665, 0.83], [0.04, 0.02, 0.035], eyes, { flat: true }));
  }
  parts.push(box('tail', [0, -0.58, 0.72], [0.06, 0.44, 0.06], fur, { rot: [0.4, 0, 0] }));
  parts.push(box('tail', [0, -0.8, 0.86], [0.08, 0.1, 0.1], ember, { rot: [0.4, 0, 0] }));  // ponta em chama
  for (const [name, x, y] of [['leg.FR', 0.15, 0.28], ['leg.FL', -0.15, 0.28], ['leg.BR', 0.15, -0.28], ['leg.BL', -0.15, -0.28]]) {
    parts.push(box(name, [x, y, 0.3], [0.1, 0.12, 0.5], fur));
    parts.push(box(name, [x, y + 0.03, 0.03], [0.11, 0.15, 0.05], dark));
  }
  return {
    bones: CERBERUS_BONES.map((b) => ({ ...b, pivot: b.pivot.map((v) => v * s) })),
    parts: parts.map((p) => ({ ...p, at: p.at.map((v) => v * s), size: p.size.map((v) => v * s) })),
    scale: s,
  };
}

/** Animações do Cérbero com os nomes que o Boss usa (Idle, Walk, Attack, Charge, Roar, Slam...). */
export function cerberusAnimations() {
  const key = (t, pose) => [t, pose];
  const run = (ph, k = 1) => ({
    'leg.FR': { swing: 0.8 * ph * k }, 'leg.FL': { swing: 0.6 * ph * k }, 'leg.BR': { swing: -0.8 * ph * k }, 'leg.BL': { swing: -0.6 * ph * k },
    body: { loc: [0, 0, 0.04 * ph * k], lean: -0.08 * ph * k }, tail: { lean: 0.3 * ph },
    'head.L': { twist: 0.15 * ph }, 'head.R': { twist: -0.15 * ph },
  });
  const heads = (lean, twist = 0) => ({ head: { lean }, 'head.L': { lean, twist }, 'head.R': { lean, twist: -twist } });
  return [
    { name: 'Idle', frames: 4, fps: 4, loop: true, keys: [key(0, heads(0, 0.2)), key(0.5, heads(0.1, -0.1)), key(1, heads(0, 0.2))] },
    { name: 'Walk', frames: 6, fps: 9, loop: true, keys: [key(0, run(1, 0.6)), key(0.5, run(-1, 0.6)), key(1, run(1, 0.6))] },
    { name: 'Charge', frames: 4, fps: 14, loop: true, keys: [key(0, { ...run(1), ...heads(0.3) }), key(0.5, { ...run(-1), ...heads(0.3) }), key(1, { ...run(1), ...heads(0.3) })] },
    { name: 'Attack', frames: 5, fps: 12, loop: false, keys: [
      key(0, {}), key(0.3, { ...heads(-0.45, 0.2), body: { loc: [0, -0.05, 0], lean: 0.1 } }),
      key(0.6, { ...heads(0.4), body: { loc: [0, 0.2, 0], lean: -0.12 } }), key(1, {}),
    ] },
    { name: 'Roar', frames: 6, fps: 6, loop: false, keys: [key(0, {}), key(0.4, { ...heads(-0.6, 0.45), body: { lean: 0.2 } }), key(0.85, { ...heads(-0.65, 0.5), body: { lean: 0.2 } }), key(1, {})] },
    { name: 'Slam', frames: 6, fps: 10, loop: false, keys: [
      key(0, {}), key(0.4, { body: { lean: 0.5, loc: [0, 0, 0.2] }, 'leg.FR': { swing: 1.2 }, 'leg.FL': { swing: 1.2 }, ...heads(-0.4) }),
      key(0.6, { body: { lean: -0.15, loc: [0, 0, -0.05] }, 'leg.FR': { swing: -0.3 }, 'leg.FL': { swing: -0.3 }, ...heads(0.3) }), key(1, {}),
    ] },
    { name: 'Hurt', frames: 2, fps: 10, loop: false, keys: [key(0, { ...heads(-0.3), body: { lean: 0.15 } }), key(1, {})] },
    { name: 'Death', frames: 6, fps: 8, loop: false, keys: [key(0, {}), key(1, { body: { loc: [0, 0, -0.38], twist: 0.3 }, 'leg.FR': { swing: 0.5, spread: 0.8 }, 'leg.BR': { swing: -0.5, spread: 0.8 }, ...heads(0.4, 0.4) })] },
  ];
}

// ───────────────────────── A Entidade do Submundo ─────────────────────────

/**
 * A Entidade do Submundo: estátua de sombra rachada com fogo por dentro, coroa partida e manto
 * em farrapos. monstrous = forma da fase 3: maior, chifres, garras em brasa e asas de fumaça.
 */
export function entityModel(monstrous = false) {
  const stone = hex(0x5e5468), crack = hex(0xff8a2a), robe = hex(0x3a1a24), soul = hex(0xc08aff);
  const c = { torso: stone, sleeve: stone, skin: stone, pants: robe, shoes: robe, eyes: hex(0xffd060), mouth: crack, brow: stone };
  return humanoid(c, { bulk: monstrous ? 1.45 : 1.05, scale: monstrous ? 2.2 : 1.8, extra: (parts) => {
    parts.push(box('hips', [0, 0, 0.62], [0.54, 0.34, 0.66], robe));  // manto
    for (const [x, z] of [[-0.1, 1.3], [0.08, 1.15], [0.12, 1.38], [-0.05, 1.05], [0.16, 1.02], [-0.16, 1.2]]) parts.push(box('spine', [x, 0.145, z], [0.05, 0.02, 0.18], crack, { flat: true, rot: [0, 0.4, 0] }));
    parts.push(box('head', [0, 0.135, 1.62], [0.2, 0.02, 0.04], crack, { flat: true }));  // rachadura no rosto
    parts.push(box('spine', [0, 0.15, 1.24], [0.1, 0.02, 0.1], soul, { flat: true }));  // núcleo de alma
    for (const [x, h] of [[-0.1, 0.1], [0, 0.16], [0.1, 0.08]]) parts.push(box('head', [x, 0.02, 1.8 + h / 2], [0.06, 0.06, h], hex(0xb08a3a)));  // coroa partida
    if (monstrous) {
      for (const s of [1, -1]) {
        parts.push(box('head', [s * 0.18, 0, 1.82], [0.2, 0.07, 0.07], hex(0x3a3036), { rot: [0, 0, s * -0.6] }));  // chifres
        parts.push(box('head', [s * 0.32, 0.02, 1.98], [0.07, 0.07, 0.2], hex(0x3a3036), { rot: [0, 0, s * 0.3] }));
        parts.push(box(s > 0 ? 'fore.R' : 'fore.L', [s * 0.31, 0.08, 0.74], [0.16, 0.2, 0.12], crack));  // garras em brasa
        parts.push(box('spine', [s * 0.45, -0.22, 1.45], [0.5, 0.06, 0.7], hex(0x3a2a44), { rot: [0, s * 0.5, s * 0.35] }));  // asas de fumaça
      }
      parts.push(box('spine', [0, 0.15, 1.24], [0.2, 0.02, 0.2], soul, { flat: true }));
    }
  } });
}

// ───────────────────────── Floresta e Templo da Górgona ─────────────────────────

/** Sátiro: pequeno, pernas de bode peludas com cascos, chifres curvos e barbicha. */
export function satyrModel(look) {
  const fur = look.shirt || hex(0x5a3a22), skin = look.skin || hex(0x8a6a4a), horn = hex(0xd8ccb0);
  const c = { torso: skin, sleeve: skin, skin, pants: fur, shoes: hex(0x2a1e14), eyes: hex(0xffc83a), mouth: hex(0x3a1a10) };
  return humanoid(c, { scale: look.scale || 0.82, extra: (parts) => {
    for (const s of [1, -1]) {
      const leg = s > 0 ? 'leg.R' : 'leg.L';
      parts.push(box(leg, [s * 0.12, -0.05, 0.62], [0.21, 0.24, 0.5], fur));  // coxa peluda
      parts.push(box(leg, [s * 0.12, -0.06, 0.26], [0.13, 0.15, 0.34], fur, { rot: [-0.25, 0, 0] }));  // canela de bode
      parts.push(box('head', [s * 0.1, -0.02, 1.8], [0.06, 0.06, 0.16], horn, { rot: [-0.6, 0, s * 0.3] }));  // chifres
      parts.push(box('head', [s * 0.13, -0.1, 1.86], [0.05, 0.1, 0.05], horn, { rot: [0.4, 0, 0] }));
      parts.push(box('head', [s * 0.16, 0, 1.66], [0.08, 0.04, 0.06], skin, { rot: [0, 0, s * 0.6] }));  // orelha pontuda
    }
    parts.push(box('head', [0, 0.1, 1.5], [0.08, 0.05, 0.1], fur));  // barbicha
    parts.push(box('head', [0, -0.02, 1.79], [0.28, 0.27, 0.06], fur));  // cabelo
    parts.push(box('hips', [0, 0, 0.95], [0.46, 0.3, 0.18], fur));
  } });
}

/** Lobo Infernal: o corpo do cão, pelagem carbonizada, olhos acesos e brasas no dorso. */
export function hellwolfLook(look) {
  return { shirt: look.shirt || hex(0x2a2226), skin: look.skin || hex(0x7a2a1a) };
}

/** Harpia: mulher-pássaro de asas no lugar dos braços, penas escuras e garras. */
export function harpyModel(look) {
  const feather = look.shirt || hex(0x4a3a5a), skin = look.skin || hex(0x9a8a7a), talon = hex(0xd8c89a);
  const c = { torso: feather, sleeve: feather, forearm: feather, skin, pants: feather, shoes: talon, eyes: hex(0xff4a2a), mouth: hex(0x2a1a14) };
  return humanoid(c, { bulk: 0.85, scale: look.scale || 0.9, extra: (parts) => {
    for (const s of [1, -1]) {
      const arm = s > 0 ? 'arm.R' : 'arm.L';
      const fore = s > 0 ? 'fore.R' : 'fore.L';
      parts.push(box(arm, [s * 0.45, -0.02, 1.32], [0.4, 0.1, 0.34], feather, { rot: [0, 0, s * 0.15] }));  // asa (braço)
      parts.push(box(fore, [s * 0.6, -0.02, 1.0], [0.46, 0.08, 0.42], feather, { rot: [0, 0, s * 0.3] }));  // ponta da asa
      for (let i = 0; i < 3; i++) parts.push(box(fore, [s * (0.5 + i * 0.12), 0.0, 0.8 - i * 0.06], [0.08, 0.04, 0.22], hex(0x2e2438)));  // penas longas
      const leg = s > 0 ? 'leg.R' : 'leg.L';
      parts.push(box(leg, [s * 0.12, 0.08, 0.03], [0.18, 0.22, 0.05], talon));  // garras
    }
    parts.push(box('head', [0, -0.03, 1.78], [0.32, 0.3, 0.1], hex(0x2a2030)));  // cabelo de penas
    parts.push(box('head', [0, -0.16, 1.66], [0.22, 0.08, 0.3], hex(0x2a2030)));
    parts.push(box('hips', [0, -0.18, 0.9], [0.3, 0.2, 0.3], feather, { rot: [0.5, 0, 0] }));  // cauda
  } });
}

/** Górgona: vestido longo verde-escuro, pele escamosa e serpentes vivas no lugar do cabelo. */
export function gorgonModel(look) {
  const dress = look.shirt || hex(0x2e5a3a), skin = look.skin || hex(0x7a9a6a), snake = hex(0x4e7a3a), gold = GOLD;
  const c = { torso: dress, sleeve: skin, skin, pants: dress, shoes: dress, eyes: hex(0xb4ff5a), mouth: hex(0x2a3a1a) };
  return humanoid(c, { scale: look.scale || 1.15, extra: (parts) => {
    parts.push(box('hips', [0, 0, 0.55], [0.56, 0.36, 0.8], dress));  // vestido até o chão
    parts.push(box('spine', [0, 0.14, 1.44], [0.3, 0.03, 0.06], gold));  // colar
    for (let i = 0; i < 9; i++) {  // serpentes do cabelo
      const a = (i / 9) * Math.PI * 2;
      const x = Math.cos(a) * 0.14, y = Math.sin(a) * 0.14;
      parts.push(box('head', [x, y, 1.82], [0.05, 0.05, 0.16], snake, { rot: [y * 3, 0, -x * 3] }));
      parts.push(box('head', [x * 1.6, y * 1.6, 1.9], [0.06, 0.06, 0.05], snake));
      parts.push(box('head', [x * 1.7, y * 1.7 + 0.02, 1.915], [0.02, 0.02, 0.015], hex(0xff3a2a), { flat: true }));
    }
    for (const [x, z] of [[0.1, 1.2], [-0.12, 1.32], [0.05, 1.05]]) parts.push(box('spine', [x, 0.145, z], [0.06, 0.02, 0.04], scale(skin, 0.7), { flat: true }));  // escamas
  } });
}
