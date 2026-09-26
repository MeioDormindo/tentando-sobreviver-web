// Objetos do Templo dos Mortos (Mapa 3) em pixel art 2.5D: colunas, altares, braseiros,
// sarcófagos (tampa animável), túmulos, ossadas, ânforas, árvores, pedras, estátuas
// petrificadas, as 12 estátuas dos deuses (cada uma com o símbolo do deus no pedestal), o
// altar da Mystery Box do Templo e os itens da missão. Mesmo formato das receitas de props.mjs.
import { base, stain, rect, hline, vline, bevel, mix, scale, hex } from './paint.mjs';

const MARBLE = hex(0xc8c4b6);
const STONE = hex(0x7a7468);
const BRONZE = hex(0x9a6a2a);
const GOLD = hex(0xd8a24a);
const GRIME = hex(0x1a1714);

/** Símbolos 9×9 dos 12 deuses (# = relevo). */
export const GOD_SYMBOLS = {
  zeus: ['.....##..', '....##...', '...##....', '..######.', '.....##..', '....##...', '...##....', '..##.....', '.#.......'],
  hera: ['.#..#..#.', '.#.###.#.', '..#####..', '..#####..', '...###...', '..#####..', '.#######.', '#########', '.........'],
  poseidon: ['#...#...#', '#...#...#', '#...#...#', '#########', '....#....', '....#....', '....#....', '....#....', '....#....'],
  demeter: ['....#....', '...#.#...', '..#.#.#..', '...#.#...', '..#.#.#..', '...#.#...', '....#....', '....#....', '...###...'],
  athena: ['.##...##.', '#..#.#..#', '#.##.##.#', '#..#.#..#', '.#######.', '.#.....#.', '.#.###.#.', '..#...#..', '...###...'],
  apollo: ['#...#...#', '.#.....#.', '...###...', '#.#####.#', '..#####..', '#.#####.#', '...###...', '.#.....#.', '#...#...#'],
  artemis: ['...###...', '..#......', '.#.......', '.#.......', '.#.......', '.#.......', '.#.......', '..#......', '...###...'],
  ares: ['....#....', '...###...', '..#####..', '.##.#.##.', '.##...##.', '.##...##.', '..#...#..', '.........', '.........'],
  aphrodite: ['.........', '.##...##.', '####.####', '#########', '#########', '.#######.', '..#####..', '...###...', '....#....'],
  hephaestus: ['.#######.', '.#######.', '.###.###.', '....#....', '....#....', '....#....', '....#....', '...###...', '.........'],
  hermes: ['#.......#', '##.....##', '###...###', '.###.###.', '..#####..', '....#....', '...#.#...', '...#.#...', '....#....'],
  dionysus: ['.....##..', '....#....', '..##.##..', '.#######.', '..#####..', '..#####..', '...###...', '...###...', '....#....'],
  // Hades não é um dos 12 olímpicos (não tem estátua no Templo), mas é a 6ª bênção — caveira,
  // o mesmo símbolo do "Pacto dos Mortos".
  hades: ['..#####..', '.#######.', '#.......#', '#.#...#.#', '#.......#', '#..###..#', '.#######.', '..#.#.#..', '.........'],
};

const painters = {
  marble: (color = MARBLE, veins = true) => (w, h, r) => {
    const p = base(w, h, color, r, { amount: 0.05 });
    if (veins) for (let v = 0; v < Math.max(1, w * h / 900); v++) {
      let x = r() * w, y = r() * h;
      for (let i = 0; i < 40; i++) { x += r() - 0.3; y += r() - 0.5; p.set(Math.round(x), Math.round(y), scale(color, 0.78)); }
    }
    for (let i = 0; i < 2; i++) stain(p, r, r() * w, r() * h, 3 + r() * 5, GRIME, 0.3);
    bevel(p, 0, 0, w, h, scale(color, 1.12), scale(color, 0.62));
    return p;
  },
  // Fuste canelado (colunas): faixas verticais claras e escuras.
  flutes: (color = MARBLE) => (w, h, r) => {
    const p = base(w, h, color, r, { amount: 0.04 });
    for (let x = 0; x < w; x += 5) { vline(p, x, scale(color, 0.7)); vline(p, x + 1, scale(color, 1.12)); }
    for (let i = 0; i < 3; i++) stain(p, r, r() * w, r() * h, 3 + r() * 6, GRIME, 0.35);
    for (let i = 0; i < 40; i++) { const x = r.int(0, w - 1), y = r.int(Math.floor(h * 0.7), h - 1); p.set(x, y, hex(0x3e5a2a)); }  // musgo no pé
    return p;
  },
  block: (color = STONE) => (w, h, r) => {
    const p = base(w, h, color, r, { amount: 0.1, cells: 5 });
    for (let y = 10; y < h; y += 12) hline(p, y, scale(color, 0.6));
    for (let i = 0; i < 3; i++) stain(p, r, r() * w, r() * h, 3 + r() * 6, GRIME, 0.35);
    bevel(p, 0, 0, w, h, scale(color, 1.15), scale(color, 0.55));
    return p;
  },
  relief: (symbol, color = STONE, ink = hex(0xd8a24a)) => (w, h, r) => {
    const p = painters.block(color)(w, h, r);
    const rows = GOD_SYMBOLS[symbol];
    if (rows) {
      const s = Math.max(1, Math.floor(Math.min(w, h) / 13));
      const ox = Math.floor((w - 9 * s) / 2), oy = Math.floor((h - 9 * s) / 2);
      rows.forEach((row, y) => [...row].forEach((c, x) => { if (c === '#') rect(p, ox + x * s, oy + y * s, s, s, ink); }));
    }
    return p;
  },
  fire: () => (w, h, r) => {
    const p = base(w, h, hex(0xff8a2a), r, { amount: 0.2 });
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = r();
      if (v < 0.2) p.set(x, y, hex(0xffd060)); else if (v > 0.85) p.set(x, y, hex(0xd0441a));
    }
    return p;
  },
  coals: () => (w, h, r) => {
    const p = base(w, h, hex(0x3a1a14), r, { amount: 0.2 });
    for (let i = 0; i < (w * h) / 6; i++) p.set(r.int(0, w - 1), r.int(0, h - 1), r() < 0.5 ? hex(0xff8a2a) : hex(0xffd060));
    return p;
  },
  sarcophagus: (lid = false) => (w, h, r) => {
    const p = painters.block(hex(0x8a8274))(w, h, r);
    rect(p, 3, 3, w - 6, h - 6, hex(0x7a7264)); bevel(p, 3, 3, w - 6, h - 6, hex(0x5a5448), hex(0x9a9282));
    if (lid) {  // figura deitada em relevo
      const cx = Math.floor(w / 2);
      rect(p, cx - 4, 6, 8, 8, hex(0x9a9282)); rect(p, cx - 6, 15, 12, h - 24, hex(0x9a9282)); bevel(p, cx - 6, 15, 12, h - 24, hex(0xaaa292), hex(0x6a6254));
    } else {
      for (let x = 8; x < w - 8; x += 12) { hline(p, Math.floor(h / 2), GOLD, x, x + 5); }
    }
    return p;
  },
  bark: (color = hex(0x4a3420)) => (w, h, r) => {
    const p = base(w, h, color, r, { amount: 0.14 });
    for (let x = 0; x < w; x += 4) for (let y = 0; y < h; y++) if (r() < 0.5) p.set(x, y, scale(color, 0.6));
    return p;
  },
  leaves: (color = hex(0x2e4a22)) => (w, h, r) => {
    const p = base(w, h, color, r, { amount: 0.25, cells: 5 });
    for (let i = 0; i < (w * h) / 3; i++) p.set(r.int(0, w - 1), r.int(0, h - 1), r() < 0.5 ? scale(color, 1.45) : scale(color, 0.55));
    return p;
  },
  bone: () => (w, h, r) => {
    const p = base(w, h, hex(0xcfc6aa), r, { amount: 0.08 });
    for (let i = 0; i < (w * h) / 30; i++) p.set(r.int(0, w - 1), r.int(0, h - 1), hex(0x8a826a));
    return p;
  },
  // Ânfora de figuras negras: terracota com faixa preta e figuras.
  amphora: () => (w, h, r) => {
    const p = base(w, h, hex(0xb0602a), r, { amount: 0.06 });
    rect(p, 0, Math.floor(h * 0.35), w, Math.floor(h * 0.3), hex(0x1d1612));
    for (let x = 2; x < w - 3; x += 7) { rect(p, x, Math.floor(h * 0.4), 2, Math.floor(h * 0.18), hex(0xb0602a)); p.set(x + 1, Math.floor(h * 0.38), hex(0xb0602a)); }
    hline(p, Math.floor(h * 0.2), hex(0x1d1612)); hline(p, Math.floor(h * 0.8), hex(0x1d1612));
    return p;
  },
  crystal: (color = hex(0x8a6aff)) => (w, h, r) => {
    const p = base(w, h, color, r, { amount: 0.15 });
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if ((x + y) % 5 === 0) p.set(x, y, scale(color, 1.5));
    bevel(p, 0, 0, w, h, hex(0xe0d0ff), scale(color, 0.5));
    return p;
  },
  iron: () => (w, h, r) => {
    const p = base(w, h, hex(0x3a3436), r, { amount: 0.1 });
    for (let x = 0; x < w; x += 6) rect(p, x, 0, 4, h, hex(0x5a5256));
    return p;
  },
  // Pedra petrificada (gente virada estátua): cinza com rachaduras.
  petrified: () => (w, h, r) => {
    const p = base(w, h, hex(0x8a877e), r, { amount: 0.1 });
    for (let i = 0; i < 3; i++) { let x = r() * w, y = 0; for (; y < h; y++) { x += r() - 0.5; p.set(Math.round(x), y, hex(0x4a4740)); } }
    bevel(p, 0, 0, w, h, hex(0xa8a59a), hex(0x5a5750));
    return p;
  },
  runeAltar: (color = hex(0x6fd3ff)) => (w, h, r) => {
    const p = painters.block(hex(0x5a5448))(w, h, r);
    for (let x = 4; x < w - 4; x += 8) { rect(p, x, Math.floor(h / 2) - 2, 4, 4, color); }
    return p;
  },
};

/** Receitas do Templo (box/cyl/all vêm de props.mjs). */
export function templeRecipes({ box, cyl, all }) {
  const P = painters;
  const column = (height, broken = false) => [
    box([0.8, 0.2, 0.8], [0, 0.1, 0], all(P.block(MARBLE))),
    cyl(0.62, height, [0, 0.2 + height / 2, 0], { top: broken ? P.block(hex(0x9a968a)) : P.marble(), side: P.flutes() }),
    ...(broken ? [] : [box([0.86, 0.22, 0.86], [0, 0.2 + height + 0.11, 0], all(P.block(MARBLE)))]),
  ];
  const statueFigure = (tex, top = 0) => [
    box([0.9, 0.6, 0.9], [0, 0.3 + top, 0], tex.pedestal),
    box([0.5, 0.9, 0.34], [0, 1.05 + top, 0], all(tex.body)),       // túnica
    box([0.26, 0.28, 0.26], [0, 1.66 + top, 0], all(tex.body)),     // cabeça
    box([0.14, 0.62, 0.14], [-0.34, 1.1 + top, 0.05], all(tex.body), { rot: [0, 0, -12] }),
    box([0.14, 0.62, 0.14], [0.34, 1.2 + top, 0.02], all(tex.body), { rot: [0, 0, 25] }),
  ];
  const out = {
    column: column(2.6),
    column_broken: column(1.1, true),
    column_fallen: [cyl(0.6, 2.6, [0, 0.3, 0], { top: P.marble(), side: P.flutes() }, { rot: [0, 0, 90] }), box([0.5, 0.3, 0.4], [1.4, 0.15, 0.2], all(P.block(MARBLE)))],
    // Colunas da praça que o Minotauro derruba: inteira e os pedaços caídos (o Godot troca).
    pillar: column(2.6),
    pillar_rubble: [box([0.8, 0.25, 0.8], [0, 0.12, 0], all(P.block(MARBLE))), cyl(0.55, 1.4, [0.5, 0.3, 0.3], { top: P.marble(), side: P.flutes() }, { rot: [0, 30, 90] }),
      box([0.4, 0.25, 0.35], [-0.5, 0.12, -0.3], all(P.block(MARBLE)), { rot: [0, 20, 0] })],
    altar: [box([1.6, 0.9, 0.9], [0, 0.45, 0], { top: P.block(hex(0x8a8274)), front: P.relief('zeus', hex(0x8a8274)), side: P.block(hex(0x8a8274)) }),
      box([1.2, 0.1, 0.6], [0, 0.95, 0], all(P.coals()), { glow: hex(0xff9a3a), name: 'flame' })],
    // Altares do Portão do Templo (recebem um Fragmento de Alma): cristal apagado até ativar.
    ...Object.fromEntries(['zeus', 'poseidon', 'hades'].map((god) => [`altar_${god}`, [
      box([1.3, 1.0, 0.9], [0, 0.5, 0], { top: P.block(hex(0x6a6458)), front: P.relief(god === 'hades' ? 'ares' : god, hex(0x6a6458), hex(0x9fd8ff)), side: P.block(hex(0x6a6458)) }),
      box([0.34, 0.5, 0.34], [0, 1.25, 0], all(P.crystal(hex(0x6a5acd))), { glow: hex(0x8a7aff), name: 'soul' }),
    ]])),
    brazier: [cyl(0.2, 0.9, [0, 0.45, 0], { top: P.block(BRONZE), side: P.block(BRONZE) }),
      cyl(0.75, 0.3, [0, 1.05, 0], { top: P.coals(), side: P.block(BRONZE) }, { glow: hex(0xff9a3a) }),
      box([0.45, 0.4, 0.45], [0, 1.4, 0], all(P.fire()), { glow: hex(0xffb050), name: 'flame' })],
    sarcophagus: [box([2.1, 0.8, 0.95], [0, 0.4, 0], { top: P.sarcophagus(), front: P.sarcophagus(), side: P.block(hex(0x8a8274)) }),
      box([2.2, 0.2, 1.02], [0, 0.9, 0], { top: P.sarcophagus(true), front: P.block(hex(0x8a8274)), side: P.block(hex(0x8a8274)) }, { name: 'lid' })],
    tomb: [box([1.2, 0.35, 0.6], [0, 0.18, 0], all(P.block(hex(0x6a6458)))), box([1.0, 1.1, 0.2], [0, 0.9, -0.2], { top: P.block(hex(0x7a7264)), front: P.relief('demeter', hex(0x7a7264), hex(0x4a453c)), side: P.block(hex(0x7a7264)) })],
    bones: [box([0.7, 0.08, 0.3], [0, 0.04, 0], all(P.bone()), { rot: [0, 25, 0] }), box([0.26, 0.24, 0.26], [0.3, 0.12, 0.15], all(P.bone())), box([0.5, 0.06, 0.12], [-0.2, 0.03, -0.2], all(P.bone()), { rot: [0, -40, 0] })],
    amphora: [cyl(0.42, 0.7, [0, 0.35, 0], { top: P.coals(), side: P.amphora() }), cyl(0.22, 0.2, [0, 0.8, 0], { top: P.block(hex(0x1d1612)), side: P.amphora() })],
    tree: [cyl(0.4, 2.2, [0, 1.1, 0], { top: P.bark(), side: P.bark() }),
      cyl(2.8, 1.1, [0, 2.7, 0], { top: P.leaves(), side: P.leaves() }), cyl(2.0, 0.8, [0.25, 3.5, -0.1], { top: P.leaves(hex(0x3a5a2a)), side: P.leaves(hex(0x3a5a2a)) }),
      cyl(1.1, 0.6, [-0.3, 4.1, 0.2], { top: P.leaves(hex(0x46683a)), side: P.leaves(hex(0x46683a)) })],
    dead_tree: [cyl(0.35, 2.6, [0, 1.3, 0], { top: P.bark(hex(0x3a2e24)), side: P.bark(hex(0x3a2e24)) }),
      box([1.2, 0.14, 0.14], [0.5, 2.2, 0], all(P.bark(hex(0x3a2e24))), { rot: [0, 0, 30] }), box([0.9, 0.12, 0.12], [-0.4, 1.8, 0.1], all(P.bark(hex(0x3a2e24))), { rot: [0, 40, -35] })],
    bush: [cyl(1.1, 0.6, [0, 0.3, 0], { top: P.leaves(hex(0x34502a)), side: P.leaves(hex(0x34502a)) }), cyl(0.7, 0.4, [0.3, 0.7, 0.1], { top: P.leaves(hex(0x2a4222)), side: P.leaves(hex(0x2a4222)) })],
    rock: [box([1.3, 0.8, 1.0], [0, 0.4, 0], all(P.block(hex(0x5e5a52))), { rot: [0, 15, 0] }), box([0.7, 0.5, 0.6], [0.6, 0.25, 0.4], all(P.block(hex(0x6a665e))), { rot: [0, -25, 0] })],
    statue_stone: statueFigure({ pedestal: all(P.block(hex(0x6a665e))), body: P.petrified() }, -0.3),
    soul_crystal: [box([0.4, 0.9, 0.4], [0, 0.45, 0], all(P.crystal()), { glow: hex(0x8a6aff), rot: [0, 20, 8] }), box([0.25, 0.5, 0.25], [0.3, 0.25, 0.1], all(P.crystal()), { glow: hex(0x8a6aff), rot: [0, -15, -12] })],
    chains: [box([0.1, 2.4, 0.1], [-0.3, 1.8, 0], all(P.iron())), box([0.1, 2.0, 0.1], [0.3, 2.0, 0], all(P.iron())), box([0.8, 0.1, 0.1], [0, 0.85, 0], all(P.iron()))],
    // Fragmento de Alma (item da missão) e a chave do Submundo.
    soul_fragment: [box([0.3, 0.45, 0.3], [0, 0.6, 0], all(P.crystal(hex(0x9a7aff))), { glow: hex(0xb09aff), rot: [0, 45, 0] })],
    underworld_key: [box([0.12, 0.6, 0.06], [0, 0.6, 0], all(P.block(hex(0x3a3436)))), box([0.3, 0.3, 0.06], [0, 0.95, 0], all(P.crystal(hex(0xff6a2a))), { glow: hex(0xff8a3a) }),
      box([0.22, 0.08, 0.06], [0.1, 0.36, 0], all(P.block(hex(0x3a3436))))],
    // Pedestal do Arco de Artemis no Santuário.
    bow_pedestal: [box([0.9, 1.0, 0.9], [0, 0.5, 0], { top: P.marble(), front: P.relief('artemis', MARBLE, GOLD), side: P.marble() }),
      box([0.12, 1.1, 0.12], [0, 1.6, 0], all(P.block(hex(0xe0dccc))), { glow: hex(0xd8f0ff), rot: [0, 0, 15] })],
    // Mystery Box do Templo: altar de pedra com tampa de sarcófago e fogo azul.
    mystery_box_temple: [box([2.0, 0.78, 1.1], [0, 0.39, 0], { top: P.block(hex(0x5e584c)), front: P.relief('zeus', hex(0x5e584c), hex(0x9fe8ff)), side: P.block(hex(0x5e584c)) }),
      ...[[-0.97, -0.52], [0.97, -0.52], [-0.97, 0.52], [0.97, 0.52]].map(([x, z]) => cyl(0.16, 0.95, [x, 0.47, z], { top: P.marble(), side: P.flutes() })),
      box([2.08, 0.16, 1.18], [0, 0.86, 0], { top: P.sarcophagus(true), front: P.block(BRONZE), side: P.block(BRONZE) }, { name: 'lid', glow: hex(0x7fd8ff) })],
  };
  // As 12 estátuas dos deuses: pedestal com o símbolo do deus e a figura de mármore.
  for (const god of Object.keys(GOD_SYMBOLS)) {
    out[`statue_${god}`] = statueFigure({ pedestal: { top: P.marble(), front: P.relief(god, MARBLE, GOLD), side: P.relief(god, MARBLE, GOLD) }, body: P.marble(hex(0xd8d4c6)) });
  }
  return out;
}
