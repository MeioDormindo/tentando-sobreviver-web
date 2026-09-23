import Phaser from 'phaser';
import { ASSET_KEYS, ZOMBIE_VARIANTS, zombieAnimKey, zombieSheetKey, type ZombieVariant } from '../config/assets.config';
import { ART_SCALE, DEPTH } from '../config/visual.config';
import type { ZombieConfig } from '../config/zombies.config';
import { emitGameEvent, GameEvents } from '../game/events';
import type { Damageable } from './Damageable';

export const ZombieState = {
  Idle: 'IDLE',
  Chase: 'CHASE',
  Attack: 'ATTACK',
  Dead: 'DEAD',
} as const;
export type ZombieState = (typeof ZombieState)[keyof typeof ZombieState];

/** Margem para sair do ATTACK e voltar a perseguir (evita alternar a cada frame). */
const ATTACK_EXIT_FACTOR = 1.3;
/** Janela (ms) em que um novo desvio reaproveita o lado do anterior (evita oscilar). */
const DETOUR_MEMORY_MS = 1500;
/** Fração da velocidade empurrando contra a parede durante o deslize. */
const DETOUR_HUG = 0.3;
/** Abaixo desta diferença (px) o lado do desvio é sorteado. */
const DETOUR_ALIGN_TOLERANCE = 16;
/** Atraso entre o início da animação de ataque e o golpe (ms) — coincide com o bote. */
const ATTACK_HIT_DELAY = 160;
/** Velocidade de giro do corpo em direção ao alvo (rad/frame). */
const TURN_SPEED = 0.12;
/** Velocidade de referência da animação de caminhada (px/s). */
const WALK_ANIM_SPEED = 60;
const SHADOW_OFFSET = { x: 4, y: 6 };
/** Quanto o zumbi precisa se aproximar do alvo para contar como progresso (px). */
const PROGRESS_STEP = 24;

/**
 * Zumbi genérico dirigido por ZombieConfig. Reutilizado via pool (Physics Group).
 * Perseguição em linha reta por enquanto; pathfinding A* entra na Fase 4.
 */
export class Zombie extends Phaser.Physics.Arcade.Sprite {
  aiState: ZombieState = ZombieState.Dead;
  hp = 0;
  variant: ZombieVariant = 'a';

  private config: ZombieConfig | null = null;
  private target: Damageable | null = null;
  private nextAttackAt = 0;
  private detouring = false;
  private detourUntil = 0;
  private lastDetourEnd = -Infinity;
  /** Direção unitária do deslize ao longo da parede. */
  private readonly detourAlong = new Phaser.Math.Vector2();
  /** Direção unitária para dentro da parede (mantém o contato durante o deslize). */
  private readonly detourInto = new Phaser.Math.Vector2();
  private readonly shadow: Phaser.GameObjects.Image;
  /** Incrementa a cada spawn: invalida golpes agendados de uma "vida" anterior do pool. */
  private life = 0;
  /** Menor distância já alcançada até o alvo e há quanto tempo não melhora (detecção de "preso"). */
  private bestDistance = Infinity;
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

  spawn(x: number, y: number, config: ZombieConfig, target: Damageable): void {
    this.config = config;
    this.target = target;
    this.hp = config.health;
    this.nextAttackAt = 0;
    this.detouring = false;
    this.lastDetourEnd = -Infinity;
    this.detourAlong.set(0, 0);
    this.aiState = ZombieState.Idle;
    this.life++;
    this.resetProgress();
    this.variant = Phaser.Utils.Array.GetRandom([...ZOMBIE_VARIANTS]);

    this.enableBody(true, x, y, true, true);
    this.setTexture(zombieSheetKey(this.variant), 0);
    this.setAlpha(1).clearTint();
    const r = config.bodyRadius / ART_SCALE;
    this.setCircle(r, this.width / 2 - r, this.height / 2 - r);
    this.rotation = Phaser.Math.Angle.Between(x, y, target.x, target.y);
    this.play({ key: zombieAnimKey(this.variant, 'walk'), startFrame: Phaser.Math.Between(0, 7) });
    this.shadow.setVisible(true);
  }

  /** Tempo (ms) sem se aproximar do alvo enquanto persegue. */
  get stuckMs(): number {
    return this.noProgressMs;
  }

  /** Move o zumbi para outro ponto (usado quando fica preso), mantendo vida e estado. */
  relocate(x: number, y: number): void {
    this.body?.reset(x, y);
    this.detouring = false;
    this.resetProgress();
  }

  private resetProgress(): void {
    this.bestDistance = Infinity;
    this.noProgressMs = 0;
  }

  /** Surge aos poucos (saindo da escuridão). */
  fadeIn(durationMs: number): void {
    this.setAlpha(0);
    this.shadow.setAlpha(0);
    this.scene.tweens.add({ targets: [this, this.shadow], alpha: 1, duration: durationMs });
  }

  private get isAttacking(): boolean {
    return this.anims.isPlaying && this.anims.currentAnim?.key === zombieAnimKey(this.variant, 'attack');
  }

  private syncParts(): void {
    if (!this.active) return;
    this.setDepth(this.y);
    this.shadow.setPosition(this.x + SHADOW_OFFSET.x, this.y + SHADOW_OFFSET.y);
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
    const angleToTarget = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
    this.rotation = Phaser.Math.Angle.RotateTo(this.rotation, angleToTarget, TURN_SPEED);

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
          this.chase(time, target);
          this.playWalk();
          this.trackProgress(dist, delta);
        }
        break;

      case ZombieState.Attack:
        this.setVelocity(0, 0);
        this.resetProgress();
        if (dist > this.config.attackRange * ATTACK_EXIT_FACTOR && !this.isAttacking) {
          this.aiState = ZombieState.Chase;
        } else if (time >= this.nextAttackAt) {
          this.startAttack(target);
          this.nextAttackAt = time + this.config.attackCooldown;
        } else if (!this.isAttacking) {
          this.anims.stop();
          this.setFrame(0);
        }
        break;
    }
  }

  /**
   * Perseguição em linha reta com contorno simples de paredes ("wall following"):
   * ao bater numa parede, desliza ao longo dela, mantendo o mesmo sentido, até passar
   * da quina. Paliativo até o pathfinding A* da Fase 4.
   */
  private chase(time: number, target: Damageable): void {
    const body = this.body as Phaser.Physics.Arcade.Body | null;
    if (!body || !this.config) return;
    const speed = this.config.speed;
    const blockedX = body.blocked.left || body.blocked.right;
    const blockedY = body.blocked.up || body.blocked.down;

    if (this.detouring) {
      // Quina côncava: o sentido do deslize também está bloqueado → inverte.
      if ((this.detourAlong.x !== 0 && blockedX) || (this.detourAlong.y !== 0 && blockedY)) {
        this.detourAlong.negate();
      }
      const touchingWall = this.detourAlong.x !== 0 ? blockedY : blockedX;
      if (touchingWall) {
        // Continua até o corpo inteiro passar da quina.
        this.detourUntil = time + ((this.config.bodyRadius * 2.5) / speed) * 1000;
      } else if (time >= this.detourUntil) {
        this.detouring = false;
        this.lastDetourEnd = time;
      }
      if (this.detouring) {
        this.applyDetourVelocity(speed);
        return;
      }
    }

    if (blockedX || blockedY) {
      this.startDetour(time, body, target);
      this.applyDetourVelocity(speed);
      return;
    }

    this.scene.physics.moveTo(this, target.x, target.y, speed);
  }

  private startDetour(time: number, body: Phaser.Physics.Arcade.Body, target: Damageable): void {
    const blockedX = body.blocked.left || body.blocked.right;
    const recent = time - this.lastDetourEnd < DETOUR_MEMORY_MS;
    const prevSign = this.detourAlong.x + this.detourAlong.y;
    const delta = blockedX ? target.y - this.y : target.x - this.x;
    let sign: number;
    if (recent && prevSign !== 0) sign = Math.sign(prevSign); // mantém o lado escolhido
    else if (Math.abs(delta) > DETOUR_ALIGN_TOLERANCE) sign = Math.sign(delta);
    else sign = Phaser.Math.RND.sign();

    this.detourAlong.set(blockedX ? 0 : sign, blockedX ? sign : 0);
    if (blockedX) this.detourInto.set(body.blocked.right ? 1 : -1, 0);
    else this.detourInto.set(0, body.blocked.down ? 1 : -1);
    this.detouring = true;
    this.detourUntil = time;
  }

  private applyDetourVelocity(speed: number): void {
    this.setVelocity(
      (this.detourAlong.x + this.detourInto.x * DETOUR_HUG) * speed,
      (this.detourAlong.y + this.detourInto.y * DETOUR_HUG) * speed,
    );
  }

  private trackProgress(dist: number, delta: number): void {
    if (dist < this.bestDistance - PROGRESS_STEP) {
      this.bestDistance = dist;
      this.noProgressMs = 0;
    } else {
      this.noProgressMs += delta;
    }
  }

  private playWalk(): void {
    if (this.isAttacking || !this.config) return;
    const key = zombieAnimKey(this.variant, 'walk');
    if (!this.anims.isPlaying || this.anims.currentAnim?.key !== key) this.play(key);
    this.anims.timeScale = this.config.speed / WALK_ANIM_SPEED;
  }

  /** Bote: a animação começa agora e o golpe acerta se o alvo ainda estiver ao alcance. */
  private startAttack(target: Damageable): void {
    if (!this.config) return;
    const config = this.config;
    const life = this.life;
    this.anims.timeScale = 1;
    this.play(zombieAnimKey(this.variant, 'attack'));
    this.scene.time.delayedCall(ATTACK_HIT_DELAY, () => {
      if (life !== this.life || !this.isAlive || !target.isAlive) return;
      const dist = Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y);
      if (dist <= config.attackRange * ATTACK_EXIT_FACTOR) {
        target.takeDamage(config.damage, this.scene.time.now);
      }
    });
  }

  /** Aplica dano; retorna true se o golpe matou o zumbi. */
  takeDamage(amount: number, headshot = false): boolean {
    if (!this.isAlive || !this.config) return false;

    this.hp -= amount;
    if (this.hp <= 0) {
      this.die(headshot);
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

  /** O corpo caído é criado pelo EffectsSystem; aqui o zumbi só volta ao pool. */
  private die(headshot: boolean): void {
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
      });
    }

  }
}
