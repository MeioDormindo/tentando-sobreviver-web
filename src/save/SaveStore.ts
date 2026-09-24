import { DEFAULT_MAP, MAP_IDS, MAPS, PLAYER_NAME_MAX, RANKING_SIZE, type MapId } from '../config/maps.config';

/** Save local (GDD §65): configurações, recordes, desbloqueios, ranking e totais. */

const SAVE_KEY = 'ts-save-v1';
const SAVE_VERSION = 1;

export interface MapRecords {
  bestWave: number;
  bestKills: number;
  bestScore: number;
}

export interface RankEntry {
  name: string;
  score: number;
  wave: number;
  kills: number;
  /** Data (ISO) da partida. */
  date: string;
}

export interface LifetimeStats {
  gamesPlayed: number;
  totalKills: number;
  bossesDefeated: number;
  playTimeMs: number;
}

/** Tamanho do minimapa no canto da HUD. */
export type MinimapSize = 'small' | 'medium' | 'large';

/** Controles de toque: automático (detecta o aparelho), sempre ou nunca. */
export type TouchMode = 'auto' | 'on' | 'off';

export interface Settings {
  muted: boolean;
  musicOn: boolean;
  playerName: string;
  /** Volume geral (0 a 1). */
  volume: number;
  minimap: boolean;
  minimapSize: MinimapSize;
  touchMode: TouchMode;
  /** Tremor de câmera (explosões, dano). */
  screenShake: boolean;
  /** Easter egg: zumbis cabeçudos (liberado pelo código Konami). */
  bigHeads: boolean;
}

/** Segredos descobertos (easter eggs). */
export interface Secrets {
  teddies: boolean;
  konami: boolean;
}

interface SaveData {
  version: number;
  settings: Settings;
  records: Record<MapId, MapRecords>;
  unlockedMaps: MapId[];
  ranking: Record<MapId, RankEntry[]>;
  lifetime: LifetimeStats;
  secrets: Secrets;
}

const emptyRecords = (): MapRecords => ({ bestWave: 0, bestKills: 0, bestScore: 0 });

function defaults(): SaveData {
  return {
    version: SAVE_VERSION,
    settings: { muted: false, musicOn: true, playerName: 'SOBREVIVENTE', volume: 1, minimap: true, minimapSize: 'medium', touchMode: 'auto', screenShake: true, bigHeads: false },
    records: Object.fromEntries(MAP_IDS.map((id) => [id, emptyRecords()])) as Record<MapId, MapRecords>,
    unlockedMaps: MAP_IDS.filter((id) => MAPS[id].unlock === null),
    ranking: Object.fromEntries(MAP_IDS.map((id) => [id, []])) as unknown as Record<MapId, RankEntry[]>,
    lifetime: { gamesPlayed: 0, totalKills: 0, bossesDefeated: 0, playTimeMs: 0 },
    secrets: { teddies: false, konami: false },
  };
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const isMapId = (v: unknown): v is MapId => typeof v === 'string' && (MAP_IDS as string[]).includes(v);

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

/** Lê o save validando campo a campo (dados corrompidos viram o padrão). */
function sanitize(raw: unknown): SaveData {
  const d = defaults();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Partial<Record<keyof SaveData, unknown>>;
  const s = (r.settings ?? {}) as Partial<SaveData['settings']>;
  d.settings.muted = s.muted === true;
  d.settings.musicOn = s.musicOn !== false;
  if (typeof s.playerName === 'string' && s.playerName.trim()) d.settings.playerName = s.playerName.slice(0, PLAYER_NAME_MAX);
  if (typeof s.volume === 'number' && Number.isFinite(s.volume)) d.settings.volume = Math.min(1, Math.max(0, s.volume));
  d.settings.minimap = s.minimap !== false;
  if (s.minimapSize === 'small' || s.minimapSize === 'large') d.settings.minimapSize = s.minimapSize;
  d.settings.screenShake = s.screenShake !== false;
  d.settings.bigHeads = s.bigHeads === true;
  if (s.touchMode === 'on' || s.touchMode === 'off') d.settings.touchMode = s.touchMode;
  const recs = (r.records ?? {}) as Partial<Record<MapId, Partial<MapRecords>>>;
  for (const id of MAP_IDS) {
    const m = recs[id] ?? {};
    d.records[id] = { bestWave: num(m.bestWave), bestKills: num(m.bestKills), bestScore: num(m.bestScore) };
  }
  if (Array.isArray(r.unlockedMaps)) {
    for (const id of r.unlockedMaps) if (isMapId(id) && !d.unlockedMaps.includes(id)) d.unlockedMaps.push(id);
  }
  const rank = (r.ranking ?? {}) as Partial<Record<MapId, unknown>>;
  for (const id of MAP_IDS) {
    const list = Array.isArray(rank[id]) ? (rank[id] as Array<Partial<RankEntry>>) : [];
    d.ranking[id] = list
      .filter((e) => e && typeof e.name === 'string')
      .map((e) => ({ name: String(e.name).slice(0, PLAYER_NAME_MAX), score: num(e.score), wave: num(e.wave), kills: num(e.kills), date: String(e.date ?? '') }))
      .sort((a, b) => b.score - a.score)
      .slice(0, RANKING_SIZE);
  }
  const l = (r.lifetime ?? {}) as Partial<LifetimeStats>;
  d.lifetime = { gamesPlayed: num(l.gamesPlayed), totalKills: num(l.totalKills), bossesDefeated: num(l.bossesDefeated), playTimeMs: num(l.playTimeMs) };
  const sec = (r.secrets ?? {}) as Partial<Secrets>;
  d.secrets = { teddies: sec.teddies === true, konami: sec.konami === true };
  return d;
}

/** Converte as chaves avulsas das versões anteriores (som, música, recordes). */
function migrateLegacy(d: SaveData): SaveData {
  try {
    if (localStorage.getItem('ts-muted') === '1') d.settings.muted = true;
    if (localStorage.getItem('ts-music-off') === '1') d.settings.musicOn = false;
  } catch {
    /* sem armazenamento */
  }
  const old = readJson('ts-records') as Partial<MapRecords> | null;
  if (old) d.records[DEFAULT_MAP] = { bestWave: num(old.bestWave), bestKills: num(old.bestKills), bestScore: num(old.bestScore) };
  return d;
}

/**
 * Save do jogador no navegador. Tudo passa por aqui; cada alteração grava na hora.
 * Se o armazenamento estiver indisponível (modo privado, bloqueado), vale só na sessão.
 */
class SaveStore {
  private data: SaveData;

  constructor() {
    const raw = readJson(SAVE_KEY);
    this.data = raw ? sanitize(raw) : migrateLegacy(defaults());
    this.persist();
  }

  // ── Configurações ──
  get muted(): boolean {
    return this.data.settings.muted;
  }
  set muted(v: boolean) {
    this.data.settings.muted = v;
    this.persist();
  }
  get musicOn(): boolean {
    return this.data.settings.musicOn;
  }
  set musicOn(v: boolean) {
    this.data.settings.musicOn = v;
    this.persist();
  }
  get playerName(): string {
    return this.data.settings.playerName;
  }

  /** Configuração pelo nome (tela de Configurações). */
  setting<K extends keyof Settings>(key: K): Settings[K] {
    return this.data.settings[key];
  }

  set<K extends keyof Settings>(key: K, value: Settings[K]): void {
    this.data.settings[key] = value;
    this.persist();
  }

  /** Apaga todo o progresso (recordes, ranking, mapas liberados e configurações). */
  reset(): void {
    this.data = defaults();
    this.persist();
  }

  // ── Mapas ──
  isUnlocked(map: MapId): boolean {
    return this.data.unlockedMaps.includes(map);
  }

  /** Libera um mapa; retorna true se era novidade. */
  unlock(map: MapId): boolean {
    if (this.isUnlocked(map)) return false;
    this.data.unlockedMaps.push(map);
    this.persist();
    return true;
  }

  // ── Recordes e totais ──
  records(map: MapId): Readonly<MapRecords> {
    return this.data.records[map];
  }

  get lifetime(): Readonly<LifetimeStats> {
    return this.data.lifetime;
  }

  /** Fim de partida: atualiza recordes e totais; retorna os recordes anteriores. */
  finishRun(map: MapId, run: { wave: number; kills: number; score: number; bosses: number; timeMs: number }): MapRecords {
    const prev = { ...this.data.records[map] };
    this.data.records[map] = {
      bestWave: Math.max(prev.bestWave, run.wave),
      bestKills: Math.max(prev.bestKills, run.kills),
      bestScore: Math.max(prev.bestScore, run.score),
    };
    const l = this.data.lifetime;
    l.gamesPlayed++;
    l.totalKills += run.kills;
    l.bossesDefeated += run.bosses;
    l.playTimeMs += run.timeMs;
    this.persist();
    return prev;
  }

  // ── Segredos ──
  secret(key: keyof Secrets): boolean {
    return this.data.secrets[key];
  }

  /** Marca um segredo como descoberto; retorna true se era novidade. */
  discover(key: keyof Secrets): boolean {
    if (this.data.secrets[key]) return false;
    this.data.secrets[key] = true;
    this.persist();
    return true;
  }

  // ── Ranking ──
  ranking(map: MapId): readonly RankEntry[] {
    return this.data.ranking[map];
  }

  /** A pontuação entra no top do mapa? */
  qualifies(map: MapId, score: number): boolean {
    const list = this.data.ranking[map];
    return score > 0 && (list.length < RANKING_SIZE || score > list[list.length - 1].score);
  }

  /** Grava no ranking e devolve a posição (1 = primeiro), ou 0 se não entrou. */
  addRanking(map: MapId, entry: Omit<RankEntry, 'date' | 'name'> & { name: string }): number {
    if (!this.qualifies(map, entry.score)) return 0;
    const name = entry.name.trim().slice(0, PLAYER_NAME_MAX).toUpperCase() || 'SOBREVIVENTE';
    this.data.settings.playerName = name;
    const row: RankEntry = { ...entry, name, date: new Date().toISOString() };
    const list = [...this.data.ranking[map], row].sort((a, b) => b.score - a.score).slice(0, RANKING_SIZE);
    this.data.ranking[map] = list;
    this.persist();
    return list.indexOf(row) + 1;
  }

  private persist(): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch {
      /* armazenamento indisponível: vale só nesta sessão */
    }
  }
}

/** Save único do jogo. */
export const save = new SaveStore();
