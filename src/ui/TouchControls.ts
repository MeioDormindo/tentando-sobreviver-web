import Phaser from 'phaser';
import { uiPointer } from './uiScale';
import { touchInput, type TouchAction } from '../input/touchInput';

const DEAD_ZONE = 0.12;
const FONT = 'monospace';

interface Stick {
  pointerId: number | null;
  baseX: number;
  baseY: number;
  x: number;
  y: number;
}

/** Botão na tela; 'fire' fica ativo enquanto segurado, os demais disparam uma ação. */
interface Button {
  action: TouchAction | 'fire';
  label: string;
  x: number;
  y: number;
  r: number;
  color: number;
  pointerId: number | null;
  text: Phaser.GameObjects.Text;
}

/**
 * Controles de toque (celular):
 * - analógico esquerdo (metade esquerda) move;
 * - analógico direito (metade direita) gira a lanterna — o tiro sai sempre para onde ela aponta;
 * - ATIRAR (segurar) atira, com mira assistida no zumbi mais próximo do cone da lanterna;
 * - USAR (segurar repara), RECARREGAR, TROCAR e pausa.
 * Não há mira na tela: a própria lanterna é a mira.
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

  constructor(private readonly scene: Phaser.Scene) {
    touchInput.enabled = true;
    touchInput.release();
    // Até 4 dedos ao mesmo tempo (2 analógicos + botões).
    scene.input.addPointer(3);
    this.g = scene.add.graphics().setDepth(90);
    const defs: Array<[Button['action'], string, number]> = [
      ['fire', 'ATIRAR', 0xe0503c],
      ['interact', 'USAR', 0xc9a45c],
      ['reload', 'RECARR.', 0x8fa3b8],
      ['swap', 'TROCAR', 0x8fa3b8],
      ['knife', 'FACA', 0xb8b8b8],
      ['pause', 'II', 0x7a7d78],
    ];
    for (const [action, label, color] of defs) {
      const text = scene.add
        .text(0, 0, label, { fontFamily: FONT, fontSize: '13px', color: '#f0ece0', fontStyle: 'bold' })
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
    const br = Phaser.Math.Clamp(this.radius * 0.48, 24, 36);
    // ATIRAR grande no canto inferior direito (onde o polegar descansa); os outros acima dele.
    const fireR = br * 1.75;
    const fx = width - fireR - 16;
    const fy = height - fireR - 16;
    const place: Record<Button['action'], [number, number, number]> = {
      fire: [fx, fy, fireR],
      interact: [fx - fireR - br * 1.6, fy + fireR * 0.2, br * 1.1],
      reload: [fx + fireR * 0.25, fy - fireR - br * 1.2, br],
      swap: [fx - fireR * 0.95, fy - fireR - br * 0.6, br],
      knife: [fx - fireR - br * 2.4, fy - fireR * 1.05, br],
      pause: [width / 2, br * 0.9 + 4, br * 0.7],
    };
    for (const b of this.buttons) {
      [b.x, b.y, b.r] = place[b.action];
      b.text.setPosition(b.x, b.y).setFontSize(Math.round(b.r * (b.action === 'fire' ? 0.3 : 0.42)));
    }
    this.resetStick(this.move, this.moveHome()[0], this.moveHome()[1]);
    this.resetStick(this.aim, this.aimHome()[0], this.aimHome()[1]);
    this.draw();
  }

  private moveHome(): [number, number] {
    return [this.radius * 1.7, this.height - this.radius * 1.7];
  }

  /** Posição de repouso do analógico de mira: à esquerda dos botões. */
  private aimHome(): [number, number] {
    return [this.width * 0.62, this.height - this.radius * 1.5];
  }

  // ───────────── Toques ─────────────

  private onDown(p: Phaser.Input.Pointer): void {
    if (!this.visible) return;
    const { x, y } = uiPointer(this.scene, p);
    const button = this.buttons.find((b) => b.pointerId === null && Phaser.Math.Distance.Between(x, y, b.x, b.y) <= b.r * 1.15);
    if (button) {
      button.pointerId = p.id;
      if (button.action === 'fire') touchInput.firing = true;
      else {
        if (button.action === 'interact') touchInput.interactHeld = true;
        touchInput.press(button.action);
      }
      this.draw();
      return;
    }
    // Não pega toques no topo da tela (HUD) para não brigar com os botões da interface.
    if (y < this.height * 0.18) return;
    const stick = x < this.width / 2 ? this.move : this.aim;
    if (stick.pointerId !== null) return;
    stick.pointerId = p.id;
    stick.baseX = stick.x = x;
    stick.baseY = stick.y = y;
    this.apply();
  }

  private onMove(p: Phaser.Input.Pointer): void {
    for (const stick of [this.move, this.aim]) {
      if (stick.pointerId !== p.id) continue;
      const at = uiPointer(this.scene, p);
      stick.x = at.x;
      stick.y = at.y;
      this.apply();
    }
  }

  private onUp(p: Phaser.Input.Pointer): void {
    for (const b of this.buttons) {
      if (b.pointerId !== p.id) continue;
      b.pointerId = null;
      if (b.action === 'interact') touchInput.interactHeld = false;
      if (b.action === 'fire') touchInput.firing = false;
    }
    if (this.move.pointerId === p.id) this.resetStick(this.move, ...this.moveHome());
    if (this.aim.pointerId === p.id) this.resetStick(this.aim, ...this.aimHome());
    this.apply();
  }

  private releaseAll(): void {
    for (const b of this.buttons) b.pointerId = null;
    this.resetStick(this.move, ...this.moveHome());
    this.resetStick(this.aim, ...this.aimHome());
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
    for (const stick of [this.move, this.aim]) {
      const active = stick.pointerId !== null;
      // O analógico de mira só aparece enquanto está sendo usado (a lanterna já mostra a direção).
      if (stick === this.aim && !active) continue;
      const [vx, vy] = this.vector(stick);
      g.fillStyle(0x000000, active ? 0.3 : 0.15).fillCircle(stick.baseX, stick.baseY, r);
      g.lineStyle(2, 0xe8e2c8, active ? 0.55 : 0.25).strokeCircle(stick.baseX, stick.baseY, r);
      g.fillStyle(0xe8e2c8, active ? 0.6 : 0.3).fillCircle(stick.baseX + vx * r, stick.baseY + vy * r, r * 0.42);
    }
    for (const b of this.buttons) {
      const held = b.pointerId !== null;
      g.fillStyle(b.color, held ? 0.6 : b.action === 'fire' ? 0.35 : 0.25).fillCircle(b.x, b.y, b.r);
      g.lineStyle(b.action === 'fire' ? 3 : 2, b.color, held ? 0.95 : 0.6).strokeCircle(b.x, b.y, b.r);
    }
  }
}
