import Phaser from 'phaser';
import { touchInput, type TouchAction } from '../input/touchInput';

/** Fração do raio a partir da qual o analógico direito atira. */
const FIRE_THRESHOLD = 0.35;
const DEAD_ZONE = 0.12;
const FONT = 'monospace';

interface Stick {
  pointerId: number | null;
  baseX: number;
  baseY: number;
  x: number;
  y: number;
}

interface Button {
  action: TouchAction;
  label: string;
  x: number;
  y: number;
  r: number;
  color: number;
  pointerId: number | null;
  text: Phaser.GameObjects.Text;
}

/**
 * Controles de toque (celular): analógico esquerdo move, direito mira e atira ao ser
 * empurrado; botões USAR (segure para reparar), RECARREGAR, TROCAR e pausa.
 * Os analógicos aparecem onde o polegar toca (metade esquerda / direita da tela).
 */
export class TouchControls {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly move: Stick = { pointerId: null, baseX: 0, baseY: 0, x: 0, y: 0 };
  private readonly aim: Stick = { pointerId: null, baseX: 0, baseY: 0, x: 0, y: 0 };
  private readonly buttons: Button[] = [];
  private radius = 60;
  private width = 0;
  private height = 0;
  private visible = true;

  constructor(scene: Phaser.Scene) {
    touchInput.enabled = true;
    touchInput.release();
    // Até 4 dedos ao mesmo tempo (2 analógicos + botões).
    scene.input.addPointer(3);
    this.g = scene.add.graphics().setDepth(90);
    const defs: Array<[TouchAction, string, number]> = [
      ['interact', 'USAR', 0xc9a45c],
      ['reload', 'RECARR.', 0x8fa3b8],
      ['swap', 'TROCAR', 0x8fa3b8],
      ['pause', 'II', 0x7a7d78],
    ];
    for (const [action, label, color] of defs) {
      const text = scene.add
        .text(0, 0, label, { fontFamily: FONT, fontSize: '13px', color: '#e8e2c8', fontStyle: 'bold' })
        .setOrigin(0.5)
        .setDepth(91);
      this.buttons.push({ action, label, x: 0, y: 0, r: 30, color, pointerId: null, text });
    }

    const input = scene.input;
    input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      input.off(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
      input.off(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
      input.off(Phaser.Input.Events.POINTER_UP, this.onUp, this);
      input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
      touchInput.release();
    });
  }

  /** Esconde e solta tudo (pausa, morte). */
  setVisible(visible: boolean): void {
    this.visible = visible;
    if (!visible) this.releaseAll();
    for (const b of this.buttons) b.text.setVisible(visible);
    this.draw();
  }

  layout(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.radius = Phaser.Math.Clamp(Math.min(width, height) * 0.13, 44, 80);
    const r = this.radius;
    const br = Phaser.Math.Clamp(r * 0.48, 24, 36);
    // Botões acima da área do polegar direito (que fica no canto de baixo); pausa no topo.
    const above = height - r * 2.2;
    const place: Record<TouchAction, [number, number, number]> = {
      reload: [width - br * 1.3, above - br * 1.2, br],
      swap: [width - br * 1.3, above - br * 3.6, br],
      interact: [width - br * 3.9, above - br * 2.3, br * 1.15],
      pause: [width / 2, br * 0.9 + 4, br * 0.7],
    };
    for (const b of this.buttons) {
      [b.x, b.y, b.r] = place[b.action];
      b.text.setPosition(b.x, b.y).setFontSize(Math.round(b.r * 0.42));
    }
    this.resetStick(this.move, r * 1.7, height - r * 1.7);
    this.resetStick(this.aim, width - r * 1.7, height - r * 1.7);
    this.draw();
  }

  // ───────────── Toques ─────────────

  private onDown(p: Phaser.Input.Pointer): void {
    if (!this.visible) return;
    const button = this.buttons.find((b) => b.pointerId === null && Phaser.Math.Distance.Between(p.x, p.y, b.x, b.y) <= b.r * 1.15);
    if (button) {
      button.pointerId = p.id;
      if (button.action === 'interact') touchInput.interactHeld = true;
      touchInput.press(button.action);
      this.draw();
      return;
    }
    // Não pega toques no topo da tela (HUD) para não brigar com os botões da interface.
    if (p.y < this.height * 0.18) return;
    const stick = p.x < this.width / 2 ? this.move : this.aim;
    if (stick.pointerId !== null) return;
    stick.pointerId = p.id;
    stick.baseX = stick.x = p.x;
    stick.baseY = stick.y = p.y;
    this.apply();
  }

  private onMove(p: Phaser.Input.Pointer): void {
    for (const stick of [this.move, this.aim]) {
      if (stick.pointerId !== p.id) continue;
      stick.x = p.x;
      stick.y = p.y;
      this.apply();
    }
  }

  private onUp(p: Phaser.Input.Pointer): void {
    for (const b of this.buttons) {
      if (b.pointerId !== p.id) continue;
      b.pointerId = null;
      if (b.action === 'interact') touchInput.interactHeld = false;
    }
    const r = this.radius;
    if (this.move.pointerId === p.id) this.resetStick(this.move, r * 1.7, this.height - r * 1.7);
    if (this.aim.pointerId === p.id) this.resetStick(this.aim, this.width - r * 1.7, this.height - r * 1.7);
    this.apply();
  }

  private releaseAll(): void {
    for (const b of this.buttons) b.pointerId = null;
    const r = this.radius;
    this.resetStick(this.move, r * 1.7, this.height - r * 1.7);
    this.resetStick(this.aim, this.width - r * 1.7, this.height - r * 1.7);
    touchInput.release();
  }

  private resetStick(s: Stick, x: number, y: number): void {
    s.pointerId = null;
    s.baseX = s.x = x;
    s.baseY = s.y = y;
  }

  /** Converte a posição dos analógicos no estado lido pela partida. */
  private apply(): void {
    const [mx, my] = this.vector(this.move);
    touchInput.moveX = mx;
    touchInput.moveY = my;
    const [ax, ay] = this.vector(this.aim);
    const len = Math.hypot(ax, ay);
    touchInput.aiming = this.aim.pointerId !== null && len > DEAD_ZONE;
    if (touchInput.aiming) {
      touchInput.aimX = ax / len;
      touchInput.aimY = ay / len;
    }
    touchInput.firing = touchInput.aiming && len >= FIRE_THRESHOLD;
    this.draw();
  }

  private vector(s: Stick): [number, number] {
    if (s.pointerId === null) return [0, 0];
    let dx = (s.x - s.baseX) / this.radius;
    let dy = (s.y - s.baseY) / this.radius;
    const len = Math.hypot(dx, dy);
    if (len < DEAD_ZONE) return [0, 0];
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    return [dx, dy];
  }

  // ───────────── Desenho ─────────────

  private draw(): void {
    const g = this.g;
    g.clear();
    if (!this.visible) return;
    const r = this.radius;
    for (const [stick, color] of [[this.move, 0xe8e2c8], [this.aim, touchInput.firing ? 0xe0503c : 0xe8e2c8]] as const) {
      const active = stick.pointerId !== null;
      const [vx, vy] = this.vector(stick);
      g.fillStyle(0x000000, active ? 0.3 : 0.15).fillCircle(stick.baseX, stick.baseY, r);
      g.lineStyle(2, color, active ? 0.55 : 0.25).strokeCircle(stick.baseX, stick.baseY, r);
      if (stick === this.aim) g.lineStyle(1, 0xe0503c, 0.3).strokeCircle(stick.baseX, stick.baseY, r * FIRE_THRESHOLD);
      g.fillStyle(color, active ? 0.6 : 0.3).fillCircle(stick.baseX + vx * r, stick.baseY + vy * r, r * 0.42);
    }
    for (const b of this.buttons) {
      const held = b.pointerId !== null;
      g.fillStyle(b.color, held ? 0.55 : 0.25).fillCircle(b.x, b.y, b.r);
      g.lineStyle(2, b.color, held ? 0.9 : 0.55).strokeCircle(b.x, b.y, b.r);
    }
  }
}
