import Phaser from 'phaser';
import { ASSET_KEYS, FX_KEYS, ZOMBIE_SKINS, zombieAnimKey, zombieSheetKey, type ZombieSkin } from '../config/assets.config';
import { ART_SCALE, DEPTH } from '../config/visual.config';
import type { ExplosiveConfig, ZombieConfig } from '../config/zombies.config';
import { emitGameEvent, GameEvents, type KillSource } from '../game/events';
import { PathFollower, type BarricadeTarget, type NavWorld } from '../systems/pathfinding/PathFollower';
import type { Damageable } from './Damageable';
import { audio } from '../audio/AudioSystem';

export const ZombieState = {
  Idle: 'IDLE',
  Chase: 'CHASE',
  Attack: 'ATTACK',
  BreakBarricade: 'BREAK_BARRICADE',
  /** Ataque especial (Exploder armando a explosão). */
  SpecialAttack: 'SPECIAL_ATTACK',
  Dead: 'DEAD',
} as const;
export type ZombieState = (typeof ZombieState)[keyof typeof ZombieState];

export type { BarricadeTarget } from '../systems/pathfinding/PathFollower';

/** Acesso do zumbi ao mundo: navegação, barricadas e explosões. */
export interface ZombieWorld extends NavWorld {
  /** Explosão de um Exploder (dano em área ao jogador e a outros zumbis). */
  explode(x: number, y: number, explosive: ExplosiveConfig, source: KillSource, self: Zombie): void;
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
/** Cor do tremor elétrico enquanto atordoado. */
const STUN_TINT = 0x9fe8ff;

/**
 * Zumbi genérico dirigido por ZombieConfig, reutilizado via pool.
 * IA: IDLE → CHASE → ATTACK, com BREAK_BARRICADE nas janelas (GDD §29).
 * Navegação: perseguição direta quando enxerga o alvo; caso contrário, segue o caminho do A*.
 */
export class Zombie extends Phaser.Physics.Arcade.Sprite {
  aiState: ZombieState = ZombieState.Dead;
  hp = 0;
  skin: ZombieSkin = 'a';

  private config: ZombieConfig | null = null;
  private target: Damageable | null = null;
  private world: ZombieWorld | null = null;
  private nextAttackAt = 0;
  private readonly shadow: Phaser.GameObjects.Image;
  /** Brilho pulsante do Exploder (visível no escuro). */
  private readonly aura: Phaser.GameObjects.Image;
  private fuseEndsAt = 0;
  private exploded = false;
  /** Incrementa a cada spawn: invalida golpes agendados de uma "vida" anterior do pool. */
  private life = 0;

  // Navegação (compartilhada com o boss)
  private readonly follower = new PathFollower(this);
  private breaking: BarricadeTarget | null = null;

  // Detecção de "preso"
  private readonly progressAnchor = new Phaser.Math.Vector2();
  private noProgressMs = 0;
  /** Próximo gemido (cada zumbi resmunga de tempos em tempos). */
  private nextGroanAt = 0;
  /** Atordoado (Arc Gun / Energy Cannon) até este instante. */
  private stunnedUntil = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, zombieSheetKey('a'), 0);
    this.setScale(ART_SCALE);
    this.shadow = scene.add
      .image(x, y, ASSET_KEYS.shadow)
      .setScale(ART_SCALE * 0.9)
      .setDepth(DEPTH.shadows)
      .setVisible(false);
    this.aura = scene.add
      .image(x, y, FX_KEYS.lightRadial)
      .setTint(0xb8e04a)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0.32)
      .setDepth(DEPTH.glow)
      .setVisible(false);

    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.syncParts, this);
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.syncParts, this);
      this.shadow.destroy();
      this.aura.destroy();
    });
  }

  /** Tipo do zumbi (walker, runner, tank, exploder). */
  get typeId(): string {
    return this.config?.id ?? '';
  }

  /** Muda a cada spawn/morte: identifica esta "vida" do zumbi reaproveitado do pool. */
  get lifeId(): number {
    return this.life;
  }

  /** Choque elétrico: fica parado, tremendo, por `ms`. */
  stun(ms: number): void {
    if (!this.isAlive) return;
    this.stunnedUntil = Math.max(this.stunnedUntil, this.scene.time.now + ms);
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
    this.skin = Phaser.Utils.Array.GetRandom(config.skins) as ZombieSkin;
    this.exploded = false;
    this.fuseEndsAt = 0;
    this.stunnedUntil = 0;
    this.nextGroanAt = this.scene.time.now + Phaser.Math.Between(500, 5000);

    this.enableBody(true, x, y, true, true);
    this.resetNavigation();
    this.setTexture(zombieSheetKey(this.skin), 0);
    this.setAlpha(1).clearTint();
    const r = config.bodyRadius / ART_SCALE;
    this.setCircle(r, this.width / 2 - r, this.height / 2 - r);
    this.setPushable(config.pushable);
    // Sombra proporcional ao tamanho do sprite (o Tank é maior).
    this.shadow.setScale(ART_SCALE * 0.9 * (ZOMBIE_SKINS[this.skin].frame / 128));
    this.aura.setVisible(!!config.explosive).setAlpha(0.5);
    this.rotation = Phaser.Math.Angle.Between(x, y, target.x, target.y);
    this.play({ key: zombieAnimKey(this.skin, 'walk'), startFrame: Phaser.Math.Between(0, 7) });
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
    if (this.stunnedUntil > 0) {
      if (time < this.stunnedUntil) {
        this.setVelocity(0, 0);
        this.anims.pause();
        this.setTint(Math.floor(time / 50) % 2 === 0 ? STUN_TINT : 0xffffff);
        return;
      }
      this.stunnedUntil = 0;
      this.anims.resume();
      this.clearTint();
    }
    const dist = Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y);

    switch (this.aiState) {
      case ZombieState.Idle:
        this.setVelocity(0, 0);
        if (dist <= this.config.detectRange) this.aiState = ZombieState.Chase;
        break;

      case ZombieState.Chase:
        if (this.config.explosive && dist <= this.config.explosive.triggerRange) {
          this.aiState = ZombieState.SpecialAttack;
          this.fuseEndsAt = time + this.config.explosive.fuseMs;
          audio.playAt('exploder_fuse', this.x, this.y, { category: 'zombie', volume: 1 });
          this.setVelocity(0, 0);
        } else if (dist <= this.config.attackRange) {
          this.aiState = ZombieState.Attack;
          this.setVelocity(0, 0);
        } else {
          this.navigate(time, target);
          this.playWalk();
          this.trackProgress(delta);
          if (time >= this.nextGroanAt) {
            this.nextGroanAt = time + Phaser.Math.Between(3500, 9000);
            audio.playAt(`zombie_${this.config.id}_groan`, this.x, this.y, { category: 'zombie', volume: 0.75 });
          }
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

      case ZombieState.SpecialAttack: {
        // Pisca cada vez mais rápido e explode no fim do pavio.
        this.setVelocity(0, 0);
        this.resetProgress();
        const left = this.fuseEndsAt - time;
        const blink = Math.floor(left / (left > 300 ? 110 : 55)) % 2 === 0;
        if (blink) this.setTintFill(0xfff2a0);
        else this.clearTint();
        this.aura.setAlpha(blink ? 1 : 0.6).setScale(0.45);
        if (time >= this.fuseEndsAt) this.detonate('explosion');
        break;
      }

      case ZombieState.BreakBarricade: {
        this.setVelocity(0, 0);
        this.resetProgress();
        const barricade = this.breaking;
        if (!barricade || !barricade.isIntact) {
          this.breaking = null;
          this.aiState = ZombieState.Chase;
          this.follower.reset();
          break;
        }
        this.faceTowards(barricade.x, barricade.y);
        if (time >= this.nextAttackAt) {
          const planks = this.config.plankDamage;
          this.strike(() => {
            if (barricade.isIntact) barricade.takeHit(planks);
          });
          this.nextAttackAt = time + this.config.attackCooldown;
        } else if (!this.isAttacking) {
          this.idlePose();
        }
        break;
      }
    }
  }

  /** Aplica dano; retorna true se o golpe matou o zumbi. `flash` = pisca branco (não em dano contínuo). */
  takeDamage(amount: number, headshot = false, source: KillSource = 'weapon', flash = true): boolean {
    if (!this.isAlive || !this.config) return false;

    this.hp -= amount;
    if (this.hp <= 0) {
      this.die(headshot, source);
      return true;
    }
    // Ao ser atingido, o zumbi percebe o jogador mesmo fora do alcance de detecção.
    if (this.aiState === ZombieState.Idle) this.aiState = ZombieState.Chase;
    if (!flash) return false;
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
    const barricade = this.follower.step(world, time, target.x, target.y, config.speed, config.bodyRadius);
    this.faceTowards(this.follower.face.x, this.follower.face.y);
    if (barricade) {
      // Janela com barricada no caminho: para e arranca as tábuas.
      this.breaking = barricade;
      this.aiState = ZombieState.BreakBarricade;
    }
  }

  private resetNavigation(): void {
    this.follower.reset();
    this.breaking = null;
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
    return this.anims.isPlaying && this.anims.currentAnim?.key === zombieAnimKey(this.skin, 'attack');
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
    const key = zombieAnimKey(this.skin, 'walk');
    if (!this.anims.isPlaying || this.anims.currentAnim?.key !== key) this.play(key);
    this.anims.timeScale = this.config.speed / WALK_ANIM_SPEED;
  }

  /** Bote: a animação começa agora e o golpe se resolve no meio dela. */
  private strike(onHit: () => void): void {
    const life = this.life;
    if (this.config) audio.playAt(`zombie_${this.config.id}_attack`, this.x, this.y, { category: 'zombie', volume: 0.85 });
    this.anims.timeScale = 1;
    this.play(zombieAnimKey(this.skin, 'attack'));
    this.scene.time.delayedCall(ATTACK_HIT_DELAY, () => {
      if (life === this.life && this.isAlive) onHit();
    });
  }

  private syncParts(): void {
    if (!this.active) return;
    this.setDepth(this.y);
    this.shadow.setPosition(this.x + SHADOW_OFFSET.x, this.y + SHADOW_OFFSET.y);
    if (this.aura.visible) {
      this.aura.setPosition(this.x, this.y);
      if (this.aiState !== ZombieState.SpecialAttack) this.aura.setAlpha(0.35 + 0.2 * Math.sin(this.scene.time.now / 180));
    }
  }

  /** Exploder: explode (dano em área) e morre. */
  private detonate(source: KillSource): void {
    if (this.exploded || !this.config?.explosive || !this.world) return;
    this.exploded = true;
    this.world.explode(this.x, this.y, this.config.explosive, source, this);
    if (this.isAlive) this.die(false, 'explosion');
  }

  /** O corpo caído é criado pelo EffectsSystem; aqui o zumbi só volta ao pool. */
  private die(headshot: boolean, source: KillSource): void {
    const config = this.config;
    this.aiState = ZombieState.Dead;
    this.life++;
    this.anims.stop();
    this.clearTint();
    this.shadow.setVisible(false);
    this.aura.setVisible(false);
    this.disableBody(true, true);
    // Exploder abatido também explode (e o crédito dos abates vai para quem o matou).
    if (config?.explosive && !this.exploded) {
      this.exploded = true;
      this.world?.explode(this.x, this.y, config.explosive, source, this);
    }

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
