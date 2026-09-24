import Phaser from 'phaser';

/** Ações dos botões de toque. */
export type TouchAction = 'interact' | 'reload' | 'swap' | 'pause' | 'knife';

/**
 * Estado dos controles de toque (celular), escrito pela HUD (TouchControls) e lido
 * pela partida (jogador, armas, interação, câmera). Vetores com comprimento 0..1.
 */
class TouchInput {
  /** Controles de toque ligados (aparelho de toque). */
  enabled = false;
  moveX = 0;
  moveY = 0;
  /** Direção da mira (analógico direito) e se está sendo usada. */
  aimX = 0;
  aimY = 0;
  aiming = false;
  /** Analógico direito empurrado além do limite: atira. */
  firing = false;
  /** Botão USAR segurado (reparar barricada). */
  interactHeld = false;
  /** Avisos de botão pressionado (armas, interação, pausa). */
  readonly events = new Phaser.Events.EventEmitter();

  get moving(): boolean {
    return this.moveX * this.moveX + this.moveY * this.moveY > 0.01;
  }

  press(action: TouchAction): void {
    this.events.emit(action);
  }

  /** Solta tudo (ao pausar, morrer ou trocar de cena). */
  release(): void {
    this.moveX = this.moveY = this.aimX = this.aimY = 0;
    this.aiming = this.firing = this.interactHeld = false;
  }
}

export const touchInput = new TouchInput();
