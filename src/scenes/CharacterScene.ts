import Phaser from 'phaser';
import { uiView } from '../ui/uiScale';
import { COLORS, SCENE_KEYS } from '../config/game.config';
import { achievementById } from '../config/achievements.config';
import { SKINS, skinUrl, type SkinDef } from '../config/skins.config';
import { save } from '../save/SaveStore';
import { MENU_FONT, menuButton, menuTitle, onResize } from '../ui/menuWidgets';

const CARD_W = 170;
const CARD_H = 210;
/** Tamanho de um frame do torso (px do SVG). */
const FRAME = 128;
const previewKey = (id: string): string => `skin_preview_${id}`;

export const isSkinUnlocked = (skin: SkinDef): boolean => skin.unlock === null || save.hasAchievement(skin.unlock);

/**
 * Escolha do visual do personagem. Os visuais trancados mostram a conquista que os libera.
 * Trocar de visual recarrega a página (o jogo só baixa a arte do visual escolhido).
 */
export class CharacterScene extends Phaser.Scene {
  private cards: Phaser.GameObjects.Container[] = [];
  private message!: Phaser.GameObjects.Text;

  constructor() {
    super(SCENE_KEYS.character);
  }

  preload(): void {
    // Prévia: o torso com a pistola de cada visual (só nesta tela).
    for (const s of SKINS) {
      if (!this.textures.exists(previewKey(s.id))) this.load.svg(previewKey(s.id), skinUrl('assets/player/player_torso_pistol.svg', s.id));
    }
  }

  create(): void {
    this.input.setDefaultCursor('default');
    const title = menuTitle(this, 'PERSONAGEM', 48);
    this.message = this.add.text(0, 0, '', { fontFamily: MENU_FONT, fontSize: '14px', color: COLORS.textDim, align: 'center' }).setOrigin(0.5);
    const back = menuButton(this, '[ VOLTAR ]', () => this.scene.start(SCENE_KEYS.menu), 22);
    this.input.keyboard?.once('keydown-ESC', () => this.scene.start(SCENE_KEYS.menu));
    for (const s of SKINS) {
      const tex = this.textures.get(previewKey(s.id));
      if (!tex.has('f0')) tex.add('f0', 0, 0, 0, FRAME, FRAME);
    }
    onResize(this, () => {
      const { width, height } = uiView(this);
      title.setPosition(width / 2, 50);
      back.setPosition(width / 2, height - 36);
      this.message.setWordWrapWidth(width - 32).setPosition(width / 2, height - 80);
      this.build(width, height);
    });
  }

  private build(width: number, height: number): void {
    this.cards.forEach((c) => c.destroy());
    const cols = width >= 4 * (CARD_W + 12) ? 4 : 2;
    const rows = Math.ceil(SKINS.length / cols);
    const scale = Math.min(1, (width - 24) / (cols * (CARD_W + 12)), (height - 200) / (rows * (CARD_H + 12)));
    const cw = (CARD_W + 12) * scale;
    const ch = (CARD_H + 12) * scale;
    const x0 = width / 2 - (cols * cw) / 2 + cw / 2;
    const y0 = 100 + ch / 2;
    this.cards = SKINS.map((s, i) => this.card(s, x0 + (i % cols) * cw, y0 + Math.floor(i / cols) * ch, scale));
  }

  private card(skin: SkinDef, x: number, y: number, scale: number): Phaser.GameObjects.Container {
    const unlocked = isSkinUnlocked(skin);
    const selected = save.setting('skin') === skin.id;
    const c = this.add.container(x, y).setScale(scale);
    const bg = this.add.rectangle(0, 0, CARD_W, CARD_H, 0x15171a, 0.95).setStrokeStyle(selected ? 3 : 1.5, selected ? 0xe3c77a : unlocked ? 0x55584f : 0x2e302e);
    c.add(bg);
    const img = this.add.image(0, -30, previewKey(skin.id), 'f0').setRotation(-Math.PI / 2).setScale(1.1);
    if (!unlocked) img.setTintFill(0x2a2c2e);
    c.add(img);
    c.add(this.add.text(0, 50, skin.name.toUpperCase(), { fontFamily: 'Impact, "Arial Black", sans-serif', fontSize: '18px', color: unlocked ? '#e8e2c8' : '#6a6c6a' }).setOrigin(0.5));
    const req = skin.unlock ? achievementById(skin.unlock) : null;
    const status = selected ? 'EM USO' : unlocked ? 'TOQUE PARA USAR' : `CONQUISTA: ${req?.name.toUpperCase() ?? ''}`;
    c.add(
      this.add.text(0, 76, status, { fontFamily: MENU_FONT, fontSize: '11px', color: selected ? '#e3c77a' : COLORS.textDim, align: 'center', wordWrap: { width: CARD_W - 16 } }).setOrigin(0.5, 0),
    );
    bg.setInteractive({ useHandCursor: unlocked && !selected }).on('pointerup', () => this.choose(skin));
    return c;
  }

  private choose(skin: SkinDef): void {
    if (!isSkinUnlocked(skin)) {
      const req = skin.unlock ? achievementById(skin.unlock) : null;
      this.message.setText(`Trancado — libere com a conquista "${req?.name ?? ''}": ${req?.description ?? ''}`).setColor('#e05a4a');
      return;
    }
    if (save.setting('skin') === skin.id) return;
    save.set('skin', skin.id);
    this.message.setText('Aplicando o novo visual...').setColor('#e3c77a');
    // A arte do personagem é carregada no início: recarrega para baixar o visual novo.
    this.time.delayedCall(350, () => window.location.reload());
  }
}
