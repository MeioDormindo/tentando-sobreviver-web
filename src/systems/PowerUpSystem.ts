import Phaser from 'phaser';
import { FX_KEYS, powerUpKey } from '../config/assets.config';
import { perks, type PerkId } from '../config/machines.config';
import {
  dropConfig, goldenConfig, powerUpEffects, powerUps, type PowerUpDef, type PowerUpId,
} from '../config/powerups.config';
import { DEPTH } from '../config/visual.config';
import type { EffectsSystem } from '../effects/EffectsSystem';
import type { LightingSystem } from '../effects/LightingSystem';
import type { Player } from '../entities/Player';
import type { Zombie } from '../entities/Zombie';
import { emitGameEvent, GameEvents, onGameEvent, type PowerUpTimer, type WaveStatePayload, type ZombieKilledPayload } from '../game/events';
import type { WeaponSystem } from '../weapons/WeaponSystem';
import type { CombatBuffs } from './CombatSystem';
import type { EconomySystem } from './EconomySystem';
import type { PerkSystem } from './PerkSystem';
import { audio } from '../audio/AudioSystem';

export interface PowerUpDeps {
  player: Player;
  economy: EconomySystem;
  weapons: WeaponSystem;
  perks: PerkSystem;
  effects: EffectsSystem;
  lighting: LightingSystem;
  zombies: Phaser.Physics.Arcade.Group;
}

interface Drop {
  def: PowerUpDef;
  x: number;
  y: number;
  spawnedAt: number;
  icon: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
}

interface ActiveTimer {
  name: string;
  color: number;
  expiresAt: number;
  totalMs: number;
  onEnd: () => void;
}

const ICON_SCALE = 0.32;
const GOLDEN_SCALE = 0.42;

/**
 * Power-ups (GDD §41–43): sorteia drops quando zumbis morrem por arma, mantém os
 * itens no chão (piscando antes de sumir), aplica os efeitos ao coletar e controla
 * os efeitos temporários.
 */
export class PowerUpSystem {
  /** Efeitos temporários lidos pelo combate. */
  readonly buffs: CombatBuffs = { instaKill: false, damageMultiplier: 1 };
  private readonly drops: Drop[] = [];
  private readonly timers = new Map<string, ActiveTimer>();
  private dropsThisWave = 0;
  private lastTimersKey = '';

  constructor(private readonly scene: Phaser.Scene, private readonly deps: PowerUpDeps) {
    const offs = [
      onGameEvent(scene.game.events, GameEvents.ZombieKilled, this.onZombieKilled, this),
      onGameEvent(scene.game.events, GameEvents.WaveState, this.onWaveState, this),
    ];
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => offs.forEach((off) => off()));
  }

  update(time: number): void {
    const { player } = this.deps;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i];
      const age = time - drop.spawnedAt;
      if (player.isAlive && Phaser.Math.Distance.Between(player.x, player.y, drop.x, drop.y) <= dropConfig.pickupRadius) {
        this.removeDrop(i);
        this.deps.effects.pickupBurst(drop.x, drop.y, drop.def.color);
        this.apply(drop.def.id);
        continue;
      }
      if (age >= dropConfig.lifetimeMs) {
        this.removeDrop(i);
        continue;
      }
      // Pisca cada vez mais rápido perto de sumir.
      if (age >= dropConfig.blinkAtMs) {
        const period = age > dropConfig.lifetimeMs - 3000 ? 120 : 260;
        const visible = Math.floor(age / period) % 2 === 0;
        drop.icon.setVisible(visible);
        drop.glow.setVisible(visible);
      }
    }

    for (const [key, timer] of this.timers) {
      if (time >= timer.expiresAt) {
        this.timers.delete(key);
        timer.onEnd();
      }
    }
    this.emitTimers(time);
  }

  /** Cria um power-up no chão (também usado em testes/depuração). */
  spawnDrop(id: PowerUpId, x: number, y: number): void {
    const def = powerUps[id];
    const golden = id === 'golden';
    const glow = this.scene.add
      .image(x, y, FX_KEYS.lightRadial)
      .setTint(def.color)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(golden ? 0.55 : 0.4)
      .setAlpha(0.55)
      .setDepth(DEPTH.glow);
    const icon = this.scene.add
      .image(x, y, powerUpKey(id))
      .setScale(golden ? GOLDEN_SCALE : ICON_SCALE)
      .setDepth(DEPTH.glow + 1);
    // Flutua e pulsa (visível mesmo no escuro).
    this.scene.tweens.add({ targets: icon, y: y - 5, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.scene.tweens.add({ targets: glow, alpha: 0.3, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.drops.push({ def, x, y, spawnedAt: this.scene.time.now, icon, glow });
  }

  syncHud(): void {
    this.lastTimersKey = '#';
    this.emitTimers(this.scene.time.now);
  }

  // ───────────────────────── Drops ─────────────────────────

  private onZombieKilled(kill: ZombieKilledPayload): void {
    if (kill.source !== 'weapon' || this.dropsThisWave >= dropConfig.maxPerWave) return;
    const roll = Math.random();
    if (roll < dropConfig.goldenChance) {
      this.dropsThisWave++;
      this.spawnDrop('golden', kill.x, kill.y);
    } else if (roll < dropConfig.goldenChance + dropConfig.chance) {
      this.dropsThisWave++;
      this.spawnDrop(this.pickFromTable(), kill.x, kill.y);
    }
  }

  private onWaveState(state: WaveStatePayload): void {
    if (state.phase === 'active' && state.remaining === state.total) this.dropsThisWave = 0;
  }

  private pickFromTable(): PowerUpId {
    const entries = Object.entries(dropConfig.table) as Array<[Exclude<PowerUpId, 'golden'>, number]>;
    let pick = Math.random() * entries.reduce((sum, [, w]) => sum + w, 0);
    for (const [id, weight] of entries) {
      pick -= weight;
      if (pick < 0) return id;
    }
    return entries[0][0];
  }

  private removeDrop(index: number): void {
    const [drop] = this.drops.splice(index, 1);
    this.scene.tweens.killTweensOf([drop.icon, drop.glow]);
    drop.icon.destroy();
    drop.glow.destroy();
  }

  // ───────────────────────── Efeitos ─────────────────────────

  private apply(id: PowerUpId): void {
    const { player, economy, weapons, lighting } = this.deps;
    const def = powerUps[id];
    let detail: string | undefined;

    switch (id) {
      case 'max_ammo':
        weapons.refillAllAmmo();
        break;
      case 'full_heal':
        player.heal();
        break;
      case 'armor':
        player.refillArmor();
        break;
      case 'nuke':
        this.nuke();
        break;
      case 'double_cash':
        this.startTimer(id, def, () => (economy.cashMultiplier = powerUpEffects.cashMultiplier), () => (economy.cashMultiplier = 1));
        break;
      case 'insta_kill':
        this.startTimer(id, def, () => (this.buffs.instaKill = true), () => (this.buffs.instaKill = false));
        break;
      case 'speed_boost':
        this.startTimer(id, def, () => (player.speedBuff = powerUpEffects.speedMultiplier), () => (player.speedBuff = 1));
        break;
      case 'golden':
        detail = this.golden();
        break;
    }

    lighting.addFlash(player.x, player.y, 160, 0.8, 500);
    emitGameEvent(this.scene.game.events, GameEvents.PowerUpCollected, { id, name: def.name, color: def.color, detail });
  }

  /** Efeito temporário: pegar de novo renova a duração. */
  private startTimer(key: string, def: { name: string; color: number }, onStart: () => void, onEnd: () => void, durationMs?: number): void {
    const total = durationMs ?? powerUps[key as PowerUpId]?.durationMs ?? 10_000;
    onStart();
    this.timers.set(key, { name: def.name, color: def.color, expiresAt: this.scene.time.now + total, totalMs: total, onEnd });
  }

  /** Nuke: mata todos os zumbis vivos; paga um valor fixo. */
  private nuke(): void {
    const { zombies, effects, economy } = this.deps;
    for (const child of zombies.getChildren()) {
      const z = child as Zombie;
      if (!z.active || !z.isAlive) continue;
      const x = z.x;
      const y = z.y;
      if (z.takeDamage(Number.MAX_SAFE_INTEGER, false, 'nuke')) effects.zombieDeath(x, y, Math.random() * Math.PI * 2, z.skin);
    }
    economy.earn(powerUpEffects.nukeReward);
    audio.play('explosion', { category: 'world', volume: 1, rate: 0.7 });
    const cam = this.scene.cameras.main;
    cam.flash(450, 255, 190, 110);
    cam.shake(500, 0.008);
  }

  /** Golden Drop (GDD §43): arma especial, dinheiro alto, perk grátis ou Fúria. */
  private golden(): string {
    const { weapons, economy, perks: perkSystem } = this.deps;
    const outcomes = Object.entries(goldenConfig.outcomes) as Array<[keyof typeof goldenConfig.outcomes, number]>;
    let pick = Math.random() * outcomes.reduce((sum, [, w]) => sum + w, 0);
    let outcome: keyof typeof goldenConfig.outcomes = 'money';
    for (const [id, w] of outcomes) {
      pick -= w;
      if (pick < 0) {
        outcome = id;
        break;
      }
    }

    if (outcome === 'weapon') {
      const id = Phaser.Utils.Array.GetRandom(goldenConfig.weapons);
      if (weapons.owns(id)) weapons.refillAllAmmo();
      else weapons.give(id);
      return weapons.current.config.name;
    }
    if (outcome === 'perk') {
      const available = (Object.keys(perks) as PerkId[]).filter((id) => !perkSystem.isMaxed(id));
      if (available.length > 0) {
        const id = Phaser.Utils.Array.GetRandom(available);
        perkSystem.grant(id);
        return `Perk grátis: ${perks[id].name}`;
      }
    }
    if (outcome === 'fury') {
      this.startTimer(
        'fury',
        { name: 'Fúria', color: powerUps.golden.color },
        () => (this.buffs.damageMultiplier = goldenConfig.furyDamageMultiplier),
        () => (this.buffs.damageMultiplier = 1),
        goldenConfig.furyDurationMs,
      );
      return `Fúria: dano x${goldenConfig.furyDamageMultiplier}`;
    }
    // Dinheiro (também é o prêmio quando não há perk disponível); não passa pelo Double Cash.
    const multiplier = economy.cashMultiplier;
    economy.cashMultiplier = 1;
    economy.earn(goldenConfig.money);
    economy.cashMultiplier = multiplier;
    return `+$${goldenConfig.money.toLocaleString('pt-BR')}`;
  }

  /** Envia os cronômetros à HUD quando o segundo exibido muda. */
  private emitTimers(time: number): void {
    const timers: PowerUpTimer[] = [...this.timers.entries()].map(([id, t]) => ({
      id,
      name: t.name,
      color: t.color,
      remainingMs: Math.max(0, t.expiresAt - time),
      totalMs: t.totalMs,
    }));
    const key = timers.map((t) => `${t.id}:${Math.ceil(t.remainingMs / 1000)}`).join('|');
    if (key === this.lastTimersKey) return;
    this.lastTimersKey = key;
    emitGameEvent(this.scene.game.events, GameEvents.PowerUpTimers, { timers });
  }
}
