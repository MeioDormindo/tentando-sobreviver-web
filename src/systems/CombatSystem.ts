import Phaser from 'phaser';
import { headshotConfig } from '../config/economy.config';
import type { PerkModifiers } from '../config/machines.config';
import type { WeaponConfig } from '../config/weapons.config';
import type { ExplosiveConfig } from '../config/zombies.config';
import type { KillSource } from '../game/events';
import type { EffectsSystem, ExplosionStyle } from '../effects/EffectsSystem';
import type { Player } from '../entities/Player';
import { Projectile, PROJECTILE_BURST } from '../entities/Projectile';
import { Zombie } from '../entities/Zombie';
import { Boss } from '../entities/Boss';
import type { NavGrid } from './pathfinding/NavGrid';

export interface CombatSystemDeps {
  player: Player;
  zombies: Phaser.Physics.Arcade.Group;
  projectiles: Phaser.Physics.Arcade.Group;
  walls: Phaser.Tilemaps.TilemapLayer;
  /** Props sólidos (bancos, caixas, barris...). */
  obstacles: Phaser.Physics.Arcade.StaticGroup;
  /** Props que servem de cobertura contra tiros. */
  bulletBlockers: Phaser.Physics.Arcade.StaticGroup;
  /** Barricadas das janelas: bloqueiam o jogador sempre; os zumbis, só enquanto há tábuas. */
  barricades: Phaser.Physics.Arcade.StaticGroup;
  effects: EffectsSystem;
  modifiers: Readonly<PerkModifiers>;
  /** Efeitos temporários de power-ups. */
  buffs: Readonly<CombatBuffs>;
  /** Grupo com o boss atual (se houver). */
  bosses: Phaser.Physics.Arcade.Group;
  /** Linha de visão para o raio da Arc Gun. */
  nav: NavGrid;
}

export interface CombatBuffs {
  /** Instant Kill: um acerto mata zumbis comuns. */
  instaKill: boolean;
  /** Fúria (Golden Drop): multiplicador de dano. */
  damageMultiplier: number;
}

type ArcadeObject = Parameters<Phaser.Types.Physics.Arcade.ArcadePhysicsCallback>[0];

/** Explosões ferem muito mais os zumbis que o jogador (o Exploder abre buracos na horda). */
const EXPLOSION_ZOMBIE_MULTIPLIER = 4;
/** Na borda da explosão sobra esta fração do dano. */
const EXPLOSION_EDGE_FALLOFF = 0.3;
/** Arc Gun: cone (graus, para cada lado) em que o raio procura o primeiro alvo. */
const ARC_AIM_CONE = 22;
/** Passo ao procurar onde um raio sem alvo bate na parede (px). */
const ARC_PROBE_STEP = 16;
const ARC_DEFAULT_TINT = 0x7fd8ff;
/** Intervalo entre labaredas sobre um alvo em chamas (ms). */
const BURN_PUFF_MS = 90;

interface BlastOptions {
  radius: number;
  damage: number;
  /** Multiplicador do dano nos zumbis. */
  zombieMultiplier: number;
  harmPlayer: boolean;
  source: KillSource;
  style: ExplosionStyle;
  exclude?: Zombie;
  /** Atordoa quem sobreviver (plasma). */
  stunMs?: number;
}

type Target = Zombie | Boss;

interface Burn {
  /** Vida do zumbi quando pegou fogo (o pool reaproveita zumbis). */
  life: number;
  dps: number;
  until: number;
  nextPuff: number;
}

/**
 * Registra colisões e sobreposições de combate e resolve as mecânicas das armas
 * especiais (explosões, fogo, raio elétrico).
 * O ataque corpo a corpo do zumbi é decidido pela própria IA (Zombie.update).
 */
export class CombatSystem {
  private readonly burning = new Map<Target, Burn>();

  constructor(private readonly scene: Phaser.Scene, private readonly deps: CombatSystemDeps) {
    const { player, zombies, projectiles, walls, obstacles, bulletBlockers, barricades, effects, modifiers, buffs, bosses } = deps;
    const physics = scene.physics;

    physics.add.collider(player, walls);
    physics.add.collider(player, obstacles);
    physics.add.collider(zombies, walls);
    physics.add.collider(zombies, obstacles);
    physics.add.collider(zombies, zombies);
    physics.add.collider(player, zombies);
    physics.add.collider(player, barricades);
    physics.add.collider(bosses, walls);
    physics.add.collider(bosses, obstacles);
    physics.add.collider(player, bosses);
    physics.add.collider(zombies, bosses);

    // Tiros no boss: sem Instant Kill (só inimigos comuns), mas a Fúria vale.
    physics.add.overlap(
      projectiles,
      bosses,
      (a, b) => {
        const projectile = CombatSystem.find(Projectile, a, b);
        const boss = CombatSystem.find(Boss, a, b);
        if (!projectile || !boss) return;
        const angle = projectile.angleOfTravel;
        const damage = projectile.damage * buffs.damageMultiplier;
        const special = projectile.special;
        if (special?.type === 'grenade') {
          boss.takeDamage(damage);
          this.burst(projectile);
          return;
        }
        if (projectile.registerHit(boss)) projectile.kill();
        if (special?.type === 'flame') {
          boss.takeDamage(damage, false);
          this.ignite(boss, special.burnDps * projectile.damageScale, special.burnMs);
          return;
        }
        effects.bloodHit(projectile.x, projectile.y, angle);
        boss.takeDamage(damage);
      },
      (a, b) => {
        const projectile = CombatSystem.find(Projectile, a, b);
        const boss = CombatSystem.find(Boss, a, b);
        return !!projectile?.active && !!boss?.isAlive && !projectile.hasHit(boss);
      },
    );
    physics.add.collider(zombies, barricades, undefined, (a, b) => {
      const zone = (a instanceof Zombie ? b : a) as Phaser.GameObjects.Zone;
      return (zone.getData('barricade') as { isIntact: boolean } | undefined)?.isIntact ?? false;
    });

    const stopBullet = (a: ArcadeObject, b: ArcadeObject): void => {
      const projectile = CombatSystem.find(Projectile, a, b);
      if (!projectile?.active) return;
      if (projectile.bursts) {
        this.burst(projectile);
        return;
      }
      if (projectile.special?.type !== 'flame') effects.surfaceImpact(projectile.x, projectile.y, projectile.angleOfTravel);
      projectile.kill();
    };
    physics.add.collider(projectiles, walls, stopBullet);
    physics.add.overlap(projectiles, bulletBlockers, stopBullet);

    physics.add.overlap(
      projectiles,
      zombies,
      (a, b) => {
        const projectile = CombatSystem.find(Projectile, a, b);
        const zombie = CombatSystem.find(Zombie, a, b);
        if (!projectile || !zombie) return;
        if (projectile.special) {
          this.specialHit(projectile, zombie);
          return;
        }
        const angle = projectile.angleOfTravel;
        const headshot = CombatSystem.isHeadshot(projectile, zombie, angle);
        const headshotMult = headshotConfig.damageMultiplier + modifiers.headshotBonus;
        const damage = buffs.instaKill
          ? zombie.hp
          : projectile.damage * (headshot ? headshotMult : 1) * buffs.damageMultiplier;
        if (projectile.registerHit(zombie)) projectile.kill();
        effects.bloodHit(zombie.x, zombie.y, angle);
        if (zombie.takeDamage(damage, headshot)) {
          effects.zombieDeath(zombie.x, zombie.y, angle, zombie.skin);
        }
      },
      (a, b) => {
        const projectile = CombatSystem.find(Projectile, a, b);
        const zombie = CombatSystem.find(Zombie, a, b);
        return !!projectile?.active && !!zombie?.isAlive && !projectile.hasHit(zombie);
      },
    );

    // Granadas e plasma que chegam ao fim do alcance explodem no ar.
    const onBurst = (projectile: Projectile): void => this.burst(projectile);
    scene.events.on(PROJECTILE_BURST, onBurst);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(PROJECTILE_BURST, onBurst));
  }

  /** Dano contínuo do fogo. */
  update(time: number, delta: number): void {
    const { effects, buffs } = this.deps;
    for (const [target, burn] of this.burning) {
      const zombie = target instanceof Zombie ? target : null;
      if (!target.isAlive || time >= burn.until || (zombie && zombie.lifeId !== burn.life)) {
        this.burning.delete(target);
        continue;
      }
      if (time >= burn.nextPuff) {
        burn.nextPuff = time + BURN_PUFF_MS;
        effects.burnPuff(target.x, target.y);
      }
      const damage = burn.dps * buffs.damageMultiplier * (delta / 1000);
      if (zombie) {
        const { x, y } = zombie;
        if (zombie.takeDamage(damage, false, 'weapon', false)) {
          effects.zombieDeath(x, y, Math.random() * Math.PI * 2, zombie.skin);
          this.burning.delete(target);
        }
      } else {
        target.takeDamage(damage, false);
      }
    }
  }

  /**
   * Explosão de um Exploder: fere o jogador (exceto quando causada pelo Nuke) e os
   * zumbis no raio. Abates contam para quem matou o Exploder (arma → paga e pode dropar).
   */
  explode(x: number, y: number, explosive: ExplosiveConfig, source: KillSource, self: Zombie): void {
    this.blast(x, y, {
      radius: explosive.radius,
      damage: explosive.damage,
      zombieMultiplier: EXPLOSION_ZOMBIE_MULTIPLIER,
      harmPlayer: source !== 'nuke',
      source,
      style: 'exploder',
      exclude: self,
    });
  }

  /**
   * Arc Gun: raio instantâneo no alvo mais bem alinhado com a mira; depois salta
   * para o zumbi mais próximo ainda não atingido, perdendo força a cada salto.
   */
  fireArc(x: number, y: number, aim: number, cfg: WeaponConfig, damageScale: number): void {
    const special = cfg.special;
    if (special?.type !== 'arc') return;
    const { nav, effects, buffs } = this.deps;
    const tint = cfg.tracerTint ?? ARC_DEFAULT_TINT;
    const cone = Phaser.Math.DegToRad(ARC_AIM_CONE);
    const targets = this.liveTargets();
    const points = [{ x, y }];

    let current: Target | null = null;
    let bestScore = Infinity;
    for (const t of targets) {
      const d = Phaser.Math.Distance.Between(x, y, t.x, t.y);
      const off = Math.abs(Phaser.Math.Angle.Wrap(Phaser.Math.Angle.Between(x, y, t.x, t.y) - aim));
      if (d > cfg.range || off > cone) continue;
      const score = d * (1 + off * 2);
      if (score < bestScore && nav.lineOfSight(x, y, t.x, t.y, 0)) {
        current = t;
        bestScore = score;
      }
    }

    if (!current) {
      // Sem alvo: o raio segue a mira até bater em algo.
      let end = { x: x + Math.cos(aim) * cfg.range, y: y + Math.sin(aim) * cfg.range };
      for (let d = ARC_PROBE_STEP; d <= cfg.range; d += ARC_PROBE_STEP) {
        const px = x + Math.cos(aim) * d;
        const py = y + Math.sin(aim) * d;
        if (!nav.lineOfSight(x, y, px, py, 0)) break;
        end = { x: px, y: py };
      }
      points.push(end);
      effects.lightning(points, tint);
      return;
    }

    const hit = new Set<Target>();
    let damage = cfg.damage * damageScale * buffs.damageMultiplier;
    for (let jump = 0; current && jump <= special.chains; jump++) {
      const from = points[points.length - 1];
      const origin: Target = current;
      hit.add(origin);
      points.push({ x: origin.x, y: origin.y });
      this.shock(origin, damage, special.stunMs, Phaser.Math.Angle.Between(from.x, from.y, origin.x, origin.y));
      damage *= special.chainFalloff;

      current = null;
      let nearest = special.chainRange;
      for (const t of targets) {
        if (hit.has(t) || !t.isAlive) continue;
        const d = Phaser.Math.Distance.Between(origin.x, origin.y, t.x, t.y);
        if (d < nearest && nav.lineOfSight(origin.x, origin.y, t.x, t.y, 0)) {
          current = t;
          nearest = d;
        }
      }
    }
    effects.lightning(points, tint);
  }

  /** Acerto de granada, chama ou plasma num zumbi. */
  private specialHit(projectile: Projectile, zombie: Zombie): void {
    const special = projectile.special;
    if (!special) return;
    const { effects, buffs } = this.deps;
    const angle = projectile.angleOfTravel;
    const damage = buffs.instaKill ? zombie.hp : projectile.damage * buffs.damageMultiplier;
    const { x, y } = zombie;

    if (special.type === 'grenade') {
      // Impacto direto + explosão.
      if (zombie.takeDamage(damage)) effects.zombieDeath(x, y, angle, zombie.skin);
      this.burst(projectile);
      return;
    }
    if (projectile.registerHit(zombie)) projectile.kill();
    if (special.type === 'flame') {
      if (zombie.takeDamage(damage, false, 'weapon', false)) effects.zombieDeath(x, y, angle, zombie.skin);
      else this.ignite(zombie, special.burnDps * projectile.damageScale, special.burnMs);
      return;
    }
    // Plasma: atravessa a horda eletrocutando.
    effects.bloodHit(x, y, angle);
    if (zombie.takeDamage(damage)) effects.zombieDeath(x, y, angle, zombie.skin);
    else zombie.stun(special.stunMs);
  }

  /** Granada/plasma explode onde está (não fere o jogador). */
  private burst(projectile: Projectile): void {
    const special = projectile.special;
    const { x, y } = projectile;
    projectile.kill();
    if (special?.type !== 'grenade' && special?.type !== 'plasma') return;
    this.blast(x, y, {
      radius: special.blastRadius,
      damage: special.blastDamage * projectile.damageScale * this.deps.buffs.damageMultiplier,
      zombieMultiplier: 1,
      harmPlayer: false,
      source: 'weapon',
      style: special.type,
      stunMs: special.type === 'plasma' ? special.stunMs : undefined,
    });
  }

  /** Dano em área com queda até a borda. Abates contam para quem causou a explosão. */
  private blast(x: number, y: number, o: BlastOptions): void {
    const { player, zombies, effects } = this.deps;
    effects.explosion(x, y, o.radius, o.style);
    const falloff = (d: number) => 1 - (1 - EXPLOSION_EDGE_FALLOFF) * (d / o.radius);

    const dp = Phaser.Math.Distance.Between(player.x, player.y, x, y);
    if (o.harmPlayer && dp <= o.radius) {
      player.takeDamage(Math.round(o.damage * falloff(dp)), this.scene.time.now);
    }

    // O boss também sofre com explosões (dano normal).
    for (const child of this.deps.bosses.getChildren()) {
      const boss = child as Boss;
      const d = Phaser.Math.Distance.Between(boss.x, boss.y, x, y);
      if (boss.isAlive && d <= o.radius + boss.config.bodyRadius) boss.takeDamage(o.damage * falloff(Math.min(d, o.radius)));
    }

    for (const child of zombies.getChildren()) {
      const z = child as Zombie;
      if (z === o.exclude || !z.active || !z.isAlive) continue;
      const d = Phaser.Math.Distance.Between(z.x, z.y, x, y);
      if (d > o.radius) continue;
      const zx = z.x;
      const zy = z.y;
      if (z.takeDamage(o.damage * o.zombieMultiplier * falloff(d), false, o.source)) {
        effects.zombieDeath(zx, zy, Phaser.Math.Angle.Between(x, y, zx, zy), z.skin);
      } else if (o.stunMs) {
        z.stun(o.stunMs);
      }
    }
  }

  private ignite(target: Target, dps: number, ms: number): void {
    const now = this.scene.time.now;
    const burn = this.burning.get(target);
    if (burn) {
      burn.until = Math.max(burn.until, now + ms);
      burn.dps = Math.max(burn.dps, dps);
      return;
    }
    const life = target instanceof Zombie ? target.lifeId : 0;
    this.burning.set(target, { life, dps, until: now + ms, nextPuff: now });
  }

  /** Dano elétrico (o boss não fica atordoado). */
  private shock(target: Target, damage: number, stunMs: number, angle: number): void {
    if (target instanceof Boss) {
      target.takeDamage(damage);
      return;
    }
    const { x, y } = target;
    const dealt = this.deps.buffs.instaKill ? target.hp : damage;
    if (target.takeDamage(dealt)) this.deps.effects.zombieDeath(x, y, angle, target.skin);
    else target.stun(stunMs);
  }

  private liveTargets(): Target[] {
    const list: Target[] = [];
    for (const c of this.deps.zombies.getChildren()) if (c instanceof Zombie && c.active && c.isAlive) list.push(c);
    for (const c of this.deps.bosses.getChildren()) if (c instanceof Boss && c.isAlive) list.push(c);
    return list;
  }

  /**
   * Vista de cima: a cabeça fica no centro do zumbi. É headshot quando a trajetória
   * do tiro passa a menos de headRadius desse centro.
   */
  private static isHeadshot(projectile: Projectile, zombie: Zombie, angle: number): boolean {
    const dx = zombie.x - projectile.x;
    const dy = zombie.y - projectile.y;
    const offLine = Math.abs(dx * Math.sin(angle) - dy * Math.cos(angle));
    return offLine <= headshotConfig.headRadius;
  }

  private static find<T>(
    ctor: abstract new (...args: never[]) => T,
    a: ArcadeObject,
    b: ArcadeObject,
  ): T | null {
    if (a instanceof ctor) return a;
    if (b instanceof ctor) return b;
    return null;
  }
}
