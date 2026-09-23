import Phaser from 'phaser';
import { spawnConfig } from '../config/waves.config';
import type { ZombieConfig } from '../config/zombies.config';
import type { Player } from '../entities/Player';
import type { Zombie, ZombieWorld } from '../entities/Zombie';

/** Ponto de spawn (GDD §20). `sector` é a área que precisa estar aberta. */
export interface SpawnPoint {
  id: string;
  x: number;
  y: number;
  sector: string;
  /** Primeira wave em que o ponto pode ser usado. */
  minWave: number;
  enabled: boolean;
}

/** Quantos dos pontos válidos mais próximos entram no sorteio. */
const NEAREST_CANDIDATES = 5;

/**
 * Escolhe onde os zumbis surgem (GDD §21): só em áreas abertas, nunca perto do
 * jogador, de preferência fora da tela e entre os pontos mais próximos (para a horda
 * chegar logo). Não decide quantos nem quando — isso é do WaveSystem.
 */
export class SpawnSystem {
  private readonly unlocked = new Set<string>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly zombies: Phaser.Physics.Arcade.Group,
    private readonly points: SpawnPoint[],
    private readonly player: Player,
    private readonly world: ZombieWorld,
  ) {}

  unlockArea(area: string): void {
    this.unlocked.add(area);
  }

  isUnlocked(area: string): boolean {
    return this.unlocked.has(area);
  }

  get aliveCount(): number {
    return this.zombies.countActive(true);
  }

  /** Quantos zumbis vivos de cada tipo. */
  aliveByType(): Map<string, number> {
    const counts = new Map<string, number>();
    for (const child of this.zombies.getChildren()) {
      const z = child as Zombie;
      if (z.active && z.isAlive) counts.set(z.typeId, (counts.get(z.typeId) ?? 0) + 1);
    }
    return counts;
  }

  /** Tenta criar um zumbi; retorna null se nenhum ponto é válido agora ou o pool esgotou. */
  spawn(config: ZombieConfig, wave: number): Zombie | null {
    const point = this.pickPoint(wave);
    if (!point) return null;
    const zombie = this.zombies.get(point.x, point.y) as Zombie | null;
    if (!zombie) return null;
    zombie.spawn(point.x, point.y, config, this.player, this.world);
    zombie.fadeIn(spawnConfig.fadeInMs);
    return zombie;
  }

  /**
   * Rede de segurança: zumbis presos (parados há muito tempo) e fora da tela
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
    const px = this.player.x;
    const py = this.player.y;
    const candidates = this.points
      .filter(
        (p) =>
          p.enabled &&
          wave >= p.minWave &&
          this.unlocked.has(p.sector) &&
          Phaser.Math.Distance.Between(p.x, p.y, px, py) >= spawnConfig.minDistanceFromPlayer &&
          this.isClear(p),
      )
      .sort((a, b) => Phaser.Math.Distance.Squared(a.x, a.y, px, py) - Phaser.Math.Distance.Squared(b.x, b.y, px, py))
      .slice(0, NEAREST_CANDIDATES);
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
