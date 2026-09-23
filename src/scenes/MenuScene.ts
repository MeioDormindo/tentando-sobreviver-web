import Phaser from 'phaser';
import { COLORS, SCENE_KEYS } from '../config/game.config';

interface MenuItem {
  label: string;
  enabled: boolean;
  action?: () => void;
}

export class MenuScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.menu);
  }

  create(): void {
    this.input.setDefaultCursor('default');
    const startGame = (): void => {
      this.scene.start(SCENE_KEYS.game);
    };

    const items: MenuItem[] = [
      { label: '[ JOGAR ]', enabled: true, action: startGame },
      { label: '[ ARMAS ]', enabled: false },
      { label: '[ CONFIGURAÇÕES ]', enabled: false },
      { label: '[ CRÉDITOS ]', enabled: false },
    ];

    const title = this.add
      .text(0, 0, 'TENTANDO\nSOBREVIVER', {
        fontFamily: 'Impact, "Arial Black", sans-serif',
        fontSize: '72px',
        color: COLORS.text,
        align: 'center',
      })
      .setOrigin(0.5);

    const buttons = items.map((item) => {
      const text = this.add
        .text(0, 0, item.label, {
          fontFamily: 'monospace',
          fontSize: '26px',
          color: item.enabled ? COLORS.text : COLORS.textDim,
        })
        .setOrigin(0.5);

      if (item.enabled && item.action) {
        const action = item.action;
        text
          .setInteractive({ useHandCursor: true })
          .on('pointerover', () => text.setColor(COLORS.accent))
          .on('pointerout', () => text.setColor(COLORS.text))
          .on('pointerdown', action);
      }
      return text;
    });

    const hint = this.add
      .text(0, 0, 'WASD mover · Mouse mirar · Clique atirar · R recarregar · E comprar · Q/1/2 trocar arma · M som', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: COLORS.textDim,
      })
      .setOrigin(0.5);

    const layout = (): void => {
      const { width, height } = this.scale;
      title.setPosition(width / 2, height * 0.28);
      buttons.forEach((b, i) => b.setPosition(width / 2, height * 0.52 + i * 44));
      hint.setPosition(width / 2, height - 32);
    };
    layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, layout);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, layout);
    });

    this.input.keyboard?.once('keydown-ENTER', startGame);
  }
}
