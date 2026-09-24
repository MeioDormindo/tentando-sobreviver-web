import Phaser from 'phaser';
import { uiConfig } from '../config/visual.config';

/**
 * HUD e menus em telas grandes: aplica zoom na câmera da cena (origem no canto) e devolve
 * o tamanho lógico da tela. Até `uiConfig.refHeight` de altura a escala é 1 (celular incluso).
 */
export function uiView(scene: Phaser.Scene): { width: number; height: number; scale: number } {
  const { width, height } = scene.scale;
  const scale = Phaser.Math.Clamp(height / uiConfig.refHeight, 1, uiConfig.maxScale);
  const cam = scene.cameras.main;
  cam.setOrigin(0, 0).setZoom(scale);
  return { width: width / scale, height: height / scale, scale };
}

/** Posição do ponteiro em coordenadas lógicas (divididas pela escala da interface). */
export function uiPointer(scene: Phaser.Scene, p: Phaser.Input.Pointer): { x: number; y: number } {
  const z = scene.cameras.main.zoom;
  return { x: p.x / z, y: p.y / z };
}
