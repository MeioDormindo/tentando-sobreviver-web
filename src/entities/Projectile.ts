import Phaser from 'phaser';
import { FX_KEYS } from '../config/assets.config';
import { DEPTH } from '../config/visual.config';

const BODY_RADIUS = 3;

/** Projétil reutilizável (pool via Physics Group), desenhado como traçante luminoso. */
export class Projectile extends Phaser.Physics.Arcade.Image {
  damage = 0;
  /** Zumbis que ainda pode atravessar. */
  pierceLeft = 0;
  private readonly hits = new Set<object>();

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

  fire(x: number, y: number, angle: number, speed: number, range: number, damage: number, pierce = 0, tint = 0xffffff): void {
    this.pierceLeft = pierce;
    this.hits.clear();
    this.setTint(tint);
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

  /** Já atingiu este alvo? (evita acertar o mesmo zumbi em frames seguidos ao atravessar). */
  hasHit(target: object): boolean {
    return this.hits.has(target);
  }

  /** Registra o acerto; retorna true se o projétil deve parar aqui. */
  registerHit(target: object): boolean {
    this.hits.add(target);
    if (this.pierceLeft > 0) {
      this.pierceLeft--;
      return false;
    }
    return true;
  }

  kill(): void {
    this.disableBody(true, true);
  }
}
