import Phaser from 'phaser';
import { uiView } from '../ui/uiScale';
import { COLORS, SCENE_KEYS } from '../config/game.config';
import { MAP_IDS, MAPS, RANKING_SIZE, type MapId } from '../config/maps.config';
import { isOnlineConfigured } from '../config/online.config';
import { fetchTop, seasonDaysLeft, type GlobalEntry } from '../online/leaderboard';
import { save } from '../save/SaveStore';
import { MENU_FONT, menuButton, menuTitle, onResize } from '../ui/menuWidgets';

const ROW_H = 30;
const MEDALS = ['#e3c77a', '#c8c8c8', '#c68a4e'];

type Scope = 'local' | 'global';

/** Ranking por mapa: LOCAL (salvo no navegador) e GLOBAL (temporada de 15 dias, online). */
export class RankingScene extends Phaser.Scene {
  private mapId: MapId = 'terminal';
  private scope: Scope = 'local';
  private rows: Phaser.GameObjects.GameObject[] = [];
  private tabs: Array<{ id: MapId; text: Phaser.GameObjects.Text }> = [];
  private scopeTabs: Array<{ id: Scope; text: Phaser.GameObjects.Text }> = [];
  /** Cache do global por mapa (evita buscar de novo ao trocar de aba). */
  private globalCache = new Map<MapId, GlobalEntry[] | null>();
  private request = 0;

  constructor() {
    super(SCENE_KEYS.ranking);
  }

  create(data: { map?: MapId; scope?: Scope }): void {
    this.mapId = data.map ?? 'terminal';
    this.scope = data.scope ?? 'local';
    this.rows = [];
    this.globalCache = new Map();
    this.input.setDefaultCursor('default');
    const title = menuTitle(this, 'RANKING', 52);
    this.scopeTabs = (['local', 'global'] as const).map((id) => ({
      id,
      text: menuButton(this, id === 'local' ? 'LOCAL' : 'GLOBAL', () => this.show(this.mapId, id), 18),
    }));
    this.tabs = MAP_IDS.map((id) => ({
      id,
      text: menuButton(this, MAPS[id].name.toUpperCase(), () => this.show(id, this.scope), 18),
    }));
    const back = menuButton(this, '[ VOLTAR ]', () => this.scene.start(SCENE_KEYS.menu), 22);
    this.input.keyboard?.once('keydown-ESC', () => this.scene.start(SCENE_KEYS.menu));
    onResize(this, () => {
      const { width, height } = uiView(this);
      const narrow = width < 560;
      title.setPosition(width / 2, height * 0.08);
      this.scopeTabs.forEach((t, i) => t.text.setPosition(width / 2 + (i - 0.5) * 180, height * 0.08 + 50));
      this.tabs.forEach((t, i) => t.text.setPosition(width / 2 + (i - (this.tabs.length - 1) / 2) * (narrow ? 180 : 260), height * 0.08 + 88));
      back.setPosition(width / 2, height - 40);
      this.show(this.mapId, this.scope);
    });
  }

  private show(id: MapId, scope: Scope): void {
    this.mapId = id;
    this.scope = scope;
    this.request++;
    for (const t of this.tabs) t.text.setColor(t.id === id ? COLORS.accent : COLORS.textDim);
    for (const t of this.scopeTabs) t.text.setColor(t.id === scope ? COLORS.accent : COLORS.textDim);
    this.clearRows();
    if (scope === 'local') {
      this.drawList(save.ranking(id), save.isUnlocked(id) ? 'Nenhuma partida ainda — jogue para entrar no ranking!' : 'Mapa bloqueado');
      return;
    }
    if (!isOnlineConfigured()) {
      this.drawList([], 'Ranking global indisponível');
      return;
    }
    const cached = this.globalCache.get(id);
    if (cached !== undefined) {
      this.drawGlobal(cached);
      return;
    }
    this.drawList([], 'Carregando...');
    const req = this.request;
    void fetchTop(id).then((list) => {
      if (!this.scene.isActive() || req !== this.request) return;
      if (list) this.globalCache.set(id, list);
      this.clearRows();
      this.drawGlobal(list);
    });
  }

  private drawGlobal(list: GlobalEntry[] | null): void {
    if (!list) {
      this.drawList([], 'Ranking global indisponível (sem conexão)');
      return;
    }
    this.drawList(list, 'Ninguém pontuou nesta temporada ainda — seja o primeiro!');
    const { width, height } = uiView(this);
    const days = seasonDaysLeft();
    const mine = list.findIndex((e) => e.name.toUpperCase() === save.playerName.toUpperCase());
    const info = `TEMPORADA TERMINA EM ${days} ${days === 1 ? 'DIA' : 'DIAS'}${mine >= 0 ? ` · VOCÊ: ${mine + 1}º` : ''}`;
    this.rows.push(this.add.text(width / 2, height - 82, info, { fontFamily: MENU_FONT, fontSize: '14px', color: COLORS.textDim }).setOrigin(0.5));
  }

  private clearRows(): void {
    this.rows.forEach((r) => r.destroy());
    this.rows = [];
  }

  private drawList(list: ReadonlyArray<{ name: string; wave: number; score: number }>, emptyText: string): void {
    const { width, height } = uiView(this);
    const top = height * 0.08 + 124;
    const w = Math.min(640, width - 32);
    const x0 = width / 2 - w / 2;
    const style = (color: string) => ({ fontFamily: MENU_FONT, fontSize: w < 480 ? '13px' : '16px', color });
    this.rows.push(
      this.add.text(x0, top, '#', style(COLORS.textDim)),
      this.add.text(x0 + w * 0.08, top, 'NOME', style(COLORS.textDim)),
      this.add.text(x0 + w * 0.62, top, 'WAVE', style(COLORS.textDim)).setOrigin(1, 0),
      this.add.text(x0 + w, top, 'PONTOS', style(COLORS.textDim)).setOrigin(1, 0),
    );
    if (list.length === 0) {
      this.rows.push(this.add.text(width / 2, top + 60, emptyText, style(COLORS.textDim)).setOrigin(0.5, 0));
      return;
    }
    for (let i = 0; i < Math.min(list.length, RANKING_SIZE); i++) {
      const e = list[i];
      const y = top + 34 + i * ROW_H;
      const color = MEDALS[i] ?? COLORS.text;
      this.rows.push(
        this.add.text(x0, y, `${i + 1}`, style(color)),
        this.add.text(x0 + w * 0.08, y, e.name, style(color)),
        this.add.text(x0 + w * 0.62, y, `${e.wave}`, style(COLORS.text)).setOrigin(1, 0),
        this.add.text(x0 + w, y, e.score.toLocaleString('pt-BR'), style(color)).setOrigin(1, 0),
      );
    }
  }
}
