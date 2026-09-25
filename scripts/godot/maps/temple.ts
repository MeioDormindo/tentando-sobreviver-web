/**
 * Templo dos Mortos (id "temple"), o Mapa 3: um sítio arqueológico grego sobre o Submundo.
 *
 *   Labirinto ─ Necrópole ─ RUÍNAS (início) ─ Floresta de Artemis ─ Santuário (secreto)
 *                              │ Portão do Templo (3 altares) → Templo da Górgona
 *                              │ Portão do Submundo (chave do Minotauro) → Submundo → Arena Final
 *
 * Arsenal todo novo (Makarov na mão; Mauser, Thompson, Lupara, Lee-Enfield, StG 44, Winchester
 * e Bren na parede). As colunas da praça das Ruínas desabam na investida do Minotauro.
 */
import { MapBuilder, rect, GODS } from './dsl';

export function temple(): MapBuilder {
  const m = new MapBuilder('temple', 120, 116, { outsideDarkness: 0.86, decorSeed: 'temple-2d5' });

  m.area('ruins', 'Ruínas Gregas', 0.55, 'lit')
    .area('necropolis', 'Necrópole', 0.9, 'dark', 1.4)
    .area('labyrinth', 'Labirinto', 0.78, 'dim', 1.1)
    .area('forest', 'Floresta de Artemis', 0.8, 'dim', 1.2)
    .area('gorgon_temple', 'Templo da Górgona', 0.76, 'dim', 1.2)
    .area('underworld', 'Submundo', 0.9, 'dark', 1.3)
    .area('arena', 'Arena Final', 0.7, 'dim', 0.8)
    .area('sanctuary', 'Santuário do Olimpo', 0.5, 'lit', 0.6);

  // ── Ruínas (início): praça de mosaico com caminhos de pedra e um anel de colunas no meio.
  m.room('ruins', rect(38, 38, 44, 30), 'mosaic')
    .floor(rect(38, 51, 44, 3), 'stone').floor(rect(58, 38, 4, 30), 'stone')
    .pocket(rect(39, 31, 5, 5), 'stone').window('win_ruins_nw', rect(40, 36, 3, 2), 'ruins').spawn('R1', 41, 33, 'ruins')
    .pocket(rect(77, 31, 5, 5), 'stone').window('win_ruins_ne', rect(78, 36, 3, 2), 'ruins').spawn('R2', 79, 33, 'ruins')
    .spawn('R3', 39, 66, 'ruins').spawn('R4', 80, 66, 'ruins');
  m.startWeapon('makarov');
  m.playerStart('ruins', 60, 55).boss([44, 42], [76, 42], [44, 64], [76, 64]);
  m.weapon('mauser_c96', 46, 67).weapon('thompson', 74, 67).ammo(38, 46).ammo(81, 46)
    .mysteryBox(60, 66, 'ruins').boxSpot(40, 60, 'ruins').boxSpot(80, 60, 'ruins');
  m.perk('quick_revive', 81, 56);
  m.lamp(44, 44, { torch: true }).lamp(76, 44, { torch: true }).lamp(44, 62, { torch: true }).lamp(76, 62, { torch: true })
    .lamp(60, 47, { intensity: 0.5, color: 0xffe0b0 });
  m.props('brazier', [[46, 45], [74, 45], [50, 66], [70, 66]])
    .props('column_broken', [[39, 39], [81, 39], [39, 50], [81, 50]])
    .props('column_fallen', [[46, 57, 20], [73, 48, -15]])
    .props('amphora', [[42, 39], [43, 40], [78, 65], [52, 66]])
    .props('bones', [[48, 45], [72, 60], [55, 63]])
    .props('rock', [[40, 43], [79, 57]]);
  // Colunas da praça: o Minotauro derruba na investida (abre caminho).
  m.extra('pillars', [[52, 52], [68, 52], [60, 45], [54, 47], [66, 47], [54, 58], [66, 58]].map(([tx, ty]) => ({ tx, ty })));
  // Portão do Templo: os 3 altares (um Fragmento de Alma em cada) ficam ao lado dele.
  m.extra('altars', [{ id: 'zeus', tx: 53, ty: 39 }, { id: 'poseidon', tx: 66, ty: 39 }, { id: 'hades', tx: 71, ty: 39 }]);

  // ── Necrópole: túmulos em fileiras, sarcófagos e o disjuntor do gerador dos arqueólogos.
  m.room('necropolis', rect(4, 34, 30, 34), 'catacomb')
    .solid(rect(12, 40, 1, 8), rect(24, 40, 1, 8), rect(12, 54, 1, 8), rect(24, 54, 1, 8))
    .door('door_ruins_necropolis', rect(34, 51, 4, 3), 750, 'ruins', 'necropolis')
    .pocket(rect(1, 40, 2, 4), 'catacomb').window('win_necro_1', rect(3, 41, 1, 2), 'necropolis').spawn('N1', 1, 42, 'necropolis')
    .pocket(rect(1, 56, 2, 4), 'catacomb').window('win_necro_2', rect(3, 57, 1, 2), 'necropolis').spawn('N2', 1, 58, 'necropolis')
    .spawn('N3', 32, 66, 'necropolis').spawn('N4', 18, 50, 'necropolis');
  m.weapon('lupara', 14, 67).perk('fortify', 4, 64).boxSpot(28, 36, 'necropolis').breaker(20, 34.2);
  m.lamp(8, 38, { torch: true, intensity: 0.45 }).lamp(30, 60, { torch: true, intensity: 0.4 }).lamp(18, 64, { torch: true, intensity: 0.35, flicker: 0.6 })
    .lamp(8, 52, { broken: true });
  m.props('sarcophagus', [[8, 44, 90], [8, 60, 90], [18, 44, 90], [29, 44, 90], [18, 60, 90], [29, 60, 90]])
    .props('tomb', [[6, 50], [16, 51], [21, 51], [30, 51]])
    .props('bones', [[10, 38], [26, 55], [14, 64], [31, 40]])
    .props('chains', [[22, 35], [7, 66]]);

  // ── Labirinto: corredores em serpentina (paredes com passagens alternadas).
  m.room('labyrinth', rect(4, 3, 38, 27), 'stone')
    .solid(rect(11, 3, 1, 18), rect(19, 10, 1, 20), rect(27, 3, 1, 18), rect(35, 10, 1, 20))
    .door('door_necropolis_labyrinth', rect(14, 30, 3, 4), 1500, 'necropolis', 'labyrinth');
  m.spawn('L1', 5, 4, 'labyrinth').spawn('L2', 40, 4, 'labyrinth').spawn('L3', 31, 28, 'labyrinth');
  m.weapon('stg44', 23, 3).perk('adrenaline', 8, 29).boxSpot(39, 28, 'labyrinth');
  m.trap(31, 3.2, rect(29, 4, 5, 3));
  m.lamp(7, 12, { torch: true, intensity: 0.4 }).lamp(15, 22, { torch: true, intensity: 0.4 }).lamp(23, 12, { torch: true, intensity: 0.4 })
    .lamp(31, 22, { torch: true, intensity: 0.4 }).lamp(39, 14, { torch: true, intensity: 0.4 });
  m.props('bones', [[6, 20], [22, 26], [38, 8]]).props('column_broken', [[15, 4], [31, 4]]).props('rock', [[8, 26], [24, 6]]);

  // ── Templo da Górgona (atrás do Portão do Templo): colunatas e pessoas petrificadas.
  m.room('gorgon_temple', rect(46, 6, 30, 28), 'marble')
    .door('gate_temple', rect(58, 34, 4, 4), 0, 'ruins', 'gorgon_temple', 'altar');
  m.spawn('G1', 47, 7, 'gorgon_temple').spawn('G2', 74, 7, 'gorgon_temple').spawn('G3', 60, 8, 'gorgon_temple');
  m.weapon('winchester_1887', 46, 20).weaponLab(75, 20).perk('deadeye', 75, 30).boxSpot(48, 32, 'gorgon_temple');
  m.lamp(52, 12, { torch: true }).lamp(70, 12, { torch: true }).lamp(52, 27, { torch: true }).lamp(70, 27, { torch: true })
    .lamp(61, 18, { intensity: 0.55, color: 0x9fe0b0, flicker: 0.2 });
  m.props('column', [[51, 9], [51, 15], [51, 21], [51, 27], [70, 9], [70, 15], [70, 21], [70, 27]])
    .props('statue_stone', [[56, 12], [64, 11], [58, 24], [66, 26], [62, 30]])
    .props('altar', [[61, 7]])
    .props('brazier', [[57, 7], [65, 7]]);

  // ── Floresta de Artemis: árvores, arbustos e pedras; trilha de pedra até o Santuário.
  m.room('forest', rect(86, 40, 30, 30), 'grass')
    .floor(rect(86, 51, 30, 3), 'stone').floor(rect(104, 54, 5, 16), 'stone')
    .door('door_ruins_forest', rect(82, 51, 4, 3), 1000, 'ruins', 'forest')
    .pocket(rect(95, 35, 5, 3), 'grass').window('win_forest_n', rect(96, 38, 3, 2), 'forest').spawn('F1', 97, 36, 'forest')
    .pocket(rect(117, 45, 2, 4), 'grass').window('win_forest_e1', rect(116, 46, 1, 2), 'forest').spawn('F2', 117, 47, 'forest')
    .pocket(rect(117, 60, 2, 4), 'grass').window('win_forest_e2', rect(116, 61, 1, 2), 'forest').spawn('F3', 117, 62, 'forest')
    .spawn('F4', 87, 68, 'forest');
  m.weapon('lee_enfield', 110, 40).perk('sprint', 115, 55).perk('quick_hands', 86, 64).boxSpot(100, 68, 'forest');
  m.lamp(92, 46, { torch: true, intensity: 0.4 }).lamp(110, 58, { torch: true, intensity: 0.4 })
    .lamp(98, 64, { intensity: 0.35, color: 0xa0c8ff, flicker: 0.2 });
  m.props('tree', [[89, 43], [93, 57], [99, 44], [101, 60], [112, 44], [112, 65], [90, 63], [108, 48]])
    .props('dead_tree', [[96, 67], [114, 50]])
    .props('bush', [[91, 48], [97, 49], [103, 57], [110, 62], [95, 60], [113, 58]])
    .props('rock', [[88, 55], [105, 45], [99, 69]])
    .props('statue_stone', [[102, 64]]);

  // ── Santuário do Olimpo (segredo das 12 estátuas): mármore claro e o Arco de Artemis.
  m.room('sanctuary', rect(98, 74, 18, 18), 'marble')
    .door('gate_sanctuary', rect(105, 70, 3, 4), 0, 'forest', 'sanctuary', 'secret');
  m.spawn('S1', 99, 90, 'sanctuary').spawn('S2', 114, 90, 'sanctuary');
  m.lamp(102, 78, { torch: true }).lamp(112, 78, { torch: true }).lamp(107, 86, { intensity: 0.7, color: 0xfff0c0 });
  m.props('column', [[100, 76], [114, 76], [100, 89], [114, 89]]).props('altar', [[107, 82]]);
  m.extra('sanctuary', { bow: { tx: 107, ty: 84 } });

  // ── Submundo (atrás do Portão do Submundo): rocha vulcânica, rio de lava com duas pontes.
  m.room('underworld', rect(20, 72, 64, 22), 'volcanic')
    .lava(rect(20, 80, 16, 3), rect(40, 80, 18, 3), rect(62, 80, 22, 3), rect(26, 87, 6, 4), rect(70, 87, 8, 4))
    .floor(rect(36, 80, 4, 3), 'stone').floor(rect(58, 80, 4, 3), 'stone')
    .door('gate_underworld', rect(58, 68, 4, 4), 0, 'ruins', 'underworld', 'quest');
  m.spawn('U1', 21, 73, 'underworld').spawn('U2', 82, 92, 'underworld').spawn('U3', 48, 92, 'underworld').spawn('U4', 76, 74, 'underworld');
  m.weapon('bren', 40, 93).ammo(66, 93).perk('overload', 83, 76).boxSpot(40, 76, 'underworld');
  m.lamp(30, 75, { torch: true, color: 0xff6a2a }).lamp(74, 76, { torch: true, color: 0xff6a2a }).lamp(50, 90, { intensity: 0.5, color: 0xa06aff, flicker: 0.4 });
  m.props('chains', [[24, 74], [44, 74], [80, 90]])
    .props('soul_crystal', [[22, 92], [56, 76], [80, 84]])
    .props('bones', [[34, 90], [64, 76], [46, 85]])
    .props('column_broken', [[21, 85], [70, 76]]);

  // ── Arena Final: círculo de pedra vulcânica com poços de lava nos cantos.
  m.room('arena', rect(30, 98, 48, 14), 'volcanic')
    .lava(rect(30, 98, 6, 4), rect(72, 98, 6, 4), rect(30, 108, 6, 4), rect(72, 108, 6, 4))
    .door('door_underworld_arena', rect(52, 94, 4, 4), 3000, 'underworld', 'arena');
  m.spawn('A1', 40, 110, 'arena').spawn('A2', 68, 110, 'arena').spawn('A3', 40, 100, 'arena');
  m.boxSpot(64, 110, 'arena');
  m.lamp(44, 104, { torch: true, color: 0xff6a2a }).lamp(64, 104, { torch: true, color: 0xff6a2a });
  m.props('column', [[42, 101], [66, 101], [42, 109], [66, 109]]).props('brazier', [[54, 110]]);

  // Missão "Abra o Portão do Submundo": onde ficam os Fragmentos de Alma (o 3º vem de um
  // Esqueleto que o carrega).
  m.quest({ gate: { fragments: { necropolis: { tx: 6, ty: 36 }, forest: { tx: 113, ty: 67 } }, arena: { tx: 54, ty: 104 } } });
  const statueSpots: Array<[number, number]> = [
    [40, 66], [80, 40], [5, 66], [32, 35], [5, 4], [40, 20], [47, 32], [74, 16], [88, 68], [114, 41], [56, 92], [31, 104],
  ];
  m.secrets({
    // As 12 estátuas dos deuses (segredo): ativar todas abre a passagem do Santuário.
    statues: GODS.map((god, i) => ({ god, tx: statueSpots[i][0], ty: statueSpots[i][1] })),
    radio: { tx: 42, ty: 38.2, holdMs: 900, label: 'LER A INSCRIÇÃO' },
    loreMessages: [
      '📜 "Diário da Dra. Helena, escavação 7: as inscrições falam de mortos que voltam quando o portão é tocado."',
      '📜 "Chegou a caixa do Hospital Santa Luzia: amostras do Dr. Almeida. Ele disse que o soro veio DAQUI."',
      '📜 "Os trens da Estação Central traziam os caixotes à noite. Nenhum carregador voltou para a segunda viagem."',
      '📜 "O templo não era uma prisão. Era uma porta. E alguém, do outro lado, está batendo."',
    ],
  });
  return m;
}
