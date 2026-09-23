import Phaser from 'phaser';
import { GameEvents, onGameEvent, type WorldEventStatePayload } from '../game/events';

const TITLE_FONT = 'Impact, "Arial Black", sans-serif';
const FONT = 'monospace';
const BAR_WIDTH = 180;
const BANNER_MS = 3200;

const hex = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;

/**
 * HUD dos eventos dinâmicos: anúncio grande quando um evento começa e um indicador
 * no topo da tela com o nome e o tempo restante enquanto ele dura.
 */
export class EventHud {
  private readonly title: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly label: Phaser.GameObjects.Text;
  private readonly bar: Phaser.GameObjects.Graphics;
  private state: WorldEventStatePayload | null = null;
  private barY = 0;
  private centerX = 0;

  constructor(private readonly scene: Phaser.Scene) {
    const stroke = { stroke: '#000', strokeThickness: 5 };
    this.title = scene.add.text(0, 0, '', { fontFamily: TITLE_FONT, fontSize: '46px', color: '#fff', ...stroke }).setOrigin(0.5).setAlpha(0);
    this.hint = scene.add.text(0, 0, '', { fontFamily: FONT, fontSize: '17px', color: '#e8e2c8', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setAlpha(0);
    this.label = scene.add.text(0, 0, '', { fontFamily: FONT, fontSize: '14px', color: '#fff', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5, 1);
    this.bar = scene.add.graphics();

    const offs = [
      onGameEvent(scene.game.events, GameEvents.WorldEventStarted, (e) => this.announce(e.name, e.hint, e.color)),
      onGameEvent(scene.game.events, GameEvents.WorldEventState, (s) => this.setState(s)),
    ];
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => offs.forEach((off) => off()));
  }

  layout(width: number, height: number, top: number): void {
    this.centerX = width / 2;
    this.title.setPosition(width / 2, height * 0.42);
    this.hint.setPosition(width / 2, height * 0.42 + 38);
    this.barY = top + 58;
    this.label.setPosition(width / 2, this.barY - 3);
    this.drawBar();
  }

  private announce(name: string, hint: string, color: number): void {
    const { scene } = this;
    scene.tweens.killTweensOf([this.title, this.hint]);
    this.title.setText(`⚠ ${name}`).setColor(hex(color)).setAlpha(0).setScale(1.3);
    this.hint.setText(hint).setAlpha(0);
    scene.tweens.add({ targets: this.title, alpha: 1, scale: 1, duration: 260, ease: 'Back.easeOut' });
    scene.tweens.add({ targets: this.hint, alpha: 1, duration: 260, delay: 120 });
    scene.tweens.add({ targets: [this.title, this.hint], alpha: 0, duration: 600, delay: BANNER_MS });
  }

  private setState(s: WorldEventStatePayload | null): void {
    this.state = s;
    if (!s) {
      this.label.setText('');
    } else {
      const secs = s.remainingMs === null ? '' : `  ${Math.ceil(s.remainingMs / 1000)}s`;
      this.label.setText(`● ${s.name}${secs}`).setColor(hex(s.color));
    }
    this.drawBar();
  }

  private drawBar(): void {
    const g = this.bar;
    g.clear();
    const s = this.state;
    if (!s || s.remainingMs === null || !s.totalMs) return;
    const x = this.centerX - BAR_WIDTH / 2;
    g.fillStyle(0x000000, 0.55).fillRect(x, this.barY, BAR_WIDTH, 4);
    g.fillStyle(s.color, 0.95).fillRect(x, this.barY, BAR_WIDTH * (s.remainingMs / s.totalMs), 4);
  }
}
