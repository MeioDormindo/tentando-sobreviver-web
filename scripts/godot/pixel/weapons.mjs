// Armas em pixel art: uma forma por arma (as 19 do jogo), em coordenadas da arma
// (y = cano para a frente, z = cima, origem = cabo), e os acabamentos das melhorias do
// Weapon Lab: Mk II (aço azulado, mira, carregador maior) e Mk III (detalhes dourados e
// faixa brilhante na cor da arma).
import { hex } from './raster.mjs';

const STEEL = hex(0x2e3136);
const DARK = hex(0x1c1d21);
const WOOD = hex(0x6a4428);
const POLY = hex(0x3a3d38);
const TAN = hex(0x8c7a55);
const BLUE_STEEL = hex(0x3c526c);
const GOLD = hex(0xe0ad45);

/** Cor de destaque de cada arma (brilho das energéticas, faixa do Mk III). */
const ACCENT = {
  arc_gun: hex(0x72ccff), energy_cannon: hex(0x80ff72), rail: hex(0x7fe7ff), wind_cannon: hex(0xc0f2ff),
  flamethrower: hex(0xff8a26), conductor_lantern: hex(0xffc85a), grenade_launcher: hex(0xb6d04a), minigun: hex(0xffc85a),
};

/**
 * Peças da arma `id` no nível `level` (0 = original, 1 = Mk II, 2 = Mk III).
 * Cada peça: { at, size, color, flat?, shape?, round? }.
 */
export function weaponShape(id, level = 0) {
  const p = [];
  const metal = level >= 1 ? BLUE_STEEL : STEEL;
  const accent = ACCENT[id] || hex(0xffcc66);
  const add = (at, size, color, extra = {}) => p.push({ at, size, color, round: Math.min(...size) * 0.25, ...extra });
  const barrel = (y0, len, r = 0.035, z = 0.07, color = metal) => add([0, y0 + len / 2, z], [r, len, r], color, { round: r * 0.45 });
  const grip = (y = 0, color = POLY) => add([0, y, -0.05], [0.045, 0.07, 0.13], color, { rot: [-0.3, 0, 0] });
  const mag = (y, h, color = DARK, curve = 0) => add([0, y, -0.02 - h / 2], [0.04, 0.06, h], color, { rot: [curve, 0, 0] });
  const stock = (len, color = POLY, z = 0.04) => add([0, -0.05 - len / 2, z], [0.05, len, 0.1], color);
  const receiver = (len, h = 0.1, w = 0.06, color = metal) => add([0, len / 2 - 0.06, 0.06], [w, len, h], color);
  const sight = (y, z = 0.14) => add([0, y, z], [0.015, 0.03, 0.035], DARK);
  const scope = (y, len = 0.2) => add([0, y, 0.15], [0.045, len, 0.045], DARK, { shape: 'ellipsoid' });

  switch (id) {
    case 'conductor_lantern':
      // Lanterna de sinal ferroviário do Condutor: coronha de madeira, corpo de latão com a
      // lente âmbar acesa, alça em cima e o cano com bobinas de cobre.
      stock(0.26, WOOD);
      add([0, 0.08, 0.07], [0.12, 0.2, 0.14], hex(0xb8862e));                                   // corpo de latão
      add([0, 0.19, 0.07], [0.1, 0.02, 0.1], hex(0xffb84a), { flat: true });                     // lente âmbar
      add([0, 0.08, 0.17], [0.03, 0.14, 0.05], hex(0x5a4020));                                   // alça
      barrel(0.2, 0.34, 0.04, 0.07, DARK);
      for (const y of [0.27, 0.35, 0.43]) add([0, y, 0.07], [0.06, 0.025, 0.06], hex(0xc2703a));  // bobinas
      add([0, 0.56, 0.07], [0.07, 0.04, 0.07], accent, { flat: true });                         // ponta acesa
      grip(0, WOOD);
      if (level >= 1) add([0, 0.08, -0.04], [0.1, 0.12, 0.05], metal);                           // bateria extra
      if (level >= 2) add([0, 0.3, 0.12], [0.02, 0.26, 0.02], GOLD);
      break;
    case 'knife':
      // Faca de combate: cabo escuro com guarda, lâmina clara com fio brilhante.
      add([0, -0.01, 0], [0.04, 0.11, 0.045], DARK);
      add([0, 0.05, 0], [0.08, 0.015, 0.05], STEEL);
      add([0, 0.16, 0.004], [0.014, 0.2, 0.045], hex(0xc9ced4), { round: 0.004 });
      add([0, 0.16, 0.024], [0.016, 0.19, 0.008], hex(0xf2f5f8), { flat: true, round: 0.002 });
      break;
    case 'm1911':
      add([0, 0.07, 0.075], [0.045, 0.22, 0.06], metal); grip(-0.005, WOOD); sight(0.16, 0.11);
      break;
    case 'glock':
      add([0, 0.065, 0.075], [0.05, 0.2, 0.065], POLY); grip(0, POLY); add([0, 0.14, 0.05], [0.04, 0.05, 0.02], DARK);
      break;
    case 'beretta':
      // Beretta 92 (pistola inicial do Hospital): ferrolho vazado com o cano à mostra.
      add([0, 0.07, 0.078], [0.046, 0.23, 0.058], metal); add([0, 0.12, 0.078], [0.03, 0.08, 0.03], DARK);
      grip(-0.005, POLY); sight(0.17, 0.112);
      break;
    case 'nailgun':
      // Pistola de pregos: corpo amarelo de ferramenta, pente de pregos embaixo, bico curto.
      add([0, 0.06, 0.08], [0.07, 0.22, 0.09], hex(0xd8b02a)); add([0, 0.06, 0.13], [0.05, 0.14, 0.025], DARK);
      add([0, 0.19, 0.06], [0.035, 0.06, 0.035], metal); add([0, 0.1, 0.0], [0.03, 0.2, 0.05], hex(0x9aa0a4), { rot: [0.15, 0, 0] });
      grip(-0.02, DARK);
      break;
    case 'p90':
      // P90: corpo arredondado de polímero, pente em cima, empunhadura vazada.
      add([0, 0.08, 0.06], [0.07, 0.36, 0.11], POLY, { round: 0.03 }); add([0, 0.09, 0.135], [0.05, 0.26, 0.03], hex(0x6a6d68));
      add([0, 0.05, -0.02], [0.04, 0.08, 0.1], DARK); barrel(0.26, 0.06, 0.028); sight(0.02, 0.16);
      break;
    case 'sawed_off':
      // Cano serrado: dois canos curtos lado a lado e coronha de madeira cortada.
      add([0, 0.02, 0.06], [0.07, 0.12, 0.08], metal); grip(-0.02, WOOD); stock(0.12, WOOD, 0.03);
      for (const x of [-0.022, 0.022]) add([x, 0.2, 0.07], [0.04, 0.26, 0.04], DARK, { round: 0.015 });
      add([0, 0.14, 0.03], [0.07, 0.1, 0.04], WOOD);
      break;
    case 'magnum':
      add([0, 0.03, 0.065], [0.05, 0.12, 0.08], metal); add([0, 0.03, 0.06], [0.075, 0.07, 0.075], metal, { shape: 'ellipsoid' });
      barrel(0.09, 0.2, 0.04, 0.08); grip(-0.02, WOOD);
      break;
    case 'uzi_dual':
      for (const x of [-0.11, 0.11]) {
        p.push({ at: [x, 0.07, 0.07], size: [0.05, 0.18, 0.08], color: POLY, round: 0.012 });
        p.push({ at: [x, 0.02, -0.06], size: [0.04, 0.05, 0.16], color: DARK, round: 0.01 });
        p.push({ at: [x, 0.19, 0.08], size: [0.025, 0.06, 0.025], color: metal, round: 0.01 });
      }
      break;
    case 'mp5':
      receiver(0.3, 0.09); grip(); mag(0.12, 0.17, DARK, 0.3); barrel(0.24, 0.1, 0.03); stock(0.16, DARK); sight(0.02);
      break;
    case 'vector':
      receiver(0.3, 0.14, 0.07, POLY); add([0, 0.1, -0.06], [0.05, 0.08, 0.14], DARK, { rot: [0.2, 0, 0] }); grip(0.02); stock(0.18, POLY); barrel(0.24, 0.06, 0.03);
      break;
    case 'm4':
      receiver(0.36, 0.1); add([0, 0.12, 0.14], [0.04, 0.12, 0.03], DARK); grip(); mag(0.14, 0.18, DARK); barrel(0.3, 0.3, 0.032); stock(0.22, POLY); add([0, 0.36, 0.07], [0.06, 0.16, 0.07], POLY);
      break;
    case 'ak':
      receiver(0.34, 0.1); grip(0, WOOD); mag(0.14, 0.2, DARK, 0.4); barrel(0.32, 0.26, 0.032); stock(0.22, WOOD, 0.03); add([0, 0.36, 0.05], [0.055, 0.18, 0.06], WOOD);
      break;
    case 'rpk':
      receiver(0.38, 0.1); grip(0, WOOD); mag(0.16, 0.22, DARK, 0.4); barrel(0.36, 0.42, 0.036); stock(0.24, WOOD, 0.03);
      add([0.03, 0.66, -0.05], [0.015, 0.02, 0.16], DARK, { rot: [0, 0.4, 0] }); add([-0.03, 0.66, -0.05], [0.015, 0.02, 0.16], DARK, { rot: [0, -0.4, 0] });  // bipé
      break;
    case 'rail':
      receiver(0.5, 0.12, 0.07, DARK); grip(0.02); stock(0.2, DARK);
      for (let i = 0; i < 4; i++) add([0, 0.12 + i * 0.1, 0.07], [0.09, 0.03, 0.09], accent, { flat: true });
      barrel(0.46, 0.3, 0.04, 0.07, metal);
      break;
    case 'barrett':
      receiver(0.5, 0.12, 0.07); grip(); mag(0.2, 0.12); stock(0.26, DARK); barrel(0.44, 0.5, 0.04); add([0, 0.96, 0.07], [0.07, 0.06, 0.06], DARK); scope(0.2, 0.26);
      break;
    case 'pump':
      receiver(0.3, 0.1, 0.065); grip(0, WOOD); stock(0.24, WOOD, 0.03); barrel(0.26, 0.42, 0.045, 0.08); add([0, 0.4, 0.02], [0.06, 0.16, 0.06], WOOD);
      break;
    case 'combat_shotgun':
      receiver(0.34, 0.12, 0.07, POLY); grip(); mag(0.16, 0.14, DARK); stock(0.2, POLY); barrel(0.3, 0.34, 0.05, 0.08); sight(0.3, 0.15);
      break;
    case 'grenade_launcher':
      add([0, 0.1, 0.07], [0.16, 0.14, 0.16], metal, { shape: 'ellipsoid' });  // tambor
      barrel(0.16, 0.3, 0.09, 0.08, DARK); grip(-0.02); stock(0.18, POLY); add([0, 0.47, 0.08], [0.1, 0.03, 0.1], accent, { flat: true });
      break;
    case 'flamethrower':
      receiver(0.46, 0.09); grip(0.02); add([0, 0.12, -0.1], [0.1, 0.3, 0.1], hex(0x9a3b22), { shape: 'ellipsoid' });  // tanque
      barrel(0.4, 0.22, 0.05, 0.07); add([0, 0.63, 0.07], [0.04, 0.02, 0.04], accent, { flat: true });
      break;
    case 'arc_gun':
      receiver(0.4, 0.12, 0.08, DARK); grip(0.02);
      for (let i = 0; i < 3; i++) add([0, 0.18 + i * 0.08, 0.07], [0.11 - i * 0.015, 0.035, 0.11 - i * 0.015], accent, { flat: true, shape: 'ellipsoid' });
      barrel(0.42, 0.12, 0.03);
      break;
    case 'energy_cannon':
      add([0, 0.2, 0.07], [0.14, 0.48, 0.14], DARK); grip(0.02); add([0, 0.35, 0.07], [0.11, 0.2, 0.11], accent, { flat: true, shape: 'ellipsoid' });
      barrel(0.44, 0.12, 0.08, 0.07, metal);
      break;
    case 'minigun':
      add([0, 0.08, 0.06], [0.14, 0.2, 0.14], metal); grip(0.0, DARK); add([0.09, 0.05, -0.02], [0.1, 0.14, 0.12], TAN);  // caixa de munição
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        barrel(0.18, 0.42, 0.022, 0.07 + Math.sin(a) * 0.04, metal);
        p[p.length - 1].at[0] = Math.cos(a) * 0.04;
      }
      break;
    case 'wind_cannon':
      receiver(0.34, 0.1); grip(0.02); add([0, 0.4, 0.08], [0.22, 0.16, 0.22], metal, { shape: 'ellipsoid' });
      add([0, 0.49, 0.08], [0.17, 0.02, 0.17], accent, { flat: true, shape: 'ellipsoid' });
      break;
    default:
      receiver(0.3); grip();
  }

  // Melhorias do Weapon Lab.
  if (level >= 1) {
    const top = Math.max(...p.map((q) => q.at[2] + q.size[2] / 2));
    const front = Math.max(...p.map((q) => q.at[1] + q.size[1] / 2));
    if (!['uzi_dual', 'minigun', 'grenade_launcher', 'barrett'].includes(id)) add([0, 0.12, top + 0.03], [0.04, 0.14, 0.04], DARK, { shape: 'ellipsoid' });  // mira
    add([0, front + 0.03, 0.07], [0.05, 0.06, 0.05], DARK);  // quebra-chama
  }
  if (level >= 2) {
    const front = Math.max(...p.map((q) => q.at[1] + q.size[1] / 2));
    add([0, front * 0.45, 0.13], [0.07, front * 0.5, 0.012], GOLD, { flat: true });  // friso dourado
    add([0.036, front * 0.45, 0.07], [0.008, front * 0.6, 0.02], accent, { flat: true });  // faixa brilhante
    add([-0.036, front * 0.45, 0.07], [0.008, front * 0.6, 0.02], accent, { flat: true });
  }
  return p;
}
