import Phaser from 'phaser';
import { emitGameEvent, GameEvents } from '../game/events';

/** Uma etapa da missão: texto do objetivo, onde fica (minimapa) e quando termina. */
export interface QuestStep {
  /** Objetivo mostrado na HUD (pode mudar durante a etapa, ex.: "1/3"). */
  objective(): string;
  /** Ponto do objetivo no minimapa (px), ou null. */
  target(): { x: number; y: number } | null;
  /** Chamado ao entrar na etapa (cria interagíveis, inimigos...). */
  enter?(): void;
  /** Chamado a cada frame; devolve true quando a etapa terminou. */
  update(time: number, delta: number): boolean;
  /** Chamado ao sair da etapa (limpa o que criou). */
  exit?(): void;
}

/**
 * Missão principal genérica: uma lista de etapas em ordem. Emite o estado para a HUD
 * (QuestState) e, no fim, QuestComplete.
 */
export class QuestSystem {
  private index = -1;
  private lastText = '';
  private done = false;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly title: string,
    private readonly steps: QuestStep[],
    private readonly onComplete: () => void,
  ) {
    this.advance();
    const offHud = () => this.emit(true);
    scene.game.events.on(GameEvents.HudRequest, offHud);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.game.events.off(GameEvents.HudRequest, offHud));
  }

  get isComplete(): boolean {
    return this.done;
  }

  /** Índice da etapa atual (0 = primeira). */
  get stepIndex(): number {
    return this.index;
  }

  /** Objetivo atual para o minimapa. */
  get target(): { x: number; y: number } | null {
    return this.done ? null : (this.steps[this.index]?.target() ?? null);
  }

  update(time: number, delta: number): void {
    if (this.done) return;
    const step = this.steps[this.index];
    if (step.update(time, delta)) {
      step.exit?.();
      this.advance();
      return;
    }
    this.emit();
  }

  private advance(): void {
    this.index++;
    if (this.index >= this.steps.length) {
      this.done = true;
      emitGameEvent(this.scene.game.events, GameEvents.QuestState, null);
      this.onComplete();
      return;
    }
    this.steps[this.index].enter?.();
    this.emit(true);
  }

  private emit(force = false): void {
    const step = this.steps[this.index];
    if (!step) return;
    const text = step.objective();
    if (!force && text === this.lastText) return;
    this.lastText = text;
    emitGameEvent(this.scene.game.events, GameEvents.QuestState, { title: this.title, objective: text, step: this.index + 1, total: this.steps.length });
  }
}
