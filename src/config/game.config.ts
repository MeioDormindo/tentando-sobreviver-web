import Phaser from 'phaser';
import { BootScene } from '../scenes/BootScene';
import { PreloadScene } from '../scenes/PreloadScene';
import { MenuScene } from '../scenes/MenuScene';
import { MapSelectScene } from '../scenes/MapSelectScene';
import { RankingScene } from '../scenes/RankingScene';
import { GameScene } from '../scenes/GameScene';
import { UIScene } from '../scenes/UIScene';

export const TILE_SIZE = 32;

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

export const COLORS = {
  background: 0x0a0b0a,
  hpBar: 0xb33a3a,
  hpBarBg: 0x2b1b1b,
  text: '#d8d8d0',
  textDim: '#7a7d78',
  accent: '#c9a45c',
} as const;

export const SCENE_KEYS = {
  boot: 'BootScene',
  preload: 'PreloadScene',
  menu: 'MenuScene',
  mapSelect: 'MapSelectScene',
  ranking: 'RankingScene',
  game: 'GameScene',
  ui: 'UIScene',
} as const;

export const TEXTURE_KEYS = {
  /** Tileset invisível de colisão. */
  tiles: 'collision_tiles',
} as const;

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  // Elementos HTML sobre o jogo (campo de nome do ranking).
  dom: { createContainer: true },
  backgroundColor: COLORS.background,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  render: {
    antialias: true,
    pixelArt: false,
  },
  scene: [BootScene, PreloadScene, MenuScene, MapSelectScene, RankingScene, GameScene, UIScene],
};
