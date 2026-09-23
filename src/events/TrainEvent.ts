import Phaser from 'phaser';
import { ASSET_KEYS } from '../config/assets.config';
import { TILE_SIZE } from '../config/game.config';
import { trainConfig } from '../config/events.config';
import { ART_SCALE, DEPTH } from '../config/visual.config';
import { audio, type SpatialLoop } from '../audio/AudioSystem';
import { liveZombies, type EventContext, type WorldEvent } from './WorldEvent';

type Light = { x: number; y: number; radius: number; intensity: number; color?: number };

/** Largura da faixa dos trilhos na plataforma (tiles): só o trecho aberto recebe o aviso. */
const PLATFORM_SPAN = { from: 16, to: 112 };
const WARNING_BLINK_MS = 260;

/**
 * Trem atravessando a plataforma: aviso (buzina, luzes vermelhas, faixa piscando)
 * e depois o trem cruza a faixa livre dos trilhos em alta velocidade, matando os
 * zumbis e ferindo o jogador que estiverem nela.
 */
export class TrainEvent implements WorldEvent {
  readonly id = 'train';
  readonly durationMs = null;
  readonly endsWithWave = false;
  readonly atWaveStart = false;

  private ctx: EventContext | null = null;
  private startedAt = 0;
  private dir = 1;
  private train: Phaser.GameObjects.Container | null = null;
  private stripe: Phaser.GameObjects.Rectangle | null = null;
  private beacons: Light[] = [];
  private headlight: Light | null = null;
  private rumble: SpatialLoop | null = null;
  private playerHit = false;

  private readonly top = trainConfig.lane.y * TILE_SIZE;
  private readonly bottom = (trainConfig.lane.y + trainConfig.lane.h) * TILE_SIZE;
  private readonly length = trainConfig.cars * trainConfig.carLength;

  canStart(ctx: EventContext): boolean {
    return ctx.isAreaOpen(trainConfig.area);
  }

  start(ctx: EventContext): void {
    this.ctx = ctx;
    this.startedAt = ctx.scene.time.now;
    this.dir = Math.random() < 0.5 ? 1 : -1;
    this.playerHit = false;
    const x0 = PLATFORM_SPAN.from * TILE_SIZE;
    const x1 = PLATFORM_SPAN.to * TILE_SIZE;
    const cy = (this.top + this.bottom) / 2;
    this.stripe = ctx.scene.add
      .rectangle(x0, this.top, x1 - x0, this.bottom - this.top, 0xff2a1a, 0)
      .setOrigin(0)
      .setBlendMode(Phaser.BlendModes.ADD)
      // Acima da escuridão: o aviso aparece mesmo com a plataforma escura.
      .setDepth(DEPTH.glow);
    this.beacons = [x0 + 24, x1 - 24, (x0 + x1) / 2].map((x) =>
      ctx.lighting.addDynamicLight({ x, y: cy, radius: 140, intensity: 0, color: 0xff3322 }),
    );
    // A buzina vem do lado de onde o trem chega.
    audio.playAt('evt_train_warning', this.dir > 0 ? x0 : x1, cy, { category: 'world', volume: 1, distance: 2600 });
  }

  update(time: number, delta: number): boolean {
    const ctx = this.ctx;
    if (!ctx) return false;
    const elapsed = time - this.startedAt;

    if (elapsed < trainConfig.warningMs) {
      const on = Math.floor(elapsed / WARNING_BLINK_MS) % 2 === 0;
      this.stripe?.setFillStyle(0xff2a1a, on ? 0.28 : 0.08);
      for (const b of this.beacons) b.intensity = on ? 0.9 : 0.15;
      return true;
    }
    if (!this.train) this.spawnTrain(ctx);
    const train = this.train;
    if (!train) return false;

    train.x += this.dir * trainConfig.speed * (delta / 1000);
    const [minX, maxX] = this.dir > 0 ? [train.x, train.x + this.length] : [train.x - this.length, train.x];
    const cy = (this.top + this.bottom) / 2;
    if (this.headlight) this.headlight.x = this.dir > 0 ? maxX + 40 : minX - 40;
    if (this.rumble) this.rumble.x = Phaser.Math.Clamp(ctx.player.x, minX, maxX);
    const blink = Math.floor(elapsed / WARNING_BLINK_MS) % 2 === 0;
    for (const b of this.beacons) b.intensity = blink ? 0.9 : 0.15;
    this.stripe?.setFillStyle(0xff2a1a, blink ? 0.22 : 0.06);
    this.runOver(ctx, minX, maxX);
    if (Math.abs(ctx.player.y - cy) < 260 && ctx.player.x > minX - 400 && ctx.player.x < maxX + 400) {
      ctx.scene.cameras.main.shake(80, 0.0025);
    }
    // Terminou quando o último vagão saiu do mapa.
    return this.dir > 0 ? minX < ctx.map.widthPx : maxX > 0;
  }

  end(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.train?.destroy();
    this.stripe?.destroy();
    for (const b of this.beacons) ctx.lighting.removeDynamicLight(b);
    if (this.headlight) ctx.lighting.removeDynamicLight(this.headlight);
    this.rumble?.stop(600);
    this.train = null;
    this.stripe = null;
    this.beacons = [];
    this.headlight = null;
    this.rumble = null;
    this.ctx = null;
  }

  /** Locomotivas nas pontas e vagões no meio; a frente aponta na direção do movimento. */
  private spawnTrain(ctx: EventContext): void {
    const { scene } = ctx;
    const car = trainConfig.carLength;
    const cy = (this.top + this.bottom) / 2;
    const parts: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < trainConfig.cars; i++) {
      const last = i === trainConfig.cars - 1;
      const key = i === 0 || last ? ASSET_KEYS.trainHead : ASSET_KEYS.trainCar;
      parts.push(scene.add.image(car / 2 + i * car, 0, key).setScale(ART_SCALE).setFlipX(i === 0));
    }
    const startX = this.dir > 0 ? -this.length : ctx.map.widthPx + this.length;
    this.train = scene.add
      .container(startX, cy, parts)
      .setScale(this.dir, 1)
      .setDepth(this.bottom + 8);
    this.headlight = ctx.lighting.addDynamicLight({ x: startX, y: cy, radius: 220, intensity: 1, color: 0xfff0c0 });
    this.rumble = audio.loopAt('evt_train_pass', ctx.player.x, cy, { category: 'world', volume: 1, distance: 1500 });
  }

  /** Quem estiver na faixa dos trilhos é atropelado. */
  private runOver(ctx: EventContext, minX: number, maxX: number): void {
    const angle = this.dir > 0 ? 0 : Math.PI;
    for (const z of liveZombies(ctx.zombies)) {
      if (z.x < minX || z.x > maxX || z.y < this.top - 10 || z.y > this.bottom + 10) continue;
      const { x, y } = z;
      if (z.takeDamage(z.hp + 1, false, 'hazard')) ctx.effects.zombieDeath(x, y, angle, z.skin);
    }
    const p = ctx.player;
    if (!this.playerHit && p.isAlive && p.x >= minX && p.x <= maxX && p.y > this.top - 8 && p.y < this.bottom + 8) {
      this.playerHit = true;
      p.takeDamage(trainConfig.playerDamage, ctx.scene.time.now);
      ctx.effects.bloodHit(p.x, p.y, angle);
      ctx.scene.cameras.main.shake(400, 0.012);
    }
  }
}
