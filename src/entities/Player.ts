import Phaser from 'phaser';
import { ANIM_KEYS, ASSET_KEYS, PLAYER_FRAMES, playerAnimKey, playerTorsoKey } from '../config/assets.config';
import { NEUTRAL_MODIFIERS, type PerkModifiers } from '../config/machines.config';
import type { PlayerConfig } from '../config/player.config';
import type { WeaponKind } from '../config/weapons.config';
import { ART_SCALE, DEPTH } from '../config/visual.config';
import { emitGameEvent, GameEvents } from '../game/events';
import type { Damageable } from './Damageable';
import { audio } from '../audio/AudioSystem';
import { audioConfig } from '../config/audio.config';
import { touchInput } from '../input/touchInput';

interface MoveKeys {
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
}

const HURT_TINT = 0xff7a7a;
const DEAD_TINT = 0x5a4040;
/** Velocidade com que as pernas giram para a direção do movimento (rad/frame). */
const LEGS_TURN = 0.25;
/** Ângulo máximo entre pernas e tronco antes das pernas acompanharem a mira. */
const LEGS_MAX_TWIST = Phaser.Math.DegToRad(100);
const SHADOW_OFFSET = { x: 4, y: 6 };

/**
 * Jogador em duas partes: o tronco (este sprite) gira para a mira e as pernas
 * giram para a direção do movimento, como em shooters top-down modernos.
 */
export class Player extends Phaser.Physics.Arcade.Sprite implements Damageable {
  hp: number;
  armor = 0;

  private readonly config: PlayerConfig;
  private readonly keys: MoveKeys;
  private readonly moveDir = new Phaser.Math.Vector2();
  private readonly legs: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Image;
  private invulnerableUntil = 0;
  private lastDamageAt = 0;
  private alive = true;
  private weaponKind: WeaponKind = 'pistol';
  private stepDistance = 0;
  /** Modificadores dos perks (referência viva do PerkSystem). */
  private mods: Readonly<PerkModifiers> = NEUTRAL_MODIFIERS;
  /** Multiplicador temporário de velocidade (power-up Speed Boost). */
  speedBuff = 1;
  /** Chamado ao levar dano (sangue no ponto do jogador). */
  onHurt: ((x: number, y: number) => void) | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, config: PlayerConfig) {
    super(scene, x, y, playerTorsoKey('pistol'), PLAYER_FRAMES.aim);
    this.config = config;
    this.hp = config.maxHp;

    this.shadow = scene.add.image(x, y, ASSET_KEYS.shadow).setScale(ART_SCALE * 0.9).setDepth(DEPTH.shadows);
    this.legs = scene.add.sprite(x, y, ASSET_KEYS.playerLegs, 0).setScale(ART_SCALE);

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setScale(ART_SCALE);
    const r = config.bodyRadius / ART_SCALE;
    this.setCircle(r, this.width / 2 - r, this.height / 2 - r);
    this.setCollideWorldBounds(true);
    this.setPushable(false);

    const keyboard = scene.input.keyboard;
    if (!keyboard) throw new Error('Teclado indisponível');
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      up: keyboard.addKey(K.W),
      down: keyboard.addKey(K.S),
      left: keyboard.addKey(K.A),
      right: keyboard.addKey(K.D),
    };

    // Sincroniza as partes depois da física aplicar a posição do frame.
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.syncParts, this);
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.syncParts, this);
    });
  }

  get isAlive(): boolean {
    return this.alive;
  }

  get maxHp(): number {
    return this.config.maxHp + this.mods.maxHpBonus;
  }

  get maxArmor(): number {
    return this.config.maxArmor;
  }

  heal(): void {
    if (!this.alive) return;
    this.hp = this.maxHp;
    this.emitHp();
  }

  refillArmor(): void {
    if (!this.alive) return;
    this.armor = this.maxArmor;
    this.emitHp();
  }

  setModifiers(mods: Readonly<PerkModifiers>): void {
    this.mods = mods;
  }

  /** Após comprar perk: ganha a vida extra imediatamente. */
  onPerksChanged(): void {
    if (!this.alive) return;
    this.hp = this.maxHp;
    this.emitHp();
  }

  /** Movimento WASD normalizado (diagonal não é mais rápida). */
  updateMovement(): void {
    if (!this.alive) {
      this.setVelocity(0, 0);
      return;
    }
    const { up, down, left, right } = this.keys;
    this.moveDir.set(
      Number(right.isDown) - Number(left.isDown),
      Number(down.isDown) - Number(up.isDown),
    );
    // Toque: o analógico dá direção e intensidade (empurrar pouco = andar devagar).
    let analog = 1;
    if (touchInput.enabled && touchInput.moving) {
      this.moveDir.set(touchInput.moveX, touchInput.moveY);
      analog = Math.min(1, this.moveDir.length() / 0.7);
    }
    // Andar de lado ou de costas (em relação à mira) é mais lento.
    let facing = 1;
    if (this.moveDir.lengthSq() > 0) {
      const diff = Math.abs(Phaser.Math.Angle.Wrap(this.moveDir.angle() - this.rotation));
      if (diff > Phaser.Math.DegToRad(120)) facing = this.config.backpedalMultiplier;
      else if (diff > Phaser.Math.DegToRad(60)) facing = this.config.strafeMultiplier;
    }
    this.moveDir.normalize().scale(this.config.speed * this.mods.speedMultiplier * this.speedBuff * facing * analog);
    this.setVelocity(this.moveDir.x, this.moveDir.y);
  }

  /** Tempo desde o último dano recebido (ms). */
  msSinceDamage(time: number): number {
    return time - this.lastDamageAt;
  }

  /** Regeneração lenta depois de um tempo sem levar dano. */
  updateRegen(time: number, delta: number): void {
    const regen = this.mods.regenMultiplier;
    if (!this.alive || this.hp >= this.maxHp || time - this.lastDamageAt < this.config.regenDelayMs / regen) return;
    const before = Math.ceil(this.hp);
    this.hp = Math.min(this.maxHp, this.hp + (this.config.regenPerSecond * regen * delta) / 1000);
    if (Math.ceil(this.hp) !== before) this.emitHp();
  }

  aimAt(worldX: number, worldY: number): void {
    if (!this.alive) return;
    this.rotation = Phaser.Math.Angle.Between(this.x, this.y, worldX, worldY);
  }

  /** Troca a pose/arma desenhada no tronco. */
  setWeaponKind(kind: WeaponKind): void {
    this.weaponKind = kind;
    this.anims.stop();
    this.setTexture(playerTorsoKey(kind), PLAYER_FRAMES.aim);
  }

  playShoot(): void {
    if (this.anims.currentAnim?.key === playerAnimKey(this.weaponKind, 'reload') && this.anims.isPlaying) return;
    this.play(playerAnimKey(this.weaponKind, 'shoot'));
  }

  playReload(durationMs: number): void {
    this.play({ key: playerAnimKey(this.weaponKind, 'reload'), duration: durationMs });
  }

  takeDamage(amount: number, time: number): void {
    if (!this.alive || time < this.invulnerableUntil) return;

    // A armadura absorve o dano primeiro.
    const absorbed = Math.min(this.armor, amount);
    this.armor -= absorbed;
    this.hp = Math.max(0, this.hp - (amount - absorbed));
    this.invulnerableUntil = time + this.config.invulnerabilityMs;
    this.lastDamageAt = time;
    this.emitHp();
    this.scene.cameras.main.shake(90, 0.005);

    if (this.hp === 0) {
      this.die();
      return;
    }
    this.onHurt?.(this.x, this.y);
    // Tranco: o tronco encolhe e volta (animação de dano).
    this.scene.tweens.add({ targets: this, scale: ART_SCALE * 0.9, duration: 60, yoyo: true, ease: 'Quad.easeOut' });
    this.setTint(HURT_TINT);
    this.legs.setTint(HURT_TINT);
    this.scene.time.delayedCall(120, () => {
      if (!this.alive) return;
      this.clearTint();
      this.legs.clearTint();
    });
  }

  emitHp(): void {
    emitGameEvent(this.scene.game.events, GameEvents.PlayerHpChanged, {
      hp: this.hp,
      maxHp: this.maxHp,
      armor: this.armor,
      maxArmor: this.maxArmor,
    });
  }

  private syncParts(): void {
    const body = this.body as Phaser.Physics.Arcade.Body | null;
    const speed = body ? body.velocity.length() : 0;
    const moving = this.alive && speed > 5;

    this.setDepth(this.y);
    this.legs.setPosition(this.x, this.y).setDepth(this.y - 0.5);
    this.shadow.setPosition(this.x + SHADOW_OFFSET.x, this.y + SHADOW_OFFSET.y);

    if (moving && body) {
      const moveAngle = Math.atan2(body.velocity.y, body.velocity.x);
      // Andando de costas: as pernas apontam para trás do movimento, sem torcer demais o tronco.
      const diff = Phaser.Math.Angle.Wrap(moveAngle - this.rotation);
      const target = Math.abs(diff) > LEGS_MAX_TWIST ? moveAngle + Math.PI : moveAngle;
      this.legs.rotation = Phaser.Math.Angle.RotateTo(this.legs.rotation, target, LEGS_TURN);
      if (!this.legs.anims.isPlaying) this.legs.play(ANIM_KEYS.playerLegsWalk);
      this.legs.anims.timeScale = speed / this.config.speed;
      // Um passo a cada ~44 px andados (som conforme o piso).
      this.stepDistance += speed * (this.scene.game.loop.delta / 1000);
      if (this.stepDistance >= audioConfig.stepDistance) {
        this.stepDistance = 0;
        audio.footstep(this.x, this.y);
      }
    } else {
      this.legs.anims.stop();
      this.legs.setFrame(0);
      this.legs.rotation = Phaser.Math.Angle.RotateTo(this.legs.rotation, this.rotation, LEGS_TURN);
    }
  }

  private die(): void {
    this.alive = false;
    this.setVelocity(0, 0);
    this.anims.stop();
    this.onHurt?.(this.x, this.y);
    // Queda: o corpo tomba de lado e as pernas somem sob ele.
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({ targets: this, rotation: this.rotation + 1.4, scale: ART_SCALE * 0.92, duration: 700, ease: 'Bounce.easeOut' });
    this.scene.tweens.add({ targets: this.legs, alpha: 0, duration: 500 });
    this.setTint(DEAD_TINT);
    this.legs.setTint(DEAD_TINT);
    emitGameEvent(this.scene.game.events, GameEvents.PlayerDied, undefined);
  }
}
