/**
 * Terminal Central, redesenhado para a câmera 2.5D (~20 m de largura na tela): salas do
 * tamanho de uma ou duas telas, corredores de 3–5 m, colunas e balcões para usar de cobertura.
 * De cima para baixo: Plataforma (trem) → Hall (início) → Bilheteria e Lojas → Área Técnica
 * → Túneis → Manutenção. Mesmas áreas, portas, preços, máquinas e segredos do jogo web.
 */
import { MapBuilder, rect } from './dsl';

export function terminal(): MapBuilder {
  const m = new MapBuilder('terminal', 100, 104, { outsideDarkness: 0.82, decorSeed: 'terminal-2d5' });

  m.area('hall', 'Hall Central', 0.6, 'lit')
    .area('platform', 'Plataforma Norte', 0.68, 'dim')
    .area('ticket', 'Bilheteria', 0.7, 'dim')
    .area('shops', 'Lojas', 0.78, 'dim', 1.3)
    .area('tech', 'Área Técnica', 0.8, 'dark', 1.2)
    .area('tunnels', 'Túneis', 0.9, 'dark', 1.5)
    .area('maintenance', 'Manutenção', 0.82, 'dark', 1.3);

  // ── Plataforma Norte: trilho de trás (trem parado com um vagão aberto), ilha, trilho da
  // frente (onde o trem passa) e a plataforma principal, ligada ao Hall.
  m.room('platform', rect(4, 2, 92, 20), 'concrete')
    .floor(rect(4, 2, 92, 5), 'tracks')
    .floor(rect(4, 10, 92, 4), 'tracks')
    .train(rect(16, 2, 68, 5))
    .carve(rect(44, 3, 12, 3), 'wagon')
    .carve(rect(49, 6, 3, 1), 'wagon')
    .solid(rect(16, 17, 2, 2), rect(32, 17, 2, 2), rect(66, 17, 2, 2), rect(82, 17, 2, 2));
  m.station({
    area: 'platform',
    lane: { y: 10, h: 4 },
    span: { from: 4, to: 96 },
    tunnels: [{ y: 2, h: 5 }, { y: 10, h: 4 }],
    signals: [{ tx: 4.8, ty: 14.4 }, { tx: 94.2, ty: 14.4 }],
    board: { tx: 60, ty: 14.1 },
  });
  m.spawn('P1', 5, 11, 'platform').spawn('P2', 94, 12, 'platform').spawn('P3', 5, 4, 'platform').spawn('P4', 94, 4, 'platform');
  m.weapon('ak', 30, 7).ammo(70, 7).weapon('combat_shotgun', 46, 3);
  m.perk('deadeye', 5, 16).boxSpot(58, 20, 'platform').trainPanel(40, 14.3);
  m.lampRow(10, 90, 18, 16, { intensity: 0.55, flicker: 0.15 })
    .lamp(24, 8, { intensity: 0.4, flicker: 0.5 }).lamp(50, 8, { intensity: 0.45 }).lamp(76, 8, { broken: true });
  m.props('bench', [[24, 19], [42, 19], [58, 19], [74, 19], [40, 8], [62, 8]])
    .props('trash', [[10, 20], [50, 20], [90, 20], [34, 8]])
    .props('barrier', [[8, 14], [92, 14]])
    .props('sign_stand', [[24, 15], [76, 15]])
    .props('suitcase', [[46, 17, -30], [88, 17, 60], [70, 8, 15]])
    .props('wagon_seat', [[45, 4], [45, 5], [54, 4], [54, 5]])
    .props('luggage_cart', [[86, 20]])
    .props('extinguisher', [[4, 20], [95, 20]]);

  // ── Hall Central (início): colunas, balcão de informações, janelas a oeste e a leste.
  m.room('hall', rect(30, 24, 40, 20), 'terminal')
    .solid(rect(35, 29, 2, 2), rect(63, 29, 2, 2), rect(35, 38, 2, 2), rect(63, 38, 2, 2))
    .door('door_hall_platform', rect(48, 22, 4, 2), 1500, 'hall', 'platform')
    .pocket(rect(24, 25, 5, 5)).window('win_hall_w1', rect(29, 27, 1, 2), 'hall').spawn('H1', 26, 27, 'hall')
    .pocket(rect(24, 37, 5, 5)).window('win_hall_w2', rect(29, 39, 1, 2), 'hall').spawn('H2', 26, 39, 'hall')
    .pocket(rect(71, 25, 5, 5)).window('win_hall_e1', rect(70, 27, 1, 2), 'hall').spawn('H3', 73, 27, 'hall')
    .pocket(rect(71, 37, 5, 5)).window('win_hall_e2', rect(70, 39, 1, 2), 'hall').spawn('H4', 73, 39, 'hall');
  m.playerStart('hall', 50, 37).boss([50, 35], [42, 36], [58, 36], [50, 41]);
  m.weapon('glock', 38, 24).ammo(62, 24).mysteryBox(56, 24, 'hall').boxSpot(43, 43, 'hall').boxSpot(57, 43, 'hall');
  m.perk('fortify', 30, 34).perk('quick_revive', 69, 34);
  m.alarmPanel(41, 24.2).trap(45, 24.2, rect(47, 24, 6, 2));
  m.lamp(40, 27, { intensity: 0.7 }).lamp(60, 27, { intensity: 0.7, flicker: 0.2 }).lamp(50, 34, { intensity: 0.75 })
    .lamp(40, 41, { intensity: 0.65 }).lamp(60, 41, { intensity: 0.65, flicker: 0.4 });
  m.props('bench', [[41, 35, 90], [59, 35, 90], [46, 39], [54, 39]])
    .props('trash', [[31, 25], [68, 25], [31, 42], [68, 42]])
    .props('desk_computer', [[47, 31], [52, 31]])
    .props('chair', [[47, 30, 180], [52, 30, 170]])
    .props('waiting_chairs', [[50, 27]])
    .props('luggage_cart', [[38, 42]])
    .props('suitcase', [[47, 36, 25], [62, 33, -40]])
    .props('sign_stand', [[62, 42]])
    .props('extinguisher', [[30, 30], [69, 30]])
    .props('cables', [[56, 41, 4]]);

  // ── Bilheteria: balcão com três guichês.
  m.room('ticket', rect(8, 46, 32, 16), 'terminal')
    .solid(rect(10, 52, 7, 1), rect(19, 52, 7, 1), rect(28, 52, 7, 1))
    .door('door_hall_ticket', rect(33, 44, 3, 2), 750, 'hall', 'ticket')
    .pocket(rect(2, 47, 5, 5)).window('win_ticket_1', rect(7, 49, 1, 2), 'ticket').spawn('B1', 4, 49, 'ticket')
    .pocket(rect(2, 55, 5, 5)).window('win_ticket_2', rect(7, 57, 1, 2), 'ticket').spawn('B2', 4, 57, 'ticket');
  m.weapon('mp5', 14, 46).weapon('pump', 26, 46).perk('quick_hands', 39, 57).boxSpot(15, 60, 'ticket');
  m.lamp(14, 49, { intensity: 0.55, flicker: 0.3 }).lamp(28, 49, { intensity: 0.55 }).lamp(20, 57, { intensity: 0.5, flicker: 0.6 })
    .lamp(33, 58, { broken: true });
  m.props('desk_computer', [[13, 51], [22, 51], [31, 51]])
    .props('chair', [[13, 49, 180], [22, 49, 170], [31, 49, 190], [11, 58, 40]])
    .props('waiting_chairs', [[22, 56], [22, 59]])
    .props('trash', [[9, 61], [38, 47]])
    .props('suitcase', [[30, 56, 10]])
    .props('barrel', [[38, 60]])
    .props('sign_stand', [[36, 53]]);

  // ── Lojas: três lojas lado a lado com vitrines, abertas para o corredor da frente.
  m.room('shops', rect(60, 46, 32, 16), 'terminal')
    .floor(rect(60, 54, 32, 8), 'concrete')
    .solid(rect(70, 46, 1, 7), rect(81, 46, 1, 7))
    .solid(rect(60, 53, 4, 1), rect(67, 53, 8, 1), rect(78, 53, 8, 1), rect(89, 53, 3, 1))
    .door('door_hall_shops', rect(64, 44, 3, 2), 1000, 'hall', 'shops')
    .pocket(rect(93, 47, 5, 5)).window('win_shops_1', rect(92, 49, 1, 2), 'shops').spawn('L1', 95, 49, 'shops')
    .pocket(rect(93, 55, 5, 5)).window('win_shops_2', rect(92, 57, 1, 2), 'shops').spawn('L2', 95, 57, 'shops');
  m.weapon('vector', 74, 46).weapon('m4', 86, 46).ammo(61, 54).perk('sprint', 91, 60).boxSpot(76, 60, 'shops');
  m.lamp(65, 49, { intensity: 0.5, flicker: 0.2 }).lamp(76, 49, { intensity: 0.45, flicker: 0.8 }).lamp(86, 49, { intensity: 0.5 })
    .lamp(68, 58, { intensity: 0.45 }).lamp(84, 58, { broken: true });
  m.props('vitrine', [[62, 51], [77, 51], [88, 51]])
    .props('crate', [[61, 47], [68, 47], [69, 48], [90, 47]])
    .props('vending', [[72, 55]])
    .props('bench', [[80, 59]])
    .props('trash', [[60, 61], [88, 55]])
    .props('extinguisher', [[60, 58]]);

  // ── Área Técnica: salas de máquinas em labirinto.
  m.room('tech', rect(12, 65, 76, 13), 'metal')
    .solid(rect(28, 65, 1, 8), rect(44, 70, 1, 8), rect(56, 65, 1, 8), rect(70, 70, 1, 8), rect(32, 73, 8, 1), rect(60, 72, 6, 1))
    .door('door_ticket_tech', rect(24, 62, 3, 3), 1500, 'ticket', 'tech')
    .door('door_shops_tech', rect(74, 62, 3, 3), 2000, 'shops', 'tech');
  m.spawn('T1', 13, 66, 'tech').spawn('T2', 86, 76, 'tech').spawn('T3', 13, 76, 'tech').spawn('T4', 87, 70, 'tech');
  m.ammo(38, 65).perk('adrenaline', 82, 65).boxSpot(62, 76, 'tech').breaker(50, 65.2).powerPanel(12.4, 70);
  m.lamp(20, 68, { intensity: 0.5, flicker: 0.2 }).lamp(36, 68, { intensity: 0.5 }).lamp(50, 74, { intensity: 0.55, flicker: 0.6 })
    .lamp(63, 67, { broken: true }).lamp(80, 72, { intensity: 0.5, flicker: 0.3 });
  m.props('generator', [[18, 72], [48, 67], [84, 74]])
    .props('crate', [[34, 66], [35, 67], [76, 76], [66, 76]])
    .props('barrel', [[52, 76], [53, 75], [20, 76]])
    .props('locker', [[31, 65], [60, 65], [72, 65]])
    .props('cables', [[38, 75, -8], [78, 69, 12]])
    .props('floor_pipe', [[64, 70], [22, 67]])
    .props('extinguisher', [[57, 67]]);

  // ── Túneis: dois corredores de serviço com travessias.
  m.room('tunnels', rect(8, 81, 84, 9), 'tunnel')
    .solid(rect(8, 85, 8, 1), rect(18, 85, 22, 1), rect(42, 85, 16, 1), rect(60, 85, 18, 1), rect(80, 85, 12, 1))
    .solid(rect(30, 81, 1, 3), rect(72, 86, 1, 3))
    .door('door_tech_tunnels', rect(49, 78, 3, 3), 2500, 'tech', 'tunnels');
  m.spawn('U1', 9, 82, 'tunnels').spawn('U2', 90, 82, 'tunnels').spawn('U3', 9, 88, 'tunnels')
    .spawn('U4', 90, 88, 'tunnels').spawn('U5', 34, 82, 'tunnels').spawn('U6', 76, 88, 'tunnels');
  m.boxSpot(24, 88, 'tunnels').trap(41, 86.2, rect(44, 86, 5, 3));
  m.lamp(20, 83, { intensity: 0.45, flicker: 0.7 }).lamp(52, 87, { intensity: 0.45, flicker: 0.4 })
    .lamp(70, 83, { broken: true }).lamp(86, 87, { intensity: 0.4, flicker: 0.5 });
  m.props('barrel', [[26, 82], [86, 88]])
    .props('crate', [[56, 88]])
    .props('barrier', [[44, 83], [82, 82]])
    .props('cables', [[64, 82], [30, 88, 180]])
    .props('floor_pipe', [[12, 83]]);

  // ── Manutenção: oficina com o Weapon Lab.
  m.room('maintenance', rect(28, 93, 44, 9), 'metal')
    .solid(rect(38, 96, 2, 2), rect(60, 96, 2, 2), rect(47, 98, 6, 1))
    .door('door_tunnels_maint', rect(66, 90, 3, 3), 3000, 'tunnels', 'maintenance');
  m.spawn('M1', 29, 94, 'maintenance').spawn('M2', 70, 100, 'maintenance');
  m.weaponLab(44, 93).perk('overload', 71, 98).boxSpot(56, 100, 'maintenance');
  m.lamp(36, 99, { intensity: 0.55, flicker: 0.2 }).lamp(50, 95, { intensity: 0.6 }).lamp(64, 99, { intensity: 0.55, flicker: 0.4 });
  m.props('generator', [[54, 100]])
    .props('pallet', [[31, 100], [66, 95]])
    .props('crate', [[57, 94], [58, 95]])
    .props('locker', [[34, 93]])
    .props('barrel', [[42, 100]])
    .props('floor_pipe', [[50, 101]])
    .props('extinguisher', [[28, 97]]);

  m.secrets({
    // Ursinhos em cantos escuros: Lojas, Bilheteria e Túneis
    teddies: [{ tx: 91, ty: 46 }, { tx: 8, ty: 61 }, { tx: 91, ty: 89 }],
    // Rádio velho na Manutenção
    radio: { tx: 28.4, ty: 93.2, holdMs: 900, label: 'SINTONIZAR O RÁDIO' },
    // Placa perto da entrada da Plataforma
    creditsSign: { tx: 53.5, ty: 26 },
    loreMessages: [
      '📻 "...controle da Estação Central. O trem das 23h40 NÃO deve parar. Repito: não parem o trem..."',
      '📻 "...o maquinista não responde. Alguém viu o Condutor? Ele desceu nos túneis e voltou... diferente."',
      '📻 "...quarentena decretada. Portas lacradas. Quem ficou lá dentro está por conta própria."',
      '📻 "...se alguém ouvir isto: tentem sobreviver. O resgate chega ao amanhecer. Talvez."',
    ],
  });
  return m;
}
