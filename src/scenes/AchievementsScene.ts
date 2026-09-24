import Phaser from 'phaser';
import { uiView } from '../ui/uiScale';
import { COLORS, SCENE_KEYS } from '../config/game.config';
import { ACHIEVEMENTS, type AchievementDef } from '../config/achievements.config';
import { MAP_IDS, MAPS } from '../config/maps.config';
import { save } from '../save/SaveStore';
import { MENU_FONT, menuButton, menuTitle, onResize } from '../ui/menuWidgets';

const CARD_W = 300;
const CARD_H = 66;
const GAP = 10;

/** Conquistas (liberadas em cores, trancadas em cinza, progresso das acumuladas) e estatísticas. */
export class AchievementsScene extends Phaser.Scene {
  private content!: Phaser.GameObjects.Container;
  private scrollY = 0;
  private maxScroll = 0;
  private top = 0;

  constructor() {
    super(SCENE_KEYS.achievements);
  }

  create(): void {
    this.scrollY = 0;
    this.input.setDefaultCursor('default');
    const title = menuTitle(this, 'CONQUISTAS', 48);
    const count = ACHIEVEMENTS.filter((a) => save.hasAchievement(a.id)).length;
    const summary = this.add
      .text(0, 0, `${count} / ${ACHIEVEMENTS.length} LIBERADAS`, { fontFamily: MENU_FONT, fontSize: '15px', color: '#e3c77a' })
      .setOrigin(0.5);
    const back = menuButton(this, '[ VOLTAR ]', () => this.scene.start(SCENE_KEYS.menu), 22);
    this.input.keyboard?.once('keydown-ESC', () => this.scene.start(SCENE_KEYS.menu));
    this.content = this.add.container(0, 0);
    const mask = this.add.graphics().setVisible(false);
    this.content.setMask(mask.createGeometryMask());

    // Rolagem: roda do mouse e arrastar (celular).
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => this.scrollTo(this.scrollY + dy * 0.6));
    let dragFrom: number | null = null;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { dragFrom = p.y; });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (dragFrom === null || !p.isDown) return;
      this.scrollTo(this.scrollY - (p.y - dragFrom) / this.cameras.main.zoom);
      dragFrom = p.y;
    });
    this.input.on('pointerup', () => { dragFrom = null; });

    onResize(this, () => {
      const { width, height } = uiView(this);
      title.setPosition(width / 2, 44);
      summary.setPosition(width / 2, 84);
      back.setPosition(width / 2, height - 34);
      this.top = 108;
      const viewH = height - this.top - 64;
      mask.clear().fillStyle(0xffffff).fillRect(0, this.top, width, viewH);
      this.build(width);
      this.maxScroll = Math.max(0, this.contentHeight - viewH);
      this.scrollTo(this.scrollY);
    });
  }

  private contentHeight = 0;

  private scrollTo(y: number): void {
    this.scrollY = Phaser.Math.Clamp(y, 0, this.maxScroll);
    this.content.setY(this.top - this.scrollY);
  }

  private build(width: number): void {
    this.content.removeAll(true);
    const cols = Math.max(1, Math.min(3, Math.floor((width - 32 + GAP) / (CARD_W + GAP))));
    const cardW = cols === 1 ? Math.min(CARD_W, width - 32) : CARD_W;
    const gridW = cols * cardW + (cols - 1) * GAP;
    const x0 = width / 2 - gridW / 2;
    ACHIEVEMENTS.forEach((def, i) => {
      const x = x0 + (i % cols) * (cardW + GAP);
      const y = Math.floor(i / cols) * (CARD_H + GAP);
      this.card(def, x, y, cardW);
    });
    const rows = Math.ceil(ACHIEVEMENTS.length / cols);
    let y = rows * (CARD_H + GAP) + 16;
    y = this.stats(width, y);
    this.contentHeight = y;
  }

  private card(def: AchievementDef, x: number, y: number, w: number): void {
    const unlocked = save.hasAchievement(def.id);
    const hidden = def.secret && !unlocked;
    this.content.add(this.add.rectangle(x, y, w, CARD_H, 0x15171a, 0.95).setOrigin(0).setStrokeStyle(1.5, unlocked ? 0xe3c77a : 0x3a3c3a));
    if (this.textures.exists(def.icon)) {
      const icon = this.add.image(x + 32, y + CARD_H / 2, def.icon);
      icon.setScale(Math.min(42 / icon.width, 42 / icon.height));
      if (!unlocked) icon.setTintFill(0x44464a).setAlpha(0.7);
      this.content.add(icon);
    }
    const tx = x + 62;
    this.content.add(
      this.add.text(tx, y + 8, hidden ? '???' : def.name.toUpperCase(), { fontFamily: 'Impact, "Arial Black", sans-serif', fontSize: '16px', color: unlocked ? '#e8e2c8' : '#7a7d78' }),
    );
    this.content.add(
      this.add.text(tx, y + 30, hidden ? 'Segredo — continue explorando' : def.description, {
        fontFamily: MENU_FONT, fontSize: '11px', color: unlocked ? '#b8b4a4' : '#65676a', wordWrap: { width: w - 70 },
      }),
    );
    if (def.total && !unlocked) {
      const have = Math.min(save.total(def.total.key), def.total.target);
      const barW = w - 72;
      this.content.add(this.add.rectangle(tx, y + CARD_H - 10, barW, 4, 0x2a2c2e).setOrigin(0));
      this.content.add(this.add.rectangle(tx, y + CARD_H - 10, barW * (have / def.total.target), 4, 0xc9a45c).setOrigin(0));
      this.content.add(
        this.add.text(x + w - 8, y + 8, `${have.toLocaleString('pt-BR')}/${def.total.target.toLocaleString('pt-BR')}`, { fontFamily: MENU_FONT, fontSize: '11px', color: '#9a9c94' }).setOrigin(1, 0),
      );
    }
    const date = save.achievementDate(def.id);
    if (date) {
      this.content.add(
        this.add.text(x + w - 8, y + 8, new Date(date).toLocaleDateString('pt-BR'), { fontFamily: MENU_FONT, fontSize: '10px', color: '#8a8c84' }).setOrigin(1, 0),
      );
    }
  }

  /** Estatísticas por mapa e totais da carreira. */
  private stats(width: number, y: number): number {
    const style = { fontFamily: MENU_FONT, fontSize: '13px', color: COLORS.text, align: 'center' as const };
    this.content.add(this.add.text(width / 2, y, 'ESTATÍSTICAS', { fontFamily: 'Impact, "Arial Black", sans-serif', fontSize: '22px', color: '#e8e2c8' }).setOrigin(0.5, 0));
    y += 34;
    for (const id of MAP_IDS) {
      const r = save.records(id);
      const line = `${MAPS[id].name.toUpperCase()} — melhor wave ${r.bestWave} · recorde ${r.bestScore.toLocaleString('pt-BR')} pts · ${r.bestKills} abates`;
      this.content.add(this.add.text(width / 2, y, line, { ...style, wordWrap: { width: width - 32 } }).setOrigin(0.5, 0));
      y += 24;
    }
    const l = save.lifetime;
    const hours = Math.floor(l.playTimeMs / 3_600_000);
    const mins = Math.floor((l.playTimeMs % 3_600_000) / 60_000);
    const career = `Partidas ${l.gamesPlayed} · Abates ${l.totalKills.toLocaleString('pt-BR')} · Faca ${l.knifeKills} · Headshots ${l.headshots} · Bosses ${l.bossesDefeated} · Tempo ${hours}h${mins.toString().padStart(2, '0')}`;
    this.content.add(this.add.text(width / 2, y + 6, career, { ...style, color: COLORS.textDim, wordWrap: { width: width - 32 } }).setOrigin(0.5, 0));
    return y + 60;
  }
}
