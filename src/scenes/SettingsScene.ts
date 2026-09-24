import Phaser from 'phaser';
import { uiView } from '../ui/uiScale';
import { SCENE_KEYS } from '../config/game.config';
import { audio } from '../audio/AudioSystem';
import { save } from '../save/SaveStore';
import { MENU_FONT, menuButton, menuTitle, onResize } from '../ui/menuWidgets';
import { commonSettingsRows, drawSettingsRows, type SettingsRow } from '../ui/settingsRows';

/** Configurações (Menu → CONFIGURAÇÕES), salvas no navegador. */
export class SettingsScene extends Phaser.Scene {
  private objects: Phaser.GameObjects.GameObject[] = [];
  private confirmReset = false;

  constructor() {
    super(SCENE_KEYS.settings);
  }

  create(): void {
    this.input.setDefaultCursor('default');
    this.objects = [];
    this.confirmReset = false;
    const title = menuTitle(this, 'CONFIGURAÇÕES', 44);
    const back = menuButton(this, '[ VOLTAR ]', () => this.scene.start(SCENE_KEYS.menu), 22);
    this.input.keyboard?.once('keydown-ESC', () => this.scene.start(SCENE_KEYS.menu));
    onResize(this, () => {
      const { width, height } = uiView(this);
      title.setScale(Math.min(1, height / 600)).setPosition(width / 2, Math.min(52, height * 0.09));
      back.setPosition(width / 2, height - 30);
      this.redraw();
    });
  }

  private rows(): SettingsRow[] {
    return [
      ...commonSettingsRows(this, () => undefined),
      { label: 'TELA CHEIA', value: () => (this.scale.isFullscreen ? 'SIM' : 'NÃO'), change: () => this.scale.toggleFullscreen() },
      {
        label: 'APAGAR PROGRESSO',
        danger: true,
        value: () => (this.confirmReset ? 'TOQUE DE NOVO PARA APAGAR' : 'APAGAR'),
        change: () => {
          if (!this.confirmReset) {
            this.confirmReset = true;
            return;
          }
          this.confirmReset = false;
          save.reset();
          audio.setMuted(false, this.sound);
          this.sound.volume = 1;
        },
      },
    ];
  }

  private redraw(): void {
    this.objects.forEach((o) => o.destroy());
    this.objects = [];
    const { width, height } = uiView(this);
    const w = Math.min(560, width - 32);
    const x0 = width / 2 - w / 2;
    const top = Math.min(52, height * 0.09) + 44;
    const rows = this.rows();
    const rowH = Math.min(40, (height - top - 140) / rows.length);
    this.objects.push(...drawSettingsRows(this, rows, { x: x0, y: top, width: w, rowHeight: rowH }, () => this.redraw()));
    // Estatísticas acumuladas (save)
    const l = save.lifetime;
    const hours = Math.floor(l.playTimeMs / 3_600_000);
    const mins = Math.floor((l.playTimeMs % 3_600_000) / 60_000);
    const stats = `PARTIDAS ${l.gamesPlayed} · ABATES ${l.totalKills.toLocaleString('pt-BR')} · BOSSES ${l.bossesDefeated} · TEMPO ${hours}h${mins.toString().padStart(2, '0')}${save.secret('teddies') ? ' · 🧸 URSINHOS ✓' : ''}`;
    this.objects.push(this.add.text(width / 2, top + rows.length * rowH + 14, stats, { fontFamily: MENU_FONT, fontSize: '13px', color: '#e3c77a', align: 'center', wordWrap: { width: w } }).setOrigin(0.5, 0));
  }
}
