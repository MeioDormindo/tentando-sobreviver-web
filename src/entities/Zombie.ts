import Phaser from 'phaser';
import { ASSET_KEYS, ZOMBIE_VARIANTS, zombieAnimKey, zombieSheetKey, type ZombieVariant } from '../config/assets.config';
import { ART_SCALE, DEPTH } from '../config/visual.config';
import type { ZombieConfig } from '../config/zombies.config';
import { emitGameEvent, GameEvents, type KillSource } from '../game/events';
import type { NavGrid, PathPoint } from '../systems/pathfinding/NavGrid';
import type { Damageable } from './Damageable';

export const ZombieState = {
  Idle: 'IDLE',
  Chase: 'CHASE',
  Attack: 'ATTACK',
  BreakBarricade: 'BREAK_BARRICADE',
  Dead: 'DEAD',
} as const;
export type ZombieState = (typeof ZombieState)[keyof typeof ZombieState];

/** O que o zumbi precisa saber de uma barricada. */
export interface BarricadeTarget {
  readonly x: number;
  readonly y: number;
  readonly isIntact: boolean;
  takeHit(): void;
}

/** Acesso do zumbi ao mundo: navegação e barricadas por tile. */
export interface ZombieWorld {
  nav: NavGrid;
  barricadeAt(tx: number, ty: number): BarricadeTarget | null;
}

/** Margem para sair do ATTACK e voltar a perseguir (evita alternar a cada frame). */
const ATTACK_EXIT_FACTOR = 1.3;
/** Atraso entre o início da animação de ataque e o golpe (ms) — coincide com o bote. */
const ATTACK_HIT_DELAY = 160;
/** Velocidade de giro do corpo (rad/frame). */
const TURN_SPEED = 0.12;
/** Velocidade de referência da animação de caminhada (px/s). */
const WALK_ANIM_SPEED = 60;
const SHADOW_OFFSET = { x: 4, y: 6 };
/** Deslocamento mínimo para contar como progresso (detecção de "preso"). */
const PROGRESS_STEP = 28;
/** Intervalo entre checagens de linha de visão (ms). */
const LOS_INTERVAL = 140;
/** Intervalo base entre recálculos de caminho (ms) + aleatório, para espalhar o custo. */
const REPATH_BASE = 650;
const REPATH_JITTER = 400;
/** Distância para considerar um ponto do caminho alcançado (px). */
const WAYPOINT_REACHED = 12;
/** Distância da barricada para começar a arrancar tábuas (px). */
const BARRICADE_REACH = 46;
/** Deslize ao encostar em obstáculos durante a perseguição direta. */
const DETOUR_MEMORY_MS = 1500;
const DETOUR_HUG = 0.3;
const DETOUR_ALIGN_TOLERANCE = 16;

/**
 * Zumbi genérico dirigido por ZombieConfig, reutilizado via pool.
 * IA: IDLE → CHASE → ATTACK, com BREAK_BARRICADE nas janelas (GDD §29).
 * Navegação: perseguição direta quando enxerga o alvo; caso contrário, segue o caminho do A*.
 */
export class Zombie extends Phaser.Physics.Arcade.Sprite {
  aiState: ZombieState = ZombieState.Dead;
  hp = 0;
  variant: ZombieVariant = 'a';

  private config: ZombieConfig | null = null;
  private target: Damageable | null = null;
  private world: ZombieWorld | null = null;
  private nextAttackAt = 0;
  private readonly shadow: Phaser.GameObjects.Image;
  /** Incrementa a cada spawn: invalida golpes agendados de uma "vida" anterior do pool. */
  private life = 0;

  // Navegação
  private path: PathPoint[] | null = null;
  private pathIndex = 0;
  private nextRepathAt = 0;
  private nextLosAt = 0;
  private hasLos = false;
  private breaking: BarricadeTarget | null = null;

  // Deslize em obstáculos (perseguição direta)
  private detouring = false;
  private detourUntil = 0;
  private lastDetourEnd = -Infinity;
  private readonly detourAlong = new Phaser.Math.Vector2();
  private readonly detourInto = new Phaser.Math.Vector2();

  // Detecção de "preso"
  private readonly progressAnchor = new Phaser.Math.Vector2();
  private noProgressMs = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, zombieSheetKey('a'), 0);
    this.setScale(ART_SCALE);
    this.shadow = scene.add
      .image(x, y, ASSET_KEYS.shadow)
      .setScale(ART_SCALE * 0.9)
      .setDepth(DEPTH.shadows)
      .setVisible(false);

    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.syncParts, this);
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.syncParts, this);
      this.shadow.destroy();
    });
  }

  get isAlive(): boolean {
    return this.aiState !== ZombieState.Dead;
  }

  /** Tempo (ms) sem sair do lugar enquanto persegue. */
  get stuckMs(): number {
    return this.noProgressMs;
  }

  spawn(x: number, y: number, config: ZombieConfig, target: Damageable, world: ZombieWorld): void {
    this.config = config;
    this.target = target;
    this.world = world;
    this.hp = config.health;
    this.nextAttackAt = 0;
    this.aiState = ZombieState.Idle;
    this.life++;
    this.variant = Phaser.Utils.Array.GetRandom([...ZOMBIE_VARIANTS]);

    this.enableBody(true, x, y, true, true);
    this.resetNavigation();
    this.setTexture(zombieSheetKey(this.variant), 0);
    this.setAlpha(1).clearTint();
    const r = config.bodyRadius / ART_SCALE;
    this.setCircle(r, this.width / 2 - r, this.height / 2 - r);
    this.rotation = Phaser.Math.Angle.Between(x, y, target.x, target.y);
    this.play({ key: zombieAnimKey(this.variant, 'walk'), startFrame: Phaser.Math.Between(0, 7) });
    this.shadow.setVisible(true);
  }

  /** Move o zumbi para outro ponto (quando fica preso), mantendo vida e estado. */
  relocate(x: number, y: number): void {
    this.body?.reset(x, y);
    this.aiState = ZombieState.Chase;
    this.resetNavigation();
  }

  /** Surge aos poucos (saindo da escuridão). */
  fadeIn(durationMs: number): void {
    this.setAlpha(0);
    this.shadow.setAlpha(0);
    this.scene.tweens.add({ targets: [this, this.shadow], alpha: 1, duration: durationMs });
  }

  override update(time: number, delta: number): void {
    if (!this.active || !this.config || !this.target || this.aiState === ZombieState.Dead) return;

    const target = this.target;
    if (!target.isAlive) {
      this.aiState = ZombieState.Idle;
      this.setVelocity(0, 0);
      return;
    }
    const dist = Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y);

    switch (this.aiState) {
      case ZombieState.Idle:
        this.setVelocity(0, 0);
        if (dist <= this.config.detectRange) this.aiState = ZombieState.Chase;
        break;

      case ZombieState.Chase:
        if (dist <= this.config.attackRange) {
          this.aiState = ZombieState.Attack;
          this.setVelocity(0, 0);
        } else {
          this.navigate(time, target);
          this.playWalk();
          this.trackProgress(delta);
        }
        break;

      case ZombieState.Attack:
        this.setVelocity(0, 0);
        this.faceTowards(target.x, target.y);
        this.resetProgress();
        if (dist > this.config.attackRange * ATTACK_EXIT_FACTOR && !this.isAttacking) {
          this.aiState = ZombieState.Chase;
        } else if (time >= this.nextAttackAt) {
          this.strike(() => {
            const d = Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y);
            if (target.isAlive && d <= this.config!.attackRange * ATTACK_EXIT_FACTOR) {
              target.takeDamage(this.config!.damage, this.scene.time.now);
            }
          });
          this.nextAttackAt = time + this.config.attackCooldown;
        } else if (!this.isAttacking) {
          this.idlePose();
        }
        break;

      case ZombieState.BreakBarricade: {
        this.setVelocity(0, 0);
        this.resetProgress();
        const barricade = this.breaking;
        if (!barricade || !barricade.isIntact) {
          this.breaking = null;
          this.aiState = ZombieState.Chase;
          this.nextRepathAt = 0;
          break;
        }
        this.faceTowards(barricade.x, barricade.y);
        if (time >= this.nextAttackAt) {
          this.strike(() => {
            if (barricade.isIntact) barricade.takeHit();
          });
          this.nextAttackAt = time + this.config.attackCooldown;
        } else if (!this.isAttacking) {
          this.idlePose();
        }
        break;
      }
    }
  }

  /** Aplica dano; retorna true se o golpe matou o zumbi. */
  takeDamage(amount: number, headshot = false, source: KillSource = 'weapon'): boolean {
    if (!this.isAlive || !this.config) return false;

    this.hp -= amount;
    if (this.hp <= 0) {
      this.die(headshot, source);
      return true;
    }
    // Ao ser atingido, o zumbi percebe o jogador mesmo fora do alcance de detecção.
    if (this.aiState === ZombieState.Idle) this.aiState = ZombieState.Chase;
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(60, () => {
      if (this.isAlive) this.clearTint();
    });
    return false;
  }

  // ───────────────────────── Navegação ─────────────────────────

  private navigate(time: number, target: Damageable): void {
    const world = this.world;
    const config = this.config;
    if (!world || !config) return;

    if (time >= this.nextLosAt) {
      this.hasLos = world.nav.lineOfSight(this.x, this.y, target.x, target.y, config.bodyRadius - 2);
      this.nextLosAt = time + LOS_INTERVAL;
    }
    if (this.hasLos) {
      this.path = null;
      this.chaseDirect(time, target.x, target.y);
      return;
    }

    if (!this.path || this.pathIndex >= this.path.length || time >= this.nextRepathAt) {
      this.path = world.nav.findPath(this.x, this.y, target.x, target.y);
      this.pathIndex = 1;
      this.nextRepathAt = time + REPATH_BASE + Math.random() * REPATH_JITTER;
    }
    const path = this.path;
    if (!path || this.pathIndex >= path.length) {
      this.chaseDirect(time, target.x, target.y);
      return;
    }

    // Avança os pontos já alcançados e "puxa a corda" quando o seguinte já está à vista.
    let wp = path[this.pathIndex];
    if (Phaser.Math.Distance.Between(this.x, this.y, wp.x, wp.y) < WAYPOINT_REACHED) this.pathIndex++;
    else if (this.pathIndex + 1 < path.length) {
      const next = path[this.pathIndex + 1];
      if (world.nav.lineOfSight(this.x, this.y, next.x, next.y, config.bodyRadius - 2)) this.pathIndex++;
    }
    if (this.pathIndex >= path.length) return;
    wp = path[this.pathIndex];

    // Janela com barricada no caminho: para e arranca as tábuas.
    const tile = world.nav.tileSize;
    const barricade = world.barricadeAt(Math.floor(wp.x / tile), Math.floor(wp.y / tile));
    if (barricade?.isIntact && Phaser.Math.Distance.Between(this.x, this.y, barricade.x, barricade.y) < BARRICADE_REACH) {
      this.breaking = barricade;
      this.aiState = ZombieState.BreakBarricade;
      this.setVelocity(0, 0);
      return;
    }

    this.detouring = false;
    this.scene.physics.moveTo(this, wp.x, wp.y, config.speed);
    this.faceTowards(wp.x, wp.y);
  }

  /**
   * Perseguição direta com deslize em obstáculos: ao bater, desliza ao longo dele
   * mantendo o mesmo sentido até passar da quina.
   */
  private chaseDirect(time: number, tx: number, ty: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body | null;
    if (!body || !this.config) return;
    const speed = this.config.speed;
    const blockedX = body.blocked.left || body.blocked.right;
    const blockedY = body.blocked.up || body.blocked.down;
    this.faceTowards(tx, ty);

    if (this.detouring) {
      if ((this.detourAlong.x !== 0 && blockedX) || (this.detourAlong.y !== 0 && blockedY)) this.detourAlong.negate();
      const touching = this.detourAlong.x !== 0 ? blockedY : blockedX;
      if (touching) this.detourUntil = time + ((this.config.bodyRadius * 2.5) / speed) * 1000;
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
      const delta = blockedX ? ty - this.y : tx - this.x;
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
    this.scene.physics.moveTo(this, tx, ty, speed);
  }

  private applyDetourVelocity(speed: number): void {
    this.setVelocity(
      (this.detourAlong.x + this.detourInto.x * DETOUR_HUG) * speed,
      (this.detourAlong.y + this.detourInto.y * DETOUR_HUG) * speed,
    );
  }

  private resetNavigation(): void {
    this.path = null;
    this.pathIndex = 0;
    this.nextRepathAt = 0;
    this.nextLosAt = 0;
    this.hasLos = false;
    this.breaking = null;
    this.detouring = false;
    this.lastDetourEnd = -Infinity;
    this.detourAlong.set(0, 0);
    this.resetProgress();
  }

  private trackProgress(delta: number): void {
    if (Phaser.Math.Distance.Between(this.x, this.y, this.progressAnchor.x, this.progressAnchor.y) > PROGRESS_STEP) {
      this.progressAnchor.set(this.x, this.y);
      this.noProgressMs = 0;
    } else {
      this.noProgressMs += delta;
    }
  }

  private resetProgress(): void {
    this.progressAnchor.set(this.x, this.y);
    this.noProgressMs = 0;
  }

  // ───────────────────────── Visual ─────────────────────────

  private get isAttacking(): boolean {
    return this.anims.isPlaying && this.anims.currentAnim?.key === zombieAnimKey(this.variant, 'attack');
  }

  private faceTowards(x: number, y: number): void {
    this.rotation = Phaser.Math.Angle.RotateTo(this.rotation, Phaser.Math.Angle.Between(this.x, this.y, x, y), TURN_SPEED);
  }

  private idlePose(): void {
    this.anims.stop();
    this.setFrame(0);
  }

  private playWalk(): void {
    if (this.isAttacking || !this.config) return;
    const key = zombieAnimKey(this.variant, 'walk');
    if (!this.anims.isPlaying || this.anims.currentAnim?.key !== key) this.play(key);
    this.anims.timeScale = this.config.speed / WALK_ANIM_SPEED;
  }

  /** Bote: a animação começa agora e o golpe se resolve no meio dela. */
  private strike(onHit: () => void): void {
    const life = this.life;
    this.anims.timeScale = 1;
    this.play(zombieAnimKey(this.variant, 'attack'));
    this.scene.time.delayedCall(ATTACK_HIT_DELAY, () => {
      if (life === this.life && this.isAlive) onHit();
    });
  }

  private syncParts(): void {
    if (!this.active) return;
    this.setDepth(this.y);
    this.shadow.setPosition(this.x + SHADOW_OFFSET.x, this.y + SHADOW_OFFSET.y);
  }

  /** O corpo caído é criado pelo EffectsSystem; aqui o zumbi só volta ao pool. */
  private die(headshot: boolean, source: KillSource): void {
    const config = this.config;
    this.aiState = ZombieState.Dead;
    this.life++;
    this.anims.stop();
    this.shadow.setVisible(false);
    this.disableBody(true, true);

    if (config) {
      emitGameEvent(this.scene.game.events, GameEvents.ZombieKilled, {
        type: config.id,
        reward: config.reward,
        x: this.x,
        y: this.y,
        headshot,
        source,
      });
    }
  }
}
