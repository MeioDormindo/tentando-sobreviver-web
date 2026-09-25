/**
 * DSL dos mapas do Godot (visual 2.5D). Cada mapa é descrito por salas, paredes, portas,
 * janelas e o que vai dentro delas; `build()` gera o JSON que o LayoutMap lê (1 tile = 1 m,
 * x → leste, y → sul/+Z) e confere o desenho: tudo fica em chão, portas ligam as áreas que
 * dizem ligar e toda área é alcançável a partir do início.
 *
 * Construção da grade: tudo começa parede → salas e bolsões viram chão → sólidos (pilares,
 * balcões, trem) → recortes → portas → janelas. O tipo de piso só pinta o que já é chão.
 */
import { PROP_DEFS, type PropType, type PropDef } from '../../../src/map/props';

/** Deuses das 12 estátuas do Templo (uma receita de objeto por deus: statue_<deus>). */
export const GODS = ['zeus', 'hera', 'poseidon', 'demeter', 'athena', 'apollo', 'artemis', 'ares', 'aphrodite', 'hephaestus', 'hermes', 'dionysus'] as const;
export type God = typeof GODS[number];

/**
 * Objetos que só existem no Godot (Templo dos Mortos): mesmas unidades do jogo web (px, 32 = 1 m)
 * para o corpo de colisão; a arte vem das receitas de scripts/godot/pixel/props.mjs.
 */
export const GODOT_PROP_DEFS = {
  column: { body: { w: 30, h: 30, ox: 0, oy: 0 }, blocksBullets: true },
  column_broken: { body: { w: 30, h: 30, ox: 0, oy: 0 }, blocksBullets: true },
  column_fallen: { body: { w: 88, h: 26, ox: 0, oy: 0 }, blocksBullets: true },
  altar: { body: { w: 56, h: 34, ox: 0, oy: 0 }, blocksBullets: true, light: { radius: 90, intensity: 0.45, color: 0xffb060 } },
  brazier: { body: { w: 24, h: 24, ox: 0, oy: 0 }, blocksBullets: false, light: { radius: 150, intensity: 0.75, color: 0xff9a3a } },
  sarcophagus: { body: { w: 72, h: 32, ox: 0, oy: 0 }, blocksBullets: true },
  tomb: { body: { w: 40, h: 20, ox: 0, oy: 0 }, blocksBullets: true },
  bones: { blocksBullets: false },
  amphora: { body: { w: 16, h: 16, ox: 0, oy: 0 }, blocksBullets: false },
  tree: { body: { w: 26, h: 26, ox: 0, oy: 0 }, blocksBullets: true },
  dead_tree: { body: { w: 22, h: 22, ox: 0, oy: 0 }, blocksBullets: true },
  bush: { blocksBullets: false },
  rock: { body: { w: 40, h: 32, ox: 0, oy: 0 }, blocksBullets: true },
  statue_stone: { body: { w: 26, h: 26, ox: 0, oy: 0 }, blocksBullets: true },
  soul_crystal: { blocksBullets: false, light: { radius: 80, intensity: 0.5, color: 0x8a6aff } },
  chains: { blocksBullets: false },
  ...Object.fromEntries(GODS.map((g) => [`statue_${g}`, { body: { w: 34, h: 34, ox: 0, oy: 0 }, blocksBullets: true }])),
} as Record<string, Omit<PropDef, 'texture'>>;
export type AnyProp = PropType | keyof typeof GODOT_PROP_DEFS;

export interface Rect { x: number; y: number; w: number; h: number }
export type Floor = 'terminal' | 'concrete' | 'metal' | 'tracks' | 'tunnel' | 'wagon' | 'hospital' | 'linoleum' | 'morgue'
  | 'mosaic' | 'stone' | 'marble' | 'catacomb' | 'grass' | 'volcanic';
/** Portão especial: abre por altar (3 altares), missão (chave) ou segredo (12 estátuas); não se compra. */
export type DoorKind = 'buy' | 'altar' | 'quest' | 'secret';
/** Luz de uma área: bem iluminada (a lanterna sobra), meia-luz ou escura (a lanterna ajuda). */
export type Lighting = 'lit' | 'dim' | 'dark';

export const FLOOR_CHARS: Record<Floor, string> = {
  terminal: 't', concrete: 'c', metal: 'm', tracks: 'r', tunnel: 'u', wagon: 'w',
  hospital: 'h', linoleum: 'l', morgue: 'g',
  mosaic: 'o', stone: 'e', marble: 'a', catacomb: 'k', grass: 'f', volcanic: 'v',
};

const PX = 32;
const r3 = (n: number): number => Math.round(n * 1000) / 1000;
export const rect = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });

interface Area { id: string; name: string; darkness: number; lighting: Lighting; rects: Rect[]; decor: number }
interface Lamp { x: number; z: number; radius: number; intensity: number; flicker: number; color: number; broken: boolean; torch: boolean }

/** torch: tocha/braseiro (fogo, acende sem energia e tremula). */
export interface LampOptions { radius?: number; intensity?: number; flicker?: number; color?: number; broken?: boolean; torch?: boolean }

export class MapBuilder {
  private readonly areas: Area[] = [];
  private readonly rooms: Array<{ rect: Rect; floor: Floor }> = [];
  private readonly pockets: Array<{ rect: Rect; floor: Floor }> = [];
  private readonly solids: Array<{ rect: Rect; ch: '#' | 'T' | 'V' }> = [];
  private readonly carves: Array<{ rect: Rect; floor: Floor }> = [];
  private readonly floors: Array<{ rect: Rect; floor: Floor }> = [];
  private readonly doors: Array<{ id: string; rect: Rect; cost: number; areas: [string, string]; kind?: DoorKind }> = [];
  private readonly windows: Array<{ id: string; rect: Rect; area: string }> = [];
  private readonly spawns: Array<{ id: string; x: number; z: number; area: string; min_round: number }> = [];
  private readonly stations: Array<Record<string, unknown>> = [];
  private readonly machines: Array<Record<string, unknown>> = [];
  private readonly boxSpots: Array<{ x: number; z: number; area: string }> = [];
  private readonly bossSpawns: Array<{ x: number; z: number }> = [];
  private readonly lamps: Lamp[] = [];
  private readonly interactions: Array<Record<string, unknown>> = [];
  private readonly propList: Array<Record<string, unknown>> = [];
  private start = { area: '', x: 0, z: 0 };
  private startWeaponId = '';
  private stationData: Record<string, unknown> | null = null;
  private secretsData: Record<string, unknown> | null = null;
  private questData: Record<string, unknown> | null = null;
  private readonly extras: Record<string, unknown> = {};

  constructor(readonly id: string, readonly width: number, readonly height: number, private readonly options: { outsideDarkness: number; decorSeed: string }) {}

  // ── Estrutura ──

  /** Declara uma área (ids iguais aos do jogo web: som ambiente, trem e missão dependem deles). */
  area(id: string, name: string, darkness: number, lighting: Lighting, decor = 1): this {
    this.areas.push({ id, name, darkness, lighting, rects: [], decor });
    return this;
  }

  /** Sala: vira chão, entra na área e pinta o piso. */
  room(areaId: string, r: Rect, floor: Floor): this {
    this.getArea(areaId).rects.push(r);
    this.rooms.push({ rect: r, floor });
    return this;
  }

  /** Bolsão externo atrás de uma janela: chão fora das áreas, só zumbis chegam. */
  pocket(r: Rect, floor: Floor = 'concrete'): this {
    this.pockets.push({ rect: r, floor });
    return this;
  }

  /** Parede, pilar ou balcão dentro de uma sala. */
  solid(...rects: Rect[]): this {
    for (const r of rects) this.solids.push({ rect: r, ch: '#' });
    return this;
  }

  /** Trem parado (sólido, mais baixo que a parede). */
  train(r: Rect): this {
    this.solids.push({ rect: r, ch: 'T' });
    return this;
  }

  /** Rio de lava (Templo): não se anda nem se atravessa; brilha e ilumina (as pontes são chão). */
  lava(...rects: Rect[]): this {
    for (const r of rects) this.solids.push({ rect: r, ch: 'V' });
    return this;
  }

  /** Recorte feito depois dos sólidos (interior do vagão aberto). */
  carve(r: Rect, floor: Floor): this {
    this.carves.push({ rect: r, floor });
    return this;
  }

  /** Repinta o piso de um trecho que já é chão. */
  floor(r: Rect, floor: Floor): this {
    this.floors.push({ rect: r, floor });
    return this;
  }

  door(id: string, r: Rect, cost: number, a: string, b: string, kind: DoorKind = 'buy'): this {
    this.doors.push({ id, rect: r, cost, areas: [a, b], ...(kind !== 'buy' ? { kind } : {}) });
    return this;
  }

  window(id: string, r: Rect, area: string): this {
    this.windows.push({ id, rect: r, area });
    return this;
  }

  // ── Conteúdo (tx/ty em tiles; o centro do tile é +0,5) ──

  playerStart(area: string, tx: number, ty: number): this {
    this.start = { area, x: tx + 0.5, z: ty + 0.5 };
    return this;
  }

  /** Pistola inicial do mapa (id de godot/data/weapons); vazio = a padrão do jogador (M1911). */
  startWeapon(id: string): this {
    this.startWeaponId = id;
    return this;
  }

  spawn(id: string, tx: number, ty: number, area: string, minRound = 1): this {
    this.spawns.push({ id, x: tx + 0.5, z: ty + 0.5, area, min_round: minRound });
    return this;
  }

  /** Compra na parede: vai para o chão livre mais perto, encostada numa parede. */
  weapon(weaponId: string, tx: number, ty: number): this {
    this.stations.push({ type: 'weapon', weaponId, tx, ty, x: tx + 0.5, z: ty + 0.5 });
    return this;
  }

  ammo(tx: number, ty: number): this {
    this.stations.push({ type: 'ammo', tx, ty, x: tx + 0.5, z: ty + 0.5 });
    return this;
  }

  mysteryBox(tx: number, ty: number, area: string): this {
    this.machines.push({ type: 'mystery_box', tx, ty, x: tx + 0.5, z: ty + 0.5 });
    return this.boxSpot(tx, ty, area);
  }

  boxSpot(tx: number, ty: number, area: string): this {
    this.boxSpots.push({ x: tx + 0.5, z: ty + 0.5, area });
    return this;
  }

  weaponLab(tx: number, ty: number): this {
    this.machines.push({ type: 'weapon_lab', tx, ty, x: tx + 0.5, z: ty + 0.5 });
    return this;
  }

  perk(perkId: string, tx: number, ty: number): this {
    this.machines.push({ type: 'perk', perkId, tx, ty, x: tx + 0.5, z: ty + 0.5 });
    return this;
  }

  boss(...points: Array<[number, number]>): this {
    for (const [tx, ty] of points) this.bossSpawns.push({ x: tx + 0.5, z: ty + 0.5 });
    return this;
  }

  /** Luminária no teto. Raio em metros. Quebrada = não acende (só decoração e escuro). */
  lamp(tx: number, ty: number, o: LampOptions = {}): this {
    this.lamps.push({
      x: tx + 0.5, z: ty + 0.5, radius: o.radius ?? 6.5, intensity: o.intensity ?? 0.6,
      flicker: o.flicker ?? (o.torch ? 0.35 : 0.1), color: o.color ?? (o.torch ? 0xff9a48 : 0xffd6a0), broken: o.broken ?? false,
      torch: o.torch ?? false,
    });
    return this;
  }

  /** Fileira de luminárias de (x0,y) a (x1,y), a cada `step` tiles. */
  lampRow(x0: number, x1: number, ty: number, step: number, o: LampOptions = {}): this {
    for (let x = x0; x <= x1; x += step) this.lamp(x, ty, o);
    return this;
  }

  breaker(tx: number, ty: number): this { return this.interaction({ type: 'breaker', tx, ty }); }
  powerPanel(tx: number, ty: number): this { return this.interaction({ type: 'power', tx, ty }); }
  alarmPanel(tx: number, ty: number): this { return this.interaction({ type: 'alarm', tx, ty }); }
  trainPanel(tx: number, ty: number): this { return this.interaction({ type: 'train', tx, ty }); }
  trap(tx: number, ty: number, zone: Rect): this { return this.interaction({ type: 'trap', tx, ty, zone }); }

  private interaction(item: Record<string, unknown>): this {
    this.interactions.push(item);
    return this;
  }

  /** Objeto do kit (PropFactory). Ângulo em graus; em 90/270 o corpo de colisão gira junto. */
  prop(type: AnyProp, tx: number, ty: number, angle = 0): this {
    const def = (PROP_DEFS as Record<string, Omit<PropDef, 'texture'>>)[type] ?? GODOT_PROP_DEFS[type];
    if (!def) throw new Error(`${this.id}: prop desconhecido ${type}`);
    const turned = Math.abs(Math.round(angle / 90)) % 2 === 1 && angle % 90 === 0;
    const body = def.body
      ? {
          w: r3((turned ? def.body.h : def.body.w) / PX), d: r3((turned ? def.body.w : def.body.h) / PX),
          ox: r3((turned ? def.body.oy : def.body.ox) / PX), oz: r3((turned ? def.body.ox : def.body.oy) / PX),
        }
      : null;
    this.propList.push({
      type, x: tx + 0.5, z: ty + 0.5, angle, body, blocks_bullets: def.blocksBullets,
      light: def.light ? { radius: r3(def.light.radius / PX), intensity: def.light.intensity, color: def.light.color } : null,
    });
    return this;
  }

  /** Vários do mesmo tipo: [tx, ty, ângulo?]. */
  props(type: AnyProp, spots: Array<[number, number, number?]>): this {
    for (const [tx, ty, angle] of spots) this.prop(type, tx, ty, angle ?? 0);
    return this;
  }

  station(data: Record<string, unknown>): this {
    this.stationData = data;
    return this;
  }

  secrets(data: Record<string, unknown>): this {
    this.secretsData = data;
    return this;
  }

  /** Dados extras do mapa (Templo: colunas que o Minotauro derruba, altares e fragmentos). */
  extra(key: string, value: unknown): this {
    this.extras[key] = value;
    return this;
  }

  /** Posições da missão do mapa (o SerumQuest lê daqui; tempos e regras ficam no quests.tres). */
  quest(data: Record<string, unknown>): this {
    this.questData = data;
    return this;
  }

  // ── Saída ──

  private getArea(id: string): Area {
    const area = this.areas.find((a) => a.id === id);
    if (!area) throw new Error(`${this.id}: área ${id} não declarada`);
    return area;
  }

  grid(): string[][] {
    const g = Array.from({ length: this.height }, () => Array<string>(this.width).fill('#'));
    const set = (r: Rect, ch: string): void => {
      for (let y = r.y; y < r.y + r.h; y++) {
        for (let x = r.x; x < r.x + r.w; x++) {
          if (x <= 0 || y <= 0 || x >= this.width - 1 || y >= this.height - 1) throw new Error(`${this.id}: ${JSON.stringify(r)} encosta na borda do mapa`);
          g[y][x] = ch;
        }
      }
    };
    for (const r of this.rooms) set(r.rect, FLOOR_CHARS[r.floor]);
    for (const p of this.pockets) set(p.rect, FLOOR_CHARS[p.floor]);
    for (const s of this.solids) set(s.rect, s.ch);
    for (const c of this.carves) set(c.rect, FLOOR_CHARS[c.floor]);
    for (const d of this.doors) set(d.rect, 'D');
    for (const w of this.windows) set(w.rect, 'W');
    const floorChars = Object.values(FLOOR_CHARS);
    for (const f of this.floors) {
      for (let y = f.rect.y; y < f.rect.y + f.rect.h; y++) {
        for (let x = f.rect.x; x < f.rect.x + f.rect.w; x++) if (floorChars.includes(g[y]?.[x])) g[y][x] = FLOOR_CHARS[f.floor];
      }
    }
    return g;
  }

  build(): Record<string, unknown> {
    const g = this.grid();
    this.settle(g);
    this.validate(g);
    return {
      id: this.id,
      width: this.width,
      height: this.height,
      legend: { wall: '#', train: 'T', lava: 'V', door: 'D', window: 'W', floors: FLOOR_CHARS },
      cells: g.map((row) => row.join('')),
      start_area: this.start.area,
      player_start: { x: this.start.x, z: this.start.z },
      start_weapon: this.startWeaponId,
      outside_darkness: this.options.outsideDarkness,
      areas: this.areas.map((a) => ({ id: a.id, name: a.name, darkness: a.darkness, lighting: a.lighting, rects: a.rects })),
      doors: this.doors,
      windows: this.windows,
      spawns: this.spawns,
      stations: this.stations,
      machines: this.machines,
      box_spots: this.boxSpots,
      boss_spawns: this.bossSpawns,
      lamps: this.lamps,
      interactions: this.interactions,
      station: this.stationData,
      secrets: this.secretsData,
      quest: this.questData,
      decor: { seed: this.options.decorSeed, density: Object.fromEntries(this.areas.map((a) => [a.id, a.decor])) },
      props: this.propList,
      ...this.extras,
    };
  }

  // ── Conferência do desenho ──

  private validate(g: string[][]): void {
    const errors: string[] = [];
    const at = (x: number, z: number): string => g[Math.floor(z)]?.[Math.floor(x)] ?? '#';
    const walkable = (ch: string): boolean => ch !== '#' && ch !== 'T' && ch !== 'W' && ch !== 'V';
    const inArea = (id: string, x: number, z: number): boolean =>
      this.getArea(id).rects.some((r) => x >= r.x && x < r.x + r.w && z >= r.y && z < r.y + r.h);
    const need = (what: string, x: number, z: number): void => {
      if (!walkable(at(x, z)) || at(x, z) === 'D') errors.push(`${what} fora do chão em (${x}, ${z}): '${at(x, z)}'`);
    };

    need('início', this.start.x, this.start.z);
    if (!inArea(this.start.area, this.start.x, this.start.z)) errors.push('início fora da área inicial');
    for (const s of this.spawns) need(`spawn ${s.id}`, s.x, s.z);
    for (const s of this.stations) need(`compra ${String(s.weaponId ?? 'munição')}`, Number(s.x), Number(s.z));
    for (const m of this.machines) need(`máquina ${String(m.perkId ?? m.type)}`, Number(m.x), Number(m.z));
    for (const b of this.boxSpots) {
      need('lugar da caixa', b.x, b.z);
      if (!inArea(b.area, b.x, b.z)) errors.push(`lugar da caixa (${b.x}, ${b.z}) fora de ${b.area}`);
    }
    for (const b of this.bossSpawns) need('boss', b.x, b.z);
    for (const i of this.interactions) need(`painel ${String(i.type)}`, Number(i.tx) + 0.5, Number(i.ty) + 0.5);
    for (const p of this.propList) {
      if (!walkable(at(Number(p.x), Number(p.z)))) errors.push(`prop ${String(p.type)} dentro da parede em (${String(p.x)}, ${String(p.z)})`);
    }

    // Portas: de um lado uma área, do outro a outra.
    for (const d of this.doors) {
      const r = d.rect;
      // Atravessa em y (parede horizontal) ou em x (parede vertical): vale o eixo que liga as duas.
      const crossings: Array<Array<[number, number]>> = [
        [[r.x + r.w / 2, r.y - 0.5], [r.x + r.w / 2, r.y + r.h + 0.5]],
        [[r.x - 0.5, r.y + r.h / 2], [r.x + r.w + 0.5, r.y + r.h / 2]],
      ];
      const touched = crossings.map((sides) => sides.map(([x, z]) => this.areas.find((a) => inArea(a.id, x, z))?.id ?? '?'));
      if (!touched.some((t) => t.includes(d.areas[0]) && t.includes(d.areas[1]))) errors.push(`porta ${d.id} liga ${touched.map((t) => t.join('/')).join(' | ')} em vez de ${d.areas.join('/')}`);
    }
    // Janelas: a área de um lado, o bolsão do outro.
    for (const w of this.windows) {
      const r = w.rect;
      const sides: Array<[number, number]> = r.h >= r.w
        ? [[r.x - 0.5, r.y + r.h / 2], [r.x + r.w + 0.5, r.y + r.h / 2]]
        : [[r.x + r.w / 2, r.y - 0.5], [r.x + r.w / 2, r.y + r.h + 0.5]];
      const inside = sides.some(([x, z]) => inArea(w.area, x, z));
      const outside = sides.some(([x, z]) => walkable(at(x, z)) && !this.areas.some((a) => inArea(a.id, x, z)));
      if (!inside || !outside) errors.push(`janela ${w.id} não liga ${w.area} a um bolsão`);
    }
    // Spawns: dentro da área ou no bolsão ligado a ela por janela.
    for (const s of this.spawns) {
      const inside = inArea(s.area, s.x, s.z);
      const inPocket = this.pockets.some((p) => s.x >= p.rect.x && s.x < p.rect.x + p.rect.w && s.z >= p.rect.y && s.z < p.rect.y + p.rect.h);
      if (!inside && !inPocket) errors.push(`spawn ${s.id} fora de ${s.area} e dos bolsões`);
    }

    // Alcance: do início, abrindo todas as portas, chega-se a toda área.
    const seen = new Set<string>();
    const queue: Array<[number, number]> = [[Math.floor(this.start.x), Math.floor(this.start.z)]];
    while (queue.length) {
      const [x, y] = queue.pop()!;
      const key = `${x},${y}`;
      if (seen.has(key) || !walkable(g[y]?.[x] ?? '#')) continue;
      seen.add(key);
      queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    for (const a of this.areas) {
      const r = a.rects[0];
      if (!r) { errors.push(`área ${a.id} sem salas`); continue; }
      let reached = false;
      for (let y = r.y; y < r.y + r.h && !reached; y++) for (let x = r.x; x < r.x + r.w && !reached; x++) reached = seen.has(`${x},${y}`);
      if (!reached) errors.push(`área ${a.id} inalcançável`);
    }
    for (const p of this.pockets) {
      if (seen.has(`${p.rect.x},${p.rect.y}`)) errors.push(`bolsão ${JSON.stringify(p.rect)} alcançável sem janela`);
    }

    this.checkGaps(g, errors);

    if (errors.length) throw new Error(`${this.id}: desenho com problemas:\n  ${errors.join('\n  ')}`);
  }

  // ── Frestas (onde o jogador ou os zumbis ficam presos) ──

  /** Corpos sólidos do mapa: props com corpo, colunas da praça, altares, estátuas e pedestal. */
  private bodies(): Array<{ name: string; x0: number; z0: number; x1: number; z1: number }> {
    const out: Array<{ name: string; x0: number; z0: number; x1: number; z1: number }> = [];
    const add = (name: string, cx: number, cz: number, w: number, d: number): void => {
      out.push({ name, x0: cx - w / 2, z0: cz - d / 2, x1: cx + w / 2, z1: cz + d / 2 });
    };
    for (const p of this.propList) {
      const b = p.body as { w: number; d: number; ox: number; oz: number } | null;
      if (b) add(`prop ${String(p.type)} (${Number(p.x) - 0.5}, ${Number(p.z) - 0.5})`, Number(p.x) + b.ox, Number(p.z) + b.oz, b.w, b.d);
    }
    const tiles = (key: string, w: number, d: number): void => {
      for (const t of (this.extras[key] as Array<{ tx: number; ty: number }> | undefined) ?? []) add(`${key} (${t.tx}, ${t.ty})`, t.tx + 0.5, t.ty + 0.5, w, d);
    };
    tiles('pillars', 0.9, 0.9);
    tiles('altars', 1.3, 0.9);
    const statues = (this.secretsData?.statues as Array<{ god: string; tx: number; ty: number }> | undefined) ?? [];
    for (const st of statues) add(`estátua ${st.god} (${st.tx}, ${st.ty})`, st.tx + 0.5, st.ty + 0.5, 1.0, 1.0);
    const bow = (this.extras.sanctuary as { bow?: { tx: number; ty: number } } | undefined)?.bow;
    if (bow) add(`pedestal (${bow.tx}, ${bow.ty})`, bow.tx + 0.5, bow.ty + 0.5, 0.9, 0.9);
    return out;
  }

  /**
   * Regra das frestas: todo corpo fica encostado (≤ 0,1 m) ou a pelo menos 1,4 m da parede, da
   * lava e dos outros corpos — uma fresta entre 0,1 e 1,4 m deixa o jogador entrar mas não tem
   * navmesh (os zumbis não entram e o jogador fica preso). Spawns, início, pontos de boss e da
   * Mystery Box ficam livres dos corpos.
   */
  private checkGaps(g: string[][], errors: string[]): void {
    const MIN = 0.1, MAX = 1.4;
    const blocked = (x: number, z: number): boolean => {
      const ch = g[Math.floor(z)]?.[Math.floor(x)] ?? '#';
      return ch === '#' || ch === 'T' || ch === 'V' || ch === 'W';
    };
    const bodies = this.bodies();
    const bad = (gap: number): boolean => gap > MIN + 1e-6 && gap < MAX - 1e-6;
    for (const b of bodies) {
      // Até a parede/lava em cada lado (amostras ao longo da face).
      const sides: Array<[string, (t: number) => [number, number], number, number]> = [
        ['oeste', (t) => [b.x0 - t, 0], b.z0, b.z1], ['leste', (t) => [b.x1 + t, 0], b.z0, b.z1],
        ['norte', (t) => [0, b.z0 - t], b.x0, b.x1], ['sul', (t) => [0, b.z1 + t], b.x0, b.x1],
      ];
      for (const [side, at, a0, a1] of sides) {
        let worst = -1;
        for (const k of [0.15, 0.5, 0.85]) {
          const along = a0 + (a1 - a0) * k;
          let gap = 99;
          for (let t = 0.02; t <= MAX + 0.1; t += 0.05) {
            const [px, pz] = at(t);
            const x = side === 'oeste' || side === 'leste' ? px : along;
            const z = side === 'oeste' || side === 'leste' ? along : pz;
            if (blocked(x, z)) { gap = t - 0.02; break; }
          }
          if (gap < 99) worst = Math.max(worst, gap);
        }
        if (worst >= 0 && bad(worst)) errors.push(`fresta de ${worst.toFixed(2)} m entre ${b.name} e a parede (${side})`);
      }
    }
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i], c = bodies[j];
        const gx = Math.max(c.x0 - a.x1, a.x0 - c.x1), gz = Math.max(c.z0 - a.z1, a.z0 - c.z1);
        const overlapX = gx < 0, overlapZ = gz < 0;
        let gap = -1;
        if (overlapX && !overlapZ) gap = gz;
        else if (overlapZ && !overlapX) gap = gx;
        else if (!overlapX && !overlapZ) gap = Math.hypot(gx, gz);
        if (gap >= 0 && bad(gap)) errors.push(`fresta de ${gap.toFixed(2)} m entre ${a.name} e ${c.name}`);
      }
    }
    const clearOf = (what: string, x: number, z: number, need: number): void => {
      for (const b of bodies) {
        const dx = Math.max(b.x0 - x, 0, x - b.x1), dz = Math.max(b.z0 - z, 0, z - b.z1);
        if (Math.hypot(dx, dz) < need) errors.push(`${what} em (${x}, ${z}) a ${Math.hypot(dx, dz).toFixed(2)} m de ${b.name}`);
      }
    };
    // Corredor de 1 tile (parede, trem ou lava dos dois lados): o jogador entra, os zumbis não.
    const solid = (x: number, z: number): boolean => {
      const ch = g[z]?.[x] ?? '#';
      return ch === '#' || ch === 'T' || ch === 'V';
    };
    for (let z = 1; z < this.height - 1; z++) {
      for (let x = 1; x < this.width - 1; x++) {
        const ch = g[z][x];
        if (ch === '#' || ch === 'T' || ch === 'V' || ch === 'W' || ch === 'D') continue;
        const pocket = !this.areas.some((a) => a.rects.some((r) => x >= r.x && x < r.x + r.w && z >= r.y && z < r.y + r.h));
        if (pocket) continue;
        if ((solid(x - 1, z) && solid(x + 1, z)) || (solid(x, z - 1) && solid(x, z + 1))) errors.push(`corredor de 1 tile em (${x}, ${z})`);
      }
    }
    // Máquinas e painéis na parede: encostados num canto (ou a mais de 2 tiles dele); um tile
    // livre entre eles e a parede do lado vira fresta.
    const onWall: Array<[string, number, number]> = [
      ...this.machines.map((m) => [`máquina ${String(m.perkId ?? m.type)}`, Number(m.tx), Number(m.ty)] as [string, number, number]),
      ...this.interactions.map((i) => [`painel ${String(i.type)}`, Number(i.tx), Number(i.ty)] as [string, number, number]),
    ];
    for (const [what, tx, ty] of this.machines.map((m) => [`máquina ${String(m.perkId ?? m.type)}`, Number(m.tx), Number(m.ty)] as [string, number, number])) {
      const x = Math.floor(tx), z = Math.floor(ty);
      if (String(what) !== 'máquina mystery_box' && ![[0, -1], [0, 1], [-1, 0], [1, 0]].some(([dx, dz]) => solid(x + dx, z + dz))) errors.push(`${what} em (${tx}, ${ty}) não está colada numa parede`);
    }
    for (const [what, tx, ty] of onWall) {
      // O jogo encosta a máquina na parede mais próxima: simula esse encaixe (até 2 tiles).
      let x = Math.floor(tx), z = Math.floor(ty);
      if (![[0, -1], [0, 1], [-1, 0], [1, 0]].some(([dx, dz]) => solid(x + dx, z + dz))) {
        let best: [number, number] | null = null;
        for (const [dx, dz] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as Array<[number, number]>) {
          for (let k = 1; k <= 3; k++) if (solid(x + dx * (k + 1), z + dz * (k + 1)) && (!best || k < Math.abs(best[0] - x) + Math.abs(best[1] - z))) { best = [x + dx * k, z + dz * k]; break; }
        }
        if (best) [x, z] = best;
      }
      const wallNS = solid(x, z - 1) || solid(x, z + 1);
      const along: Array<[number, number]> = wallNS ? [[-1, 0], [1, 0]] : [[0, -1], [0, 1]];
      for (const [dx, dz] of along) {
        if (!solid(x + dx, z + dz) && solid(x + 2 * dx, z + 2 * dz)) errors.push(`${what} em (${tx}, ${ty}) deixa fresta de 1 tile até a parede`);
      }
    }
    clearOf('início', this.start.x, this.start.z, 1.0);
    for (const sp of this.spawns) clearOf(`spawn ${sp.id}`, sp.x, sp.z, 1.0);
    for (const bp of this.bossSpawns) clearOf('boss', bp.x, bp.z, 1.4);
    for (const bx of this.boxSpots) {
      clearOf('lugar da caixa', bx.x, bx.z, 1.8);
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
        if (g[Math.floor(bx.z) + dz]?.[Math.floor(bx.x) + dx] === 'V') { errors.push(`lugar da caixa em (${bx.x}, ${bx.z}) colado na lava`); dz = 3; break; }
      }
    }
  }

  /**
   * Acomoda o desenho antes de conferir (evita frestas onde se fica preso):
   * - objeto a menos de 1,4 m de uma parede/lava encosta nela;
   * - objeto a menos de 1,4 m de outro encosta nele;
   * - spawn, início, ponto de boss e da caixa colados num objeto vão para o tile livre mais
   *   perto (mesma área ou bolsão).
   */
  private settle(g: string[][]): void {
    const MIN = 0.1, MAX = 1.4;
    const blocked = (x: number, z: number): boolean => {
      const ch = g[Math.floor(z)]?.[Math.floor(x)] ?? '#';
      return ch === '#' || ch === 'T' || ch === 'V' || ch === 'W';
    };
    type Movable = { x0: number; z0: number; x1: number; z1: number; move: (dx: number, dz: number) => void };
    const movables = (): Movable[] => {
      const out: Movable[] = [];
      for (const p of this.propList) {
        const b = p.body as { w: number; d: number; ox: number; oz: number } | null;
        if (!b) continue;
        const cx = Number(p.x) + b.ox, cz = Number(p.z) + b.oz;
        out.push({ x0: cx - b.w / 2, z0: cz - b.d / 2, x1: cx + b.w / 2, z1: cz + b.d / 2, move: (dx, dz) => { p.x = r3(Number(p.x) + dx); p.z = r3(Number(p.z) + dz); } });
      }
      const tiles = (list: Array<{ tx: number; ty: number }> | undefined, w: number, d: number): void => {
        for (const t of list ?? []) {
          const cx = t.tx + 0.5, cz = t.ty + 0.5;
          out.push({ x0: cx - w / 2, z0: cz - d / 2, x1: cx + w / 2, z1: cz + d / 2, move: (dx, dz) => { t.tx = r3(t.tx + dx); t.ty = r3(t.ty + dz); } });
        }
      };
      tiles(this.extras.pillars as Array<{ tx: number; ty: number }> | undefined, 0.9, 0.9);
      tiles(this.extras.altars as Array<{ tx: number; ty: number }> | undefined, 1.3, 0.9);
      tiles(this.secretsData?.statues as Array<{ tx: number; ty: number }> | undefined, 1.0, 1.0);
      const bow = (this.extras.sanctuary as { bow?: { tx: number; ty: number } } | undefined)?.bow;
      if (bow) tiles([bow], 0.9, 0.9);
      return out;
    };
    const wallGap = (b: Movable, side: 0 | 1 | 2 | 3): number => {
      let worst = -1;
      for (const k of [0.15, 0.5, 0.85]) {
        let gap = 99;
        for (let t = 0.02; t <= MAX + 0.1; t += 0.05) {
          const x = side === 0 ? b.x0 - t : side === 1 ? b.x1 + t : b.x0 + (b.x1 - b.x0) * k;
          const z = side === 2 ? b.z0 - t : side === 3 ? b.z1 + t : b.z0 + (b.z1 - b.z0) * k;
          if (blocked(x, z)) { gap = t - 0.02; break; }
        }
        if (gap < 99) worst = Math.max(worst, gap);
      }
      return worst;
    };
    for (let pass = 0; pass < 3; pass++) {
      // Paredes: encosta no lado da fresta (o menor, se houver dois).
      for (const b of movables()) {
        const gaps = ([0, 1, 2, 3] as const).map((side) => wallGap(b, side));
        let best = -1;
        for (let side = 0; side < 4; side++) if (gaps[side] > MIN && gaps[side] < MAX && (best < 0 || gaps[side] < gaps[best])) best = side;
        if (best < 0) continue;
        const d = gaps[best];
        b.move(best === 0 ? -d : best === 1 ? d : 0, best === 2 ? -d : best === 3 ? d : 0);
      }
      // Entre objetos: o segundo encosta no primeiro.
      const list = movables();
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
        const a = list[i], c = list[j];
        const gx = Math.max(c.x0 - a.x1, a.x0 - c.x1), gz = Math.max(c.z0 - a.z1, a.z0 - c.z1);
        if (gx < 0 && gz > MIN && gz < MAX) c.move(0, c.z0 > a.z1 ? -gz : gz);
        else if (gz < 0 && gx > MIN && gx < MAX) c.move(c.x0 > a.x1 ? -gx : gx, 0);
        else if (gx >= 0 && gz >= 0 && Math.hypot(gx, gz) > MIN && Math.hypot(gx, gz) < MAX) {
          // Na diagonal: afasta o segundo até 1,4 m no eixo de menor esforço.
          if (gx >= gz) c.move(c.x0 > a.x1 ? MAX - gx + 0.05 : -(MAX - gx + 0.05), 0);
          else c.move(0, c.z0 > a.z1 ? MAX - gz + 0.05 : -(MAX - gz + 0.05));
        }
      }
    }
    // Pontos colados em objetos: vão para o tile livre mais perto.
    const bodies = movables();
    const clear = (x: number, z: number, need: number): boolean => {
      if (blocked(x, z) || (g[Math.floor(z)]?.[Math.floor(x)] ?? '#') === 'D') return false;
      return bodies.every((b) => Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.z0 - z, 0, z - b.z1)) >= need);
    };
    const region = (x: number, z: number): string =>
      this.areas.find((a) => a.rects.some((r) => x >= r.x && x < r.x + r.w && z >= r.y && z < r.y + r.h))?.id ?? 'pocket';
    const open8 = (x: number, z: number): boolean => {
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (blocked(x + dx, z + dz)) return false;
      return true;
    };
    const relocate = (pt: { x: number; z: number }, need: number): void => {
      if (clear(pt.x, pt.z, need)) return;
      const home0 = region(pt.x, pt.z);
      for (let rad = 1; rad <= 6; rad++) {
        for (let dz = -rad; dz <= rad; dz++) for (let dx = -rad; dx <= rad; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== rad) continue;
          const x = pt.x + dx, z = pt.z + dz;
          if (region(x, z) === home0 && open8(x, z) && clear(x, z, need)) { pt.x = x; pt.z = z; return; }
        }
      }
      const home = region(pt.x, pt.z);
      for (let rad = 1; rad <= 6; rad++) {
        for (let dz = -rad; dz <= rad; dz++) for (let dx = -rad; dx <= rad; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== rad) continue;
          const x = pt.x + dx, z = pt.z + dz;
          if (region(x, z) === home && clear(x, z, need)) { pt.x = x; pt.z = z; return; }
        }
      }
    };
    relocate(this.start, 1.0);
    for (const sp of this.spawns) relocate(sp, 1.0);
    for (const bp of this.bossSpawns) relocate(bp, 1.4);
    for (const bx of this.boxSpots) relocate(bx, 1.8);
  }
}
