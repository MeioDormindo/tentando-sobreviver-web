export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

/** Tipo visual: define a pose do jogador, a maleta de compra e a posição do cano. */
export type WeaponKind = 'pistol' | 'smg' | 'rifle' | 'ak' | 'shotgun';

export interface WeaponConfig {
  id: string;
  name: string;
  kind: WeaponKind;
  /** Dano por projétil (em espingardas, por chumbo). */
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
  /** Projéteis por disparo (espingardas > 1). */
  pellets: number;
  /** true = segurar o botão dispara continuamente. */
  automatic: boolean;
  /** Preço na maleta de compra (0 = arma inicial). */
  price: number;
  /** Preço para reabastecer a munição. */
  ammoPrice: number;
  rarity: Rarity;
}

/**
 * Armas do GDD §26. Valores de dano/pente/reserva/preço do GDD; cadência, recarga,
 * dispersão e alcance são placeholders para o balanceamento da Fase 12.
 */
export const weapons: Record<string, WeaponConfig> = {
  m1911: {
    id: 'm1911', name: 'M1911', kind: 'pistol',
    damage: 35, fireRate: 250, magazineSize: 8, reserveAmmo: 80, reloadTime: 1400,
    spread: 2, range: 700, projectileSpeed: 1100, pellets: 1, automatic: false,
    price: 0, ammoPrice: 250, rarity: 'common',
  },
  glock: {
    id: 'glock', name: 'Glock 17', kind: 'pistol',
    damage: 25, fireRate: 140, magazineSize: 17, reserveAmmo: 136, reloadTime: 1300,
    spread: 2.5, range: 650, projectileSpeed: 1100, pellets: 1, automatic: false,
    price: 500, ammoPrice: 250, rarity: 'common',
  },
  mp5: {
    id: 'mp5', name: 'MP5', kind: 'smg',
    damage: 24, fireRate: 85, magazineSize: 30, reserveAmmo: 180, reloadTime: 2000,
    spread: 4, range: 650, projectileSpeed: 1150, pellets: 1, automatic: true,
    price: 1200, ammoPrice: 600, rarity: 'uncommon',
  },
  vector: {
    id: 'vector', name: 'Vector', kind: 'smg',
    damage: 20, fireRate: 55, magazineSize: 33, reserveAmmo: 198, reloadTime: 1800,
    spread: 5, range: 550, projectileSpeed: 1150, pellets: 1, automatic: true,
    price: 1800, ammoPrice: 900, rarity: 'rare',
  },
  m4: {
    id: 'm4', name: 'M4', kind: 'rifle',
    damage: 32, fireRate: 95, magazineSize: 30, reserveAmmo: 180, reloadTime: 2200,
    spread: 2.5, range: 900, projectileSpeed: 1300, pellets: 1, automatic: true,
    price: 1800, ammoPrice: 900, rarity: 'rare',
  },
  ak: {
    id: 'ak', name: 'AK', kind: 'ak',
    damage: 42, fireRate: 120, magazineSize: 30, reserveAmmo: 180, reloadTime: 2400,
    spread: 3.5, range: 900, projectileSpeed: 1300, pellets: 1, automatic: true,
    price: 2000, ammoPrice: 1000, rarity: 'rare',
  },
  pump: {
    id: 'pump', name: 'Pump Shotgun', kind: 'shotgun',
    damage: 16, fireRate: 850, magazineSize: 6, reserveAmmo: 48, reloadTime: 2600,
    spread: 9, range: 320, projectileSpeed: 1000, pellets: 8, automatic: false,
    price: 1500, ammoPrice: 750, rarity: 'uncommon',
  },
  combat_shotgun: {
    id: 'combat_shotgun', name: 'Combat Shotgun', kind: 'shotgun',
    damage: 13, fireRate: 320, magazineSize: 8, reserveAmmo: 64, reloadTime: 2600,
    spread: 8, range: 360, projectileSpeed: 1000, pellets: 7, automatic: false,
    price: 2200, ammoPrice: 1100, rarity: 'rare',
  },
};

export function getWeaponConfig(id: string): WeaponConfig {
  const cfg = weapons[id];
  if (!cfg) throw new Error(`Arma desconhecida: ${id}`);
  return cfg;
}

/** Quantas armas o jogador carrega ao mesmo tempo. */
export const INVENTORY_SLOTS = 2;
/** Tempo para trocar de arma (ms). */
export const WEAPON_SWITCH_MS = 350;
