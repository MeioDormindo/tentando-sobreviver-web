export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface WeaponConfig {
  id: string;
  name: string;
  damage: number;
  /** Intervalo mínimo entre disparos (ms). */
  fireRate: number;
  magazineSize: number;
  reserveAmmo: number;
  /** Tempo de recarga (ms). */
  reloadTime: number;
  /** Desvio máximo do disparo (graus, para cada lado). */
  spread: number;
  /** Alcance máximo do projétil (px). */
  range: number;
  projectileSpeed: number;
  /** Projéteis por disparo (shotguns > 1). */
  pellets: number;
  /** true = segurar o botão dispara continuamente. */
  automatic: boolean;
  price: number;
  rarity: Rarity;
}

export const weapons: Record<string, WeaponConfig> = {
  m1911: {
    id: 'm1911',
    name: 'M1911',
    damage: 35,
    fireRate: 250,
    magazineSize: 8,
    reserveAmmo: 80,
    reloadTime: 1400,
    spread: 2,
    range: 700,
    projectileSpeed: 1100,
    pellets: 1,
    automatic: false,
    price: 0,
    rarity: 'common',
  },
};

export function getWeaponConfig(id: string): WeaponConfig {
  const cfg = weapons[id];
  if (!cfg) throw new Error(`Arma desconhecida: ${id}`);
  return cfg;
}
