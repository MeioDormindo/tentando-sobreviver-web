import Phaser from 'phaser';
import { ART_SCALE, DEPTH } from '../config/visual.config';
import { HoldProgress } from '../entities/HoldProgress';
import type { InteractionPromptPayload } from '../game/events';
import type { Interactable } from '../systems/InteractionSystem';

export interface QuestSpotOptions {
  x: number;
  y: number;
  /** Imagem no mundo (opcional: a gaveta usa o prop que já existe). */
  texture?: string;
  radius?: number;
  /** Texto quando está disponível (sem o "[E]"/"SEGURE E:"). */
  label: string;
  /** Texto quando ainda não pode ser usado (null = some da HUD). */
  lockedLabel?: string | null;
  /** Pode ser usado agora? */
  enabled?: () => boolean;
  /** Segurar E por este tempo (ms); ausente = tocar E. */
  holdMs?: number;
  onDone: () => void;
}

/** Ponto da missão: tocar ou segurar E para concluir. Brilha em amarelo enquanto disponível. */
export class QuestSpot implements Interactable {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  private readonly progress: HoldProgress | null;
  private readonly image: Phaser.GameObjects.Image | null;
  private readonly glow: Phaser.GameObjects.Arc;
  private used = false;

  constructor(private readonly scene: Phaser.Scene, private readonly opts: QuestSpotOptions) {
    this.x = opts.x;
    this.y = opts.y;
    this.radius = opts.radius ?? 50;
    this.progress = opts.holdMs ? new HoldProgress(opts.holdMs) : null;
    this.image = opts.texture ? scene.add.image(opts.x, opts.y, opts.texture).setScale(ART_SCALE).setDepth(opts.y + 10) : null;
    // Anel pulsando que marca o objetivo (visível no escuro).
    this.glow = scene.add.circle(opts.x, opts.y, 22, 0xffd35a, 0).setStrokeStyle(2, 0xffd35a, 0.8).setDepth(DEPTH.glow);
    scene.tweens.add({ targets: this.glow, scale: 1.4, alpha: 0.2, duration: 800, yoyo: true, repeat: -1 });
  }

  private get available(): boolean {
    return !this.used && (this.opts.enabled?.() ?? true);
  }

  getPrompt(): InteractionPromptPayload | null {
    if (this.used) return null;
    if (!this.available) return this.opts.lockedLabel ? { text: this.opts.lockedLabel, affordable: false } : null;
    if (this.progress) return { text: `SEGURE E: ${this.opts.label}${this.progress.bar(this.scene.time.now)}`, affordable: true };
    return { text: `[E] ${this.opts.label}`, affordable: true };
  }

  interact(): void {
    if (!this.progress && this.available) this.finish();
  }

  onHold(time: number, delta: number): void {
    if (this.progress && this.available && this.progress.hold(time, delta)) this.finish();
  }

  /** Mostra/esconde o anel (ex.: gaveta só brilha com o cartão). */
  update(): void {
    this.glow.setVisible(this.available);
  }

  destroy(): void {
    this.glow.destroy();
    this.image?.destroy();
  }

  private finish(): void {
    this.used = true;
    this.glow.setVisible(false);
    this.opts.onDone();
  }
}
