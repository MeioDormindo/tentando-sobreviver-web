import Phaser from 'phaser';
import { audio } from '../audio/AudioSystem';
import { uiView } from './uiScale';

interface Item {
  name: string;
  description: string;
  icon: string;
}

const W = 340;
const H = 64;
const SHOW_MS = 3600;

/** Aviso "CONQUISTA DESBLOQUEADA" no alto da tela; várias seguidas entram em fila. */
export class AchievementToast {
  private readonly queue: Item[] = [];
  private showing = false;

  constructor(private readonly scene: Phaser.Scene) {}

  push(item: Item): void {
    this.queue.push(item);
    if (!this.showing) this.next();
  }

  private next(): void {
    const item = this.queue.shift();
    if (!item) {
      this.showing = false;
      return;
    }
    this.showing = true;
    const { scene } = this;
    const { width } = uiView(scene);
    const y = 118;
    const box = scene.add.container(width / 2, -H).setDepth(190);
    box.add(scene.add.rectangle(0, 0, W, H, 0x101214, 0.92).setStrokeStyle(2, 0xe3c77a));
    const icon = scene.textures.exists(item.icon) ? scene.add.image(-W / 2 + 34, 0, item.icon) : null;
    if (icon) {
      icon.setScale(Math.min(44 / icon.width, 44 / icon.height));
      box.add(icon);
    }
    box.add(scene.add.text(-W / 2 + 64, -22, 'CONQUISTA DESBLOQUEADA', { fontFamily: 'monospace', fontSize: '11px', color: '#e3c77a' }));
    box.add(scene.add.text(-W / 2 + 64, -8, item.name.toUpperCase(), { fontFamily: 'Impact, "Arial Black", sans-serif', fontSize: '18px', color: '#e8e2c8' }));
    box.add(scene.add.text(-W / 2 + 64, 14, item.description, { fontFamily: 'monospace', fontSize: '11px', color: '#9a9c94', wordWrap: { width: W - 74 } }));
    audio.play('box_reveal', { category: 'ui', volume: 0.8, rate: 1.2, pitchJitter: 0 });
    scene.tweens.add({ targets: box, y, duration: 420, ease: 'Back.easeOut' });
    scene.tweens.add({
      targets: box,
      y: -H,
      delay: SHOW_MS,
      duration: 360,
      ease: 'Quad.easeIn',
      onComplete: () => {
        box.destroy();
        this.next();
      },
    });
  }
}
