import Phaser from 'phaser';

const FONT = 'monospace';
const TITLE_COLOR = '#ffd35a';
const TEXT_COLOR = '#e8e4d8';

/** Objetivo atual da missão principal, abaixo do minimapa. */
export class QuestHud {
  private readonly title: Phaser.GameObjects.Text;
  private readonly text: Phaser.GameObjects.Text;
  private lastObjective = '';

  constructor(private readonly scene: Phaser.Scene) {
    this.title = scene.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: '11px', color: TITLE_COLOR, fontStyle: 'bold', stroke: '#000', strokeThickness: 3 })
      .setVisible(false);
    this.text = scene.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: '13px', color: TEXT_COLOR, stroke: '#000', strokeThickness: 3, wordWrap: { width: 230 } })
      .setVisible(false);
  }

  /** null = sem missão ativa (esconde). */
  set(state: { title: string; objective: string; step: number; total: number } | null): void {
    const visible = state !== null;
    this.title.setVisible(visible);
    this.text.setVisible(visible);
    if (!state) return;
    this.title.setText(`◆ ${state.title}  ${state.step}/${state.total}`);
    this.text.setText(state.objective);
    // Objetivo novo: pisca para chamar a atenção.
    if (state.objective.split(':')[0] !== this.lastObjective.split(':')[0]) {
      this.scene.tweens.add({ targets: this.text, alpha: { from: 0.2, to: 1 }, duration: 250, repeat: 2 });
    }
    this.lastObjective = state.objective;
  }

  layout(x: number, y: number): void {
    this.title.setPosition(x, y);
    this.text.setPosition(x, y + 15);
  }
}
