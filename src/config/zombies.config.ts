import type { MapId } from './maps.config';
export interface ExplosiveConfig {
  /** Dano no centro da explosão (cai até 30% na borda). */
  damage: number;
  radius: number;
  /** Distância do alvo em que o zumbi "arma" a explosão (px). */
  triggerRange: number;
  /** Tempo piscando antes de explodir (ms). */
  fuseMs: number;
}

/** Poça ou nuvem que fere o jogador enquanto ele estiver dentro (ácido, gás). */
export interface HazardPoolConfig {
  radius: number;
  durationMs: number;
  /** Dano por segundo ao jogador. */
  dps: number;
}

/** Ataque à distância (Cuspidor): para, prepara e cospe um projétil que vira poça. */
export interface RangedConfig {
  minRange: number;
  maxRange: number;
  cooldownMs: number;
  /** Tempo parado "carregando" o cuspe (aviso ao jogador). */
  windupMs: number;
  projectileSpeed: number;
  pool: HazardPoolConfig;
}

/** Armadura (Blindado): absorve o dano no corpo até quebrar; headshot derruba o capacete na hora. */
export interface ArmorConfig {
  hp: number;
  /** Fração do dano no corpo que passa para a vida enquanto há armadura. */
  bodyFactor: number;
  /** Aparência depois que a armadura cai. */
  brokenSkin: string;
}

export interface ZombieConfig {
  id: string;
  name: string;
  health: number;
  damage: number;
  /** Velocidade de perseguição em px/s. */
  speed: number;
  /** Distância em que o zumbi percebe o jogador (px). */
  detectRange: number;
  /** Distância entre centros para iniciar o ataque (px). */
  attackRange: number;
  /** Intervalo entre ataques (ms). */
  attackCooldown: number;
  bodyRadius: number;
  /** Recompensa em dinheiro por abate. */
  reward: number;
  /** Aparências possíveis (spritesheets). */
  skins: string[];
  /** Tábuas arrancadas por golpe numa barricada. */
  plankDamage: number;
  /** Pode ser empurrado por outros zumbis. */
  pushable: boolean;
  /** Explode ao chegar perto do alvo e ao morrer (Exploder). */
  explosive?: ExplosiveConfig;
  ranged?: RangedConfig;
  armor?: ArmorConfig;
  /** Nuvem de gás deixada ao morrer (Rastejante). */
  deathCloud?: HazardPoolConfig;
  /** Pega fogo ao morrer e não deixa corpo (Cão Infernal). */
  burnsOnDeath?: boolean;
}

/** Tipos de zumbi (GDD §28). Toda a lógica é a mesma classe Zombie; muda só a config. */
export const zombies: Record<string, ZombieConfig> = {
  walker: {
    id: 'walker',
    name: 'Walker',
    health: 100,
    damage: 10,
    speed: 60,
    // Modo horda: sempre sabe onde o jogador está (cobre o mapa inteiro).
    detectRange: 6000,
    attackRange: 30,
    attackCooldown: 1000,
    bodyRadius: 12,
    reward: 100,
    skins: ['a', 'b', 'c'],
    plankDamage: 1,
    pushable: true,
  },
  runner: {
    id: 'runner',
    name: 'Runner',
    health: 80,
    damage: 15,
    speed: 125,
    detectRange: 6000,
    attackRange: 30,
    attackCooldown: 750,
    bodyRadius: 12,
    reward: 125,
    skins: ['runner'],
    plankDamage: 1,
    pushable: true,
  },
  tank: {
    id: 'tank',
    name: 'Tank',
    health: 600,
    damage: 30,
    speed: 40,
    detectRange: 6000,
    attackRange: 38,
    attackCooldown: 1500,
    // Visualmente 40% maior, mas o corpo cabe em corredores de 1 tile.
    bodyRadius: 15,
    reward: 250,
    skins: ['tank'],
    plankDamage: 2,
    pushable: false,
  },
  exploder: {
    id: 'exploder',
    name: 'Exploder',
    health: 150,
    damage: 0,
    speed: 80,
    detectRange: 6000,
    attackRange: 30,
    attackCooldown: 1000,
    bodyRadius: 13,
    reward: 175,
    skins: ['exploder'],
    plankDamage: 1,
    pushable: true,
    explosive: { damage: 45, radius: 95, triggerRange: 46, fuseMs: 650 },
  },
  // ── Hospital Santa Luzia ──
  crawler: {
    id: 'crawler',
    name: 'Rastejante',
    health: 70,
    damage: 8,
    speed: 45,
    detectRange: 6000,
    attackRange: 26,
    attackCooldown: 900,
    // Baixo e pequeno: difícil de acertar e de ver no escuro.
    bodyRadius: 10,
    reward: 90,
    skins: ['crawler'],
    plankDamage: 1,
    pushable: true,
    deathCloud: { radius: 70, durationMs: 3500, dps: 12 },
  },
  spitter: {
    id: 'spitter',
    name: 'Cuspidor',
    health: 120,
    damage: 10,
    speed: 55,
    detectRange: 6000,
    attackRange: 30,
    attackCooldown: 1100,
    bodyRadius: 12,
    reward: 130,
    skins: ['spitter'],
    plankDamage: 1,
    pushable: true,
    ranged: {
      minRange: 140,
      maxRange: 300,
      cooldownMs: 3200,
      windupMs: 700,
      projectileSpeed: 260,
      pool: { radius: 46, durationMs: 4000, dps: 14 },
    },
  },
  armored: {
    id: 'armored',
    name: 'Blindado',
    health: 220,
    damage: 18,
    speed: 52,
    detectRange: 6000,
    attackRange: 32,
    attackCooldown: 1200,
    bodyRadius: 14,
    reward: 200,
    skins: ['armored'],
    plankDamage: 2,
    pushable: false,
    armor: { hp: 400, bodyFactor: 0.25, brokenSkin: 'armored_broken' },
  },
  hound: {
    id: 'hound',
    name: 'Cão Infernal',
    health: 110,
    damage: 10,
    speed: 190,
    detectRange: 6000,
    attackRange: 30,
    attackCooldown: 650,
    bodyRadius: 13,
    reward: 150,
    skins: ['hound'],
    plankDamage: 1,
    pushable: true,
    burnsOnDeath: true,
  },
};

export function getZombieConfig(id: string): ZombieConfig {
  const cfg = zombies[id];
  if (!cfg) throw new Error(`Zumbi desconhecido: ${id}`);
  return cfg;
}

/** Roupas de cada tipo por mapa (os valores de vida/dano/velocidade não mudam). */
export const mapSkins: Partial<Record<MapId, Record<string, string[]>>> = {
  map2: {
    walker: ['h_a', 'h_b', 'h_c'],
    runner: ['h_runner'],
    tank: ['h_tank'],
    exploder: ['h_exploder'],
  },
};
