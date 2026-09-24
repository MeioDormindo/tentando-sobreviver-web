import Phaser from 'phaser';
import { COLORS } from '../config/game.config';
import { audio } from '../audio/AudioSystem';
import { save, type MinimapSize, type TouchMode } from '../save/SaveStore';
import { MENU_FONT, menuButton } from './menuWidgets';

const TOUCH_LABELS: Record<TouchMode, string> = { auto: 'AUTOMÁTICO', on: 'SEMPRE', off: 'NUNCA' };
const TOUCH_ORDER: TouchMode[] = ['auto', 'on', 'off'];
const MINIMAP_LABELS: Record<MinimapSize, string> = { small: 'PEQUENO', medium: 'MÉDIO', large: 'GRANDE' };
const MINIMAP_ORDER: MinimapSize[] = ['small', 'medium', 'large'];
const VOLUME_STEP = 0.1;

export interface SettingsRow {
  label: string;
  value: () => string;
  /** Ação ao tocar no valor (ou nos botões − / + do volume). */
  change?: (dir: 1 | -1) => void;
  stepper?: boolean;
  danger?: boolean;
}

const next = <T>(order: readonly T[], current: T): T => order[(order.indexOf(current) + 1) % order.length];

/**
 * Configurações que valem no menu e no jogo (tela CONFIGURAÇÕES e menu de pausa).
 * `onChange` avisa quem precisa aplicar na hora (HUD, câmera).
 */
export function commonSettingsRows(scene: Phaser.Scene, onChange: () => void): SettingsRow[] {
  const toggle = (key: 'minimap' | 'screenShake' | 'bigHeads') => () => {
    save.set(key, !save.setting(key));
    onChange();
  };
  return [
    {
      label: 'VOLUME GERAL',
      value: () => `${Math.round(save.setting('volume') * 100)}%`,
      stepper: true,
      change: (dir) => {
        const v = Phaser.Math.Clamp(Math.round((save.setting('volume') + dir * VOLUME_STEP) * 10) / 10, 0, 1);
        save.set('volume', v);
        scene.sound.volume = v;
        audio.play('ui_beep', { category: 'ui' });
      },
    },
    { label: 'SOM', value: () => (save.muted ? 'DESLIGADO' : 'LIGADO'), change: () => audio.setMuted(!save.muted, scene.sound) },
    { label: 'MÚSICA', value: () => (save.musicOn ? 'LIGADA' : 'DESLIGADA'), change: () => { save.musicOn = !save.musicOn; onChange(); } },
    { label: 'MINIMAPA', value: () => (save.setting('minimap') ? 'SIM' : 'NÃO'), change: toggle('minimap') },
    {
      label: 'TAMANHO DO MINIMAPA',
      value: () => MINIMAP_LABELS[save.setting('minimapSize')],
      change: () => {
        save.set('minimapSize', next(MINIMAP_ORDER, save.setting('minimapSize')));
        onChange();
      },
    },
    { label: 'TREMOR DE TELA', value: () => (save.setting('screenShake') ? 'SIM' : 'NÃO'), change: toggle('screenShake') },
    {
      label: 'CONTROLES DE TOQUE',
      value: () => TOUCH_LABELS[save.setting('touchMode')],
      change: () => save.set('touchMode', next(TOUCH_ORDER, save.setting('touchMode'))),
    },
    ...(save.secret('konami') ? [{ label: 'MODO CABEÇÃO', value: () => (save.setting('bigHeads') ? 'SIM' : 'NÃO'), change: toggle('bigHeads') }] : []),
  ];
}

/**
 * Desenha as linhas (rótulo à esquerda, valor ou − valor + à direita) e devolve os objetos
 * criados. Tocar num valor chama `change` e `refresh` (que redesenha).
 */
export function drawSettingsRows(
  scene: Phaser.Scene,
  rows: SettingsRow[],
  box: { x: number; y: number; width: number; rowHeight: number },
  refresh: () => void,
): Phaser.GameObjects.GameObject[] {
  const objects: Phaser.GameObjects.GameObject[] = [];
  const { x: x0, width: w, rowHeight } = box;
  const size = rowHeight < 32 ? 14 : 17;
  rows.forEach((row, i) => {
    const y = box.y + i * rowHeight;
    objects.push(scene.add.text(x0, y, row.label, { fontFamily: MENU_FONT, fontSize: `${size}px`, color: COLORS.textDim }));
    const apply = (dir: 1 | -1) => {
      row.change?.(dir);
      refresh();
    };
    if (row.stepper) {
      objects.push(
        menuButton(scene, '−', () => apply(-1), size + 4).setPosition(x0 + w - 150, y + size / 2 + 2),
        scene.add.text(x0 + w - 85, y, row.value(), { fontFamily: MENU_FONT, fontSize: `${size}px`, color: COLORS.text }).setOrigin(0.5, 0),
        menuButton(scene, '+', () => apply(1), size + 4).setPosition(x0 + w - 20, y + size / 2 + 2),
      );
    } else {
      const btn = menuButton(scene, `[ ${row.value()} ]`, () => apply(1), size);
      btn.setOrigin(1, 0.5).setPosition(x0 + w, y + size / 2 + 2);
      if (row.danger) btn.setColor('#c05050');
      objects.push(btn);
    }
  });
  return objects;
}
