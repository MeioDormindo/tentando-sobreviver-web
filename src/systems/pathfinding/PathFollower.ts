import Phaser from 'phaser';
import type { NavGrid, PathPoint } from './NavGrid';

/** O que quem navega precisa saber de uma barricada. */
export interface BarricadeTarget {
  readonly x: number;
  readonly y: number;
  readonly isIntact: boolean;
  takeHit(amount?: number): void;
}

/** Mundo navegável: grade + barricadas por tile. */
export interface NavWorld {
  nav: NavGrid;
  barricadeAt(tx: number, ty: number): BarricadeTarget | null;
}

/** Intervalo entre checagens de linha de visão (ms). */
const LOS_INTERVAL = 140;
/** Intervalo base entre recálculos de caminho (ms) + aleatório, para espalhar o custo. */
const REPATH_BASE = 650;
const REPATH_JITTER = 400;
/** Distância para considerar um ponto do caminho alcançado (px). */
const WAYPOINT_REACHED = 12;
/** Folga extra da barricada para começar a quebrá-la (px, além do raio do corpo). */
const BARRICADE_REACH_EXTRA = 34;
/** Deslize ao encostar em obstáculos durante a perseguição direta. */
const DETOUR_MEMORY_MS = 1500;
const DETOUR_HUG = 0.3;
const DETOUR_ALIGN_TOLERANCE = 16;

/**
 * Navegação compartilhada por zumbis e bosses (GDD §22–23): perseguição direta quando
 * o alvo está à vista (deslizando em obstáculos); caso contrário, segue o caminho do A*
 * "puxando a corda" e para diante de barricadas intactas.
 */
export class PathFollower {
  /** Para onde o corpo deve olhar neste frame. */
  readonly face = new Phaser.Math.Vector2();

  private path: PathPoint[] | null = null;
  private pathIndex = 0;
  private nextRepathAt = 0;
  private nextLosAt = 0;
  private hasLos = false;
  private detouring = false;
  private detourUntil = 0;
  private lastDetourEnd = -Infinity;
  private readonly detourAlong = new Phaser.Math.Vector2();
  private readonly detourInto = new Phaser.Math.Vector2();

  constructor(private readonly sprite: Phaser.Physics.Arcade.Sprite) {}

  reset(): void {
    this.path = null;
    this.pathIndex = 0;
    this.nextRepathAt = 0;
    this.nextLosAt = 0;
    this.hasLos = false;
    this.detouring = false;
    this.lastDetourEnd = -Infinity;
    this.detourAlong.set(0, 0);
  }

  /**
   * Move em direção ao alvo. Retorna a barricada intacta que bloqueia o caminho
   * quando já está ao alcance (quem chama decide quebrá-la); senão, null.
   */
  step(world: NavWorld, time: number, tx: number, ty: number, speed: number, radius: number): BarricadeTarget | null {
    const s = this.sprite;
    const clearance = radius - 2;
    if (time >= this.nextLosAt) {
      this.hasLos = world.nav.lineOfSight(s.x, s.y, tx, ty, clearance);
      this.nextLosAt = time + LOS_INTERVAL;
    }
    if (this.hasLos) {
      this.path = null;
      this.chaseDirect(time, tx, ty, speed, radius);
      return null;
    }

    if (!this.path || this.pathIndex >= this.path.length || time >= this.nextRepathAt) {
      this.path = world.nav.findPath(s.x, s.y, tx, ty);
      this.pathIndex = 1;
      this.nextRepathAt = time + REPATH_BASE + Math.random() * REPATH_JITTER;
    }
    const path = this.path;
    if (!path || this.pathIndex >= path.length) {
      this.chaseDirect(time, tx, ty, speed, radius);
      return null;
    }

    // Avança os pontos já alcançados e "puxa a corda" quando o seguinte já está à vista.
    let wp = path[this.pathIndex];
    if (Phaser.Math.Distance.Between(s.x, s.y, wp.x, wp.y) < WAYPOINT_REACHED) this.pathIndex++;
    else if (this.pathIndex + 1 < path.length) {
      const next = path[this.pathIndex + 1];
      if (world.nav.lineOfSight(s.x, s.y, next.x, next.y, clearance)) this.pathIndex++;
    }
    if (this.pathIndex >= path.length) return null;
    wp = path[this.pathIndex];

    // Janela com barricada no caminho: para diante dela.
    const tile = world.nav.tileSize;
    const barricade = world.barricadeAt(Math.floor(wp.x / tile), Math.floor(wp.y / tile));
    if (barricade?.isIntact && Phaser.Math.Distance.Between(s.x, s.y, barricade.x, barricade.y) < radius + BARRICADE_REACH_EXTRA) {
      s.setVelocity(0, 0);
      this.face.set(barricade.x, barricade.y);
      return barricade;
    }

    this.detouring = false;
    s.scene.physics.moveTo(s, wp.x, wp.y, speed);
    this.face.set(wp.x, wp.y);
    return null;
  }

  /**
   * Perseguição direta com deslize em obstáculos: ao bater, desliza ao longo dele
   * mantendo o mesmo sentido até passar da quina.
   */
  private chaseDirect(time: number, tx: number, ty: number, speed: number, radius: number): void {
    const s = this.sprite;
    const body = s.body as Phaser.Physics.Arcade.Body | null;
    this.face.set(tx, ty);
    if (!body) return;
    const blockedX = body.blocked.left || body.blocked.right;
    const blockedY = body.blocked.up || body.blocked.down;

    if (this.detouring) {
      if ((this.detourAlong.x !== 0 && blockedX) || (this.detourAlong.y !== 0 && blockedY)) this.detourAlong.negate();
      const touching = this.detourAlong.x !== 0 ? blockedY : blockedX;
      if (touching) this.detourUntil = time + ((radius * 2.5) / speed) * 1000;
      else if (time >= this.detourUntil) {
        this.detouring = false;
        this.lastDetourEnd = time;
      }
      if (this.detouring) {
        this.applyDetourVelocity(speed);
        return;
      }
    }
    if (blockedX || blockedY) {
      const recent = time - this.lastDetourEnd < DETOUR_MEMORY_MS;
      const prevSign = this.detourAlong.x + this.detourAlong.y;
      const delta = blockedX ? ty - s.y : tx - s.x;
      let sign: number;
      if (recent && prevSign !== 0) sign = Math.sign(prevSign);
      else if (Math.abs(delta) > DETOUR_ALIGN_TOLERANCE) sign = Math.sign(delta);
      else sign = Phaser.Math.RND.sign();
      this.detourAlong.set(blockedX ? 0 : sign, blockedX ? sign : 0);
      if (blockedX) this.detourInto.set(body.blocked.right ? 1 : -1, 0);
      else this.detourInto.set(0, body.blocked.down ? 1 : -1);
      this.detouring = true;
      this.detourUntil = time;
      this.applyDetourVelocity(speed);
      return;
    }
    s.scene.physics.moveTo(s, tx, ty, speed);
  }

  private applyDetourVelocity(speed: number): void {
    this.sprite.setVelocity(
      (this.detourAlong.x + this.detourInto.x * DETOUR_HUG) * speed,
      (this.detourAlong.y + this.detourInto.y * DETOUR_HUG) * speed,
    );
  }
}
