import Phaser from 'phaser';
import { gameConfig } from './config/game.config';

const game = new Phaser.Game(gameConfig);

// Acesso para depuração/testes automatizados: em desenvolvimento ou em builds de
// teste (VITE_TEST_HOOKS=1). O build publicado não expõe o jogo.
if (import.meta.env.DEV || import.meta.env.VITE_TEST_HOOKS === '1') {
  (window as unknown as { __GAME__: Phaser.Game }).__GAME__ = game;
}
