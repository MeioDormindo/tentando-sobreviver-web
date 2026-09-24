import Phaser from 'phaser';
import { uiView } from '../ui/uiScale';
import { COLORS, SCENE_KEYS } from '../config/game.config';
import { MAP_IDS, MAPS, RANKING_SIZE, type MapId } from '../config/maps.config';
import { save } from '../save/SaveStore';
import { MENU_FONT, menuButton, menuTitle, onResize } from '../ui/menuWidgets';

const ROW_H = 30;
const MEDALS = ['#e3c77a', '#c8c8c8', '#c68a4e'];

/** Ranking de pontuação por mapa (salvo no navegador). */
export class RankingScene extends Phaser.Scene {
  private mapId: MapId = 'terminal';
  private rows: Phaser.GameObjects.GameObject[] = [];
  private tabs: Array<{ id: MapId; text: Phaser.GameObjects.Text }> = [];

  constructor() {
    super(SCENE_KEYS.ranking);
  }

  create(data: { map?: MapId }): void {
    this.mapId = data.map ?? 'terminal';
    this.rows = [];
    this.input.setDefaultCursor('default');
    const title = menuTitle(this, 'RANKING', 52);
    this.tabs = MAP_IDS.map((id) => ({
      id,
      text: menuButton(this, MAPS[id].name.toUpperCase(), () => this.show(id), 18),
    }));
    const back = menuButton(this, '[ VOLTAR ]', () => this.scene.start(SCENE_KEYS.menu), 22);
    this.input.keyboard?.once('keydown-ESC', () => this.scene.start(SCENE_KEYS.menu));
    onResize(this, () => {
      const { width, height } = uiView(this);
      title.setPosition(width / 2, height * 0.1);
      this.tabs.forEach((t, i) => t.text.setPosition(width / 2 + (i - (this.tabs.length - 1) / 2) * 260, height * 0.1 + 58));
      back.setPosition(width / 2, height - 40);
      this.show(this.mapId);
    });
  }

  private show(id: MapId): void {
    this.mapId = id;
    for (const t of this.tabs) t.text.setColor(t.id === id ? COLORS.accent : COLORS.textDim);
    this.rows.forEach((r) => r.destroy());
    this.rows = [];
    const { width, height } = uiView(this);
    const list = save.ranking(id);
    const top = height * 0.1 + 104;
    const w = Math.min(640, width - 32);
    const x0 = width / 2 - w / 2;
    const style = (color: string) => ({ fontFamily: MENU_FONT, fontSize: w < 480 ? '13px' : '16px', color });
    const header = [
      this.add.text(x0, top, '#', style(COLORS.textDim)),
      this.add.text(x0 + w * 0.08, top, 'NOME', style(COLORS.textDim)),
      this.add.text(x0 + w * 0.62, top, 'WAVE', style(COLORS.textDim)).setOrigin(1, 0),
      this.add.text(x0 + w, top, 'PONTOS', style(COLORS.textDim)).setOrigin(1, 0),
    ];
    this.rows.push(...header);
    if (list.length === 0) {
      this.rows.push(this.add.text(width / 2, top + 60, save.isUnlocked(id) ? 'Nenhuma partida ainda — jogue para entrar no ranking!' : 'Mapa bloqueado', style(COLORS.textDim)).setOrigin(0.5, 0));
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
