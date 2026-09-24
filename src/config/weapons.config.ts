import type { ElementId } from './elements.config';
import type { MapId } from './maps.config';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

/** Tipo visual: define a pose do jogador, a maleta de compra e a posição do cano. */
export type WeaponKind =
  | 'pistol' | 'smg' | 'rifle' | 'ak' | 'shotgun' | 'launcher' | 'flamer' | 'arc' | 'energy'
  // Hospital: revólver, sniper, duas Uzis, metralhadora giratória e o Canhão de Vento
  | 'revolver' | 'sniper' | 'akimbo' | 'lmg' | 'wind';

/**
 * Disparo especial (armas exclusivas da Mystery Box, GDD §44). Sem isto, a arma
 * dispara projéteis comuns.
 */
export type SpecialFire =
  /** Granada: explode ao bater em algo ou no fim do alcance (não fere o jogador). */
  | { type: 'grenade'; blastRadius: number; blastDamage: number }
  /** Chama: jato curto que incendeia (dano por segundo durante burnMs). */
  | { type: 'flame'; burnDps: number; burnMs: number }
  /** Raio elétrico instantâneo que salta entre alvos próximos e os atordoa. */
  | { type: 'arc'; chains: number; chainRange: number; chainFalloff: number; stunMs: number }
  /** Esfera de plasma: atravessa tudo e explode numa descarga ao bater na parede. */
  | { type: 'plasma'; blastRadius: number; blastDamage: number; stunMs: number }
  /** Rajada de vento em cone (arma-maravilha): arremessa e fere tudo à frente, sem projétil. */
  | { type: 'gust'; range: number; arcDeg: number; damage: number; knockback: number };

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
  /** Quantos zumbis extras o projétil atravessa (0 = para no primeiro). */
  pierce?: number;
  /** Cor do traçante (padrão: amarelado). */
  tracerTint?: number;
  /** Só sai na Mystery Box (não é vendida nas maletas). */
  boxOnly?: boolean;
  /** Versão melhorada pelo Weapon Lab (Mk II ou Mk III). */
  upgraded?: boolean;
  /** Nível no Weapon Lab: 0 normal, 1 Mk II, 2 Mk III. */
  upgradeLevel?: number;
  /** Elemento vendido na maleta desta arma (comprado à parte). */
  element?: ElementId;
  special?: SpecialFire;
  /** Multiplicador do headshot desta arma (padrão: o global de headshotConfig). */
  headshotMultiplier?: number;
  /** Tempo girando o cano antes do primeiro tiro, com o gatilho seguro (ms). */
  spinUpMs?: number;
  /** Fração da velocidade do jogador enquanto atira. */
  moveSlowWhileFiring?: number;
  /** Duas armas: os tiros alternam entre o cano da esquerda e o da direita. */
  akimbo?: boolean;
  /** Só aparece na Mystery Box destes mapas (ausente = todos). */
  maps?: MapId[];
  /** Nome da versão Mk II, quando é especial (Canhão de Vento → Tornado). */
  upgradeName?: string;
}

/**
 * Armas do GDD §26. Pente/reserva/preço do GDD; cadência, recarga, dispersão e alcance
 * ajustados na Fase 12 (as espingardas ganharam dano por chumbo e recarga menor).
 */
export const weapons: Record<string, WeaponConfig> = {
  m1911: {
    id: 'm1911', name: 'M1911', kind: 'pistol',
    damage: 35, fireRate: 250, magazineSize: 8, reserveAmmo: 80, reloadTime: 1400,
    spread: 2, range: 700, projectileSpeed: 1100, pellets: 1, automatic: false,
    price: 0, ammoPrice: 250, rarity: 'common', element: 'light',
  },
  glock: {
    id: 'glock', name: 'Glock 17', kind: 'pistol',
    damage: 25, fireRate: 140, magazineSize: 17, reserveAmmo: 136, reloadTime: 1300,
    spread: 2.5, range: 650, projectileSpeed: 1100, pellets: 1, automatic: false,
    price: 500, ammoPrice: 250, rarity: 'common', element: 'shadow',
  },
  mp5: {
    id: 'mp5', name: 'MP5', kind: 'smg',
    damage: 24, fireRate: 85, magazineSize: 30, reserveAmmo: 180, reloadTime: 2000,
    spread: 4, range: 650, projectileSpeed: 1150, pellets: 1, automatic: true,
    price: 1200, ammoPrice: 600, rarity: 'uncommon', element: 'ice',
  },
  vector: {
    id: 'vector', name: 'Vector', kind: 'smg',
    damage: 20, fireRate: 55, magazineSize: 33, reserveAmmo: 198, reloadTime: 1800,
    spread: 5, range: 550, projectileSpeed: 1150, pellets: 1, automatic: true,
    price: 1800, ammoPrice: 900, rarity: 'rare', element: 'lightning',
  },
  m4: {
    id: 'm4', name: 'M4', kind: 'rifle',
    damage: 32, fireRate: 95, magazineSize: 30, reserveAmmo: 180, reloadTime: 2200,
    spread: 2.5, range: 900, projectileSpeed: 1300, pellets: 1, automatic: true,
    price: 1800, ammoPrice: 900, rarity: 'rare', element: 'fire',
  },
  ak: {
    id: 'ak', name: 'AK', kind: 'ak',
    damage: 42, fireRate: 120, magazineSize: 30, reserveAmmo: 180, reloadTime: 2400,
    spread: 3.5, range: 900, projectileSpeed: 1300, pellets: 1, automatic: true,
    price: 2000, ammoPrice: 1000, rarity: 'rare', element: 'explosive',
  },
  pump: {
    id: 'pump', name: 'Pump Shotgun', kind: 'shotgun',
    damage: 20, fireRate: 850, magazineSize: 6, reserveAmmo: 48, reloadTime: 2200,
    spread: 9, range: 320, projectileSpeed: 1000, pellets: 8, automatic: false,
    price: 1500, ammoPrice: 750, rarity: 'uncommon', element: 'fire',
  },
  combat_shotgun: {
    id: 'combat_shotgun', name: 'Combat Shotgun', kind: 'shotgun',
    damage: 16, fireRate: 320, magazineSize: 8, reserveAmmo: 64, reloadTime: 2400,
    spread: 8, range: 360, projectileSpeed: 1000, pellets: 7, automatic: false,
    price: 2200, ammoPrice: 1100, rarity: 'rare', element: 'ice',
  },
  // Exclusivas da Mystery Box (preenchem as raridades épica e lendária)
  rpk: {
    id: 'rpk', name: 'RPK', kind: 'ak',
    damage: 40, fireRate: 90, magazineSize: 75, reserveAmmo: 300, reloadTime: 3800,
    spread: 4, range: 900, projectileSpeed: 1300, pellets: 1, automatic: true,
    price: 0, ammoPrice: 1500, rarity: 'epic', boxOnly: true,
  },
  rail: {
    id: 'rail', name: 'Rail Weapon', kind: 'rifle',
    damage: 420, fireRate: 900, magazineSize: 4, reserveAmmo: 28, reloadTime: 2600,
    spread: 0.5, range: 1400, projectileSpeed: 2400, pellets: 1, automatic: false,
    price: 0, ammoPrice: 2500, rarity: 'legendary', boxOnly: true, pierce: 8, tracerTint: 0x7fe7ff,
  },
  // Armas especiais (GDD §44): mecânicas próprias, só na Mystery Box
  grenade_launcher: {
    id: 'grenade_launcher', name: 'Grenade Launcher', kind: 'launcher',
    damage: 60, fireRate: 650, magazineSize: 6, reserveAmmo: 30, reloadTime: 3000,
    spread: 1.5, range: 560, projectileSpeed: 620, pellets: 1, automatic: false,
    price: 0, ammoPrice: 2000, rarity: 'epic', boxOnly: true,
    special: { type: 'grenade', blastRadius: 105, blastDamage: 220 },
  },
  flamethrower: {
    id: 'flamethrower', name: 'Flamethrower', kind: 'flamer',
    damage: 7, fireRate: 45, magazineSize: 120, reserveAmmo: 480, reloadTime: 3200,
    spread: 11, range: 230, projectileSpeed: 450, pellets: 2, automatic: true,
    price: 0, ammoPrice: 2000, rarity: 'epic', boxOnly: true, pierce: 99,
    special: { type: 'flame', burnDps: 45, burnMs: 2600 },
  },
  arc_gun: {
    id: 'arc_gun', name: 'Arc Gun', kind: 'arc',
    damage: 95, fireRate: 260, magazineSize: 24, reserveAmmo: 144, reloadTime: 2600,
    spread: 0, range: 480, projectileSpeed: 0, pellets: 1, automatic: true,
    price: 0, ammoPrice: 2000, rarity: 'epic', boxOnly: true, tracerTint: 0x7fd8ff,
    special: { type: 'arc', chains: 5, chainRange: 170, chainFalloff: 0.85, stunMs: 700 },
  },
  energy_cannon: {
    id: 'energy_cannon', name: 'Energy Cannon', kind: 'energy',
    damage: 320, fireRate: 1100, magazineSize: 3, reserveAmmo: 18, reloadTime: 3200,
    spread: 0, range: 1100, projectileSpeed: 760, pellets: 1, automatic: false,
    price: 0, ammoPrice: 3000, rarity: 'legendary', boxOnly: true, pierce: 999, tracerTint: 0x6ff0ff,
    special: { type: 'plasma', blastRadius: 130, blastDamage: 280, stunMs: 600 },
  },
  // ── Hospital Santa Luzia ──
  magnum: {
    id: 'magnum', name: 'Magnum .44', kind: 'revolver',
    damage: 140, fireRate: 420, magazineSize: 6, reserveAmmo: 48, reloadTime: 2100,
    spread: 1, range: 900, projectileSpeed: 1400, pellets: 1, automatic: false,
    price: 1500, ammoPrice: 750, rarity: 'rare', pierce: 1, headshotMultiplier: 3, element: 'lightning',
  },
  barrett: {
    id: 'barrett', name: 'Barrett .50', kind: 'sniper',
    damage: 450, fireRate: 1200, magazineSize: 5, reserveAmmo: 30, reloadTime: 2800,
    spread: 0.3, range: 1500, projectileSpeed: 2200, pellets: 1, automatic: false,
    price: 3000, ammoPrice: 1500, rarity: 'epic', pierce: 5, tracerTint: 0xfff2c0, element: 'explosive',
  },
  uzi_dual: {
    id: 'uzi_dual', name: 'Uzi Dupla', kind: 'akimbo',
    damage: 26, fireRate: 55, magazineSize: 64, reserveAmmo: 320, reloadTime: 2300,
    spread: 5, range: 520, projectileSpeed: 1000, pellets: 1, automatic: true,
    price: 2000, ammoPrice: 1000, rarity: 'rare', akimbo: true, element: 'shadow',
  },
  minigun: {
    id: 'minigun', name: 'Minigun', kind: 'lmg',
    damage: 32, fireRate: 45, magazineSize: 150, reserveAmmo: 450, reloadTime: 4000,
    spread: 4, range: 750, projectileSpeed: 1300, pellets: 1, automatic: true,
    price: 0, ammoPrice: 3000, rarity: 'epic', boxOnly: true, tracerTint: 0xffd070,
    spinUpMs: 700, moveSlowWhileFiring: 0.55,
  },
  wind_cannon: {
    id: 'wind_cannon', name: 'Canhão de Vento', kind: 'wind',
    damage: 0, fireRate: 900, magazineSize: 2, reserveAmmo: 12, reloadTime: 2600,
    spread: 0, range: 340, projectileSpeed: 0, pellets: 1, automatic: false,
    price: 0, ammoPrice: 4000, rarity: 'legendary', boxOnly: true, maps: ['map2'], tracerTint: 0x9fe8ff,
    upgradeName: 'Tornado',
    special: { type: 'gust', range: 340, arcDeg: 70, damage: 1500, knockback: 900 },
  },
};

/** Nível máximo no Weapon Lab (2 = Mk III). */
export const MAX_UPGRADE_LEVEL = 2;

/** Mk III: dobra os projéteis de todas as armas (espingardas, lança-chamas, granadas, raios...). */
export const weaponUpgradeMk3 = {
  pelletMultiplier: 2,
  /** Espalhamento extra (graus) para os projéteis dobrados não saírem sobrepostos. */
  extraSpread: 2.5,
  tracerTint: 0xffd35a,
};

/** Melhoria do Weapon Lab (GDD §38): "M4" → "M4 Mk II". */
export const weaponUpgrade = {
  damage: 1.8,
  magazine: 1.5,
  reserve: 1.5,
  reload: 0.75,
  fireRate: 0.9,
  tracerTint: 0xc38bff,
};

/** Próximo nível do Weapon Lab: normal → Mk II → Mk III. */
export function upgradeWeaponConfig(cfg: WeaponConfig): WeaponConfig {
  const level = cfg.upgradeLevel ?? (cfg.upgraded ? 1 : 0);
  if (level >= MAX_UPGRADE_LEVEL) return cfg;
  return level === 0 ? toMk2(cfg) : toMk3(cfg);
}

/** Mk III: mesmos atributos do Mk II, projéteis em dobro e traçante dourado. */
function toMk3(cfg: WeaponConfig): WeaponConfig {
  const u = weaponUpgradeMk3;
  return {
    ...cfg,
    name: / Mk II$/.test(cfg.name) ? cfg.name.replace(/ Mk II$/, ' Mk III') : `${cfg.name} Mk III`,
    pellets: cfg.pellets * u.pelletMultiplier,
    spread: cfg.spread + u.extraSpread,
    tracerTint: u.tracerTint,
    upgraded: true,
    upgradeLevel: 2,
  };
}

function toMk2(cfg: WeaponConfig): WeaponConfig {
  const u = weaponUpgrade;
  return {
    ...cfg,
    special: cfg.special && upgradeSpecial(cfg.special),
    name: cfg.upgradeName ?? `${cfg.name} Mk II`,
    damage: Math.round(cfg.damage * u.damage),
    magazineSize: Math.round(cfg.magazineSize * u.magazine),
    reserveAmmo: Math.round(cfg.reserveAmmo * u.reserve),
    reloadTime: Math.round(cfg.reloadTime * u.reload),
    fireRate: Math.round(cfg.fireRate * u.fireRate),
    pierce: (cfg.pierce ?? 0) + 1,
    tracerTint: u.tracerTint,
    upgraded: true,
    upgradeLevel: 1,
  };
}

/** O Lab também fortalece a mecânica especial (explosão, queima, saltos do raio). */
function upgradeSpecial(sp: SpecialFire): SpecialFire {
  const d = weaponUpgrade.damage;
  switch (sp.type) {
    case 'grenade':
    case 'plasma':
      return { ...sp, blastDamage: Math.round(sp.blastDamage * d), blastRadius: Math.round(sp.blastRadius * 1.15) };
    case 'flame':
      return { ...sp, burnDps: Math.round(sp.burnDps * d) };
    case 'arc':
      return { ...sp, chains: sp.chains + 3 };
    case 'gust':
      // Tornado: cone maior e mais longo.
      return { ...sp, damage: Math.round(sp.damage * d), range: Math.round(sp.range * 1.25), arcDeg: sp.arcDeg + 15 };
  }
}

export function getWeaponConfig(id: string): WeaponConfig {
  const cfg = weapons[id];
  if (!cfg) throw new Error(`Arma desconhecida: ${id}`);
  return cfg;
}

/** Arma largada no chão ao pegar outra: some depois disto (ms) e pisca a partir de blinkAtMs. */
export const weaponDropConfig = {
  lifetimeMs: 60_000,
  blinkAtMs: 50_000,
};

/** Quantas armas o jogador carrega ao mesmo tempo. */
export const INVENTORY_SLOTS = 2;
/** Tempo para trocar de arma (ms). */
export const WEAPON_SWITCH_MS = 350;

/** Faca (V, botão direito do mouse ou botão FACA no celular). */
export const knifeConfig = {
  damage: 150,
  /** Alcance do golpe (px, do centro do jogador) e abertura do arco (graus). */
  range: 48,
  arcDeg: 120,
  /** Tempo mínimo entre golpes (ms). */
  cooldownMs: 1000,
  /** Tempo entre o início do golpe e o acerto (ms); as armas ficam paradas por busyMs. */
  windupMs: 70,
  busyMs: 380,
  /** Avanço: se houver um alvo à frente até esta distância, o jogador avança até ele. */
  lungeRange: 120,
  lungeSpeed: 560,
  lungeMs: 130,
  knockback: 260,
};
