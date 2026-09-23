import Phaser from 'phaser';
import { ASSET_KEYS, bossAnimKey, bossSheetKey } from '../config/assets.config';
import type { BossConfig } from '../config/bosses.config';
import { ART_SCALE, DEPTH } from '../config/visual.config';
import { PathFollower, type NavWorld } from '../systems/pathfinding/PathFollower';
import type { Damageable } from './Damageable';

/** O que o boss precisa do mundo (implementado pelo BossSystem). */
export interface BossWorld extends NavWorld {
  player: Damageable;
  shockwave(x: number, y: number): void;
  summon(x: number, y: number): void;
  areaAttack(targetX: number, targetY: number): void;
  onPhaseChange(phase: number): void;
  onDefeated(boss: Boss): void;
}

type BossState = 'roar' | 'chase' | 'melee' | 'chargeWindup' | 'charging' | 'stunned' | 'slam' | 'summon' | 'area' | 'dead';
type AttackId = 'melee' | 'charge' | 'shockwave' | 'summon' | 'area';

const TURN_SPEED = 0.09;
const MELEE_HIT_DELAY = 230;
const SHADOW_OFFSET = { x: 6, y: 10 };
/** Deslocamento mínimo para contar como progresso (detecção de "preso"). */
const PROGRESS_STEP = 40;

/**
 * Boss genérico e configurável (GDD §45). Fases por fração de vida; cada fase libera
 * ataques e acelera o boss. Os efeitos em área (onda, invocação, ataque em área) ficam
 * com o BossSystem via BossWorld.
 */
export class Boss extends Phaser.Physics.Arcade.Sprite {
  readonly config: BossConfig;
  readonly maxHp: number;
  hp: number;
  phase = 1;

  private mode: BossState = 'roar';
  private stateUntil = 0;
  private readonly nextAttackAt: Record<AttackId, number> = { melee: 0, charge: 0, shockwave: 0, summon: 0, area: 0 };
  private readonly follower = new PathFollower(this);
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly telegraph: Phaser.GameObjects.Graphics;
  private readonly chargeDir = new Phaser.Math.Vector2();
  private readonly chargeStart = new Phaser.Math.Vector2();
  private chargeHit = false;
  private pendingHitAt = 0;
  private readonly progressAnchor = new Phaser.Math.Vector2();
  private noProgressMs = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, config: BossConfig, appearance: number, private readonly world: BossWorld) {
    super(scene, x, y, bossSheetKey(config.id), 0);
    this.config = config;
    this.maxHp = Math.round(config.health * (1 + config.healthPerAppearance * appearance));
    this.hp = this.maxHp;

    this.shadow = scene.add.image(x, y, ASSET_KEYS.shadow).setScale(ART_SCALE * 2.2).setDepth(DEPTH.shadows);
    this.telegraph = scene.add.graphics().setDepth(DEPTH.corpses + 2);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setScale(ART_SCALE);
    const r = config.bodyRadius / ART_SCALE;
    this.setCircle(r, this.width / 2 - r, this.height / 2 - r);
    this.setPushable(false);

    this.enterRoar(scene.time.now);
    this.nextAttackAt.charge = scene.time.now + 3000;
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.syncParts, this);
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.syncParts, this);
      this.shadow.destroy();
      this.telegraph.destroy();
    });
  }

  get isAlive(): boolean {
    return this.mode !== 'dead';
  }

  get isInvulnerable(): boolean {
    return this.mode === 'roar';
  }

  get stuckMs(): number {
    return this.noProgressMs;
  }

  /** Reposiciona (quando fica preso fora da tela). */
  relocate(x: number, y: number): void {
    this.body?.reset(x, y);
    this.follower.reset();
    this.resetProgress();
  }

  override update(time: number, delta: number): void {
    if (this.mode === 'dead') return;
    const player = this.world.player;
    const cfg = this.config;
    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    const speed = cfg.speed * cfg.phaseSpeed[this.phase - 1];

    switch (this.mode) {
      case 'roar':
      case 'summon':
      case 'area':
      case 'slam':
        this.setVelocity(0, 0);
        this.resolvePendingHit(time);
        if (time >= this.stateUntil) this.toChase();
        break;

      case 'melee':
        this.setVelocity(0, 0);
        this.face(player.x, player.y);
        if (this.pendingHitAt && time >= this.pendingHitAt) {
          this.pendingHitAt = 0;
          if (player.isAlive && dist <= cfg.melee.range + 14) player.takeDamage(cfg.melee.damage, time);
        }
        if (time >= this.stateUntil) this.toChase();
        break;

      case 'chargeWindup':
        this.setVelocity(0, 0);
        this.drawChargeTelegraph(time);
        if (time >= this.stateUntil) {
          this.telegraph.clear();
          this.mode = 'charging';
          this.chargeHit = false;
          this.chargeStart.set(this.x, this.y);
          this.setVelocity(this.chargeDir.x * cfg.charge.speed, this.chargeDir.y * cfg.charge.speed);
        }
        break;

      case 'charging': {
        this.setVelocity(this.chargeDir.x * cfg.charge.speed, this.chargeDir.y * cfg.charge.speed);
        if (!this.chargeHit && player.isAlive && dist <= cfg.bodyRadius + 18) {
          this.chargeHit = true;
          player.takeDamage(cfg.charge.damage, time);
          this.scene.cameras.main.shake(220, 0.008);
        }
        const body = this.body as Phaser.Physics.Arcade.Body;
        const hitWall = body.blocked.left || body.blocked.right || body.blocked.up || body.blocked.down;
        const traveled = Phaser.Math.Distance.Between(this.x, this.y, this.chargeStart.x, this.chargeStart.y);
        if (hitWall) {
          // Bateu na parede: fica atordoado (janela para o jogador atacar).
          this.mode = 'stunned';
          this.stateUntil = time + cfg.charge.stunMs;
          this.setVelocity(0, 0);
          this.setTint(0x9a9a9a);
          this.anims.stop();
          this.scene.cameras.main.shake(260, 0.01);
        } else if (traveled >= cfg.charge.maxDistance) {
          this.toChase();
        }
        break;
      }

      case 'stunned':
        this.setVelocity(0, 0);
        if (time >= this.stateUntil) {
          this.clearTint();
          this.toChase();
        }
        break;

      case 'chase': {
        if (!player.isAlive) {
          this.setVelocity(0, 0);
          break;
        }
        if (this.tryAttack(time, dist)) break;
        const barricade = this.follower.step(this.world, time, player.x, player.y, speed, cfg.bodyRadius);
        // O boss arrebenta a janela inteira de uma vez.
        if (barricade) barricade.takeHit(99);
        this.face(this.follower.face.x, this.follower.face.y);
        this.playLoop('walk', speed / 60);
        this.trackProgress(delta);
        break;
      }
    }
  }

  /** Dano recebido; retorna true se o golpe derrotou o boss. */
  takeDamage(amount: number): boolean {
    if (this.mode === 'dead' || this.isInvulnerable) return false;
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp === 0) {
      this.die();
      return true;
    }
    if (this.mode !== 'stunned') {
      this.setTintFill(0xffffff);
      this.scene.time.delayedCall(50, () => {
        if (this.isAlive && this.mode !== 'stunned') this.applyPhaseTint();
      });
    }
    const ratio = this.hp / this.maxHp;
    const newPhase = 1 + this.config.phaseThresholds.filter((t) => ratio <= t).length;
    if (newPhase > this.phase) {
      this.phase = newPhase;
      this.telegraph.clear();
      this.enterRoar(this.scene.time.now);
      this.world.onPhaseChange(newPhase);
    }
    return false;
  }

  // ───────────────────────── Ataques ─────────────────────────

  private ready(id: AttackId, time: number): boolean {
    return time >= this.nextAttackAt[id];
  }

  private cooldown(id: AttackId, time: number, baseMs: number): void {
    this.nextAttackAt[id] = time + baseMs * this.config.phaseCooldown[this.phase - 1];
  }

  private tryAttack(time: number, dist: number): boolean {
    const cfg = this.config;
    const player = this.world.player;
    if (dist <= cfg.melee.range && this.ready('melee', time)) {
      this.mode = 'melee';
      this.stateUntil = time + 520;
      this.pendingHitAt = time + MELEE_HIT_DELAY;
      this.cooldown('melee', time, cfg.melee.cooldownMs);
      this.playOnce('swipe');
      return true;
    }
    if (this.phase >= cfg.area.fromPhase && this.ready('area', time)) {
      this.mode = 'area';
      this.stateUntil = time + 650;
      this.cooldown('area', time, cfg.area.cooldownMs);
      this.playLoop('roar', 1);
      this.world.areaAttack(player.x, player.y);
      return true;
    }
    if (this.phase >= cfg.shockwave.fromPhase && dist <= cfg.shockwave.radius * 0.8 && this.ready('shockwave', time)) {
      this.mode = 'slam';
      this.stateUntil = time + cfg.shockwave.windupMs + 380;
      this.pendingHitAt = time + cfg.shockwave.windupMs;
      this.cooldown('shockwave', time, cfg.shockwave.cooldownMs);
      this.playOnce('slam');
      return true;
    }
    if (this.phase >= cfg.summon.fromPhase && this.ready('summon', time)) {
      this.mode = 'summon';
      this.stateUntil = time + 900;
      this.cooldown('summon', time, cfg.summon.cooldownMs);
      this.playLoop('roar', 1.4);
      this.world.summon(this.x, this.y);
      return true;
    }
    if (dist >= cfg.charge.minRange && dist <= cfg.charge.maxRange && this.ready('charge', time) &&
        this.world.nav.lineOfSight(this.x, this.y, player.x, player.y, cfg.bodyRadius - 4)) {
      this.mode = 'chargeWindup';
      this.stateUntil = time + cfg.charge.windupMs;
      this.chargeDir.set(player.x - this.x, player.y - this.y).normalize();
      this.rotation = this.chargeDir.angle();
      this.cooldown('charge', time, cfg.charge.cooldownMs);
      this.playLoop('charge', 0.6);
      return true;
    }
    return false;
  }

  /** O golpe no chão resolve a onda de choque no meio da animação. */
  private resolvePendingHit(time: number): void {
    if (this.mode === 'slam' && this.pendingHitAt && time >= this.pendingHitAt) {
      this.pendingHitAt = 0;
      this.world.shockwave(this.x, this.y);
    }
  }

  /** Faixa vermelha mostrando a direção da investida (aviso ao jogador). */
  private drawChargeTelegraph(time: number): void {
    const cfg = this.config;
    const g = this.telegraph;
    const width = cfg.bodyRadius * 2;
    const pulse = 0.25 + 0.2 * Math.sin(time / 60);
    const ex = this.x + this.chargeDir.x * cfg.charge.maxDistance;
    const ey = this.y + this.chargeDir.y * cfg.charge.maxDistance;
    g.clear();
    g.lineStyle(width, 0xd63a2a, pulse);
    g.lineBetween(this.x, this.y, ex, ey);
    g.lineStyle(2, 0xff6a50, 0.8);
    const nx = -this.chargeDir.y * (width / 2);
    const ny = this.chargeDir.x * (width / 2);
    g.lineBetween(this.x + nx, this.y + ny, ex + nx, ey + ny);
    g.lineBetween(this.x - nx, this.y - ny, ex - nx, ey - ny);
  }

  // ───────────────────────── Estados e visual ─────────────────────────

  private enterRoar(time: number): void {
    this.mode = 'roar';
    this.stateUntil = time + this.config.roarMs;
    this.setVelocity(0, 0);
    this.playLoop('roar', 1);
    this.scene.cameras.main.shake(this.config.roarMs * 0.6, 0.006);
  }

  private toChase(): void {
    this.mode = 'chase';
    this.pendingHitAt = 0;
    this.follower.reset();
    this.applyPhaseTint();
  }

  /** Rage Mode (última fase): o boss fica avermelhado. */
  private applyPhaseTint(): void {
    if (this.phase >= 4) this.setTint(0xff9a8a);
    else this.clearTint();
  }

  private face(x: number, y: number): void {
    this.rotation = Phaser.Math.Angle.RotateTo(this.rotation, Phaser.Math.Angle.Between(this.x, this.y, x, y), TURN_SPEED);
  }

  private playLoop(anim: 'walk' | 'charge' | 'roar', timeScale: number): void {
    const key = bossAnimKey(this.config.id, anim);
    if (this.anims.currentAnim?.key !== key || !this.anims.isPlaying) this.play(key);
    this.anims.timeScale = timeScale;
  }

  private playOnce(anim: 'swipe' | 'slam'): void {
    this.anims.timeScale = 1;
    this.play(bossAnimKey(this.config.id, anim));
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

  private syncParts(): void {
    if (!this.active) return;
    this.setDepth(this.y);
    this.shadow.setPosition(this.x + SHADOW_OFFSET.x, this.y + SHADOW_OFFSET.y);
  }

  private die(): void {
    this.mode = 'dead';
    this.setVelocity(0, 0);
    this.anims.stop();
    this.telegraph.clear();
    this.world.onDefeated(this);
  }
}
