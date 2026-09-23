import Phaser from 'phaser';
import { headshotConfig } from '../config/economy.config';
import type { PerkModifiers } from '../config/machines.config';
import type { EffectsSystem } from '../effects/EffectsSystem';
import type { Player } from '../entities/Player';
import { Projectile } from '../entities/Projectile';
import { Zombie } from '../entities/Zombie';

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
}

export interface CombatBuffs {
  /** Instant Kill: um acerto mata zumbis comuns. */
  instaKill: boolean;
  /** Fúria (Golden Drop): multiplicador de dano. */
  damageMultiplier: number;
}

type ArcadeObject = Parameters<Phaser.Types.Physics.Arcade.ArcadePhysicsCallback>[0];

/**
 * Registra colisões e sobreposições de combate.
 * O ataque corpo a corpo do zumbi é decidido pela própria IA (Zombie.update).
 */
export class CombatSystem {
  constructor(scene: Phaser.Scene, deps: CombatSystemDeps) {
    const { player, zombies, projectiles, walls, obstacles, bulletBlockers, barricades, effects, modifiers, buffs } = deps;
    const physics = scene.physics;

    physics.add.collider(player, walls);
    physics.add.collider(player, obstacles);
    physics.add.collider(zombies, walls);
    physics.add.collider(zombies, obstacles);
    physics.add.collider(zombies, zombies);
    physics.add.collider(player, zombies);
    physics.add.collider(player, barricades);
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
          effects.zombieDeath(zombie.x, zombie.y, angle, zombie.variant);
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
