import Phaser from 'phaser';
import { COLORS, SCENE_KEYS } from '../config/game.config';
import { audio } from '../audio/AudioSystem';
import { save, type TouchMode } from '../save/SaveStore';
import { MENU_FONT, menuButton, menuTitle, onResize } from '../ui/menuWidgets';

const TOUCH_LABELS: Record<TouchMode, string> = { auto: 'AUTOMÁTICO', on: 'SEMPRE', off: 'NUNCA' };
const TOUCH_ORDER: TouchMode[] = ['auto', 'on', 'off'];
const VOLUME_STEP = 0.1;

interface Row {
  label: string;
  value: () => string;
  /** Ação ao tocar no valor (ou nos botões − / + do volume). */
  change?: (dir: 1 | -1) => void;
  stepper?: boolean;
}

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
      const { width, height } = this.scale;
      title.setScale(Math.min(1, height / 600)).setPosition(width / 2, Math.min(52, height * 0.09));
      back.setPosition(width / 2, height - 30);
      this.redraw();
    });
  }

  private rows(): Row[] {
    const toggle = (key: 'minimap' | 'screenShake' | 'bigHeads') => () => save.set(key, !save.setting(key));
    return [
      {
        label: 'VOLUME GERAL',
        value: () => `${Math.round(save.setting('volume') * 100)}%`,
        stepper: true,
        change: (dir) => {
          const v = Phaser.Math.Clamp(Math.round((save.setting('volume') + dir * VOLUME_STEP) * 10) / 10, 0, 1);
          save.set('volume', v);
          this.sound.volume = v;
          audio.play('ui_beep', { category: 'ui' });
        },
      },
      { label: 'SOM', value: () => (save.muted ? 'DESLIGADO' : 'LIGADO'), change: () => audio.setMuted(!save.muted, this.sound) },
      { label: 'MÚSICA', value: () => (save.musicOn ? 'LIGADA' : 'DESLIGADA'), change: () => (save.musicOn = !save.musicOn) },
      { label: 'MINIMAPA', value: () => (save.setting('minimap') ? 'SIM' : 'NÃO'), change: toggle('minimap') },
      { label: 'TREMOR DE TELA', value: () => (save.setting('screenShake') ? 'SIM' : 'NÃO'), change: toggle('screenShake') },
      {
        label: 'CONTROLES DE TOQUE',
        value: () => TOUCH_LABELS[save.setting('touchMode')],
        change: () => save.set('touchMode', TOUCH_ORDER[(TOUCH_ORDER.indexOf(save.setting('touchMode')) + 1) % TOUCH_ORDER.length]),
      },
      ...(save.secret('konami') ? [{ label: 'MODO CABEÇÃO', value: () => (save.setting('bigHeads') ? 'SIM' : 'NÃO'), change: toggle('bigHeads') }] : []),
      { label: 'TELA CHEIA', value: () => (this.scale.isFullscreen ? 'SIM' : 'NÃO'), change: () => this.scale.toggleFullscreen() },
      {
        label: 'APAGAR PROGRESSO',
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
    const { width, height } = this.scale;
    const w = Math.min(560, width - 32);
    const x0 = width / 2 - w / 2;
    const top = Math.min(52, height * 0.09) + 44;
    const rows = this.rows();
    const rowH = Math.min(40, (height - top - 140) / rows.length);
    const size = rowH < 32 ? 14 : 17;
    rows.forEach((row, i) => {
      const y = top + i * rowH;
      this.objects.push(this.add.text(x0, y, row.label, { fontFamily: MENU_FONT, fontSize: `${size}px`, color: COLORS.textDim }));
      const refresh = (dir: 1 | -1) => {
        row.change?.(dir);
        this.redraw();
      };
      if (row.stepper) {
        this.objects.push(
          menuButton(this, '−', () => refresh(-1), size + 4).setPosition(x0 + w - 150, y + size / 2 + 2),
          this.add.text(x0 + w - 85, y, row.value(), { fontFamily: MENU_FONT, fontSize: `${size}px`, color: COLORS.text }).setOrigin(0.5, 0),
          menuButton(this, '+', () => refresh(1), size + 4).setPosition(x0 + w - 20, y + size / 2 + 2),
        );
      } else {
        const danger = row.label === 'APAGAR PROGRESSO';
        const btn = menuButton(this, `[ ${row.value()} ]`, () => refresh(1), size);
        btn.setOrigin(1, 0.5).setPosition(x0 + w, y + size / 2 + 2);
        if (danger) btn.setColor('#c05050');
        this.objects.push(btn);
      }
    });
    // Estatísticas acumuladas (save)
    const l = save.lifetime;
    const hours = Math.floor(l.playTimeMs / 3_600_000);
    const mins = Math.floor((l.playTimeMs % 3_600_000) / 60_000);
    const stats = `PARTIDAS ${l.gamesPlayed} · ABATES ${l.totalKills.toLocaleString('pt-BR')} · BOSSES ${l.bossesDefeated} · TEMPO ${hours}h${mins.toString().padStart(2, '0')}${save.secret('teddies') ? ' · 🧸 URSINHOS ✓' : ''}`;
    this.objects.push(this.add.text(width / 2, top + rows.length * rowH + 14, stats, { fontFamily: MENU_FONT, fontSize: '13px', color: '#e3c77a', align: 'center', wordWrap: { width: w } }).setOrigin(0.5, 0));
  }
}
