import Phaser from 'phaser';
import { SCENE_KEYS } from '../config/game.config';

/** Configurações globais mínimas antes de carregar qualquer coisa. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.boot);
  }

  create(): void {
    this.input.mouse?.disableContextMenu();
    this.scene.start(SCENE_KEYS.preload);
  }
}
