import Phaser from 'phaser';
import { ASSET_KEYS } from '../config/assets.config';
import { supplyDropConfig, worldEvents } from '../config/events.config';
import { ART_SCALE, DEPTH } from '../config/visual.config';
import { emitGameEvent, GameEvents, type InteractionPromptPayload } from '../game/events';
import type { Interactable } from '../systems/InteractionSystem';
import { audio } from '../audio/AudioSystem';
import { HoldProgress } from '../entities/HoldProgress';
import { pickFloorPoint, type EventContext, type WorldEvent } from './WorldEvent';

type Light = { x: number; y: number; radius: number; intensity: number; color?: number };

const FLARE_COLOR = 0xff4a3a;
const SMOKE_EVERY_MS = 140;

/**
 * Suprimentos: um avião passa, uma caixa desce de paraquedas num ponto do terminal
 * (com sinalizador vermelho) e quem abrir recebe munição cheia, armadura e dinheiro.
 */
export class SupplyDropEvent implements WorldEvent, Interactable {
  readonly id = 'supply_drop';
  readonly durationMs = supplyDropConfig.lifetimeMs + supplyDropConfig.fallMs;
  readonly endsWithWave = false;
  readonly atWaveStart = false;
  readonly radius = 48;
  x = 0;
  y = 0;

  private ctx: EventContext | null = null;
  private landedAt = 0;
  private landed = false;
  private opened = false;
  private readonly opening = new HoldProgress(supplyDropConfig.openHoldMs);
  private crate: Phaser.GameObjects.Image | null = null;
  private chute: Phaser.GameObjects.Image | null = null;
  private shadow: Phaser.GameObjects.Image | null = null;
  private flare: Light | null = null;
  private nextSmokeAt = 0;

  canStart(ctx: EventContext): boolean {
    const [min, max] = supplyDropConfig.distance;
    return pickFloorPoint(ctx, min, max, 20) !== null;
  }

  start(ctx: EventContext): void {
    const [min, max] = supplyDropConfig.distance;
    const point = pickFloorPoint(ctx, min, max) ?? new Phaser.Math.Vector2(ctx.player.x, ctx.player.y);
    this.ctx = ctx;
    this.x = point.x;
    this.y = point.y;
    this.landed = false;
    this.opened = false;
    const { scene } = ctx;
    const fall = supplyDropConfig.fallMs;

    audio.play('evt_plane', { category: 'world', volume: 0.9, pitchJitter: 0 });
    this.shadow = scene.add.image(this.x + 3, this.y + 5, ASSET_KEYS.shadow).setScale(0.15).setAlpha(0.2).setDepth(DEPTH.shadows);
    this.crate = scene.add.image(this.x, this.y - 60, ASSET_KEYS.supplyCrate).setScale(ART_SCALE * 1.8).setDepth(DEPTH.glow + 2);
    this.chute = scene.add.image(this.x, this.y - 70, ASSET_KEYS.parachute).setScale(ART_SCALE * 1.4).setDepth(DEPTH.glow + 3).setAlpha(0.95);
    // Desce balançando; a sombra cresce conforme a caixa se aproxima do chão.
    scene.tweens.add({ targets: this.crate, y: this.y, scale: ART_SCALE, duration: fall, ease: 'Sine.easeIn' });
    scene.tweens.add({ targets: this.chute, y: this.y - 10, scale: ART_SCALE, duration: fall, ease: 'Sine.easeIn' });
    scene.tweens.add({ targets: this.chute, angle: { from: -8, to: 8 }, duration: 550, yoyo: true, repeat: -1 });
    scene.tweens.add({ targets: this.shadow, scale: ART_SCALE * 0.9, alpha: 0.55, duration: fall, ease: 'Sine.easeIn' });
    scene.time.delayedCall(fall, () => this.land());
  }

  update(time: number): boolean {
    const ctx = this.ctx;
    if (!ctx) return false;
    if (this.opened) return false;
    if (this.landed && this.flare) {
      // Sinalizador pulsando e soltando fumaça vermelha.
      this.flare.intensity = 0.55 + 0.35 * Math.abs(Math.sin(time / 150));
      if (time >= this.nextSmokeAt) {
        this.nextSmokeAt = time + SMOKE_EVERY_MS;
        ctx.effects.flareSmoke(this.x + 14, this.y - 12, FLARE_COLOR);
      }
      // Pisca nos últimos 8 s antes de sumir.
      const left = this.landedAt + supplyDropConfig.lifetimeMs - time;
      this.crate?.setAlpha(left < 8000 && Math.floor(left / 200) % 2 === 0 ? 0.4 : 1);
    }
    return true;
  }

  end(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.interaction.remove(this);
    if (this.flare) ctx.lighting.removeDynamicLight(this.flare);
    ctx.scene.tweens.killTweensOf([this.crate, this.chute, this.shadow].filter((o) => o !== null));
    this.crate?.destroy();
    this.chute?.destroy();
    this.shadow?.destroy();
    this.crate = null;
    this.chute = null;
    this.shadow = null;
    this.flare = null;
    this.ctx = null;
  }

  /** A caixa já pousou e ainda não foi aberta. */
  get isWaiting(): boolean {
    return this.landed && !this.opened;
  }

  getPrompt(): InteractionPromptPayload | null {
    if (!this.landed || this.opened || !this.ctx) return null;
    return { text: `SEGURE E: ABRIR SUPRIMENTOS${this.opening.bar(this.ctx.scene.time.now)}`, affordable: true };
  }

  /** Tocar E não abre: é preciso segurar (openHoldMs). */
  interact(): void {}

  onHold(time: number, delta: number): void {
    if (!this.landed || this.opened || !this.ctx) return;
    // Levar dano interrompe a abertura.
    if (this.ctx.player.msSinceDamage(time) < supplyDropConfig.interruptMs) {
      this.opening.reset();
      return;
    }
    if (!this.opening.hold(time, delta)) return;
    this.open();
  }

  private open(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.opened = true;
    ctx.weapons.refillAllAmmo();
    ctx.player.refillArmor();
    ctx.economy.earn(supplyDropConfig.money);
    audio.play('purchase', { category: 'ui', volume: 0.8 });
    emitGameEvent(ctx.scene.game.events, GameEvents.PowerUpCollected, {
      id: 'supply_drop',
      name: worldEvents.supply_drop.name,
      color: worldEvents.supply_drop.color,
      detail: `Munição cheia · Armadura · +$${supplyDropConfig.money}`,
    });
  }

  private land(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.landed = true;
    this.landedAt = ctx.scene.time.now;
    this.crate?.setDepth(this.y);
    audio.playAt('evt_crate_land', this.x, this.y, { category: 'world', volume: 1 });
    ctx.effects.dustBurst(this.x, this.y, 28);
    ctx.scene.cameras.main.shake(150, 0.004);
    // O paraquedas murcha e some.
    if (this.chute) {
      ctx.scene.tweens.killTweensOf(this.chute);
      ctx.scene.tweens.add({ targets: this.chute, x: this.x + 30, alpha: 0, scale: ART_SCALE * 0.7, duration: 900, onComplete: () => this.chute?.setVisible(false) });
    }
    this.flare = ctx.lighting.addDynamicLight({ x: this.x, y: this.y, radius: 120, intensity: 0.8, color: FLARE_COLOR });
    ctx.interaction.add(this);
  }
}
