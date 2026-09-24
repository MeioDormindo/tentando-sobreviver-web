/**
 * Migração de dados: lê as configs do jogo web (src/config) e gera os .tres do projeto Godot
 * (godot/data). Assim os dois usam exatamente os mesmos números.
 *
 *   npm run godot:data
 *
 * Unidades: 32 px = 1 m (um tile); ms → s. Arquivos gerados não devem ser editados à mão:
 * mude a config do TS e rode de novo (ou, quando o Godot virar a fonte, pare de usar este script).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { weapons, knifeConfig, INVENTORY_SLOTS, WEAPON_SWITCH_MS, type WeaponConfig } from '../../src/config/weapons.config';
import { headshotConfig, economyConfig } from '../../src/config/economy.config';
import { playerConfig } from '../../src/config/player.config';
import { waveConfig, houndRounds } from '../../src/config/waves.config';
import { zombies as zombieTypes } from '../../src/config/zombies.config';
import { exportMaps } from './export-maps';
import { exportMachines } from './export-machines';
import { bosses } from '../../src/config/bosses.config';

const OUT = 'godot/data';
const PX = 32;
const m = (px: number): number => round(px / PX);
const s = (ms: number): number => round(ms / 1000);
const round = (n: number): number => Math.round(n * 1000) / 1000;

type TresValue = string | number | boolean | { raw: string };
const raw = (v: string): { raw: string } => ({ raw: v });
const name = (v: string): { raw: string } => raw(`&"${v}"`);
const color = (hex: number): { raw: string } =>
  raw(`Color(${round(((hex >> 16) & 255) / 255)}, ${round(((hex >> 8) & 255) / 255)}, ${round((hex & 255) / 255)}, 1)`);

function fmt(v: TresValue): string {
  if (typeof v === 'object') return v.raw;
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return Number.isInteger(v) ? String(v) : String(v);
}

function tres(scriptClass: string, scriptPath: string, props: Record<string, TresValue | undefined>, extra = ''): string {
  const lines = Object.entries(props)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k} = ${fmt(v as TresValue)}`);
  return `[gd_resource type="Resource" script_class="${scriptClass}" format=3]

[ext_resource type="Script" path="${scriptPath}" id="1_script"]
${extra}
[resource]
script = ExtResource("1_script")
${lines.join('\n')}
`;
}

function write(path: string, content: string): void {
  const full = join(OUT, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
  console.log('  ' + full);
}

/** Parâmetros da mecânica especial, com distâncias em m e tempos em s. */
function special(cfg: WeaponConfig): Record<string, TresValue | undefined> {
  const sp = cfg.special;
  if (!sp) return { special_type: name('') };
  const params: string[] = [];
  for (const [k, v] of Object.entries(sp)) {
    if (k === 'type' || typeof v !== 'number') continue;
    const key = k.replace(/Ms$/, '_time').replace(/([A-Z])/g, '_$1').toLowerCase();
    const value = /Ms$/.test(k) ? s(v) : /range|radius|knockback/i.test(k) ? m(v) : v;
    params.push(`"${key}": ${value}`);
  }
  return { special_type: name(sp.type), special_params: raw(`{\n${params.join(',\n')}\n}`) };
}

function exportWeapons(): void {
  for (const cfg of Object.values(weapons)) {
    write(`weapons/${cfg.id}.tres`, tres('WeaponData', 'res://scripts/weapons/weapon_data.gd', {
      id: name(cfg.id),
      display_name: cfg.name,
      kind: name(cfg.kind),
      rarity: name(cfg.rarity),
      damage: cfg.damage,
      fire_rate: round(1000 / cfg.fireRate),
      automatic: cfg.automatic,
      magazine_size: cfg.magazineSize,
      reserve_ammo: cfg.reserveAmmo,
      reload_time: s(cfg.reloadTime),
      spread_degrees: cfg.spread,
      max_range: m(cfg.range),
      projectile_speed: cfg.special && ["grenade", "plasma"].includes(cfg.special.type) ? m(cfg.projectileSpeed) : 0,
      pellets: cfg.pellets,
      pierce: cfg.pierce ?? 0,
      headshot_multiplier: cfg.headshotMultiplier ?? headshotConfig.damageMultiplier,
      price: cfg.price,
      ammo_price: cfg.ammoPrice,
      box_only: cfg.boxOnly ?? false,
      element: name(cfg.element ?? ''),
      spin_up_time: cfg.spinUpMs ? s(cfg.spinUpMs) : undefined,
      move_multiplier_while_firing: cfg.moveSlowWhileFiring,
      akimbo: cfg.akimbo,
      tracer_color: cfg.tracerTint !== undefined ? color(cfg.tracerTint) : undefined,
      upgrade_name: cfg.upgradeName,
      maps: cfg.maps ? raw(`PackedStringArray(${cfg.maps.map((x) => JSON.stringify(x)).join(', ')})`) : undefined,
      ...special(cfg),
    }));
  }
}

/** Catálogo com todas as armas (sorteio da Mystery Box; listar pastas não funciona no jogo exportado). */
function exportCatalog(): void {
  const list = Object.values(weapons);
  const ext = list.map((w, i) => `[ext_resource type="Resource" path="res://data/weapons/${w.id}.tres" id="w${i}"]`).join('\n');
  write("weapons/catalog.tres", `[gd_resource type="Resource" script_class="WeaponCatalog" format=3]

[ext_resource type="Script" path="res://scripts/weapons/weapon_catalog.gd" id="1_script"]
${ext}

[resource]
script = ExtResource("1_script")
weapons = Array[Resource]([${list.map((_, i) => `ExtResource("w${i}")`).join(", ")}])
`);
}

function exportKnifeAndPlayer(): void {
  write('weapons/knife.tres', tres('MeleeData', 'res://scripts/weapons/melee_data.gd', {
    damage: knifeConfig.damage,
    reach: m(knifeConfig.range),
    arc_degrees: knifeConfig.arcDeg,
    cooldown: s(knifeConfig.cooldownMs),
    windup: s(knifeConfig.windupMs),
    busy_time: s(knifeConfig.busyMs),
    lunge_range: m(knifeConfig.lungeRange),
    lunge_speed: m(knifeConfig.lungeSpeed),
    lunge_time: s(knifeConfig.lungeMs),
    knockback: m(knifeConfig.knockback),
  }));
  write('configs/player.tres', tres('PlayerData', 'res://scripts/player/player_data.gd', {
    move_speed: m(playerConfig.speed),
    max_health: playerConfig.maxHp,
    max_armor: playerConfig.maxArmor,
    invulnerability_time: s(playerConfig.invulnerabilityMs),
    strafe_multiplier: playerConfig.strafeMultiplier,
    backpedal_multiplier: playerConfig.backpedalMultiplier,
    regen_delay: s(playerConfig.regenDelayMs),
    regen_per_second: playerConfig.regenPerSecond,
    inventory_slots: INVENTORY_SLOTS,
    switch_time: s(WEAPON_SWITCH_MS),
  }, `[ext_resource type="Resource" path="res://data/weapons/${playerConfig.startingWeapon}.tres" id="2_weapon"]\n[ext_resource type="Resource" path="res://data/weapons/knife.tres" id="3_knife"]\n`)
    .replace('\n[resource]\nscript = ExtResource("1_script")\n', '\n[resource]\nscript = ExtResource("1_script")\nstarting_weapon = ExtResource("2_weapon")\nknife = ExtResource("3_knife")\n'));
}

/** Tabela de composição: [{ "from_round": n, "weights": { &"walker": 100, ... } }, ...]. */
function composition(list: Array<{ fromWave: number; weights: Record<string, number> }>): { raw: string } {
  const items = list.map((c) => `{ "from_round": ${c.fromWave}, "weights": { ${Object.entries(c.weights).map(([k, v]) => `&"${k}": ${v}`).join(', ')} } }`);
  return raw(`[${items.join(', ')}]`);
}

function exportRoundsAndPoints(): void {
  const w = waveConfig;
  write('configs/rounds.tres', tres('RoundData', 'res://scripts/systems/round_data.gd', {
    base_zombies: w.baseEnemies,
    zombies_per_round: w.enemiesPerWave,
    health_per_round: w.healthMultiplier,
    late_from_round: w.lateFromWave,
    late_health_per_round: w.lateHealthMultiplier,
    damage_per_round: w.damageMultiplier,
    speed_per_round: w.speedMultiplier,
    spawn_interval_base: s(w.spawnIntervalBase),
    spawn_interval_per_round: s(w.spawnIntervalPerWave),
    spawn_interval_min: s(w.spawnIntervalMin),
    max_alive_base: w.maxAliveBase,
    max_alive_per_round: w.maxAlivePerWave,
    max_alive_cap: w.maxAliveCap,
    first_round_delay: s(w.firstWaveDelay),
    intermission: s(w.intermission),
    // O jogo web não reabastece: a munição vem das compras na parede.
    refill_ammo_on_round_end: false,
    composition: composition(w.composition),
    composition_by_map: raw(`{\n${Object.entries(w.compositionByMap).map(([id, list]) => `"${id}": ${composition(list!).raw}`).join(',\n')}\n}`),
    max_alive_per_type: raw(`{ ${Object.entries(w.maxAlivePerType).map(([k, v]) => `&"${k}": ${v}`).join(', ')} }`),
    late_caps_from_round: w.lateMaxAlivePerType.fromWave,
    boss_by_map: raw('{ "terminal": &"conductor", "map2": &"patient_zero" }'),
    boss_rounds: raw(`PackedInt32Array(${w.bossWaves.join(', ')})`),
    hound_rounds: raw(`{\n${Object.entries(houndRounds).map(([id, h]) => `"${id}": { "first_round": ${h!.firstWave}, "every": ${h!.every}, "per_round": ${h!.perWave}, "cap": ${h!.cap}, "max_alive": ${h!.maxAlive}, "spawn_interval": ${s(h!.spawnIntervalMs)}, "spawn_distance_min": ${m(h!.spawnDistance[0])}, "spawn_distance_max": ${m(h!.spawnDistance[1])}, "fog_darkness": ${h!.fog.extraDarkness}, "flashlight_factor": ${h!.fog.flashlightFactor} }`).join(',\n')}\n}`),
    late_max_alive_per_type: raw(`{ ${Object.entries(w.lateMaxAlivePerType.caps).map(([k, v]) => `&"${k}": ${v}`).join(', ')} }`),
  }));
  const e = economyConfig;
  write('configs/points.tres', tres('PointsData', 'res://scripts/systems/points_data.gd', {
    start_points: e.startingMoney,
    headshot_kill_bonus: e.headshotBonus,
    melee_kill_bonus: e.knifeKillBonus,
    round_bonus_base: e.waveBonusBase,
    round_bonus_per_round: e.waveBonusPerWave,
  }));
}

/** Dicionário .tres com distâncias em m e tempos em s (chaves em snake_case). */
function dict(obj: Record<string, unknown> | undefined): { raw: string } | undefined {
  if (!obj) return undefined;
  const entries = Object.entries(obj).flatMap(([k, v]) => {
    if (typeof v === 'object' && v !== null) return [`"${snake(k)}": ${dict(v as Record<string, unknown>)!.raw}`];
    if (typeof v !== 'number') return [];
    const key = snake(k.replace(/Ms$/, '_time'));
    const value = /Ms$/.test(k) ? s(v) : /range|radius|speed|distance|spread/i.test(k) ? m(v) : v;
    return [`"${key}": ${value}`];
  });
  return raw(`{ ${entries.join(', ')} }`);
}
const snake = (k: string): string => k.replace(/([A-Z])/g, '_$1').toLowerCase();

/**
 * Aparência provisória de cada tipo (blockout, até os modelos do Blender): cores, escala e
 * se anda rastejando. Não existe no jogo web (lá são sprites).
 */
const LOOKS: Record<string, { scene?: string; shirt: number; skin: number; scale: number; low?: boolean }> = {
  walker: { shirt: 0x5e5343, skin: 0x6c765f, scale: 1 },
  runner: { shirt: 0x3d4a58, skin: 0x77806b, scale: 0.92 },
  tank: { shirt: 0x6b4a3a, skin: 0x5d6752, scale: 1.4 },
  exploder: { shirt: 0x8a6a2a, skin: 0x9aa05a, scale: 1.1 },
  crawler: { shirt: 0x6a6f74, skin: 0x7b8570, scale: 0.9, low: true },
  spitter: { shirt: 0x4f6a3a, skin: 0x8fb04a, scale: 1 },
  armored: { shirt: 0x2c3140, skin: 0x5a6150, scale: 1.1 },
  hound: { scene: 'res://scenes/zombies/hound.tscn', shirt: 0x3a1a14, skin: 0x5a241a, scale: 1 },
};

/** Bosses: vida por aparição, fases e cada ataque (distâncias em m, tempos em s). */
function exportBosses(): void {
  for (const b of Object.values(bosses)) {
    write(`bosses/${b.id}.tres`, tres('BossData', 'res://scripts/zombies/boss_data.gd', {
      id: name(b.id),
      display_name: b.name,
      scene: raw('ExtResource("2_scene")'),
      max_health: b.health,
      health_per_appearance: b.healthPerAppearance,
      move_speed: m(b.speed),
      body_radius: m(b.bodyRadius),
      reward: b.reward,
      phase_thresholds: raw(`PackedFloat32Array(${b.phaseThresholds.join(', ')})`),
      phase_speed: raw(`PackedFloat32Array(${b.phaseSpeed.join(', ')})`),
      phase_cooldown: raw(`PackedFloat32Array(${b.phaseCooldown.join(', ')})`),
      roar_time: s(b.roarMs),
      melee: dict(b.melee as unknown as Record<string, unknown>),
      charge: dict(b.charge as unknown as Record<string, unknown>),
      shockwave: dict(b.shockwave as unknown as Record<string, unknown>),
      summon: b.summon ? raw(`{ "from_phase": ${b.summon.fromPhase}, "count": ${b.summon.count}, "types": [${b.summon.types.map((t) => `&"${t}"`).join(', ')}], "cooldown_time": ${s(b.summon.cooldownMs)} }`) : undefined,
      area: dict(b.area as unknown as Record<string, unknown>),
      area_acid: b.area?.style === 'acid',
      vomit: dict(b.vomit as unknown as Record<string, unknown>),
      scream: b.scream ? raw(`{ "from_phase": ${b.scream.fromPhase}, "radius": ${m(b.scream.radius)}, "slow_time": ${s(b.scream.slowMs)}, "slow_factor": ${b.scream.slowFactor}, "cooldown_time": ${s(b.scream.cooldownMs)}, "summon_count": ${b.scream.summonCount}, "types": [${b.scream.types.map((t) => `&"${t}"`).join(', ')}] }`) : undefined,
      lantern: b.lantern ?? false,
      escort_ratio: b.escortRatio,
    }, '[ext_resource type="PackedScene" path="res://scenes/zombies/boss.tscn" id="2_scene"]\n'));
  }
}

function exportZombies(): void {
  for (const z of Object.values(zombieTypes)) {
    const look = LOOKS[z.id] ?? LOOKS.walker;
    write(`zombies/${z.id}.tres`, tres('ZombieData', 'res://scripts/zombies/zombie_data.gd', {
      id: name(z.id),
      display_name: z.name,
      scene: raw('ExtResource("2_scene")'),
      max_health: z.health,
      move_speed: m(z.speed),
      damage: z.damage,
      attack_range: round(m(z.attackRange) + 0.2),
      attack_interval: s(z.attackCooldown),
      points_kill: z.reward,
      plank_damage: z.plankDamage,
      body_radius: m(z.bodyRadius),
      pushable: z.pushable,
      explosive: dict(z.explosive as unknown as Record<string, unknown>),
      ranged: dict(z.ranged as unknown as Record<string, unknown>),
      armor: z.armor ? raw(`{ "hp": ${z.armor.hp}, "body_factor": ${z.armor.bodyFactor} }`) : undefined,
      death_cloud: dict(z.deathCloud as unknown as Record<string, unknown>),
      burns_on_death: z.burnsOnDeath ?? false,
      shirt_color: color(look.shirt),
      skin_color: color(look.skin),
      model_scale: look.scale,
      crawls: look.low ?? false,
    }, `[ext_resource type="PackedScene" path="${look.scene ?? 'res://scenes/zombies/zombie_walker.tscn'}" id="2_scene"]\n`));
  }
}

console.log('Exportando dados do jogo web para o Godot:');
exportWeapons();
exportCatalog();
exportKnifeAndPlayer();
exportRoundsAndPoints();
exportZombies();
exportBosses();
exportMaps();
exportMachines(write, tres as never);
console.log('Pronto.');
