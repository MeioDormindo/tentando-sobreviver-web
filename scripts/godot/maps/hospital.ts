/**
 * Hospital São Lázaro (id "map2"), redesenhado para a câmera 2.5D. De cima para baixo:
 * Centro Cirúrgico e UTI → Recepção (início) → Enfermaria, Radiologia e Farmácia → Pediatria,
 * Necrotério e Refeitório → Laboratório. Mesmas áreas, portas e preços do jogo web; as
 * posições da missão do Soro (UTI, Farmácia, Necrotério, Laboratório) ficam aqui.
 */
import { MapBuilder, rect } from './dsl';

export function hospital(): MapBuilder {
  const m = new MapBuilder('map2', 104, 100, { outsideDarkness: 0.84, decorSeed: 'hospital-2d5' });

  m.area('reception', 'Recepção', 0.58, 'lit')
    .area('surgery', 'Centro Cirúrgico', 0.74, 'dim')
    .area('icu', 'UTI', 0.72, 'dim')
    .area('ward', 'Enfermaria', 0.68, 'lit')
    .area('radiology', 'Radiologia', 0.8, 'dark', 1.2)
    .area('pharmacy', 'Farmácia', 0.72, 'dim')
    .area('pediatrics', 'Pediatria', 0.8, 'dark', 1.2)
    .area('morgue', 'Necrotério', 0.88, 'dark', 1.4)
    .area('cafeteria', 'Refeitório', 0.7, 'lit')
    .area('lab', 'Laboratório', 0.86, 'dark', 1.3);

  // ── Centro Cirúrgico: duas salas de cirurgia no alto, corredor embaixo.
  m.room('surgery', rect(6, 3, 44, 18), 'hospital')
    .solid(rect(20, 3, 1, 7), rect(35, 3, 1, 7))
    .solid(rect(6, 10, 5, 1), rect(14, 10, 12, 1), rect(29, 10, 10, 1), rect(42, 10, 6, 1));
  m.spawn('S1', 7, 4, 'surgery').spawn('S2', 30, 20, 'surgery');
  m.perk('adrenaline', 6, 17).boxSpot(24, 19, 'surgery');
  m.lamp(13, 6, { intensity: 0.6, color: 0xe8f6ff }).lamp(28, 6, { intensity: 0.55, flicker: 0.5, color: 0xe8f6ff })
    .lamp(42, 6, { broken: true }).lamp(18, 15, { intensity: 0.5 }).lamp(40, 15, { intensity: 0.5, flicker: 0.3 });
  m.props('gurney', [[13, 6], [28, 6], [43, 6]])
    .props('surgical_light', [[13, 5], [28, 5]])
    .props('iv_stand', [[10, 5], [25, 5], [40, 7]])
    .props('med_cabinet', [[8, 3], [23, 3], [38, 3]])
    .props('wheelchair', [[16, 18, 30], [44, 14]])
    .props('trash', [[48, 19]]);

  // ── UTI: leitos em boxes junto à parede de cima, posto de enfermagem no meio.
  m.room('icu', rect(54, 3, 44, 18), 'hospital')
    .solid(rect(62, 3, 1, 6), rect(72, 3, 1, 6), rect(82, 3, 1, 6))
    .door('door_surgery_icu', rect(50, 10, 4, 3), 1250, 'surgery', 'icu');
  m.spawn('I1', 96, 4, 'icu').spawn('I2', 70, 20, 'icu');
  m.weapon('barrett', 76, 3).perk('deadeye', 97, 18).boxSpot(86, 19, 'icu');
  m.lampRow(58, 94, 6, 12, { intensity: 0.5, flicker: 0.2, color: 0xe8f6ff }).lamp(75, 16, { intensity: 0.6 }).lamp(90, 16, { broken: true });
  m.props('hospital_bed', [[58, 5, 90], [67, 5, 90], [77, 5, 90], [88, 5, 90]])
    .props('iv_stand', [[60, 4], [69, 4], [79, 4], [86, 4]])
    .props('desk_computer', [[72, 13], [77, 13]])
    .props('chair', [[72, 12, 180], [77, 12, 180]])
    .props('med_cabinet', [[75, 15]])
    .props('wheelchair', [[92, 12, -20]])
    .props('gurney', [[62, 18]]);

  // ── Recepção (início): balcão, colunas e sala de espera; janelas a oeste e a leste.
  m.room('reception', rect(30, 24, 44, 20), 'linoleum')
    .solid(rect(36, 29, 2, 2), rect(66, 29, 2, 2), rect(36, 38, 2, 2), rect(66, 38, 2, 2))
    .door('door_reception_surgery', rect(38, 21, 3, 3), 1500, 'reception', 'surgery')
    .door('door_reception_icu', rect(64, 21, 3, 3), 1500, 'reception', 'icu')
    .pocket(rect(24, 26, 5, 5)).window('win_reception_w1', rect(29, 28, 1, 2), 'reception').spawn('R1', 26, 28, 'reception')
    .pocket(rect(24, 36, 5, 5)).window('win_reception_w2', rect(29, 38, 1, 2), 'reception').spawn('R2', 26, 38, 'reception')
    .pocket(rect(75, 26, 5, 5)).window('win_reception_e1', rect(74, 28, 1, 2), 'reception').spawn('R3', 77, 28, 'reception')
    .pocket(rect(75, 36, 5, 5)).window('win_reception_e2', rect(74, 38, 1, 2), 'reception').spawn('R4', 77, 38, 'reception');
  // Arsenal próprio: nenhuma arma de parede repete as do Terminal; começa com a Beretta.
  m.startWeapon('beretta');
  m.playerStart('reception', 52, 37).boss([52, 34], [44, 36], [60, 36], [52, 41]);
  m.weapon('nailgun', 44, 24).ammo(60, 24).weapon('magnum', 31, 42).mysteryBox(52, 24, 'reception')
    .boxSpot(41, 43, 'reception').boxSpot(63, 43, 'reception');
  m.perk('quick_revive', 73, 34).alarmPanel(33, 24.2);
  m.lamp(42, 27, { intensity: 0.7 }).lamp(62, 27, { intensity: 0.7, flicker: 0.15 }).lamp(52, 34, { intensity: 0.75 })
    .lamp(42, 41, { intensity: 0.65 }).lamp(62, 41, { intensity: 0.6, flicker: 0.5 });
  m.props('waiting_chairs', [[42, 35], [42, 38], [62, 35], [62, 38]])
    .props('desk_computer', [[46, 30], [51, 30], [56, 30]])
    .props('chair', [[46, 29, 180], [56, 29, 190]])
    .props('vending', [[31, 25], [72, 25]])
    .props('wheelchair', [[47, 41, 20], [70, 42, -60]])
    .props('iv_stand', [[34, 33]])
    .props('trash', [[31, 36], [72, 42]])
    .props('sign_stand', [[52, 32]]);

  // ── Enfermaria: duas fileiras de leitos.
  m.room('ward', rect(8, 47, 24, 16), 'hospital')
    .door('door_radiology_ward', rect(32, 53, 4, 3), 1000, 'radiology', 'ward')
    .pocket(rect(2, 48, 5, 5)).window('win_ward_1', rect(7, 50, 1, 2), 'ward').spawn('W1', 4, 50, 'ward')
    .pocket(rect(2, 56, 5, 5)).window('win_ward_2', rect(7, 58, 1, 2), 'ward').spawn('W2', 4, 58, 'ward');
  m.weapon('p90', 20, 47).perk('fortify', 8, 54).boxSpot(10, 61, 'ward');
  m.lamp(14, 50, { intensity: 0.6 }).lamp(26, 50, { intensity: 0.6, flicker: 0.2 }).lamp(20, 58, { intensity: 0.55 });
  m.props('hospital_bed', [[12, 48, 90], [17, 48, 90], [22, 48, 90], [27, 48, 90], [12, 59, 90], [17, 59, 90], [22, 59, 90]])
    .props('iv_stand', [[14, 48], [24, 48], [19, 60]])
    .props('wheelchair', [[28, 58, 45]])
    .props('med_cabinet', [[30, 47]]);

  // ── Radiologia: salas de exame com paredes de chumbo.
  m.room('radiology', rect(36, 47, 32, 16), 'linoleum')
    .solid(rect(46, 47, 1, 6), rect(57, 47, 1, 6), rect(40, 57, 4, 1), rect(60, 57, 4, 1))
    .door('door_reception_radiology', rect(50, 44, 4, 3), 750, 'reception', 'radiology')
    .door('door_radiology_pharmacy', rect(68, 53, 4, 3), 1000, 'radiology', 'pharmacy');
  m.spawn('X1', 37, 48, 'radiology').spawn('X2', 66, 48, 'radiology');
  m.weapon('sawed_off', 62, 47).ammo(40, 47).perk('sprint', 67, 59).boxSpot(51, 61, 'radiology');
  m.trap(47, 47.2, rect(49, 47, 6, 3));
  m.lamp(41, 50, { intensity: 0.5, flicker: 0.4 }).lamp(62, 50, { intensity: 0.45 }).lamp(52, 58, { intensity: 0.5, flicker: 0.7 })
    .lamp(40, 60, { broken: true });
  m.props('gurney', [[41, 50], [62, 50]])
    .props('lab_bench', [[52, 55]])
    .props('med_cabinet', [[37, 58], [66, 55]])
    .props('wheelchair', [[45, 61, 70]]);

  // ── Farmácia: prateleiras e balcão; o armário trancado da missão fica no alto.
  m.room('pharmacy', rect(72, 47, 24, 16), 'hospital')
    .solid(rect(76, 55, 14, 1))
    .pocket(rect(97, 48, 5, 5)).window('win_pharmacy_1', rect(96, 50, 1, 2), 'pharmacy').spawn('F1', 99, 50, 'pharmacy')
    .pocket(rect(97, 56, 5, 5)).window('win_pharmacy_2', rect(96, 58, 1, 2), 'pharmacy').spawn('F2', 99, 58, 'pharmacy');
  m.weapon('uzi_dual', 84, 47).ammo(74, 47).perk('quick_hands', 95, 55).boxSpot(90, 61, 'pharmacy');
  m.lamp(78, 50, { intensity: 0.55 }).lamp(90, 50, { intensity: 0.5, flicker: 0.3 }).lamp(84, 59, { intensity: 0.5 });
  m.props('med_cabinet', [[78, 47], [81, 47], [88, 47], [78, 51], [82, 51], [86, 51]])
    .props('desk_computer', [[80, 56], [86, 56]])
    .props('vending', [[73, 60]])
    .props('trash', [[94, 62]]);

  // ── Pediatria.
  m.room('pediatrics', rect(8, 67, 24, 14), 'linoleum')
    .door('door_ward_pediatrics', rect(18, 63, 3, 4), 1250, 'ward', 'pediatrics');
  m.spawn('P1', 9, 68, 'pediatrics').spawn('P2', 30, 80, 'pediatrics');
  m.ammo(24, 67).boxSpot(12, 80, 'pediatrics');
  m.lamp(14, 70, { intensity: 0.45, flicker: 0.6 }).lamp(26, 76, { intensity: 0.4 }).lamp(14, 78, { broken: true });
  m.props('hospital_bed', [[12, 68, 90], [27, 68, 90]])
    .props('waiting_chairs', [[20, 75]])
    .props('wheelchair', [[24, 79, 20]])
    .props('iv_stand', [[14, 68]]);

  // ── Necrotério: gavetas na parede, macas de autópsia; disjuntor e gaveta da missão.
  m.room('morgue', rect(36, 67, 32, 14), 'morgue')
    .solid(rect(42, 74, 1, 4), rect(61, 74, 1, 4))
    .door('door_radiology_morgue', rect(50, 63, 3, 4), 2000, 'radiology', 'morgue')
    .door('door_pediatrics_morgue', rect(32, 72, 4, 3), 1250, 'pediatrics', 'morgue');
  m.spawn('M1', 37, 80, 'morgue').spawn('M2', 66, 68, 'morgue');
  m.boxSpot(46, 80, 'morgue').breaker(44, 67.2).powerPanel(66.6, 75);
  m.lamp(46, 71, { intensity: 0.4, flicker: 0.7, color: 0xcfe8ff }).lamp(58, 76, { intensity: 0.4, color: 0xcfe8ff })
    .lamp(40, 78, { broken: true });
  m.props('morgue_drawers', [[39, 67], [55, 67], [63, 67]])
    .props('gurney', [[48, 74], [55, 74], [51, 78]])
    .props('trash', [[67, 80]]);

  // ── Refeitório.
  m.room('cafeteria', rect(72, 67, 24, 14), 'linoleum')
    .door('door_pharmacy_cafeteria', rect(82, 63, 3, 4), 1500, 'pharmacy', 'cafeteria');
  m.spawn('C1', 94, 80, 'cafeteria').spawn('C2', 73, 68, 'cafeteria');
  m.ammo(88, 67).boxSpot(90, 79, 'cafeteria');
  m.lamp(78, 71, { intensity: 0.6 }).lamp(90, 71, { intensity: 0.6, flicker: 0.2 }).lamp(84, 77, { intensity: 0.55 });
  m.props('bench', [[77, 72], [77, 75], [84, 72], [84, 75], [91, 73]])
    .props('vending', [[74, 67], [94, 67]])
    .props('trash', [[73, 80], [95, 76]]);

  // ── Laboratório: bancadas; a centrífuga da missão fica no meio.
  m.room('lab', rect(20, 85, 64, 12), 'hospital')
    .solid(rect(38, 85, 1, 5), rect(66, 85, 1, 5), rect(30, 92, 6, 1), rect(70, 92, 6, 1))
    .door('door_morgue_lab', rect(46, 81, 3, 4), 3000, 'morgue', 'lab')
    .door('door_cafeteria_lab', rect(78, 81, 3, 4), 2500, 'cafeteria', 'lab');
  m.spawn('L1', 21, 86, 'lab').spawn('L2', 82, 96, 'lab').spawn('L3', 52, 96, 'lab');
  m.ammo(70, 85).weaponLab(34, 85).perk('overload', 83, 90).boxSpot(28, 96, 'lab');
  m.trap(43, 85.2, rect(45, 85, 5, 2));
  m.lamp(28, 89, { intensity: 0.5, color: 0xcff8f0 }).lamp(52, 90, { intensity: 0.55, flicker: 0.3, color: 0xcff8f0 })
    .lamp(74, 88, { intensity: 0.45, flicker: 0.6 }).lamp(60, 95, { broken: true });
  m.props('lab_bench', [[24, 88], [58, 87], [72, 95]])
    .props('med_cabinet', [[42, 85], [62, 85]])
    .props('crate', [[21, 95], [22, 96]])
    .props('iv_stand', [[45, 93]]);

  m.quest({
    serum: {
      fridge: { tx: 92, ty: 3.2 },
      cabinet: { tx: 93, ty: 47.2 },
      drawer: { tx: 59, ty: 67.2 },
      centrifuge: { tx: 52, ty: 89.5 },
    },
  });
  m.secrets({
    // Ursinhos: Pediatria, UTI e Refeitório
    teddies: [{ tx: 8, ty: 80 }, { tx: 97, ty: 12 }, { tx: 72, ty: 80 }],
    radio: { tx: 76, ty: 96, holdMs: 900, label: 'OUVIR O GRAVADOR' },
    creditsSign: { tx: 58, ty: 49 },
    loreMessages: [
      '📼 "Diário do Dr. Almeida, dia 3: a amostra do Paciente Zero reagiu ao soro. As células não param de se dividir."',
      '📼 "Dia 9: a febre some e volta. O Paciente Zero arrancou as amarras. Três enfermeiros foram mordidos."',
      '📼 "Dia 12: lacramos o laboratório e mandamos as amostras de trem para a Estação Central. Que Deus nos perdoe."',
      '📼 "...se estiver ouvindo isto: não deixe o Paciente Zero chegar à superfície. O soro está na câmara."',
    ],
  });
  return m;
}
