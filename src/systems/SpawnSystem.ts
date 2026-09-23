import Phaser from 'phaser';
import { spawnConfig } from '../config/waves.config';
import type { ZombieConfig } from '../config/zombies.config';
import type { Player } from '../entities/Player';
import type { Zombie } from '../entities/Zombie';

/** Ponto de spawn (GDD §20). */
export interface SpawnPoint {
  id: string;
  x: number;
  y: number;
  sector: string;
  /** Primeira wave em que o ponto pode ser usado. */
  minWave: number;
  enabled: boolean;
}

/**
 * Escolhe onde os zumbis surgem (GDD §21): nunca perto do jogador, de preferência
 * fora da tela, e nunca em cima de outro zumbi. Não decide quantos nem quando — isso é do WaveSystem.
 */
export class SpawnSystem {
  private readonly scene: Phaser.Scene;
  private readonly zombies: Phaser.Physics.Arcade.Group;
  private readonly points: SpawnPoint[];
  private readonly player: Player;

  constructor(scene: Phaser.Scene, zombies: Phaser.Physics.Arcade.Group, points: SpawnPoint[], player: Player) {
    this.scene = scene;
    this.zombies = zombies;
    this.points = points;
    this.player = player;
  }

  get aliveCount(): number {
    return this.zombies.countActive(true);
  }

  /** Tenta criar um zumbi; retorna null se nenhum ponto é válido agora ou o pool esgotou. */
  spawn(config: ZombieConfig, wave: number): Zombie | null {
    const point = this.pickPoint(wave);
    if (!point) return null;
    const zombie = this.zombies.get(point.x, point.y) as Zombie | null;
    if (!zombie) return null;
    zombie.spawn(point.x, point.y, config, this.player);
    zombie.fadeIn(spawnConfig.fadeInMs);
    return zombie;
  }

  /**
   * Rede de segurança: zumbis presos (sem se aproximar há muito tempo) e fora da tela
   * reaparecem em outro ponto, para a wave nunca travar.
   */
  relocateStuck(wave: number): void {
    for (const child of this.zombies.getChildren()) {
      const z = child as Zombie;
      if (!z.active || !z.isAlive || z.stuckMs < spawnConfig.stuckTimeoutMs) continue;
      if (this.isOnScreen(z)) continue;
      const point = this.pickPoint(wave);
      if (!point) return;
      z.relocate(point.x, point.y);
      z.fadeIn(spawnConfig.fadeInMs);
    }
  }

  private pickPoint(wave: number): SpawnPoint | null {
    const candidates = this.points.filter(
      (p) =>
        p.enabled &&
        wave >= p.minWave &&
        Phaser.Math.Distance.Between(p.x, p.y, this.player.x, this.player.y) >= spawnConfig.minDistanceFromPlayer &&
        this.isClear(p),
    );
    if (candidates.length === 0) return null;
    const hidden = candidates.filter((p) => !this.isOnScreen(p));
    return Phaser.Utils.Array.GetRandom(hidden.length > 0 ? hidden : candidates);
  }

  private isOnScreen(p: { x: number; y: number }): boolean {
    const view = this.scene.cameras.main.worldView;
    const m = spawnConfig.offscreenMargin;
    return p.x > view.x - m && p.x < view.right + m && p.y > view.y - m && p.y < view.bottom + m;
  }

  private isClear(p: SpawnPoint): boolean {
    const r = spawnConfig.clearRadius;
    return !this.zombies.getChildren().some((child) => {
      const z = child as Zombie;
      return z.active && Math.abs(z.x - p.x) < r && Math.abs(z.y - p.y) < r;
    });
  }
}
