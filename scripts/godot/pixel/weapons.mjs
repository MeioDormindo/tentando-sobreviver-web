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
  // Templo dos Mortos.
  zeus_bolt: hex(0x9fd8ff), hephaestus_spear: hex(0xff8a26), artemis_bow: hex(0xd8f0ff), poseidon_trident: hex(0x6fd6ff),
};
const BRONZE = hex(0xb07a32);
const MARBLE = hex(0xd8d4c6);

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
    // ── Templo dos Mortos: armas de época e as dos deuses ──
    case 'makarov':
      // Makarov PM: ferrolho curto e liso, cabo de baquelite marrom.
      add([0, 0.06, 0.075], [0.044, 0.19, 0.058], metal); grip(-0.005, hex(0x4a2e1e)); sight(0.14, 0.108);
      break;
    case 'mauser_c96':
      // Mauser C96 "Broomhandle": pente na frente do gatilho, cano longo, cabo cabo-de-vassoura.
      add([0, 0.06, 0.08], [0.05, 0.2, 0.07], metal); barrel(0.16, 0.16, 0.03, 0.08); add([0, 0.1, 0.0], [0.04, 0.07, 0.12], DARK);
      add([0, -0.03, -0.06], [0.045, 0.06, 0.15], WOOD, { rot: [-0.25, 0, 0], shape: 'ellipsoid' });
      break;
    case 'thompson':
      // Thompson M1928: coronha e punho frontal de madeira, carregador de tambor, aletas no cano.
      receiver(0.32, 0.1); grip(0, WOOD); stock(0.2, WOOD, 0.04); add([0, 0.28, 0.02], [0.05, 0.07, 0.1], WOOD);
      add([0, 0.12, -0.05], [0.05, 0.16, 0.16], DARK, { shape: 'ellipsoid' });  // tambor
      barrel(0.26, 0.16, 0.034); for (let i = 0; i < 4; i++) add([0, 0.28 + i * 0.03, 0.07], [0.05, 0.012, 0.05], metal);
      break;
    case 'lupara':
      // Lupara: espingarda siciliana de cano duplo serrado e coronha curta.
      add([0, 0.02, 0.06], [0.07, 0.12, 0.08], metal); grip(-0.02, WOOD); stock(0.16, WOOD, 0.03);
      for (const x of [-0.022, 0.022]) add([x, 0.22, 0.07], [0.04, 0.3, 0.04], DARK, { round: 0.015 });
      break;
    case 'lee_enfield':
      // Lee-Enfield: fuzil de ferrolho com madeira até perto da ponta, alça do ferrolho e baioneta.
      receiver(0.34, 0.09, 0.06); grip(0, WOOD); stock(0.28, WOOD, 0.03); mag(0.12, 0.08);
      add([0, 0.34, 0.05], [0.06, 0.42, 0.07], WOOD); barrel(0.52, 0.16, 0.03); add([0.05, 0.02, 0.1], [0.04, 0.02, 0.02], metal);
      if (level >= 1) scope(0.14, 0.2);
      break;
    case 'stg44':
      // StG 44: receptor de chapa estampada, carregador curvo comprido e coronha de madeira.
      receiver(0.36, 0.1); grip(0, WOOD); mag(0.14, 0.22, DARK, 0.25); stock(0.24, WOOD, 0.03); barrel(0.34, 0.24, 0.03);
      add([0, 0.3, 0.1], [0.04, 0.06, 0.04], DARK);
      break;
    case 'winchester_1887':
      // Winchester 1887: espingarda de alavanca, cano longo sobre o tubo, madeira clara.
      receiver(0.2, 0.11, 0.065); grip(0, hex(0x8a5a32)); stock(0.26, hex(0x8a5a32), 0.03);
      barrel(0.14, 0.46, 0.042, 0.09); barrel(0.14, 0.4, 0.03, 0.05, DARK);
      add([0, 0.0, -0.05], [0.03, 0.14, 0.05], metal, { rot: [0.2, 0, 0] });  // alavanca
      break;
    case 'bren':
      // Bren: carregador curvo em cima, cano com alça de transporte e bipé.
      receiver(0.44, 0.1); grip(0.02, WOOD); stock(0.26, DARK, 0.04); barrel(0.42, 0.34, 0.036);
      add([0, 0.14, 0.2], [0.04, 0.1, 0.16], DARK, { rot: [-0.4, 0, 0] });  // carregador
      add([0, 0.44, 0.13], [0.03, 0.08, 0.04], metal);
      add([0.03, 0.66, -0.05], [0.015, 0.02, 0.16], DARK, { rot: [0, 0.4, 0] }); add([-0.03, 0.66, -0.05], [0.015, 0.02, 0.16], DARK, { rot: [0, -0.4, 0] });
      break;
    case 'hephaestus_spear':
      // Lança de Hefesto: haste de bronze com ponta em brasa e as tenazes da forja no cabo.
      add([0, 0.2, 0.07], [0.04, 0.8, 0.04], BRONZE, { round: 0.015 });
      add([0, 0.66, 0.07], [0.09, 0.16, 0.03], accent, { flat: true });
      add([0, 0.6, 0.07], [0.12, 0.04, 0.05], hex(0x6a3a1a));
      grip(-0.02, hex(0x3a2a1e)); add([0, -0.12, 0.07], [0.06, 0.08, 0.06], BRONZE);
      break;
    case 'zeus_bolt':
      // Raio de Zeus: um raio de ouro e mármore, com o núcleo azul aceso.
      add([0, 0.08, 0.07], [0.1, 0.22, 0.12], MARBLE); grip(0, hex(0xc8a24a));
      for (let i = 0; i < 4; i++) add([i % 2 ? 0.03 : -0.03, 0.22 + i * 0.09, 0.07], [0.05, 0.1, 0.05], hex(0xf0c040), { rot: [0, 0, i % 2 ? 0.5 : -0.5] });
      add([0, 0.1, 0.07], [0.06, 0.08, 0.14], accent, { flat: true, shape: 'ellipsoid' });
      break;
    case 'artemis_bow':
      // Arco de Artemis: arco prateado em crescente com a corda luminosa e a flecha apoiada.
      for (let i = -3; i <= 3; i++) add([0, 0.08 - Math.abs(i) * 0.02, 0.07 + i * 0.07], [0.03, 0.03, 0.08], hex(0xd8e0e8), { round: 0.01 });
      add([0, 0.0, 0.07], [0.008, 0.008, 0.46], accent, { flat: true });
      add([0, 0.2, 0.07], [0.015, 0.4, 0.015], hex(0x6a4a2a)); add([0, 0.41, 0.07], [0.04, 0.04, 0.03], hex(0xe8f0ff));
      grip(0, hex(0x5a6a7a));
      break;
    case 'poseidon_trident':
      // Tridente de Poseidon: haste de bronze e as três pontas de coral-azul.
      add([0, 0.2, 0.07], [0.04, 0.7, 0.04], BRONZE, { round: 0.015 });
      add([0, 0.54, 0.07], [0.2, 0.04, 0.04], BRONZE);
      for (const x of [-0.09, 0, 0.09]) add([x, 0.63, 0.07], [0.03, 0.16, 0.03], accent, { round: 0.01 });
      grip(-0.02, hex(0x2a4a5a));
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
