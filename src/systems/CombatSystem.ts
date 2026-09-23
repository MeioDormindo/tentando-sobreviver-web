import Phaser from 'phaser';
import { headshotConfig } from '../config/economy.config';
import type { PerkModifiers } from '../config/machines.config';
import type { ExplosiveConfig } from '../config/zombies.config';
import type { KillSource } from '../game/events';
import type { EffectsSystem } from '../effects/EffectsSystem';
import type { Player } from '../entities/Player';
import { Projectile } from '../entities/Projectile';
import { Zombie } from '../entities/Zombie';
import { Boss } from '../entities/Boss';

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

/**
 * Registra colisões e sobreposições de combate.
 * O ataque corpo a corpo do zumbi é decidido pela própria IA (Zombie.update).
 */
export class CombatSystem {
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
        if (projectile.registerHit(boss)) projectile.kill();
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
      effects.surfaceImpact(projectile.x, projectile.y, projectile.angleOfTravel);
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
  }

  /**
   * Explosão de um Exploder: fere o jogador (exceto quando causada pelo Nuke) e os
   * zumbis no raio. Abates contam para quem matou o Exploder (arma → paga e pode dropar).
   */
  explode(x: number, y: number, explosive: ExplosiveConfig, source: KillSource, self: Zombie): void {
    const { player, zombies, effects } = this.deps;
    effects.explosion(x, y, explosive.radius);
    const falloff = (d: number) => 1 - (1 - EXPLOSION_EDGE_FALLOFF) * (d / explosive.radius);

    const dp = Phaser.Math.Distance.Between(player.x, player.y, x, y);
    if (source !== 'nuke' && dp <= explosive.radius) {
      player.takeDamage(Math.round(explosive.damage * falloff(dp)), this.scene.time.now);
    }

    // O boss também sofre com explosões (dano normal).
    for (const child of this.deps.bosses.getChildren()) {
      const boss = child as Boss;
      const d = Phaser.Math.Distance.Between(boss.x, boss.y, x, y);
      if (boss.isAlive && d <= explosive.radius + boss.config.bodyRadius) boss.takeDamage(explosive.damage * falloff(Math.min(d, explosive.radius)));
    }

    const credit: KillSource = source === 'weapon' ? 'weapon' : source;
    for (const child of zombies.getChildren()) {
      const z = child as Zombie;
      if (z === self || !z.active || !z.isAlive) continue;
      const d = Phaser.Math.Distance.Between(z.x, z.y, x, y);
      if (d > explosive.radius) continue;
      const zx = z.x;
      const zy = z.y;
      if (z.takeDamage(explosive.damage * EXPLOSION_ZOMBIE_MULTIPLIER * falloff(d), false, credit)) {
        effects.zombieDeath(zx, zy, Phaser.Math.Angle.Between(x, y, zx, zy), z.skin);
      }
    }
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
