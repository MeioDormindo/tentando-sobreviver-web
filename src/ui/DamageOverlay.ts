import Phaser from 'phaser';
import { GameEvents, onGameEvent, type PlayerHpPayload } from '../game/events';

const TEXTURE = 'ui_damage_vignette';
const SIZE = 512;
/** Abaixo desta fração de vida as bordas pulsam em vermelho. */
const LOW_HP = 0.3;

/**
 * Indicador de dano na tela: as bordas piscam em vermelho a cada golpe e pulsam
 * quando a vida está baixa.
 */
export class DamageOverlay {
  private readonly image: Phaser.GameObjects.Image;
  private lastHp = -1;
  private flash = 0;
  private low = false;

  constructor(scene: Phaser.Scene) {
    if (!scene.textures.exists(TEXTURE)) {
      const tex = scene.textures.createCanvas(TEXTURE, SIZE, SIZE);
      if (tex) {
        const ctx = tex.getContext();
        const g = ctx.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.3, SIZE / 2, SIZE / 2, SIZE * 0.72);
        g.addColorStop(0, 'rgba(160,0,0,0)');
        g.addColorStop(0.6, 'rgba(150,0,0,0.45)');
        g.addColorStop(1, 'rgba(110,0,0,0.9)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, SIZE, SIZE);
        tex.refresh();
      }
    }
    this.image = scene.add.image(0, 0, TEXTURE).setOrigin(0).setAlpha(0).setDepth(50);
    const off = onGameEvent(scene.game.events, GameEvents.PlayerHpChanged, this.onHp, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
  }

  layout(width: number, height: number): void {
    this.image.setDisplaySize(width, height);
  }

  update(time: number, delta: number): void {
    this.flash = Math.max(0, this.flash - delta / 450);
    const pulse = this.low ? 0.25 + 0.2 * Math.sin(time / 180) : 0;
    this.image.setAlpha(Math.min(1, Math.max(this.flash, pulse)));
  }

  private onHp(p: PlayerHpPayload): void {
    if (this.lastHp >= 0 && p.hp < this.lastHp) this.flash = p.hp <= 0 ? 1 : 0.75;
    this.lastHp = p.hp;
    this.low = p.hp > 0 && p.hp / p.maxHp < LOW_HP;
  }
}
