import Phaser from 'phaser';
import { COLORS } from '../config/game.config';
import type { GameOverStats } from '../game/events';

const TITLE_FONT = 'Impact, "Arial Black", sans-serif';
const FONT = 'monospace';
const ROW_HEIGHT = 26;

const money = (n: number): string => `$ ${n.toLocaleString('pt-BR')}`;

function duration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export interface GameOverActions {
  retry(): void;
  menu(): void;
  makeButton(x: number, y: number, label: string, onClick: () => void): Phaser.GameObjects.Text;
}

/**
 * Tela de Game Over (GDD §63): título, estatísticas da partida em duas colunas
 * (GDD §64), recorde e os botões Jogar Novamente / Menu.
 */
export function createGameOverOverlay(scene: Phaser.Scene, stats: GameOverStats, actions: GameOverActions): Phaser.GameObjects.Container {
  const { width, height } = scene.scale;
  const overlay = scene.add.container(0, 0).setDepth(200);
  const bg = scene.add.rectangle(0, 0, width, height, 0x000000, 0.78).setOrigin(0);
  const title = scene.add
    .text(width / 2, height * 0.16, 'GAME OVER', { fontFamily: TITLE_FONT, fontSize: '72px', color: '#b33a3a', stroke: '#000', strokeThickness: 6 })
    .setOrigin(0.5);
  overlay.add([bg, title]);

  const accuracy = stats.shotsFired > 0 ? Math.round((stats.shotsHit / stats.shotsFired) * 100) : 0;
  const rows: Array<[string, string]> = [
    ['WAVE', `${stats.wave}`],
    ['ZUMBIS ABATIDOS', `${stats.kills}`],
    ['HEADSHOTS', `${stats.headshots}`],
    ['DINHEIRO GANHO', money(stats.moneyEarned)],
    ['TEMPO SOBREVIVIDO', duration(stats.timeMs)],
    ['BOSSES DERROTADOS', `${stats.bosses}`],
    ['DANO CAUSADO', stats.damage.toLocaleString('pt-BR')],
    ['DISPAROS / ACERTOS', `${stats.shotsFired} / ${stats.shotsHit}`],
    ['PRECISÃO', `${accuracy}%`],
    ['POWER-UPS', `${stats.powerUps}`],
  ];
  const colWidth = Math.min(300, width * 0.36);
  const perCol = Math.ceil(rows.length / 2);
  const top = height * 0.3;
  rows.forEach(([label, value], i) => {
    const col = Math.floor(i / perCol);
    const row = i % perCol;
    const x = width / 2 + (col === 0 ? -colWidth - 20 : 20);
    const y = top + row * ROW_HEIGHT;
    const l = scene.add.text(x, y, label, { fontFamily: FONT, fontSize: '15px', color: COLORS.textDim });
    const v = scene.add.text(x + colWidth, y, value, { fontFamily: FONT, fontSize: '17px', color: COLORS.text }).setOrigin(1, 0);
    overlay.add([l, v]);
  });

  const recordY = top + perCol * ROW_HEIGHT + 18;
  const recordText = stats.newRecord
    ? 'NOVO RECORDE!'
    : `RECORDE: WAVE ${stats.bestWave} · ${stats.bestKills} ABATES`;
  const record = scene.add
    .text(width / 2, recordY, recordText, { fontFamily: stats.newRecord ? TITLE_FONT : FONT, fontSize: stats.newRecord ? '28px' : '15px', color: stats.newRecord ? '#e3c77a' : COLORS.textDim })
    .setOrigin(0.5);
  overlay.add(record);
  if (stats.newRecord) scene.tweens.add({ targets: record, scale: 1.12, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

  const by = Math.min(height - 90, recordY + 60);
  overlay.add(actions.makeButton(width / 2, by, '[ JOGAR NOVAMENTE ]', actions.retry));
  overlay.add(actions.makeButton(width / 2, by + 44, '[ MENU ]', actions.menu));

  // Entrada suave.
  overlay.setAlpha(0);
  scene.tweens.add({ targets: overlay, alpha: 1, duration: 600 });
  return overlay;
}
