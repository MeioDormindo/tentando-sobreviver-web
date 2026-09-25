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
import { exportMachines } from './export-machines';
import { exportWebArt } from './export-web-art';
import { bosses } from '../../src/config/bosses.config';
import { scoreConfig } from '../../src/config/score.config';
import { MAPS, RANKING_SIZE, PLAYER_NAME_MAX, DEFAULT_MAP } from '../../src/config/maps.config';
import { onlineConfig, accountConfig } from '../../src/config/online.config';
import { antiCheatConfig } from '../../src/config/anticheat.config';
import { ACHIEVEMENTS, achievementConfig } from '../../src/config/achievements.config';
import { SKINS } from '../../src/config/skins.config';
import { powerUps, dropConfig, powerUpEffects, goldenConfig } from '../../src/config/powerups.config';
// @ts-expect-error módulo de arte em JS puro (paleta dos visuais do jogador)
import { PLAYER_SKINS } from '../art/characters.mjs';
import * as eventsConfig from '../../src/config/events.config';
import { interactionsConfig } from '../../src/config/interactions.config';
import { secretsConfig } from '../../src/config/secrets.config';
import { serumQuestConfig } from '../../src/config/quests.config';

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
 * Aparência de cada tipo no Godot: cores (as folhas de pixel art do npm run godot:sprites
 * leem daqui), escala e se anda rastejando.
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

/** Pontuação (score do ranking, separada dos pontos de compra) e mapas (nomes, desbloqueio). */
function exportProgression(): void {
  const c = scoreConfig;
  write('configs/score.tres', tres('ScoreData', 'res://scripts/systems/score_data.gd', {
    kill_points: raw(`{ ${Object.entries(c.kill).map(([k, v]) => `&"${k}": ${v}`).join(', ')} }`),
    kill_default: c.killDefault,
    per_round_multiplier: c.perWaveMultiplier,
    headshot: c.headshot,
    knife_kill: c.knifeKill,
    close_range_distance: m(c.closeRange.distance),
    close_range_bonus: c.closeRange.bonus,
    multi_kill_window: s(c.multiKill.windowMs),
    multi_kill_bonus_per_step: c.multiKill.bonusPerStep,
    multi_kill_max_steps: c.multiKill.maxSteps,
    indirect_factor: c.indirectFactor,
    round_complete: c.waveComplete,
    boss: c.boss,
    power_up: c.powerUp,
  }));
  const entries = Object.values(MAPS).map((mp) => `"${mp.id}": { "name": ${JSON.stringify(mp.name)}, "description": ${JSON.stringify(mp.description)}, "scene": "res://scenes/maps/${mp.id === 'terminal' ? 'terminal' : 'hospital'}.tscn", "unlock_boss_round": ${mp.unlock?.bossWave ?? 0}, "unlock_on_map": "${mp.unlock?.onMap ?? ''}" }`);
  write('configs/maps.tres', tres('MapCatalog', 'res://scripts/maps/map_catalog.gd', {
    maps: raw(`{\n${entries.join(',\n')}\n}`),
    order: raw(`PackedStringArray(${Object.keys(MAPS).map((k) => JSON.stringify(k)).join(', ')})`),
    default_map: DEFAULT_MAP,
    ranking_size: RANKING_SIZE,
    player_name_max: PLAYER_NAME_MAX,
  }));
}

/** Online (mesmo Supabase do jogo web: a chave publicável é pública) e anti-trapaça. */
function exportOnline(): void {
  write('configs/online.tres', tres('OnlineData', 'res://scripts/online/online_data.gd', {
    url: onlineConfig.url,
    publishable_key: onlineConfig.publishableKey,
    season_seconds: onlineConfig.seasonSeconds,
    timeout: s(onlineConfig.timeoutMs),
    global_rank_size: onlineConfig.globalRankSize,
    email_domain: accountConfig.emailDomain,
    username_pattern: accountConfig.usernamePattern.source,
    password_min: accountConfig.passwordMin,
    password_max: accountConfig.passwordMax,
    refresh_margin: s(accountConfig.refreshMarginMs),
    sync_debounce: s(accountConfig.syncDebounceMs),
  }));
  const a = antiCheatConfig;
  write('configs/anticheat.tres', tres('AntiCheatData', 'res://scripts/online/anticheat_data.gd', {
    points_event_base: a.money.eventBase,
    points_event_per_round: a.money.eventPerWave,
    points_window_base: a.money.windowBase,
    points_window_per_round: a.money.windowPerWave,
    score_event_base: a.score.eventBase,
    score_event_per_round: a.score.eventPerWave,
    score_window_base: a.score.windowBase,
    score_window_per_round: a.score.windowPerWave,
    window: s(a.windowMs),
    integrity_check_interval: s(a.integrityCheckMs),
    taunts: raw(`PackedStringArray(${a.taunts.map((t) => JSON.stringify(t)).join(', ')})`),
    taunt_subtitle: a.tauntSubtitle,
  }));
}

/** Conquistas (textos, metas e segredos) e visuais do personagem (cores da paleta do jogo web). */
function exportAchievements(): void {
  const list = ACHIEVEMENTS.map((a) => `{ "id": "${a.id}", "name": ${JSON.stringify(a.name)}, "description": ${JSON.stringify(a.description)}, "total_key": "${a.total?.key ?? ''}", "total_target": ${a.total?.target ?? 0}, "secret": ${a.secret ?? false} }`);
  write('configs/achievements.tres', tres('AchievementCatalog', 'res://scripts/systems/achievement_catalog.gd', {
    achievements: raw(`[\n${list.join(',\n')}\n]`),
    survivor_round: achievementConfig.survivorWave,
    veteran_round: achievementConfig.veteranWave,
    train_kills: achievementConfig.trainKills,
  }));
  const palette = (hex: string): { raw: string } => color(parseInt(hex.slice(1), 16));
  const looks: Record<string, { jacket: string; pack: string; hair: string }> = {
    default: { jacket: '#4b5140', pack: '#5d4731', hair: '#35271b' },
    ...(PLAYER_SKINS as Record<string, { jacket: string; pack: string; hair: string }>),
  };
  const skins = SKINS.map((k) => `{ "id": "${k.id}", "name": ${JSON.stringify(k.name)}, "unlock": "${k.unlock ?? ''}", "jacket": ${palette(looks[k.id].jacket).raw}, "pack": ${palette(looks[k.id].pack).raw}, "hair": ${palette(looks[k.id].hair).raw} }`);
  write('configs/skins.tres', tres('SkinCatalog', 'res://scripts/player/skin_catalog.gd', {
    skins: raw(`[\n${skins.join(',\n')}\n]`),
  }));
}

/** Power-ups: definições, chance e tabela de drop, efeitos e o Golden Drop. */
function exportPowerUps(): void {
  const defs = Object.values(powerUps).map((u) => `&"${u.id}": { "name": ${JSON.stringify(u.name)}, "color": ${color(u.color).raw}, "duration": ${u.durationMs ? s(u.durationMs) : 0} }`);
  write('configs/powerups.tres', tres('PowerUpData', 'res://scripts/systems/power_up_data.gd', {
    power_ups: raw(`{\n${defs.join(',\n')}\n}`),
    drop_chance: dropConfig.chance,
    golden_chance: dropConfig.goldenChance,
    drop_table: raw(`{ ${Object.entries(dropConfig.table).map(([k, v]) => `&"${k}": ${v}`).join(', ')} }`),
    max_per_round: dropConfig.maxPerWave,
    lifetime: s(dropConfig.lifetimeMs),
    blink_at: s(dropConfig.blinkAtMs),
    pickup_radius: m(dropConfig.pickupRadius),
    cash_multiplier: powerUpEffects.cashMultiplier,
    speed_multiplier: powerUpEffects.speedMultiplier,
    nuke_reward: powerUpEffects.nukeReward,
    carpenter_reward: powerUpEffects.carpenterReward,
    golden_outcomes: raw(`{ ${Object.entries(goldenConfig.outcomes).map(([k, v]) => `&"${k}": ${v}`).join(', ')} }`),
    golden_weapons: raw(`PackedStringArray(${goldenConfig.weapons.map((w) => JSON.stringify(w)).join(', ')})`),
    golden_money: goldenConfig.money,
    fury_duration: s(goldenConfig.furyDurationMs),
    fury_damage_multiplier: goldenConfig.furyDamageMultiplier,
  }));
}

/**
 * Valor .tres de uma config de evento: tempos (…Ms) em s, distâncias e velocidades em m,
 * listas convertidas pela regra da chave, textos entre aspas.
 */
function eventValue(key: string, v: unknown): string {
  if (Array.isArray(v)) return `[${v.map((x) => eventValue(key, x)).join(', ')}]`;
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'boolean') return String(v);
  if (typeof v === 'number') return String(/Ms$/.test(key) ? s(v) : /range|radius|distance|spread|length|^speed$/i.test(key) ? m(v) : v);
  if (typeof v === 'object' && v !== null) {
    const entries = Object.entries(v as Record<string, unknown>).map(([k, x]) => `"${snake(k.replace(/Ms$/, 'Time'))}": ${eventValue(k, x)}`);
    return `{ ${entries.join(', ')} }`;
  }
  return 'null';
}

function exportWorldEvents(): void {
  const { worldEvents, eventScheduleConfig, ...configs } = eventsConfig;
  const defs = Object.entries(worldEvents).map(([id, e]) =>
    `&"${id}": { "name": ${JSON.stringify(e.name)}, "hint": ${JSON.stringify(e.hint)}, "color": ${color(e.color).raw}, "weight": ${e.weight}, "min_round": ${e.minWave}, "cooldown_rounds": ${e.cooldownWaves} }`);
  // blackoutConfig → &"blackout", emergency_alarm usa alarmConfig, etc.
  const configIds: Record<string, string> = {
    blackoutConfig: 'blackout', alarmConfig: 'emergency_alarm', hordeConfig: 'horde', trainConfig: 'train', stationConfig: 'station',
    supplyDropConfig: 'supply_drop', gasLeakConfig: 'gas_leak', goldenZombieConfig: 'golden_zombie', bloodMoonConfig: 'blood_moon',
    collapseConfig: 'collapse', fogConfig: 'fog',
  };
  const cfg = Object.entries(configs)
    .filter(([k]) => configIds[k])
    .map(([k, v]) => `&"${configIds[k]}": ${eventValue(k, v)}`);
  write('configs/world_events.tres', tres('WorldEventData', 'res://scripts/events/world_event_data.gd', {
    events: raw(`{\n${defs.join(',\n')}\n}`),
    schedule: raw(eventValue('schedule', eventScheduleConfig)),
    configs: raw(`{\n${cfg.join(',\n')}\n}`),
    interactions: raw(eventValue('interactions', interactionsConfig)),
    credits: secretsConfig.credits.replace('TypeScript + Phaser', 'Godot + GDScript'),
  }));
}

/** Missão do Hospital (posições em tiles; tempos em s; raios em m). */
function exportQuests(): void {
  write('configs/quests.tres', tres('QuestData', 'res://scripts/quests/quest_data.gd', {
    serum: raw(eventValue('serum', serumQuestConfig)),
  }));
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
exportProgression();
exportOnline();
exportAchievements();
exportPowerUps();
exportWorldEvents();
exportQuests();
exportMachines(write, tres as never);
exportWebArt();
console.log('Pronto.');
