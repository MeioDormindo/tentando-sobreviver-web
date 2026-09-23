import Phaser from 'phaser';
import { FX_KEYS } from '../config/assets.config';
import { DEPTH } from '../config/visual.config';
import type { SpecialFire } from '../config/weapons.config';

const TRACER_RADIUS = 3;
/** Raio de colisão de cada tipo especial (px da textura). */
const SPECIAL_RADIUS = { grenade: 5, flame: 8, plasma: 10 } as const;
/** Crescimento da chama ao longo do alcance (escala inicial → final). */
const FLAME_SCALE = { from: 0.5, to: 2.3 };
const GRENADE_SPIN = 0.35;

/** Evento da cena emitido quando uma granada/esfera de plasma chega ao fim do alcance. */
export const PROJECTILE_BURST = 'projectile-burst';

type ProjectileSpecial = Extract<SpecialFire, { type: 'grenade' | 'flame' | 'plasma' }>;

export interface ProjectileShot {
  x: number;
  y: number;
  angle: number;
  speed: number;
  range: number;
  damage: number;
  /** Zumbis extras que atravessa. */
  pierce?: number;
  tint?: number;
  special?: ProjectileSpecial;
  /** Multiplicador de dano do atirador (perks), também aplicado à explosão/queima. */
  damageScale?: number;
}

/** Projétil reutilizável (pool via Physics Group): traçante, granada, chama ou plasma. */
export class Projectile extends Phaser.Physics.Arcade.Image {
  damage = 0;
  /** Zumbis que ainda pode atravessar. */
  pierceLeft = 0;
  special: ProjectileSpecial | null = null;
  damageScale = 1;
  private readonly hits = new Set<object>();

  private startX = 0;
  private startY = 0;
  private range = 0;
  private heading = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, FX_KEYS.tracer);
    this.setDepth(DEPTH.tracers);
  }

  get angleOfTravel(): number {
    return this.heading;
  }

  /** Granada e plasma explodem ao parar. */
  get bursts(): boolean {
    return this.special?.type === 'grenade' || this.special?.type === 'plasma';
  }

  fire(shot: ProjectileShot): void {
    this.special = shot.special ?? null;
    this.damageScale = shot.damageScale ?? 1;
    this.pierceLeft = shot.pierce ?? 0;
    this.hits.clear();
    this.setAppearance(shot.tint ?? 0xffffff);
    this.enableBody(true, shot.x, shot.y, true, true);
    if (this.special) {
      const r = SPECIAL_RADIUS[this.special.type];
      this.setCircle(r, this.width / 2 - r, this.height / 2 - r);
    } else {
      const r = TRACER_RADIUS;
      this.setCircle(r, this.width - r * 2, this.height / 2 - r);
    }
    this.rotation = shot.angle;
    this.heading = shot.angle;
    this.startX = shot.x;
    this.startY = shot.y;
    this.range = shot.range;
    this.damage = shot.damage;
    this.scene.physics.velocityFromRotation(shot.angle, shot.speed, this.body?.velocity);
  }

  override update(): void {
    if (!this.active) return;
    const travelled = Phaser.Math.Distance.Between(this.startX, this.startY, this.x, this.y);
    const t = Math.min(1, travelled / this.range);
    switch (this.special?.type) {
      case 'flame':
        this.setScale(Phaser.Math.Linear(FLAME_SCALE.from, FLAME_SCALE.to, t)).setAlpha(1 - t * 0.85);
        break;
      case 'grenade':
        this.rotation += GRENADE_SPIN;
        break;
      case 'plasma':
        this.setScale(1 + 0.15 * Math.sin(this.scene.time.now / 40));
        break;
    }
    if (travelled > this.range) {
      if (this.bursts) this.scene.events.emit(PROJECTILE_BURST, this);
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

  private setAppearance(tint: number): void {
    this.setScale(1).setAlpha(1);
    switch (this.special?.type) {
      case 'grenade':
        this.setTexture(FX_KEYS.grenade).setOrigin(0.5).clearTint().setBlendMode(Phaser.BlendModes.NORMAL);
        break;
      case 'flame':
        this.setTexture(FX_KEYS.flame).setOrigin(0.5).clearTint().setBlendMode(Phaser.BlendModes.ADD);
        break;
      case 'plasma':
        this.setTexture(FX_KEYS.plasma).setOrigin(0.5).setTint(tint).setBlendMode(Phaser.BlendModes.ADD);
        break;
      default:
        // A ponta brilhante fica na posição real do projétil; a cauda se estende para trás.
        this.setTexture(FX_KEYS.tracer).setOrigin(1, 0.5).setTint(tint).setBlendMode(Phaser.BlendModes.ADD);
    }
  }
}
