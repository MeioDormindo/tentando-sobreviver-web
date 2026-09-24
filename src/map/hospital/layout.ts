import type { AreaDef, BoxSpot, DoorDef, FloorDef, LampDef, MachinePlacement, MapInteractionDef, MapLayout, ObstacleDef, PropPlacement, Rect, SpawnDef, StationPlacement, TilePos, WindowDef } from '../types';

/**
 * Hospital Santa Luzia (Mapa 2). Tudo em tiles de 32 px.
 *
 *  y 4–25    [ Centro Cirúrgico ]  [ UTI ]
 *  y 28–53          [ RECEPÇÃO (início) ]           ← janelas nos dois lados
 *  y 56–75   [ Enfermaria ] [ Radiologia ] [ Farmácia ]   ← janelas nas pontas
 *  y 78–91   [ Pediatria ] [ Necrotério ] [ Refeitório ]
 *  y 94–107          [ Laboratório Subterrâneo ]
 */

const MAP_WIDTH = 120;
const MAP_HEIGHT = 110;

/** Luz fria de hospital. */
const COLD = 0xd8ecff;

const AREAS: AreaDef[] = [
  { id: 'reception', name: 'Recepção', darkness: 0.6, rects: [{ x: 38, y: 28, w: 44, h: 26 }] },
  { id: 'surgery', name: 'Centro Cirúrgico', darkness: 0.76, rects: [{ x: 8, y: 4, w: 50, h: 22 }] },
  { id: 'icu', name: 'UTI', darkness: 0.72, rects: [{ x: 60, y: 4, w: 52, h: 22 }] },
  { id: 'ward', name: 'Enfermaria', darkness: 0.7, rects: [{ x: 8, y: 56, w: 32, h: 20 }] },
  { id: 'radiology', name: 'Radiologia', darkness: 0.78, rects: [{ x: 42, y: 56, w: 36, h: 20 }] },
  { id: 'pharmacy', name: 'Farmácia', darkness: 0.72, rects: [{ x: 80, y: 56, w: 32, h: 20 }] },
  { id: 'pediatrics', name: 'Pediatria', darkness: 0.8, rects: [{ x: 8, y: 78, w: 28, h: 14 }] },
  { id: 'morgue', name: 'Necrotério', darkness: 0.88, rects: [{ x: 38, y: 78, w: 36, h: 14 }] },
  { id: 'cafeteria', name: 'Refeitório', darkness: 0.74, rects: [{ x: 76, y: 78, w: 36, h: 14 }] },
  { id: 'lab', name: 'Laboratório', darkness: 0.86, rects: [{ x: 24, y: 94, w: 72, h: 14 }] },
];

/** Pátios externos (estacionamento das ambulâncias) atrás das janelas. */
const POCKETS: Rect[] = [
  { x: 32, y: 31, w: 5, h: 5 },
  { x: 32, y: 45, w: 5, h: 5 },
  { x: 83, y: 31, w: 5, h: 5 },
  { x: 83, y: 45, w: 5, h: 5 },
  { x: 2, y: 59, w: 5, h: 5 },
  { x: 2, y: 68, w: 5, h: 5 },
  { x: 113, y: 59, w: 5, h: 5 },
  { x: 113, y: 68, w: 5, h: 5 },
];

const FLOORS: FloorDef[] = [
  { rect: { x: 38, y: 28, w: 44, h: 26 }, kind: 'hospital' },
  { rect: { x: 8, y: 4, w: 50, h: 22 }, kind: 'hospital' },
  { rect: { x: 60, y: 4, w: 52, h: 22 }, kind: 'linoleum' },
  { rect: { x: 8, y: 56, w: 32, h: 20 }, kind: 'linoleum' },
  { rect: { x: 42, y: 56, w: 36, h: 20 }, kind: 'linoleum' },
  { rect: { x: 80, y: 56, w: 32, h: 20 }, kind: 'linoleum' },
  { rect: { x: 8, y: 78, w: 28, h: 14 }, kind: 'linoleum' },
  { rect: { x: 38, y: 78, w: 36, h: 14 }, kind: 'morgue' },
  { rect: { x: 76, y: 78, w: 36, h: 14 }, kind: 'hospital' },
  { rect: { x: 24, y: 94, w: 72, h: 14 }, kind: 'metal' },
  ...POCKETS.map((rect): FloorDef => ({ rect, kind: 'concrete' })),
];

const wall = (x: number, y: number, w: number, h: number): ObstacleDef => ({ rect: { x, y, w, h }, kind: 'wall' });

const OBSTACLES: ObstacleDef[] = [
  // Recepção: balcão das enfermeiras e pilares
  wall(54, 33, 12, 2),
  wall(44, 36, 2, 2),
  wall(74, 36, 2, 2),
  wall(44, 46, 2, 2),
  wall(74, 46, 2, 2),
  // Centro Cirúrgico: três salas de cirurgia abertas para o corredor de baixo
  wall(24, 4, 1, 14),
  wall(41, 4, 1, 14),
  // UTI: divisórias dos leitos
  wall(77, 4, 1, 12),
  wall(94, 4, 1, 12),
  // Radiologia: salas de raio-X e o tomógrafo
  wall(50, 56, 1, 8),
  wall(70, 56, 1, 8),
  wall(58, 66, 4, 3),
  // Farmácia: balcões
  wall(84, 66, 10, 1),
  wall(98, 66, 10, 1),
  // Laboratório: câmara de contenção e divisórias
  wall(56, 98, 8, 4),
  wall(40, 94, 1, 6),
  wall(80, 102, 1, 6),
];

const DOORS: DoorDef[] = [
  { id: 'door_reception_radiology', rect: { x: 58, y: 54, w: 4, h: 2 }, cost: 750, areas: ['reception', 'radiology'] },
  { id: 'door_radiology_ward', rect: { x: 40, y: 64, w: 2, h: 3 }, cost: 1000, areas: ['radiology', 'ward'] },
  { id: 'door_radiology_pharmacy', rect: { x: 78, y: 64, w: 2, h: 3 }, cost: 1000, areas: ['radiology', 'pharmacy'] },
  { id: 'door_reception_surgery', rect: { x: 46, y: 26, w: 3, h: 2 }, cost: 1500, areas: ['reception', 'surgery'] },
  { id: 'door_reception_icu', rect: { x: 72, y: 26, w: 3, h: 2 }, cost: 1500, areas: ['reception', 'icu'] },
  { id: 'door_surgery_icu', rect: { x: 58, y: 12, w: 2, h: 3 }, cost: 1250, areas: ['surgery', 'icu'] },
  { id: 'door_ward_pediatrics', rect: { x: 20, y: 76, w: 3, h: 2 }, cost: 1250, areas: ['ward', 'pediatrics'] },
  { id: 'door_radiology_morgue', rect: { x: 56, y: 76, w: 3, h: 2 }, cost: 2000, areas: ['radiology', 'morgue'] },
  { id: 'door_pharmacy_cafeteria', rect: { x: 94, y: 76, w: 3, h: 2 }, cost: 1500, areas: ['pharmacy', 'cafeteria'] },
  { id: 'door_pediatrics_morgue', rect: { x: 36, y: 84, w: 2, h: 3 }, cost: 1250, areas: ['pediatrics', 'morgue'] },
  { id: 'door_morgue_lab', rect: { x: 50, y: 92, w: 3, h: 2 }, cost: 3000, areas: ['morgue', 'lab'] },
  { id: 'door_cafeteria_lab', rect: { x: 84, y: 92, w: 3, h: 2 }, cost: 2500, areas: ['cafeteria', 'lab'] },
];

const WINDOWS: WindowDef[] = [
  { id: 'win_reception_w1', rect: { x: 37, y: 32, w: 1, h: 2 }, area: 'reception' },
  { id: 'win_reception_w2', rect: { x: 37, y: 46, w: 1, h: 2 }, area: 'reception' },
  { id: 'win_reception_e1', rect: { x: 82, y: 32, w: 1, h: 2 }, area: 'reception' },
  { id: 'win_reception_e2', rect: { x: 82, y: 46, w: 1, h: 2 }, area: 'reception' },
  { id: 'win_ward_1', rect: { x: 7, y: 60, w: 1, h: 2 }, area: 'ward' },
  { id: 'win_ward_2', rect: { x: 7, y: 69, w: 1, h: 2 }, area: 'ward' },
  { id: 'win_pharmacy_1', rect: { x: 112, y: 60, w: 1, h: 2 }, area: 'pharmacy' },
  { id: 'win_pharmacy_2', rect: { x: 112, y: 69, w: 1, h: 2 }, area: 'pharmacy' },
];

/** Recepção, Enfermaria e Farmácia recebem zumbis pelos pátios; as demais, pelos cantos das salas. */
const SPAWNS: SpawnDef[] = [
  { id: 'R1', tx: 34, ty: 33, area: 'reception', minWave: 1 },
  { id: 'R2', tx: 34, ty: 47, area: 'reception', minWave: 1 },
  { id: 'R3', tx: 85, ty: 33, area: 'reception', minWave: 1 },
  { id: 'R4', tx: 85, ty: 47, area: 'reception', minWave: 1 },
  { id: 'W1', tx: 4, ty: 61, area: 'ward', minWave: 1 },
  { id: 'W2', tx: 4, ty: 70, area: 'ward', minWave: 1 },
  { id: 'F1', tx: 115, ty: 61, area: 'pharmacy', minWave: 1 },
  { id: 'F2', tx: 115, ty: 70, area: 'pharmacy', minWave: 1 },
  { id: 'S1', tx: 9, ty: 5, area: 'surgery', minWave: 1 },
  { id: 'S2', tx: 30, ty: 24, area: 'surgery', minWave: 1 },
  { id: 'I1', tx: 110, ty: 5, area: 'icu', minWave: 1 },
  { id: 'I2', tx: 90, ty: 24, area: 'icu', minWave: 1 },
  { id: 'X1', tx: 43, ty: 57, area: 'radiology', minWave: 1 },
  { id: 'X2', tx: 76, ty: 57, area: 'radiology', minWave: 1 },
  { id: 'P1', tx: 9, ty: 79, area: 'pediatrics', minWave: 1 },
  { id: 'P2', tx: 34, ty: 90, area: 'pediatrics', minWave: 1 },
  { id: 'M1', tx: 39, ty: 90, area: 'morgue', minWave: 1 },
  { id: 'M2', tx: 72, ty: 79, area: 'morgue', minWave: 1 },
  { id: 'C1', tx: 110, ty: 90, area: 'cafeteria', minWave: 1 },
  { id: 'C2', tx: 77, ty: 79, area: 'cafeteria', minWave: 1 },
  { id: 'L1', tx: 25, ty: 95, area: 'lab', minWave: 1 },
  { id: 'L2', tx: 94, ty: 106, area: 'lab', minWave: 1 },
  { id: 'L3', tx: 60, ty: 106, area: 'lab', minWave: 1 },
];

const STATIONS: StationPlacement[] = [
  { type: 'weapon', weaponId: 'glock', tx: 52, ty: 30 },
  { type: 'weapon', weaponId: 'magnum', tx: 40, ty: 44 },
  { type: 'weapon', weaponId: 'barrett', tx: 104, ty: 22 },
  { type: 'weapon', weaponId: 'uzi_dual', tx: 110, ty: 66 },
  { type: 'ammo', tx: 68, ty: 30 },
  { type: 'weapon', weaponId: 'mp5', tx: 24, ty: 57 },
  { type: 'weapon', weaponId: 'pump', tx: 66, ty: 74 },
  { type: 'ammo', tx: 46, ty: 74 },
  { type: 'ammo', tx: 104, ty: 57 },
  { type: 'ammo', tx: 30, ty: 90 },
  { type: 'ammo', tx: 104, ty: 90 },
  { type: 'ammo', tx: 70, ty: 106 },
];

const MACHINES: MachinePlacement[] = [
  { type: 'mystery_box', tx: 41, ty: 30 },
  { type: 'weapon_lab', tx: 52, ty: 106 },
  { type: 'perk', perkId: 'quick_revive', tx: 80, ty: 40 },
  { type: 'perk', perkId: 'fortify', tx: 9, ty: 74 },
  { type: 'perk', perkId: 'sprint', tx: 76, ty: 72 },
  { type: 'perk', perkId: 'quick_hands', tx: 110, ty: 74 },
  { type: 'perk', perkId: 'adrenaline', tx: 10, ty: 24 },
  { type: 'perk', perkId: 'deadeye', tx: 110, ty: 20 },
  { type: 'perk', perkId: 'overload', tx: 30, ty: 106 },
];

const BOX_SPOTS: BoxSpot[] = [
  { tx: 41, ty: 30, area: 'reception' },
  { tx: 79, ty: 52, area: 'reception' },
  { tx: 40, ty: 52, area: 'reception' },
  { tx: 32, ty: 20, area: 'surgery' },
  { tx: 86, ty: 20, area: 'icu' },
  { tx: 30, ty: 70, area: 'ward' },
  { tx: 66, ty: 70, area: 'radiology' },
  { tx: 96, ty: 70, area: 'pharmacy' },
  { tx: 20, ty: 88, area: 'pediatrics' },
  { tx: 60, ty: 88, area: 'morgue' },
  { tx: 96, ty: 88, area: 'cafeteria' },
  { tx: 40, ty: 106, area: 'lab' },
];

/** O boss surge no saguão da Recepção, amplo e sempre aberto. */
const BOSS_SPAWNS: TilePos[] = [
  { tx: 60, ty: 42 },
  { tx: 50, ty: 42 },
  { tx: 70, ty: 42 },
  { tx: 60, ty: 48 },
];

const INTERACTIONS: MapInteractionDef[] = [
  // Necrotério: gerador de emergência (encerra o Apagão)
  { type: 'power', tx: 72.6, ty: 85 },
  // Recepção: alarme de incêndio
  { type: 'alarm', tx: 38.6, ty: 40 },
  // Armadilha na entrada da Radiologia (logo abaixo da porta da Recepção)
  { type: 'trap', tx: 55.4, ty: 56.6, zone: { x: 57, y: 56, w: 6, h: 3 } },
  // Armadilha na porta do Laboratório (vinda do Necrotério)
  { type: 'trap', tx: 46.4, ty: 94.6, zone: { x: 48, y: 94, w: 7, h: 2 } },
];

const PROPS: PropPlacement[] = [
  // Recepção
  { type: 'waiting_chairs', tx: 47, ty: 50 },
  { type: 'waiting_chairs', tx: 51, ty: 50 },
  { type: 'waiting_chairs', tx: 69, ty: 50 },
  { type: 'waiting_chairs', tx: 73, ty: 50 },
  { type: 'iv_stand', tx: 57, ty: 45 },
  { type: 'gurney', tx: 64, ty: 44, angle: 20 },
  { type: 'wheelchair', tx: 49, ty: 38, angle: -30 },
  { type: 'vending', tx: 78, ty: 29 },
  { type: 'sign_stand', tx: 66, ty: 52.4 },
  { type: 'trash', tx: 39, ty: 53 },
  { type: 'extinguisher', tx: 81.3, ty: 36 },
  // Centro Cirúrgico: mesa, foco e armário em cada sala
  { type: 'surgical_light', tx: 16, ty: 10 },
  { type: 'surgical_light', tx: 32, ty: 10 },
  { type: 'surgical_light', tx: 49, ty: 10 },
  { type: 'gurney', tx: 16, ty: 12 },
  { type: 'gurney', tx: 32, ty: 12 },
  { type: 'gurney', tx: 49, ty: 12 },
  { type: 'med_cabinet', tx: 16, ty: 4.6 },
  { type: 'med_cabinet', tx: 32, ty: 4.6 },
  { type: 'med_cabinet', tx: 49, ty: 4.6 },
  { type: 'iv_stand', tx: 20, ty: 12 },
  { type: 'iv_stand', tx: 36, ty: 12 },
  { type: 'cables', tx: 28, ty: 21 },
  // UTI
  { type: 'hospital_bed', tx: 68, ty: 8 },
  { type: 'hospital_bed', tx: 85, ty: 8 },
  { type: 'hospital_bed', tx: 102, ty: 8 },
  { type: 'iv_stand', tx: 72, ty: 10 },
  { type: 'iv_stand', tx: 89, ty: 10 },
  { type: 'iv_stand', tx: 106, ty: 10 },
  { type: 'desk_computer', tx: 86, ty: 22 },
  { type: 'chair', tx: 86, ty: 23.4 },
  { type: 'wheelchair', tx: 66, ty: 20, angle: 40 },
  // Enfermaria: fileiras de leitos
  { type: 'hospital_bed', tx: 13, ty: 60 },
  { type: 'hospital_bed', tx: 13, ty: 64 },
  { type: 'hospital_bed', tx: 13, ty: 68 },
  { type: 'hospital_bed', tx: 23, ty: 61 },
  { type: 'hospital_bed', tx: 23, ty: 65 },
  { type: 'hospital_bed', tx: 23, ty: 69 },
  { type: 'hospital_bed', tx: 33, ty: 60 },
  { type: 'hospital_bed', tx: 33, ty: 68 },
  { type: 'iv_stand', tx: 16, ty: 60 },
  { type: 'iv_stand', tx: 26, ty: 65 },
  { type: 'wheelchair', tx: 18, ty: 73, angle: 70 },
  // Radiologia
  { type: 'gurney', tx: 46, ty: 62 },
  { type: 'wheelchair', tx: 66, ty: 62, angle: -20 },
  { type: 'desk_computer', tx: 54, ty: 58 },
  { type: 'cables', tx: 60, ty: 70 },
  { type: 'locker', tx: 74, ty: 74.4 },
  // Farmácia
  { type: 'med_cabinet', tx: 84, ty: 56.6 },
  { type: 'med_cabinet', tx: 90, ty: 56.6 },
  { type: 'med_cabinet', tx: 97, ty: 56.6 },
  { type: 'med_cabinet', tx: 88, ty: 74.4 },
  { type: 'med_cabinet', tx: 102, ty: 74.4 },
  { type: 'chair', tx: 89, ty: 68 },
  { type: 'trash', tx: 81, ty: 74 },
  // Pediatria
  { type: 'hospital_bed', tx: 14, ty: 81 },
  { type: 'hospital_bed', tx: 26, ty: 81 },
  { type: 'wheelchair', tx: 16, ty: 88, angle: 10 },
  { type: 'chair', tx: 24, ty: 87 },
  // Necrotério: gavetas refrigeradas e macas
  { type: 'morgue_drawers', tx: 44, ty: 78.6 },
  { type: 'morgue_drawers', tx: 64, ty: 78.6 },
  { type: 'gurney', tx: 48, ty: 86 },
  { type: 'gurney', tx: 64, ty: 86, angle: -10 },
  { type: 'iv_stand', tx: 55, ty: 89 },
  // Refeitório: mesas e máquinas de venda
  { type: 'bench', tx: 84, ty: 82 },
  { type: 'bench', tx: 92, ty: 82 },
  { type: 'bench', tx: 100, ty: 82 },
  { type: 'bench', tx: 84, ty: 87 },
  { type: 'bench', tx: 92, ty: 87 },
  { type: 'vending', tx: 110, ty: 84 },
  { type: 'vending', tx: 110, ty: 86.4 },
  { type: 'trash', tx: 77, ty: 90 },
  // Laboratório
  { type: 'lab_bench', tx: 32, ty: 97 },
  { type: 'lab_bench', tx: 32, ty: 102 },
  { type: 'lab_bench', tx: 70, ty: 97 },
  { type: 'lab_bench', tx: 88, ty: 99 },
  { type: 'cables', tx: 60, ty: 103 },
  { type: 'crate', tx: 94, ty: 101 },
  { type: 'barrel', tx: 26, ty: 99 },
];

const LAMPS: LampDef[] = [
  // Recepção
  { tx: 50, ty: 38, radius: 220, intensity: 0.72, flicker: 0.1, color: COLD },
  { tx: 70, ty: 38, radius: 220, intensity: 0.7, flicker: 0.2, color: COLD },
  { tx: 60, ty: 50, radius: 230, intensity: 0.72, flicker: 0.05, color: COLD },
  // Centro Cirúrgico
  { tx: 16, ty: 20, radius: 160, intensity: 0.45, flicker: 0.4, color: COLD },
  { tx: 40, ty: 20, radius: 160, intensity: 0.45, flicker: 0.2, color: COLD },
  // UTI
  { tx: 68, ty: 14, radius: 170, intensity: 0.5, flicker: 0.3, color: COLD },
  { tx: 86, ty: 14, radius: 170, intensity: 0.55, flicker: 0.1, color: COLD },
  { tx: 104, ty: 14, radius: 170, intensity: 0.5, flicker: 0.6, color: COLD },
  // Enfermaria
  { tx: 18, ty: 62, radius: 180, intensity: 0.55, flicker: 0.2, color: COLD },
  { tx: 30, ty: 70, radius: 180, intensity: 0.5, flicker: 0.5, color: COLD },
  // Radiologia
  { tx: 46, ty: 66, radius: 150, intensity: 0.45, flicker: 0.4, color: COLD },
  { tx: 70, ty: 70, radius: 150, intensity: 0.5, flicker: 0.2, color: COLD },
  // Farmácia
  { tx: 90, ty: 62, radius: 170, intensity: 0.55, flicker: 0.2, color: COLD },
  { tx: 102, ty: 70, radius: 170, intensity: 0.5, flicker: 0.4, color: COLD },
  // Pediatria
  { tx: 20, ty: 84, radius: 160, intensity: 0.45, flicker: 0.6 },
  // Necrotério
  { tx: 52, ty: 84, radius: 140, intensity: 0.4, flicker: 0.7, color: COLD },
  { tx: 66, ty: 88, radius: 120, intensity: 0.35, flicker: 0.5, color: COLD },
  // Refeitório
  { tx: 88, ty: 84, radius: 180, intensity: 0.55, flicker: 0.2 },
  { tx: 104, ty: 88, radius: 160, intensity: 0.5, flicker: 0.3 },
  // Laboratório (luz esverdeada das amostras)
  { tx: 34, ty: 100, radius: 160, intensity: 0.5, flicker: 0.3, color: 0x9cffd8 },
  { tx: 60, ty: 104, radius: 170, intensity: 0.55, flicker: 0.2, color: 0x9cffd8 },
  { tx: 84, ty: 100, radius: 160, intensity: 0.5, flicker: 0.5, color: 0x9cffd8 },
];

/** Hospital Santa Luzia completo, como o jogo o consome. */
export const HOSPITAL_LAYOUT: MapLayout = {
  id: 'map2',
  width: MAP_WIDTH,
  height: MAP_HEIGHT,
  startArea: 'reception',
  playerStart: { tx: 60, ty: 44 },
  outsideDarkness: 0.84,
  areas: AREAS,
  pockets: POCKETS,
  floors: FLOORS,
  obstacles: OBSTACLES,
  carves: [],
  doors: DOORS,
  windows: WINDOWS,
  spawns: SPAWNS,
  stations: STATIONS,
  machines: MACHINES,
  boxSpots: BOX_SPOTS,
  bossSpawns: BOSS_SPAWNS,
  props: PROPS,
  lamps: LAMPS,
  interactions: INTERACTIONS,
  decalSeed: 'hospital-decals',
  secrets: {
    // Ursinhos: Pediatria, UTI e Necrotério
    teddies: [
      { tx: 9, ty: 91 },
      { tx: 111, ty: 24 },
      { tx: 73, ty: 91 },
    ],
    // Gravador do Dr. Almeida no Laboratório
    radio: { tx: 88, ty: 95, holdMs: 900, label: 'OUVIR O GRAVADOR' },
    creditsSign: { tx: 66, ty: 52.4 },
    loreMessages: [
      '📼 "Diário do Dr. Almeida, dia 3: a amostra do Paciente Zero reagiu ao soro. As células não param de se dividir."',
      '📼 "Dia 9: a febre some e volta. O Paciente Zero arrancou as amarras. Três enfermeiros foram mordidos."',
      '📼 "Dia 12: lacramos o laboratório e mandamos as amostras de trem para a Estação Central. Que Deus nos perdoe."',
      '📼 "...se estiver ouvindo isto: não deixe o Paciente Zero chegar à superfície. O soro está na câmara."',
    ],
  },
};
