import Phaser from 'phaser';
import { bossCorpseKey } from '../config/assets.config';
import { bosses, bossForWave, type BossConfig } from '../config/bosses.config';
import { ART_SCALE, DEPTH } from '../config/visual.config';
import { getZombieConfig } from '../config/zombies.config';
import type { EffectsSystem } from '../effects/EffectsSystem';
import type { LightingSystem } from '../effects/LightingSystem';
import { Boss, type BossWorld } from '../entities/Boss';
import type { Player } from '../entities/Player';
import { emitGameEvent, GameEvents } from '../game/events';
import type { NavWorld } from './pathfinding/PathFollower';
import type { EconomySystem } from './EconomySystem';
import type { PowerUpSystem } from './PowerUpSystem';
import type { SpawnSystem } from './SpawnSystem';
import { getWaveParams, scaleZombie } from './difficulty';
import { audio } from '../audio/AudioSystem';

export interface BossSystemDeps {
  player: Player;
  world: NavWorld;
  spawner: SpawnSystem;
  bossGroup: Phaser.Physics.Arcade.Group;
  effects: EffectsSystem;
  lighting: LightingSystem;
  economy: EconomySystem;
  powerUps: PowerUpSystem;
}

/** Aviso "BOSS INCOMING" antes de o boss surgir (ms). */
const WARNING_MS = 3200;
/** Boss parado por este tempo e fora da tela é reposicionado perto do jogador (ms). */
const STUCK_TIMEOUT_MS = 7000;

interface Shockwave {
  x: number;
  y: number;
  start: number;
  hit: boolean;
  ring: Phaser.GameObjects.Graphics;
}

/**
 * Ciclo de vida dos bosses (GDD §45–47, §61): aviso, entrada, ataques em área,
 * invocações, mudança da arena no Rage Mode e recompensas.
 */
export class BossSystem {
  private boss: Boss | null = null;
  private pending = false;
  private appearances = new Map<string, number>();
  private defeated = 0;
  private wave = 0;
  private readonly shockwaves: Shockwave[] = [];
  private lastStateKey = '';
  /** Zumbis invocados entram na contagem da wave. */
  onSummoned: (count: number) => void = () => {};
  /** Luz da lanterna do boss. */
  private lantern: { x: number; y: number; radius: number; intensity: number } | null = null;

  constructor(private readonly scene: Phaser.Scene, private readonly deps: BossSystemDeps) {}

  /** Há boss vivo ou prestes a surgir? */
  get isActive(): boolean {
    return this.pending || !!this.boss?.isAlive;
  }

  get defeatedCount(): number {
    return this.defeated;
  }

  get current(): Boss | null {
    return this.boss;
  }

  /** Inicia a wave de boss: aviso e, depois, o boss surge num ponto de spawn. */
  startBossWave(wave: number): void {
    const config = bosses[bossForWave(wave)];
    this.wave = wave;
    this.pending = true;
    emitGameEvent(this.scene.game.events, GameEvents.BossIncoming, { name: config.name });
    this.scene.cameras.main.shake(600, 0.003);
    this.scene.time.delayedCall(WARNING_MS, () => this.spawn(config));
  }

  update(time: number, delta: number): void {
    this.boss?.update(time, delta);
    this.updateShockwaves(time);
    this.relocateIfStuck();
    if (this.lantern && this.boss) {
      this.lantern.x = this.boss.x + Math.cos(this.boss.rotation - 1.6) * 26;
      this.lantern.y = this.boss.y + Math.sin(this.boss.rotation - 1.6) * 26;
    }
    this.emitState();
  }

  syncHud(): void {
    this.lastStateKey = '#';
    this.emitState();
  }

  // ───────────────────────── Surgimento ─────────────────────────

  private spawn(config: BossConfig): void {
    const point = this.deps.spawner.pickSpawnPoint(this.wave);
    const player = this.deps.player;
    const x = point?.x ?? player.x + 400;
    const y = point?.y ?? player.y;
    const appearance = this.appearances.get(config.id) ?? 0;
    this.appearances.set(config.id, appearance + 1);

    const boss = new Boss(this.scene, x, y, config, appearance, this.createWorld(config));
    this.deps.bossGroup.add(boss);
    boss.setPushable(false);
    this.boss = boss;
    this.pending = false;
    boss.setAlpha(0);
    this.scene.tweens.add({ targets: boss, alpha: 1, duration: 600 });
    this.lantern = this.deps.lighting.addDynamicLight({ x, y, radius: 120, intensity: 0.7, color: 0xffb04a });
    this.deps.effects.explosion(x, y, 60);
  }

  private createWorld(config: BossConfig): BossWorld {
    const { player, world } = this.deps;
    return {
      nav: world.nav,
      barricadeAt: (tx, ty) => world.barricadeAt(tx, ty),
      player,
      shockwave: (x, y) => this.startShockwave(x, y),
      summon: (x, y) => this.summon(config, x, y),
      areaAttack: (tx, ty) => this.areaAttack(config, tx, ty),
      onPhaseChange: (phase) => this.onPhaseChange(config, phase),
      onDefeated: (boss) => this.onDefeated(boss),
    };
  }

  private relocateIfStuck(): void {
    const boss = this.boss;
    if (!boss?.isAlive || boss.stuckMs < STUCK_TIMEOUT_MS) return;
    const view = this.scene.cameras.main.worldView;
    if (view.contains(boss.x, boss.y)) return;
    const point = this.deps.spawner.pickSpawnPoint(this.wave);
    if (point) boss.relocate(point.x, point.y);
  }

  // ───────────────────────── Ataques em área ─────────────────────────

  private startShockwave(x: number, y: number): void {
    const ring = this.scene.add.graphics().setDepth(DEPTH.glow).setBlendMode(Phaser.BlendModes.ADD);
    this.shockwaves.push({ x, y, start: this.scene.time.now, hit: false, ring });
    audio.playAt('boss_slam', x, y, { category: 'world', volume: 1, distance: 1500 });
    this.deps.effects.surfaceImpact(x, y, 0);
    this.deps.lighting.addFlash(x, y, 200, 0.8, 400);
    this.scene.cameras.main.shake(300, 0.009);
  }

  /** Anel que se expande; fere o jogador quando a frente do anel passa por ele. */
  private updateShockwaves(time: number): void {
    const cfg = this.boss?.config.shockwave ?? bosses.conductor.shockwave;
    const player = this.deps.player;
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const w = this.shockwaves[i];
      const t = (time - w.start) / cfg.expandMs;
      if (t >= 1) {
        w.ring.destroy();
        this.shockwaves.splice(i, 1);
        continue;
      }
      const radius = cfg.radius * t;
      w.ring.clear();
      w.ring.lineStyle(14 * (1 - t) + 3, 0xff9a4a, 0.85 * (1 - t));
      w.ring.strokeCircle(w.x, w.y, radius);
      w.ring.lineStyle(4, 0xffe0a0, 0.6 * (1 - t));
      w.ring.strokeCircle(w.x, w.y, radius * 0.92);
      const d = Phaser.Math.Distance.Between(w.x, w.y, player.x, player.y);
      if (!w.hit && player.isAlive && d <= radius && d >= radius - 40) {
        w.hit = true;
        player.takeDamage(cfg.damage, time);
      }
    }
  }

  /** Círculos marcados no chão perto do jogador que explodem após o aviso. */
  private areaAttack(config: BossConfig, tx: number, ty: number): void {
    const cfg = config.area;
    audio.play('boss_area', { category: 'world', volume: 0.8 });
    const targets = [{ x: tx, y: ty }];
    for (let i = 1; i < cfg.count; i++) {
      targets.push({ x: tx + Phaser.Math.Between(-cfg.spread, cfg.spread), y: ty + Phaser.Math.Between(-cfg.spread, cfg.spread) });
    }
    for (const p of targets) {
      const mark = this.scene.add.graphics().setDepth(DEPTH.glow);
      const start = this.scene.time.now;
      const timer = this.scene.time.addEvent({
        delay: 30,
        loop: true,
        callback: () => {
          const t = Math.min(1, (this.scene.time.now - start) / cfg.telegraphMs);
          mark.clear();
          mark.fillStyle(0xd63a2a, 0.12 + 0.18 * t);
          mark.fillCircle(p.x, p.y, cfg.radius);
          mark.lineStyle(3, 0xff5a40, 0.9);
          mark.strokeCircle(p.x, p.y, cfg.radius);
          mark.fillStyle(0xff5a40, 0.35);
          mark.fillCircle(p.x, p.y, cfg.radius * t);
        },
      });
      this.scene.time.delayedCall(cfg.telegraphMs, () => {
        timer.remove();
        mark.destroy();
        this.deps.effects.explosion(p.x, p.y, cfg.radius);
        const player = this.deps.player;
        if (player.isAlive && Phaser.Math.Distance.Between(player.x, player.y, p.x, p.y) <= cfg.radius + 10) {
          player.takeDamage(cfg.damage, this.scene.time.now);
        }
      });
    }
  }

  /** Invoca zumbis em volta do boss (entram na contagem da wave). */
  private summon(config: BossConfig, x: number, y: number): void {
    const params = getWaveParams(this.wave);
    audio.playAt('boss_summon', x, y, { category: 'world', volume: 1, distance: 1400 });
    let spawned = 0;
    for (let i = 0; i < config.summon.count; i++) {
      const angle = (i / config.summon.count) * Math.PI * 2 + Math.random() * 0.5;
      const sx = x + Math.cos(angle) * 72;
      const sy = y + Math.sin(angle) * 72;
      const type = Phaser.Utils.Array.GetRandom(config.summon.types);
      if (this.deps.spawner.spawnAt(scaleZombie(getZombieConfig(type), params), sx, sy)) {
        spawned++;
        this.deps.effects.surfaceImpact(sx, sy, angle);
      }
    }
    if (spawned > 0) this.onSummoned(spawned);
  }

  // ───────────────────────── Fases e fim ─────────────────────────

  private onPhaseChange(config: BossConfig, phase: number): void {
    emitGameEvent(this.scene.game.events, GameEvents.BossPhase, { name: config.name, phase });
    // Rage Mode: a arena muda — luzes vermelhas piscando e mais escuridão.
    if (phase >= 4) this.deps.lighting.setAlarm(true);
  }

  private onDefeated(boss: Boss): void {
    const { economy, powerUps, effects, lighting } = this.deps;
    const x = boss.x;
    const y = boss.y;
    this.defeated++;
    lighting.setAlarm(false);
    if (this.lantern) {
      lighting.removeDynamicLight(this.lantern);
      this.lantern = null;
    }
    effects.explosion(x, y, 80);
    this.scene.cameras.main.flash(500, 255, 220, 180);
    const corpse = this.scene.add
      .image(x, y, bossCorpseKey(boss.config.id))
      .setScale(ART_SCALE)
      .setRotation(boss.rotation + Math.PI / 2)
      .setDepth(DEPTH.corpses);
    this.scene.tweens.add({ targets: corpse, alpha: 0, delay: 60_000, duration: 3000, onComplete: () => corpse.destroy() });
    boss.destroy();
    this.boss = null;

    const reward = economy.earn(boss.config.reward);
    powerUps.spawnDrop('golden', x, y);
    powerUps.spawnDrop('max_ammo', x + 40, y);
    emitGameEvent(this.scene.game.events, GameEvents.BossDefeated, { name: boss.config.name, reward });
    this.emitState(true);
  }

  /** Estado do boss para a barra de vida da HUD (emite quando muda ~1%). */
  private emitState(force = false): void {
    const boss = this.boss;
    const payload = boss?.isAlive
      ? { active: true, name: boss.config.name, hp: boss.hp, maxHp: boss.maxHp, phase: boss.phase, thresholds: boss.config.phaseThresholds }
      : { active: false, name: '', hp: 0, maxHp: 1, phase: 0, thresholds: [] as number[] };
    const key = `${payload.active}|${Math.ceil((payload.hp / payload.maxHp) * 200)}|${payload.phase}`;
    if (!force && key === this.lastStateKey) return;
    this.lastStateKey = key;
    emitGameEvent(this.scene.game.events, GameEvents.BossState, payload);
  }
}
