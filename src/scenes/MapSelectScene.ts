import Phaser from 'phaser';
import { COLORS, SCENE_KEYS } from '../config/game.config';
import { MAP_IDS, MAPS, type MapId } from '../config/maps.config';
import { isTouchDevice } from '../input/device';
import { save } from '../save/SaveStore';
import { MENU_FONT, MENU_TITLE_FONT, menuButton, menuTitle, onResize } from '../ui/menuWidgets';

const CARD_W = 340;
const CARD_H = 250;

/** Escolha de mapa: mostra recordes, e os mapas trancados com a condição para liberar. */
export class MapSelectScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.mapSelect);
  }

  create(): void {
    this.input.setDefaultCursor('default');
    const title = menuTitle(this, 'ESCOLHA O MAPA', 48);
    const cards = MAP_IDS.map((id) => this.createCard(id));
    const back = menuButton(this, '[ VOLTAR ]', () => this.scene.start(SCENE_KEYS.menu), 22);
    this.input.keyboard?.once('keydown-ESC', () => this.scene.start(SCENE_KEYS.menu));

    onResize(this, () => {
      const { width, height } = this.scale;
      // Lado a lado na horizontal; empilhados em telas estreitas (celular em pé).
      const wide = width >= CARD_W * 2 + 80;
      const scale = wide
        ? Math.min(1, (width - 32) / (CARD_W * cards.length + 40), (height - 170) / CARD_H)
        : Math.min(1, (width - 32) / CARD_W, (height * 0.62) / (CARD_H * 2 + 24));
      title.setScale(Math.min(1, height / 600)).setPosition(width / 2, Math.min(height * 0.14, 30 + 40 * Math.min(1, height / 600)));
      cards.forEach((c, i) => {
        c.setScale(scale);
        if (wide) c.setPosition(width / 2 + (i - (cards.length - 1) / 2) * (CARD_W + 40) * scale, height / 2 + 6);
        else c.setPosition(width / 2, height * 0.3 + CARD_H * scale * 0.5 + i * (CARD_H + 24) * scale);
      });
      back.setPosition(width / 2, height - 44);
    });
  }

  /** Começa a partida; no celular entra em tela cheia (precisa ser no toque do jogador). */
  private play(id: MapId): void {
    if (isTouchDevice() && !this.scale.isFullscreen) this.scale.startFullscreen();
    this.scene.start(SCENE_KEYS.game, { map: id });
  }

  private createCard(id: MapId): Phaser.GameObjects.Container {
    const info = MAPS[id];
    const unlocked = save.isUnlocked(id);
    const playable = unlocked && info.playable;
    const rec = save.records(id);
    const top = save.ranking(id)[0];

    const bg = this.add.rectangle(0, 0, CARD_W, CARD_H, 0x15171a, 0.95).setStrokeStyle(2, playable ? 0xc9a45c : 0x3a3d40);
    const name = this.add
      .text(0, -CARD_H / 2 + 34, unlocked ? info.name.toUpperCase() : `🔒 ${info.name.toUpperCase()}`, {
        fontFamily: MENU_TITLE_FONT, fontSize: '30px', color: unlocked ? COLORS.text : COLORS.textDim,
      })
      .setOrigin(0.5);
    const desc = this.add
      .text(0, -CARD_H / 2 + 88, info.description, {
        fontFamily: MENU_FONT, fontSize: '14px', color: COLORS.textDim, align: 'center', wordWrap: { width: CARD_W - 40 },
      })
      .setOrigin(0.5);

    let statusText: string;
    if (!unlocked && info.unlock) statusText = `Derrote o boss da wave ${info.unlock.bossWave}\nno ${MAPS[info.unlock.onMap].name} para liberar`;
    else if (!info.playable) statusText = 'LIBERADO!\nEm desenvolvimento — em breve';
    else statusText = `Recorde: ${rec.bestScore.toLocaleString('pt-BR')} pts · wave ${rec.bestWave}` + (top ? `\n1º no ranking: ${top.name}` : '');
    const status = this.add
      .text(0, 26, statusText, { fontFamily: MENU_FONT, fontSize: '14px', color: unlocked ? '#e3c77a' : COLORS.textDim, align: 'center', lineSpacing: 4 })
      .setOrigin(0.5);

    const play = menuButton(this, playable ? '[ JOGAR ]' : unlocked ? '[ EM BREVE ]' : '[ BLOQUEADO ]', playable ? () => this.play(id) : null, 24);
    play.setPosition(0, CARD_H / 2 - 36);
    const card = this.add.container(0, 0, [bg, name, desc, status, play]);
    if (playable) {
      bg.setInteractive({ useHandCursor: true }).on('pointerup', () => this.play(id));
    }
    return card;
  }
}
