import Phaser from 'phaser';
import { SCENE_KEYS } from '../config/game.config';
import { DEFAULT_MAP } from '../config/maps.config';
import { isTouchDevice } from '../input/device';
import { save } from '../save/SaveStore';
import { MENU_FONT, menuButton, menuTitle, onResize } from '../ui/menuWidgets';

const KEYBOARD_HINT = 'WASD mover · Mouse mirar · Clique atirar · R recarregar · E comprar · Q/1/2 trocar arma · M som · N música · ESC pausa';
const TOUCH_HINT = 'Analógico esquerdo: mover · Analógico direito: mirar e atirar · Botões: usar, recarregar, trocar arma';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.menu);
  }

  create(): void {
    this.input.setDefaultCursor('default');
    const title = menuTitle(this, 'TENTANDO\nSOBREVIVER', 72);
    const rec = save.records(DEFAULT_MAP);
    const record = this.add
      .text(0, 0, rec.bestScore > 0 ? `RECORDE: ${rec.bestScore.toLocaleString('pt-BR')} PONTOS · WAVE ${rec.bestWave}` : '', {
        fontFamily: MENU_FONT, fontSize: '16px', color: '#e3c77a',
      })
      .setOrigin(0.5);
    const buttons = [
      menuButton(this, '[ JOGAR ]', () => this.scene.start(SCENE_KEYS.mapSelect)),
      menuButton(this, '[ RANKING ]', () => this.scene.start(SCENE_KEYS.ranking)),
      menuButton(this, '[ ARMAS ]', null),
      menuButton(this, '[ CONFIGURAÇÕES ]', null),
    ];
    const hint = this.add
      .text(0, 0, isTouchDevice() ? TOUCH_HINT : KEYBOARD_HINT, { fontFamily: MENU_FONT, fontSize: '14px', color: '#7a7d78', align: 'center' })
      .setOrigin(0.5);

    onResize(this, () => {
      const { width, height } = this.scale;
      // Em telas pequenas (celular) o título encolhe para caber.
      const s = Phaser.Math.Clamp(Math.min(width / 900, height / 620), 0.5, 1);
      title.setScale(s).setPosition(width / 2, height * 0.24);
      record.setScale(Math.max(0.8, s)).setPosition(width / 2, height * 0.24 + 106 * s);
      buttons.forEach((b, i) => b.setScale(Math.max(0.8, s)).setPosition(width / 2, height * 0.5 + i * 46 * Math.max(0.8, s)));
      hint.setWordWrapWidth(width - 32).setPosition(width / 2, height - 30);
    });

    // Enter pula direto para o Terminal Central.
    this.input.keyboard?.once('keydown-ENTER', () => this.scene.start(SCENE_KEYS.game, { map: DEFAULT_MAP }));
  }
}
