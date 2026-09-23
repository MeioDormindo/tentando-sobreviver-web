import type { WeaponConfig } from '../config/weapons.config';
import type { AmmoPayload } from '../game/events';

/**
 * Estado de uma arma (munição, cadência, recarga). Não conhece input nem projéteis:
 * toda arma usa esta mesma lógica, variando apenas o WeaponConfig.
 */
export class Weapon {
  readonly config: WeaponConfig;
  currentAmmo: number;
  reserveAmmo: number;

  private nextFireAt = 0;
  private reloadEndsAt: number | null = null;

  constructor(config: WeaponConfig) {
    this.config = config;
    this.currentAmmo = config.magazineSize;
    this.reserveAmmo = config.reserveAmmo;
  }

  get isReloading(): boolean {
    return this.reloadEndsAt !== null;
  }

  get isEmpty(): boolean {
    return this.currentAmmo === 0 && this.reserveAmmo === 0;
  }

  canFire(time: number): boolean {
    return !this.isReloading && this.currentAmmo > 0 && time >= this.nextFireAt;
  }

  /** Consome uma bala e aplica a cadência. Chamar somente após canFire(). */
  consume(time: number): void {
    this.currentAmmo--;
    this.nextFireAt = time + this.config.fireRate;
  }

  canReload(): boolean {
    return !this.isReloading && this.currentAmmo < this.config.magazineSize && this.reserveAmmo > 0;
  }

  startReload(time: number): boolean {
    if (!this.canReload()) return false;
    this.reloadEndsAt = time + this.config.reloadTime;
    return true;
  }

  update(time: number): void {
    if (this.reloadEndsAt === null || time < this.reloadEndsAt) return;
    const needed = this.config.magazineSize - this.currentAmmo;
    const loaded = Math.min(needed, this.reserveAmmo);
    this.currentAmmo += loaded;
    this.reserveAmmo -= loaded;
    this.reloadEndsAt = null;
  }

  snapshot(): AmmoPayload {
    return {
      weaponName: this.config.name,
      current: this.currentAmmo,
      reserve: this.reserveAmmo,
      reloading: this.isReloading,
    };
  }
}
