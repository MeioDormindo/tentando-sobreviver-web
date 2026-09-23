import Phaser from 'phaser';
import { COLORS } from '../config/game.config';
import { MAPS, PLAYER_NAME_MAX } from '../config/maps.config';
import type { GameOverStats } from '../game/events';
import { save } from '../save/SaveStore';

const TITLE_FONT = 'Impact, "Arial Black", sans-serif';
const FONT = 'monospace';
const ROW_HEIGHT = 26;
/** Área de desenho da tela (escalada para caber em qualquer tela, inclusive celular). */
const DESIGN = { w: 900, h: 680 };

const money = (n: number): string => `$ ${n.toLocaleString('pt-BR')}`;

function duration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export interface GameOverActions {
  retry(): void;
  ranking(): void;
  menu(): void;
  makeButton(x: number, y: number, label: string, onClick: () => void): Phaser.GameObjects.Text;
}

/**
 * Tela de Game Over (GDD §63): título, pontuação, estatísticas em duas colunas
 * (GDD §64), recorde e, se a pontuação entrou no top do mapa, o nome para o ranking.
 */
export function createGameOverOverlay(scene: Phaser.Scene, stats: GameOverStats, actions: GameOverActions): Phaser.GameObjects.Container {
  const { width, height } = scene.scale;
  const scale = Phaser.Math.Clamp(Math.min(width / DESIGN.w, height / DESIGN.h), 0.45, 1);
  const root = scene.add.container(0, 0).setDepth(200);
  root.add(scene.add.rectangle(0, 0, width, height, 0x000000, 0.8).setOrigin(0));
  const box = scene.add.container(width / 2, height / 2).setScale(scale);
  root.add(box);

  box.add(
    scene.add.text(0, -290, 'GAME OVER', { fontFamily: TITLE_FONT, fontSize: '72px', color: '#b33a3a', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5),
  );
  box.add(
    scene.add
      .text(0, -228, `SCORE ${stats.score.toLocaleString('pt-BR')}`, { fontFamily: TITLE_FONT, fontSize: '32px', color: '#e8e2c8', stroke: '#000', strokeThickness: 4 })
      .setOrigin(0.5),
  );

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
  const colWidth = 300;
  const perCol = Math.ceil(rows.length / 2);
  const top = -180;
  rows.forEach(([label, value], i) => {
    const x = Math.floor(i / perCol) === 0 ? -colWidth - 20 : 20;
    const y = top + (i % perCol) * ROW_HEIGHT;
    box.add(scene.add.text(x, y, label, { fontFamily: FONT, fontSize: '15px', color: COLORS.textDim }));
    box.add(scene.add.text(x + colWidth, y, value, { fontFamily: FONT, fontSize: '17px', color: COLORS.text }).setOrigin(1, 0));
  });

  const recordText = stats.newRecord
    ? 'NOVO RECORDE DE PONTOS!'
    : `RECORDE: ${stats.bestScore.toLocaleString('pt-BR')} PONTOS · WAVE ${stats.bestWave}`;
  const record = scene.add
    .text(0, -10, recordText, {
      fontFamily: stats.newRecord ? TITLE_FONT : FONT,
      fontSize: stats.newRecord ? '28px' : '15px',
      color: stats.newRecord ? '#e3c77a' : COLORS.textDim,
    })
    .setOrigin(0.5);
  box.add(record);
  if (stats.newRecord) scene.tweens.add({ targets: record, scale: 1.12, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

  if (stats.rankEligible) addRankingEntry(scene, root, box, scale, stats);

  box.add(actions.makeButton(0, 150, '[ JOGAR NOVAMENTE ]', actions.retry));
  box.add(actions.makeButton(0, 196, '[ RANKING ]', actions.ranking));
  box.add(actions.makeButton(0, 242, '[ MENU ]', actions.menu));

  root.setAlpha(0);
  scene.tweens.add({ targets: root, alpha: 1, duration: 600 });
  return root;
}

/** Campo de nome (elemento HTML: abre o teclado no celular) e botão para gravar no ranking. */
function addRankingEntry(scene: Phaser.Scene, root: Phaser.GameObjects.Container, box: Phaser.GameObjects.Container, scale: number, stats: GameOverStats): void {
  const label = scene.add
    .text(0, 42, `ENTROU NO TOP DO ${MAPS[stats.mapId].name.toUpperCase()}! SEU NOME:`, { fontFamily: FONT, fontSize: '16px', color: '#e3c77a' })
    .setOrigin(0.5);
  box.add(label);
  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = PLAYER_NAME_MAX;
  input.value = save.playerName;
  input.setAttribute('aria-label', 'Nome para o ranking');
  Object.assign(input.style, {
    width: `${Math.round(230 * scale)}px`,
    font: `${Math.round(18 * scale)}px monospace`,
    padding: `${Math.round(6 * scale)}px`,
    background: '#15171a',
    color: '#e8e2c8',
    border: '1px solid #c9a45c',
    textTransform: 'uppercase',
    textAlign: 'center',
  });
  const cx = scene.scale.width / 2;
  const cy = scene.scale.height / 2;
  const dom = scene.add.dom(cx - 70 * scale, cy + 84 * scale, input).setDepth(210);
  const saveBtn = scene.add
    .text(160, 84, '[ SALVAR ]', { fontFamily: FONT, fontSize: '20px', color: COLORS.text, padding: { x: 8, y: 6 } })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true });
  saveBtn.on('pointerover', () => saveBtn.setColor(COLORS.accent)).on('pointerout', () => saveBtn.setColor(COLORS.text));
  box.add(saveBtn);

  const submit = (): void => {
    const pos = save.addRanking(stats.mapId, { name: input.value, score: stats.score, wave: stats.wave, kills: stats.kills });
    dom.destroy();
    saveBtn.destroy();
    label.setText(pos > 0 ? `${pos}º LUGAR NO RANKING DO ${MAPS[stats.mapId].name.toUpperCase()}!` : 'NÃO ENTROU NO RANKING').setFontSize(20);
  };
  saveBtn.on('pointerup', submit);
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') submit();
  });
  root.once(Phaser.GameObjects.Events.DESTROY, () => dom.active && dom.destroy());
}
