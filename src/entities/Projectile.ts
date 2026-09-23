import Phaser from 'phaser';
import { FX_KEYS } from '../config/assets.config';
import { DEPTH } from '../config/visual.config';

const BODY_RADIUS = 3;

/** Projétil reutilizável (pool via Physics Group), desenhado como traçante luminoso. */
export class Projectile extends Phaser.Physics.Arcade.Image {
  damage = 0;

  private startX = 0;
  private startY = 0;
  private range = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, FX_KEYS.tracer);
    // A ponta brilhante fica na posição real do projétil; a cauda se estende para trás.
    this.setOrigin(1, 0.5);
    this.setDepth(DEPTH.tracers);
    this.setBlendMode(Phaser.BlendModes.ADD);
  }

  get angleOfTravel(): number {
    return this.rotation;
  }

  fire(x: number, y: number, angle: number, speed: number, range: number, damage: number): void {
    this.enableBody(true, x, y, true, true);
    const r = BODY_RADIUS;
    this.setCircle(r, this.width - r * 2, this.height / 2 - r);
    this.rotation = angle;
    this.startX = x;
    this.startY = y;
    this.range = range;
    this.damage = damage;
    this.scene.physics.velocityFromRotation(angle, speed, this.body?.velocity);
  }

  override update(): void {
    if (!this.active) return;
    if (Phaser.Math.Distance.Between(this.startX, this.startY, this.x, this.y) > this.range) {
      this.kill();
    }
  }

  kill(): void {
    this.disableBody(true, true);
  }
}
