import { MAX_UPGRADE_LEVEL, upgradeWeaponConfig, type WeaponConfig } from '../config/weapons.config';
import type { AmmoPayload } from '../game/events';
import { elements, type ElementId } from '../config/elements.config';

/**
 * Estado de uma arma (munição, cadência, recarga). Não conhece input nem projéteis:
 * toda arma usa esta mesma lógica, variando apenas o WeaponConfig.
 */
export class Weapon {
  private cfg: WeaponConfig;
  currentAmmo: number;
  reserveAmmo: number;
  /** Elemento comprado na parede (continua depois do Weapon Lab). */
  element: ElementId | null = null;

  private nextFireAt = 0;
  private reloadEndsAt: number | null = null;

  constructor(config: WeaponConfig) {
    this.cfg = config;
    this.currentAmmo = config.magazineSize;
    this.reserveAmmo = config.reserveAmmo;
  }

  get config(): WeaponConfig {
    return this.cfg;
  }

  /** Nível no Weapon Lab (0 normal, 1 Mk II, 2 Mk III). */
  get level(): number {
    return this.cfg.upgradeLevel ?? 0;
  }

  /** Weapon Lab: sobe um nível (Mk II → Mk III) com pente e reserva cheios. */
  upgrade(): boolean {
    if (this.level >= MAX_UPGRADE_LEVEL) return false;
    this.cfg = upgradeWeaponConfig(this.cfg);
    this.reloadEndsAt = null;
    this.currentAmmo = this.cfg.magazineSize;
    this.reserveAmmo = this.cfg.reserveAmmo;
    return true;
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

  /** Inicia a recarga; retorna a duração (ms) ou 0 se não pôde recarregar. */
  startReload(time: number, speedMultiplier = 1): number {
    if (!this.canReload()) return 0;
    const duration = this.config.reloadTime * speedMultiplier;
    this.reloadEndsAt = time + duration;
    return duration;
  }

  cancelReload(): void {
    this.reloadEndsAt = null;
  }

  update(time: number): void {
    if (this.reloadEndsAt === null || time < this.reloadEndsAt) return;
    const needed = this.config.magazineSize - this.currentAmmo;
    const loaded = Math.min(needed, this.reserveAmmo);
    this.currentAmmo += loaded;
    this.reserveAmmo -= loaded;
    this.reloadEndsAt = null;
  }

  /** Enche a reserva até o máximo da arma. */
  refillReserve(): void {
    this.reserveAmmo = this.config.reserveAmmo;
  }

  snapshot(): Omit<AmmoPayload, 'secondary'> {
    return {
      weaponName: this.config.name,
      element: this.element ? { icon: elements[this.element].icon, name: elements[this.element].name, color: elements[this.element].color } : null,
      current: this.currentAmmo,
      reserve: this.reserveAmmo,
      reloading: this.isReloading,
    };
  }
}
