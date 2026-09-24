import Phaser from 'phaser';
import { knifeConfig } from '../config/weapons.config';
import { DEPTH } from '../config/visual.config';
import { audio } from '../audio/AudioSystem';
import type { Player } from '../entities/Player';
import { touchInput } from '../input/touchInput';
import type { WeaponSystem } from './WeaponSystem';

export interface KnifeDeps {
  player: Player;
  weapons: WeaponSystem;
  /** Golpe no arco à frente; devolve quantos alvos acertou. */
  melee: (x: number, y: number, angle: number) => number;
  /** Alvos vivos (para o avanço até o mais próximo à frente). */
  targets: () => Iterable<{ x: number; y: number }>;
  lineOfSight: (ax: number, ay: number, bx: number, by: number) => boolean;
}

const SLASH_COLOR = 0xf2f0e6;

/**
 * Faca (como no CoD Zombies): V, botão direito do mouse ou FACA no celular.
 * Avança até um zumbi próximo à frente, corta em arco e paga mais pelo abate.
 */
export class Knife {
  private readyAt = 0;
  private readonly slash: Phaser.GameObjects.Graphics;

  constructor(private readonly scene: Phaser.Scene, private readonly deps: KnifeDeps) {
    this.slash = scene.add.graphics().setDepth(DEPTH.glow).setBlendMode(Phaser.BlendModes.ADD);
    const kb = scene.input.keyboard;
    kb?.on('keydown-V', this.swing, this);
    scene.input.mouse?.disableContextMenu();
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointer, this);
    touchInput.events.on('knife', this.swing, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      kb?.off('keydown-V', this.swing, this);
      scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.onPointer, this);
      touchInput.events.off('knife', this.swing, this);
    });
  }

  private onPointer(p: Phaser.Input.Pointer): void {
    if (p.rightButtonDown()) this.swing();
  }

  swing(): void {
    const { player, weapons } = this.deps;
    const now = this.scene.time.now;
    if (!player.isAlive || player.isDowned || now < this.readyAt) return;
    const cfg = knifeConfig;
    this.readyAt = now + cfg.cooldownMs;
    weapons.blockFor(cfg.busyMs);
    const target = this.lungeTarget();
    const angle = target ? Phaser.Math.Angle.Between(player.x, player.y, target.x, target.y) : player.rotation;
    if (target) player.lunge(angle, cfg.lungeSpeed, cfg.lungeMs);
    audio.playAt('knife_swing', player.x, player.y, { category: 'weapon', volume: 0.9 });
    this.scene.time.delayedCall(cfg.windupMs + (target ? cfg.lungeMs * 0.6 : 0), () => this.strike(angle));
  }

  private strike(angle: number): void {
    const { player } = this.deps;
    if (!player.isAlive) return;
    const hits = this.deps.melee(player.x, player.y, angle);
    if (hits > 0) {
      audio.playAt('impact_flesh', player.x, player.y, { category: 'weapon', volume: 1 });
      this.scene.cameras.main.shake(70, 0.003);
    }
    this.drawSlash(player.x, player.y, angle);
  }

  /** Zumbi mais próximo dentro do alcance de avanço e do arco à frente (sem parede no meio). */
  private lungeTarget(): { x: number; y: number } | null {
    const { player } = this.deps;
    const cfg = knifeConfig;
    const half = Phaser.Math.DegToRad(cfg.arcDeg / 2);
    let best: { x: number; y: number } | null = null;
    let bestD = cfg.lungeRange;
    for (const t of this.deps.targets()) {
      const d = Phaser.Math.Distance.Between(player.x, player.y, t.x, t.y);
      if (d >= bestD) continue;
      const a = Phaser.Math.Angle.Between(player.x, player.y, t.x, t.y);
      if (Math.abs(Phaser.Math.Angle.Wrap(a - player.rotation)) > half) continue;
      if (!this.deps.lineOfSight(player.x, player.y, t.x, t.y)) continue;
      best = t;
      bestD = d;
    }
    return best;
  }

  /** Meia-lua branca que some rápido. */
  private drawSlash(x: number, y: number, angle: number): void {
    const cfg = knifeConfig;
    const half = Phaser.Math.DegToRad(cfg.arcDeg / 2);
    const g = this.slash;
    this.scene.tweens.killTweensOf(g);
    g.clear().setAlpha(1);
    for (let i = 0; i < 3; i++) {
      g.lineStyle(4 - i, SLASH_COLOR, 0.7 - i * 0.2);
      g.beginPath();
      g.arc(x, y, cfg.range - i * 6, angle - half, angle + half, false);
      g.strokePath();
    }
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 160 });
  }
}
