import Phaser from 'phaser';
import { testSpawnConfig } from '../config/spawn.config';
import { getZombieConfig } from '../config/zombies.config';
import type { Player } from '../entities/Player';
import type { Zombie } from '../entities/Zombie';

/**
 * TEMPORÁRIO (Fase 1): mantém alguns zumbis vivos para testar o combate.
 * Será substituído pelo SpawnSystem + WaveSystem na Fase 2.
 */
export class TestSpawner {
  private readonly zombies: Phaser.Physics.Arcade.Group;
  private readonly spawnPoints: Phaser.Math.Vector2[];
  private readonly player: Player;

  constructor(
    scene: Phaser.Scene,
    zombies: Phaser.Physics.Arcade.Group,
    spawnPoints: Phaser.Math.Vector2[],
    player: Player,
  ) {
    this.zombies = zombies;
    this.spawnPoints = spawnPoints;
    this.player = player;

    scene.time.addEvent({
      delay: testSpawnConfig.interval,
      loop: true,
      callback: this.trySpawn,
      callbackScope: this,
    });
  }

  private trySpawn(): void {
    if (!this.player.isAlive) return;
    if (this.zombies.countActive(true) >= testSpawnConfig.maxAlive) return;

    // Regra §21: nunca spawnar muito perto do jogador.
    const candidates = this.spawnPoints.filter(
      (p) =>
        Phaser.Math.Distance.Between(p.x, p.y, this.player.x, this.player.y) >=
        testSpawnConfig.minDistanceFromPlayer,
    );
    const point = Phaser.Utils.Array.GetRandom(candidates);
    if (!point) return;

    const zombie = this.zombies.get(point.x, point.y) as Zombie | null;
    zombie?.spawn(point.x, point.y, getZombieConfig(testSpawnConfig.zombieType), this.player);
  }
}
