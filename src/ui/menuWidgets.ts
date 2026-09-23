import Phaser from 'phaser';
import { COLORS } from '../config/game.config';

export const MENU_TITLE_FONT = 'Impact, "Arial Black", sans-serif';
export const MENU_FONT = 'monospace';

/** Botão de texto do menu (mouse e toque). Desabilitado = cinza e sem clique. */
export function menuButton(
  scene: Phaser.Scene,
  label: string,
  onClick: (() => void) | null,
  size = 26,
): Phaser.GameObjects.Text {
  const enabled = onClick !== null;
  const text = scene.add
    .text(0, 0, label, { fontFamily: MENU_FONT, fontSize: `${size}px`, color: enabled ? COLORS.text : COLORS.textDim, padding: { x: 10, y: 6 } })
    .setOrigin(0.5);
  if (onClick) {
    text
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => text.setColor(COLORS.accent))
      .on('pointerout', () => text.setColor(COLORS.text))
      .on('pointerup', onClick);
  }
  return text;
}

/** Título de tela do menu. */
export function menuTitle(scene: Phaser.Scene, label: string, size = 56): Phaser.GameObjects.Text {
  return scene.add.text(0, 0, label, { fontFamily: MENU_TITLE_FONT, fontSize: `${size}px`, color: COLORS.text, align: 'center' }).setOrigin(0.5);
}

/** Reposiciona a tela ao redimensionar (e remove o listener ao sair). */
export function onResize(scene: Phaser.Scene, layout: () => void): void {
  layout();
  scene.scale.on(Phaser.Scale.Events.RESIZE, layout);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.scale.off(Phaser.Scale.Events.RESIZE, layout));
}
