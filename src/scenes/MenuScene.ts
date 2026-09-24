import Phaser from 'phaser';
import { uiView } from '../ui/uiScale';
import { SCENE_KEYS } from '../config/game.config';
import { DEFAULT_MAP } from '../config/maps.config';
import { secretsConfig } from '../config/secrets.config';
import { audio } from '../audio/AudioSystem';
import { useTouchControls } from '../input/device';
import { save } from '../save/SaveStore';
import { currentUser } from '../online/auth';
import { MENU_FONT, menuButton, menuTitle, onResize } from '../ui/menuWidgets';

const KEYBOARD_HINT = 'WASD mover · Mouse mirar · Clique atirar · V ou botão direito: faca · R recarregar · E comprar · Q/1/2 trocar arma · M som · N música · ESC pausa';
const KONAMI_KEYS: Record<string, string> = { ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', b: 'B', B: 'B', a: 'A', A: 'A' };
/** No celular: tocar no título este número de vezes libera o mesmo segredo. */
const TITLE_TAPS = 10;
const TOUCH_HINT = 'Analógico esquerdo: mover · Analógico direito: girar a lanterna · ATIRAR: atira para onde a lanterna aponta · FACA: golpe corpo a corpo';

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
      menuButton(this, '[ ARMAS ]', () => this.scene.start(SCENE_KEYS.armory)),
      menuButton(this, currentUser() ? `[ CONTA: ${currentUser()?.toUpperCase()} ]` : '[ CONTA / SALVAR NA NUVEM ]', () => this.scene.start(SCENE_KEYS.account)),
      menuButton(this, '[ CONFIGURAÇÕES ]', () => this.scene.start(SCENE_KEYS.settings)),
    ];
    const hint = this.add
      .text(0, 0, useTouchControls(save.setting('touchMode')) ? TOUCH_HINT : KEYBOARD_HINT, { fontFamily: MENU_FONT, fontSize: '14px', color: '#7a7d78', align: 'center' })
      .setOrigin(0.5);

    onResize(this, () => {
      const { width, height } = uiView(this);
      // Em telas pequenas (celular) o título encolhe para caber.
      const s = Phaser.Math.Clamp(Math.min(width / 900, height / 620), 0.5, 1);
      title.setScale(s).setPosition(width / 2, height * 0.24);
      record.setScale(Math.max(0.8, s)).setPosition(width / 2, height * 0.24 + 106 * s);
      buttons.forEach((b, i) => b.setScale(Math.max(0.8, s)).setPosition(width / 2, height * 0.5 + i * 46 * Math.max(0.8, s)));
      hint.setWordWrapWidth(width - 32).setPosition(width / 2, height - 30);
    });

    this.listenForKonami(title);

    // Enter pula direto para o Terminal Central.
    this.input.keyboard?.once('keydown-ENTER', () => this.scene.start(SCENE_KEYS.game, { map: DEFAULT_MAP }));
  }

  /** Easter egg: código Konami (ou tocar muito no título) libera o "modo cabeção". */
  private listenForKonami(title: Phaser.GameObjects.Text): void {
    const code = secretsConfig.konami;
    let pos = 0;
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      const k = KONAMI_KEYS[e.key];
      pos = k === code[pos] ? pos + 1 : k === code[0] ? 1 : 0;
      if (pos === code.length) {
        pos = 0;
        this.unlockBigHeads(title);
      }
    });
    let taps = 0;
    title.setInteractive().on('pointerdown', () => {
      if (++taps === TITLE_TAPS) this.unlockBigHeads(title);
    });
  }

  private unlockBigHeads(title: Phaser.GameObjects.Text): void {
    const first = save.discover('konami');
    save.set('bigHeads', true);
    audio.play('secret_song', { category: 'ui', volume: 0.8, rate: 1.25, pitchJitter: 0 });
    this.cameras.main.flash(300, 120, 200, 90);
    const { width } = uiView(this);
    const msg = this.add
      .text(width / 2, title.y + title.displayHeight / 2 + 70, first ? 'MODO CABEÇÃO LIBERADO!\n(liga/desliga em Configurações)' : 'MODO CABEÇÃO LIGADO!', {
        fontFamily: MENU_FONT, fontSize: '20px', color: '#b8e04a', align: 'center', stroke: '#000', strokeThickness: 4,
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: msg, alpha: 0, delay: 2600, duration: 700, onComplete: () => msg.destroy() });
  }
}
