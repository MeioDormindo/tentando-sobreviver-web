import Phaser from 'phaser';
import { WEAPON_MUZZLE } from '../config/assets.config';
import { NEUTRAL_MODIFIERS, type PerkModifiers } from '../config/machines.config';
import { getWeaponConfig, INVENTORY_SLOTS, WEAPON_SWITCH_MS, type WeaponConfig } from '../config/weapons.config';
import type { EffectsSystem } from '../effects/EffectsSystem';
import type { Player } from '../entities/Player';
import { Projectile } from '../entities/Projectile';
import { emitGameEvent, GameEvents } from '../game/events';
import { Weapon } from './Weapon';
import { audio } from '../audio/AudioSystem';

/** Ponto de ejeção das cápsulas, à frente do tronco. */
const EJECT_DISTANCE = 16;
/** O lança-chamas dispara a cada ~45ms; o som do jato só é retocado a este intervalo. */
const FLAME_SOUND_MS = 170;
/** Clarão das armas especiais sem cor própria (lança-granadas). */
const SPECIAL_FLASH_TINT = 0xffe0b0;

/** Quem resolve o raio instantâneo da Arc Gun (CombatSystem). */
export interface ArcCaster {
  fireArc(x: number, y: number, aim: number, cfg: WeaponConfig, damageScale: number): void;
}

/**
 * Inventário de armas + disparo. Toda arma usa a mesma lógica (Weapon + WeaponConfig);
 * o que muda entre elas é só a configuração.
 */
export class WeaponSystem {
  private readonly scene: Phaser.Scene;
  private readonly owner: Player;
  private readonly projectiles: Phaser.Physics.Arcade.Group;
  private readonly effects: EffectsSystem;
  private readonly slots: Weapon[] = [];
  private active = 0;
  /** Enquanto troca de arma, não atira nem recarrega. */
  private busyUntil = 0;
  /** Semiautomática: o gatilho precisa ser solto entre disparos. */
  private triggerConsumed = false;
  private lastSnapshotKey = '';
  private releaseRequired = false;
  private mods: Readonly<PerkModifiers> = NEUTRAL_MODIFIERS;
  private arcCaster: ArcCaster | null = null;
  private nextFlameSoundAt = 0;

  constructor(
    scene: Phaser.Scene,
    owner: Player,
    projectiles: Phaser.Physics.Arcade.Group,
    startingWeapon: WeaponConfig,
    effects: EffectsSystem,
  ) {
    this.scene = scene;
    this.owner = owner;
    this.projectiles = projectiles;
    this.effects = effects;
    this.slots.push(new Weapon(startingWeapon));
    owner.setWeaponKind(startingWeapon.kind);

    const kb = scene.input.keyboard;
    kb?.on('keydown-R', this.onReloadKey, this);
    kb?.on('keydown-Q', this.cycle, this);
    kb?.on('keydown-ONE', this.onSlotOne, this);
    kb?.on('keydown-TWO', this.onSlotTwo, this);
    scene.input.on(Phaser.Input.Events.POINTER_WHEEL, this.cycle, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      kb?.off('keydown-R', this.onReloadKey, this);
      kb?.off('keydown-Q', this.cycle, this);
      kb?.off('keydown-ONE', this.onSlotOne, this);
      kb?.off('keydown-TWO', this.onSlotTwo, this);
      scene.input.off(Phaser.Input.Events.POINTER_WHEEL, this.cycle, this);
    });
  }

  setModifiers(mods: Readonly<PerkModifiers>): void {
    this.mods = mods;
  }

  setArcCaster(caster: ArcCaster): void {
    this.arcCaster = caster;
  }

  /** Ignora o gatilho até o botão ser solto (ex.: o clique que retomou a pausa). */
  holdTrigger(): void {
    this.triggerConsumed = true;
    this.releaseRequired = true;
  }

  /** Weapon Lab: melhora a arma em mãos. */
  upgradeCurrent(): boolean {
    const ok = this.current.upgrade();
    if (ok) this.emitIfChanged();
    return ok;
  }

  get current(): Weapon {
    return this.slots[this.active];
  }

  owns(weaponId: string): boolean {
    return this.slots.some((w) => w.config.id === weaponId);
  }

  /** A reserva de uma arma possuída já está cheia? */
  isAmmoFull(weaponId: string): boolean {
    const weapon = this.slots.find((w) => w.config.id === weaponId);
    return !!weapon && weapon.reserveAmmo >= weapon.config.reserveAmmo;
  }

  /** Adiciona uma arma: ocupa um espaço livre ou substitui a arma em mãos. */
  give(weaponId: string): void {
    if (this.owns(weaponId)) return;
    const weapon = new Weapon(getWeaponConfig(weaponId));
    if (this.slots.length < INVENTORY_SLOTS) {
      this.slots.push(weapon);
      this.equip(this.slots.length - 1, true);
    } else {
      this.slots[this.active] = weapon;
      this.equip(this.active, true);
    }
  }

  /** Max Ammo: enche a reserva de todas as armas. */
  refillAllAmmo(): void {
    for (const weapon of this.slots) weapon.refillReserve();
    this.emitIfChanged();
  }

  /** Enche a reserva de uma arma possuída. */
  refillAmmo(weaponId: string): void {
    this.slots.find((w) => w.config.id === weaponId)?.refillReserve();
    this.emitIfChanged();
  }

  update(time: number): void {
    for (const weapon of this.slots) weapon.update(time);

    if (this.owner.isAlive && time >= this.busyUntil) {
      const triggerDown = this.scene.input.activePointer.leftButtonDown();
      if (!triggerDown) {
        this.triggerConsumed = false;
        this.releaseRequired = false;
      } else if (!this.releaseRequired && (this.current.config.automatic || !this.triggerConsumed)) {
        this.tryFire(time);
      }
    }

    this.emitIfChanged();
  }

  /** Reenvia o estado atual para a HUD. */
  syncHud(): void {
    this.lastSnapshotKey = '';
    this.emitIfChanged();
  }

  private onSlotOne(): void {
    this.equip(0);
  }

  private onSlotTwo(): void {
    this.equip(1);
  }

  private cycle(): void {
    if (this.slots.length > 1) this.equip((this.active + 1) % this.slots.length);
  }

  private equip(index: number, force = false): void {
    if (!this.owner.isAlive || index >= this.slots.length) return;
    if (index === this.active && !force) return;
    this.current.cancelReload();
    this.active = index;
    this.owner.setWeaponKind(this.current.config.kind);
    audio.play('weapon_switch', { category: 'weapon', volume: 0.6 });
    this.busyUntil = this.scene.time.now + WEAPON_SWITCH_MS;
    this.triggerConsumed = true;
    this.emitIfChanged();
  }

  private onReloadKey(): void {
    if (this.owner.isAlive && this.scene.time.now >= this.busyUntil) this.startReload(this.scene.time.now);
  }

  private tryFire(time: number): void {
    const weapon = this.current;
    if (weapon.isReloading) return;

    if (weapon.currentAmmo === 0) {
      // Pente vazio: recarrega automaticamente; sem reserva, "clique seco".
      if (weapon.reserveAmmo === 0) audio.play('dry_fire', { category: 'weapon' });
      this.startReload(time);
      this.triggerConsumed = true;
      return;
    }
    if (!weapon.canFire(time)) return;

    weapon.consume(time);
    this.triggerConsumed = true;
    this.spawnProjectiles();
    this.owner.playShoot();

    if (weapon.currentAmmo === 0) this.startReload(time);
  }

  private startReload(time: number): void {
    const duration = this.current.startReload(time, this.mods.reloadMultiplier);
    if (duration > 0) {
      this.owner.playReload(duration);
      audio.play(`reload_${this.current.config.kind}`, { category: 'weapon', volume: 0.7, pitchJitter: 0 });
    }
  }

  private spawnProjectiles(): void {
    const cfg = this.current.config;
    const aim = this.owner.rotation;
    const muzzle = WEAPON_MUZZLE[cfg.kind];
    const cos = Math.cos(aim);
    const sin = Math.sin(aim);
    const tipX = this.owner.x + cos * muzzle.forward - sin * muzzle.side;
    const tipY = this.owner.y + sin * muzzle.forward + cos * muzzle.side;

    const special = cfg.special;
    let fired = 1;
    if (special?.type === 'arc') {
      this.arcCaster?.fireArc(tipX, tipY, aim, cfg, this.mods.damageMultiplier);
    } else {
      fired = 0;
      for (let i = 0; i < cfg.pellets; i++) {
        const projectile = this.projectiles.get(tipX, tipY) as Projectile | null;
        if (!projectile) break; // pool esgotado
        const spread = Phaser.Math.DegToRad(Phaser.Math.FloatBetween(-cfg.spread, cfg.spread));
        projectile.fire({
          x: tipX, y: tipY, angle: aim + spread, speed: cfg.projectileSpeed, range: cfg.range,
          damage: cfg.damage * this.mods.damageMultiplier, pierce: cfg.pierce, tint: cfg.tracerTint,
          special, damageScale: this.mods.damageMultiplier,
        });
        fired++;
      }
    }
    emitGameEvent(this.scene.game.events, GameEvents.ShotsFired, { count: fired });

    if (special?.type === 'flame') {
      // Jato contínuo: sem clarão nem cápsula, só o brilho do fogo.
      this.effects.glow(tipX + cos * 40, tipY + sin * 40, 130, 90);
      if (this.scene.time.now >= this.nextFlameSoundAt) {
        this.nextFlameSoundAt = this.scene.time.now + FLAME_SOUND_MS;
        audio.play(`shot_${cfg.id}`, { category: 'weapon', volume: 0.6, pitchJitter: 0.08 });
      }
      return;
    }
    this.effects.muzzleFlash(tipX, tipY, aim, special ? cfg.tracerTint ?? SPECIAL_FLASH_TINT : 0xffffff);
    audio.play(`shot_${cfg.id}`, { category: 'weapon', volume: 0.85, pitchJitter: 0.05 });
    if (cfg.upgraded) audio.play('mk2_layer', { category: 'weapon', volume: 0.5 });
    // Armas especiais não usam cartuchos.
    if (!special) this.effects.ejectShell(this.owner.x + cos * EJECT_DISTANCE, this.owner.y + sin * EJECT_DISTANCE, aim);
  }

  private emitIfChanged(): void {
    const snap = this.current.snapshot();
    const other = this.slots.length > 1 ? this.slots[(this.active + 1) % this.slots.length].config.name : null;
    const key = `${snap.weaponName}|${snap.current}|${snap.reserve}|${snap.reloading}|${other}`;
    if (key === this.lastSnapshotKey) return;
    this.lastSnapshotKey = key;
    emitGameEvent(this.scene.game.events, GameEvents.AmmoChanged, { ...snap, secondary: other });
  }
}
