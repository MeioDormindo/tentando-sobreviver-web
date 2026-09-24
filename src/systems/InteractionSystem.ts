import Phaser from 'phaser';
import { interactionConfig } from '../config/economy.config';
import type { Player } from '../entities/Player';
import { emitGameEvent, GameEvents, type InteractionPromptPayload } from '../game/events';
import { touchInput } from '../input/touchInput';

/** Algo com que o jogador interage pela tecla E (armas na parede, máquinas, portas...). */
export interface Interactable {
  readonly x: number;
  readonly y: number;
  /** Alcance próprio (px); padrão: interactionConfig.radius. */
  readonly radius?: number;
  /** Texto exibido na HUD; null = indisponível no momento. */
  getPrompt(): InteractionPromptPayload | null;
  interact(): void;
  /** Chamado a cada frame enquanto E fica pressionado (ex.: reparar barricada). */
  onHold?(time: number, delta: number): void;
}

/**
 * Encontra o interagível mais próximo do jogador, mostra o prompt na HUD
 * e executa a interação ao apertar E.
 */
export class InteractionSystem {
  private readonly scene: Phaser.Scene;
  private readonly player: Player;
  private readonly items: Interactable[] = [];
  private focused: Interactable | null = null;
  private lastPromptKey = '';
  private readonly key: Phaser.Input.Keyboard.Key | null;

  constructor(scene: Phaser.Scene, player: Player) {
    this.scene = scene;
    this.player = player;
    const kb = scene.input.keyboard;
    this.key = kb?.addKey(Phaser.Input.Keyboard.KeyCodes.E) ?? null;
    kb?.on('keydown-E', this.onInteract, this);
    touchInput.events.on('interact', this.onInteract, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      kb?.off('keydown-E', this.onInteract, this);
      touchInput.events.off('interact', this.onInteract, this);
    });
  }

  add(item: Interactable): void {
    this.items.push(item);
  }

  /** Remove um interagível temporário (ex.: caixa de suprimentos já aberta). */
  remove(item: Interactable): void {
    const i = this.items.indexOf(item);
    if (i >= 0) this.items.splice(i, 1);
    if (this.focused === item) this.focused = null;
  }

  update(time: number, delta: number): void {
    this.focused = this.player.isAlive ? this.findNearest() : null;
    if (this.focused?.onHold && (this.key?.isDown || touchInput.interactHeld)) this.focused.onHold(time, delta);
    this.emitPrompt();
  }

  syncHud(): void {
    this.lastPromptKey = '#';
    this.emitPrompt();
  }

  private findNearest(): Interactable | null {
    let best: Interactable | null = null;
    let bestDist = Infinity;
    for (const item of this.items) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, item.x, item.y);
      if (d <= (item.radius ?? interactionConfig.radius) && d < bestDist) {
        best = item;
        bestDist = d;
      }
    }
    return best;
  }

  private onInteract(): void {
    if (!this.focused || !this.player.isAlive) return;
    this.focused.interact();
    this.emitPrompt();
  }

  /** Reemite só quando o texto ou a disponibilidade mudam. */
  private emitPrompt(): void {
    const prompt = this.focused?.getPrompt() ?? null;
    const key = prompt ? `${prompt.text}|${prompt.affordable}` : '';
    if (key === this.lastPromptKey) return;
    this.lastPromptKey = key;
    emitGameEvent(this.scene.game.events, GameEvents.InteractionPrompt, prompt);
  }
}
