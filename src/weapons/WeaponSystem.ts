import Phaser from 'phaser';
import type { WeaponConfig } from '../config/weapons.config';
import type { Player } from '../entities/Player';
import { Projectile } from '../entities/Projectile';
import type { EffectsSystem } from '../effects/EffectsSystem';
import { emitGameEvent, GameEvents } from '../game/events';
import { Weapon } from './Weapon';

/** Distância do centro do player até a ponta do cano (px do mundo), conforme o sprite. */
const BARREL_LENGTH = 25;
/** Ponto de ejeção das cápsulas, à frente do tronco. */
const EJECT_DISTANCE = 16;

/**
 * Liga o input do jogador à arma equipada e dispara projéteis do pool.
 * Preparado para inventário de várias armas (Fase 3): troca-se apenas `weapon`.
 */
export class WeaponSystem {
  private readonly scene: Phaser.Scene;
  private readonly owner: Player;
  private readonly projectiles: Phaser.Physics.Arcade.Group;
  private readonly effects: EffectsSystem;
  private weapon: Weapon;
  /** Semi-automática: o gatilho precisa ser solto entre disparos. */
  private triggerConsumed = false;
  private lastSnapshotKey = '';

  constructor(
    scene: Phaser.Scene,
    owner: Player,
    projectiles: Phaser.Physics.Arcade.Group,
    config: WeaponConfig,
    effects: EffectsSystem,
  ) {
    this.scene = scene;
    this.owner = owner;
    this.projectiles = projectiles;
    this.weapon = new Weapon(config);
    this.effects = effects;

    scene.input.keyboard?.on('keydown-R', this.onReloadKey, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.input.keyboard?.off('keydown-R', this.onReloadKey, this);
    });
  }

  get current(): Weapon {
    return this.weapon;
  }

  update(time: number): void {
    this.weapon.update(time);

    if (this.owner.isAlive) {
      const triggerDown = this.scene.input.activePointer.leftButtonDown();
      if (!triggerDown) {
        this.triggerConsumed = false;
      } else if (this.weapon.config.automatic || !this.triggerConsumed) {
        this.tryFire(time);
      }
    }

    this.emitIfChanged();
  }

  /** Enche a reserva da arma equipada. */
  refillAmmo(): void {
    this.weapon.refillReserve();
    this.emitIfChanged();
  }

  /** Reenvia o estado atual para a HUD. */
  syncHud(): void {
    this.lastSnapshotKey = '';
    this.emitIfChanged();
  }

  private onReloadKey(): void {
    if (this.owner.isAlive) this.startReload(this.scene.time.now);
  }

  private tryFire(time: number): void {
    const weapon = this.weapon;
    if (weapon.isReloading) return;

    if (weapon.currentAmmo === 0) {
      // Pente vazio: recarrega automaticamente; sem reserva, "clique seco".
      this.startReload(time);
      this.triggerConsumed = true;
      return;
    }
    if (!weapon.canFire(time)) return;

    weapon.consume(time);
    this.triggerConsumed = true;
    this.spawnProjectiles();
    this.owner.playShoot();

    if (weapon.currentAmmo === 0) this.startReload(time);
  }

  private startReload(time: number): void {
    if (this.weapon.startReload(time)) this.owner.playReload(this.weapon.config.reloadTime);
  }

  private spawnProjectiles(): void {
    const cfg = this.weapon.config;
    const aim = this.owner.rotation;
    const tipX = this.owner.x + Math.cos(aim) * BARREL_LENGTH;
    const tipY = this.owner.y + Math.sin(aim) * BARREL_LENGTH;

    for (let i = 0; i < cfg.pellets; i++) {
      const projectile = this.projectiles.get(tipX, tipY) as Projectile | null;
      if (!projectile) return; // pool esgotado
      const spread = Phaser.Math.DegToRad(Phaser.Math.FloatBetween(-cfg.spread, cfg.spread));
      projectile.fire(tipX, tipY, aim + spread, cfg.projectileSpeed, cfg.range, cfg.damage);
    }
    this.effects.muzzleFlash(tipX, tipY, aim);
    this.effects.ejectShell(
      this.owner.x + Math.cos(aim) * EJECT_DISTANCE,
      this.owner.y + Math.sin(aim) * EJECT_DISTANCE,
      aim,
    );
  }

  private emitIfChanged(): void {
    const snap = this.weapon.snapshot();
    const key = `${snap.weaponName}|${snap.current}|${snap.reserve}|${snap.reloading}`;
    if (key === this.lastSnapshotKey) return;
    this.lastSnapshotKey = key;
    emitGameEvent(this.scene.game.events, GameEvents.AmmoChanged, snap);
  }
}
