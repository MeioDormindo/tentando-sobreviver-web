import Phaser from 'phaser';
import { ASSET_KEYS } from '../config/assets.config';
import { collapseConfig } from '../config/events.config';
import { DEPTH } from '../config/visual.config';
import { audio } from '../audio/AudioSystem';
import { liveZombies, type EventContext, type WorldEvent } from './WorldEvent';

interface Falling {
  x: number;
  y: number;
  at: number;
  mark: Phaser.GameObjects.Graphics;
}

/**
 * Desabamento: pedaços do teto caem perto do jogador. Cada um é avisado por um círculo
 * vermelho que fecha; ao cair, fere quem estiver dentro (zumbis também) e deixa entulho.
 */
export class CollapseEvent implements WorldEvent {
  readonly id = 'collapse';
  readonly durationMs = collapseConfig.durationMs;
  readonly endsWithWave = false;
  readonly atWaveStart = false;
  private ctx: EventContext | null = null;
  private nextAt = 0;
  private falling: Falling[] = [];

  canStart(): boolean {
    return true;
  }

  start(ctx: EventContext): void {
    this.ctx = ctx;
    this.nextAt = ctx.scene.time.now + 600;
    this.falling = [];
    audio.play('amb_creak', { category: 'world', volume: 1, rate: 0.7 });
    ctx.scene.cameras.main.shake(500, 0.004);
  }

  update(time: number): boolean {
    const ctx = this.ctx;
    if (!ctx) return false;
    const cfg = collapseConfig;
    if (time >= this.nextAt) {
      this.nextAt = time + cfg.everyMs;
      this.drop(ctx, time);
    }
    for (const f of [...this.falling]) {
      const t = 1 - Math.max(0, f.at - time) / cfg.warningMs;
      f.mark.clear();
      f.mark.lineStyle(2, 0xff3a2a, 0.5 + 0.5 * t).strokeCircle(f.x, f.y, cfg.radius * (1.6 - 0.6 * t));
      f.mark.fillStyle(0xff3a2a, 0.12 + 0.2 * t).fillCircle(f.x, f.y, cfg.radius * t);
      if (time >= f.at) this.impact(ctx, f);
    }
    return true;
  }

  end(): void {
    for (const f of this.falling) f.mark.destroy();
    this.falling = [];
    this.ctx = null;
  }

  private drop(ctx: EventContext, time: number): void {
    const cfg = collapseConfig;
    const p = ctx.player;
    let x = p.x;
    let y = p.y;
    if (Math.random() >= cfg.aimAtPlayerChance) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.sqrt(Math.random()) * cfg.spread;
      x += Math.cos(a) * d;
      y += Math.sin(a) * d;
    }
    // Só cai em chão (não no meio de paredes).
    const nav = ctx.map.nav;
    if (nav.getCost(nav.toTile(x), nav.toTile(y)) !== 1) return;
    const mark = ctx.scene.add.graphics().setDepth(DEPTH.glow);
    this.falling.push({ x, y, at: time + cfg.warningMs, mark });
    audio.playAt('amb_creak', x, y, { category: 'world', volume: 0.6, rate: 1.3 });
  }

  private impact(ctx: EventContext, f: Falling): void {
    const cfg = collapseConfig;
    this.falling.splice(this.falling.indexOf(f), 1);
    f.mark.destroy();
    ctx.effects.dustBurst(f.x, f.y, 24);
    ctx.effects.shockwave(f.x, f.y, cfg.radius * 1.3, 0xc8b48a, 320);
    ctx.effects.stampDecal(ASSET_KEYS.debris, undefined, f.x, f.y, Math.random() * Math.PI * 2, 0.9);
    audio.playAt('boss_slam', f.x, f.y, { category: 'world', volume: 0.7, rate: 1.3 });
    ctx.scene.cameras.main.shake(140, 0.004);
    const p = ctx.player;
    if (p.isAlive && Phaser.Math.Distance.Between(p.x, p.y, f.x, f.y) <= cfg.radius) p.takeDamage(cfg.playerDamage, ctx.scene.time.now);
    for (const z of liveZombies(ctx.zombies)) {
      if (Phaser.Math.Distance.Between(z.x, z.y, f.x, f.y) > cfg.radius) continue;
      const { x, y } = z;
      if (z.takeDamage(cfg.zombieDamage, false, 'hazard')) ctx.effects.zombieDeath(x, y, Math.random() * Math.PI * 2, z.skin);
    }
  }
}
