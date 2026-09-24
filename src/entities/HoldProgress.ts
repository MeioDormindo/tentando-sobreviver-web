/** Sem novo onHold por este tempo, o progresso zera (o botão foi solto). */
const RELEASE_MS = 150;
const BAR = 6;

/**
 * "Segure E / USAR" com barra de progresso: chame hold() a cada onHold e use bar() no
 * texto do aviso. done() é chamado ao completar o tempo.
 */
export class HoldProgress {
  private ms = 0;
  private lastAt = -Infinity;

  constructor(private readonly durationMs: number) {}

  /** Retorna true no quadro em que o tempo foi completado. */
  hold(time: number, delta: number): boolean {
    if (time - this.lastAt > RELEASE_MS) this.ms = 0;
    this.lastAt = time;
    this.ms += delta;
    if (this.ms < this.durationMs) return false;
    this.ms = 0;
    return true;
  }

  /** Zera o progresso (ex.: levou dano). */
  reset(): void {
    this.ms = 0;
  }

  /** " [▰▰▱▱▱▱]" enquanto segura; vazio caso contrário. */
  bar(now: number): string {
    if (now - this.lastAt >= RELEASE_MS || this.ms <= 0) return '';
    const filled = Math.round((this.ms / this.durationMs) * BAR);
    return ` [${'▰'.repeat(filled)}${'▱'.repeat(BAR - filled)}]`;
  }
}
