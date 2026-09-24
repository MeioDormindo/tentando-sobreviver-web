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
import { waveConfig } from '../../src/config/waves.config';
import { zombies as zombieTypes } from '../../src/config/zombies.config';
import { exportMaps } from './export-maps';

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
    refill_ammo_on_round_end: true,
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

function exportZombies(): void {
  for (const z of Object.values(zombieTypes)) {
    write(`zombies/${z.id}.tres`, tres('ZombieData', 'res://scripts/zombies/zombie_data.gd', {
      id: name(z.id),
      display_name: z.name,
      // Cena própria de cada tipo vem na Fase 4; por enquanto todos usam o corpo do Walker.
      scene: raw('ExtResource("2_scene")'),
      max_health: z.health,
      move_speed: m(z.speed),
      damage: z.damage,
      attack_range: round(m(z.attackRange) + 0.2),
      attack_interval: s(z.attackCooldown),
      points_kill: z.reward,
    }, '[ext_resource type="PackedScene" path="res://scenes/zombies/zombie_walker.tscn" id="2_scene"]\n'));
  }
}

console.log('Exportando dados do jogo web para o Godot:');
exportWeapons();
exportKnifeAndPlayer();
exportRoundsAndPoints();
exportZombies();
exportMaps();
console.log('Pronto.');
