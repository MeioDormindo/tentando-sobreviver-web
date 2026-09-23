import Phaser from 'phaser';
import { gameConfig } from './config/game.config';

const game = new Phaser.Game(gameConfig);

// Acesso para depuração/testes automatizados apenas em desenvolvimento.
if (import.meta.env.DEV) {
  (window as unknown as { __GAME__: Phaser.Game }).__GAME__ = game;
}
