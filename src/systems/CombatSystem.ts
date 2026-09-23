import Phaser from 'phaser';
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
  effects: EffectsSystem;
}

type ArcadeObject = Parameters<Phaser.Types.Physics.Arcade.ArcadePhysicsCallback>[0];

/**
 * Registra colisões e sobreposições de combate.
 * O ataque corpo a corpo do zumbi é decidido pela própria IA (Zombie.update).
 */
export class CombatSystem {
  constructor(scene: Phaser.Scene, deps: CombatSystemDeps) {
    const { player, zombies, projectiles, walls, obstacles, bulletBlockers, effects } = deps;
    const physics = scene.physics;

    physics.add.collider(player, walls);
    physics.add.collider(player, obstacles);
    physics.add.collider(zombies, walls);
    physics.add.collider(zombies, obstacles);
    physics.add.collider(zombies, zombies);
    physics.add.collider(player, zombies);

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
        const damage = projectile.damage;
        const angle = projectile.angleOfTravel;
        projectile.kill();
        effects.bloodHit(zombie.x, zombie.y, angle);
        if (zombie.takeDamage(damage)) {
          effects.zombieDeath(zombie.x, zombie.y, angle, zombie.variant);
        }
      },
      (a, b) => {
        const projectile = CombatSystem.find(Projectile, a, b);
        const zombie = CombatSystem.find(Zombie, a, b);
        return !!projectile?.active && !!zombie?.isAlive;
      },
    );
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
