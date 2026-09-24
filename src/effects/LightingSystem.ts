import Phaser from 'phaser';
import { powerConfig } from '../config/power.config';
import { FX_KEYS } from '../config/assets.config';
import { DEPTH, lightingConfig } from '../config/visual.config';
import type { Lamp } from '../map/GameMap';

const RADIAL_SIZE = 256;
const CONE_LENGTH = 512;

interface LightOwner {
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
  readonly isAlive: boolean;
}

interface Flash {
  x: number;
  y: number;
  radius: number;
  intensity: number;
  start: number;
  duration: number;
}

interface LampState extends Lamp {
  dimUntil: number;
  dimFactor: number;
  glow: Phaser.GameObjects.Image;
}

/**
 * Escuridão ambiente com luzes "recortadas": uma RenderTexture cobre a área visível
 * e cada luz apaga (erase) parte dela. Lanterna em cone, luminárias que piscam e clarões.
 */
export class LightingSystem {
  private readonly scene: Phaser.Scene;
  private readonly darkness: Phaser.GameObjects.RenderTexture;
  private readonly flashlightGlow: Phaser.GameObjects.Image;
  private readonly lamps: LampState[];
  private flashes: Flash[] = [];
  private readonly dynamicLights: Array<{ x: number; y: number; radius: number; intensity: number; color?: number; glow: Phaser.GameObjects.Image }> = [];
  /** Rage Mode do boss: luzes vermelhas pulsando e mais escuridão. */
  private alarm = false;
  /** Apagão: nível atual (0 = normal, 1 = luzes apagadas) e transição piscando. */
  private power = { on: true, changedAt: -Infinity, flickerMs: 0 };
  private blackout = { target: 0, level: 0, changedAt: -Infinity, flickerMs: 0, extraDarkness: 0, emergencyFactor: 1 };
  /** Cor da escuridão (null = padrão); a Lua de Sangue deixa avermelhada. */
  private darknessTint: number | null = null;
  /** Neblina: escuridão extra e lanterna mais curta. */
  private fog = { extra: 0, flashlight: 1 };
  /** Escuridão atual (transição suave ao mudar de área). */
  private ambient: number = lightingConfig.ambientDarkness;

  constructor(
    scene: Phaser.Scene,
    private readonly owner: LightOwner,
    lamps: Lamp[],
    /** Escuridão ambiente em um ponto do mundo (varia por área). */
    private readonly darknessAt: (x: number, y: number) => number = () => lightingConfig.ambientDarkness,
  ) {
    this.scene = scene;
    this.darkness = scene.add.renderTexture(0, 0, 16, 16).setOrigin(0).setDepth(DEPTH.darkness);

    // Brilho quente aditivo por cima da escuridão: dá cor às luzes.
    this.lamps = lamps.map((lamp) => ({
      ...lamp,
      dimUntil: 0,
      dimFactor: 1,
      glow: scene.add
        .image(lamp.x, lamp.y, FX_KEYS.lightRadial)
        .setScale((lamp.radius * 2) / RADIAL_SIZE)
        .setTint(lamp.color ?? lightingConfig.lampGlowColor)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(DEPTH.glow),
    }));
    this.flashlightGlow = scene.add
      .image(0, 0, FX_KEYS.lightCone)
      .setOrigin(0, 0.5)
      .setScale(lightingConfig.flashlight.range / CONE_LENGTH)
      .setTint(0xffe2b0)
      .setAlpha(lightingConfig.flashlight.warmGlow)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.glow);

    this.setEnabled(lightingConfig.enabled);
  }

  setEnabled(enabled: boolean): void {
    this.darkness.setVisible(enabled);
    this.flashlightGlow.setVisible(enabled);
    for (const lamp of this.lamps) lamp.glow.setVisible(enabled);
  }

  /** Luz que acompanha algo em movimento (ex.: a lanterna do boss). Altere x/y do objeto retornado. */
  addDynamicLight<T extends { x: number; y: number; radius: number; intensity: number; color?: number }>(light: T): T {
    const glow = this.scene.add
      .image(light.x, light.y, FX_KEYS.lightRadial)
      .setScale((light.radius * 2) / RADIAL_SIZE)
      .setTint(light.color ?? lightingConfig.lampGlowColor)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.18)
      .setDepth(DEPTH.glow);
    this.dynamicLights.push(Object.assign(light, { glow }));
    return light;
  }

  removeDynamicLight(light: object): void {
    const i = this.dynamicLights.findIndex((l) => l === light);
    if (i >= 0) {
      this.dynamicLights[i].glow.destroy();
      this.dynamicLights.splice(i, 1);
    }
  }

  setAlarm(on: boolean): void {
    this.alarm = on;
    for (const lamp of this.lamps) lamp.glow.setTint(on ? 0xff3322 : lamp.color ?? lightingConfig.lampGlowColor);
  }

  /**
   * Apagão (evento): as luminárias piscam e apagam; as luzes de emergência ficam fracas
   * e o ambiente escurece. `on = false` religa com o mesmo efeito de piscar.
   */
  /** Energia do mapa: sem ela, luzes das máquinas apagadas e luminárias mais fracas. */
  setPowered(on: boolean, flickerMs: number): void {
    this.power = { on, changedAt: this.scene.time.now, flickerMs };
  }

  setBlackout(on: boolean, opts: { extraDarkness: number; emergencyFactor: number; flickerMs: number }): void {
    this.blackout = { ...opts, target: on ? 1 : 0, level: this.blackout.level, changedAt: this.scene.time.now };
  }

  setDarknessTint(color: number | null): void {
    this.darknessTint = color;
  }

  setFog(extra: number, flashlightFactor: number): void {
    this.fog = { extra, flashlight: flashlightFactor };
  }

  addFlash(x: number, y: number, radius: number, intensity: number, duration: number): void {
    this.flashes.push({ x, y, radius, intensity, start: this.scene.time.now, duration });
  }

  update(time: number): void {
    if (!this.darkness.visible) return;
    const cfg = lightingConfig;
    const cam = this.scene.cameras.main;
    const view = cam.worldView;
    const m = cfg.margin;
    const w = Math.ceil(cam.width / cam.zoom) + m * 2;
    const h = Math.ceil(cam.height / cam.zoom) + m * 2;
    if (this.darkness.width !== w || this.darkness.height !== h) this.darkness.resize(w, h);

    const ox = view.x - m;
    const oy = view.y - m;
    const rt = this.darkness;
    rt.setPosition(ox, oy);
    rt.clear();
    const alarmExtra = this.alarm ? 0.1 : 0;
    const b = this.blackout;
    // Na transição, a energia oscila (liga/desliga em saltos) antes de firmar.
    b.level = time - b.changedAt < b.flickerMs ? (Math.sin(time * 0.037) * Math.sin(time * 0.011) > 0 ? 1 : 0) : b.target;
    const blackoutExtra = b.extraDarkness * b.level;
    this.ambient = Phaser.Math.Linear(this.ambient, Math.min(0.97, this.darknessAt(this.owner.x, this.owner.y) + alarmExtra + blackoutExtra + this.fog.extra), 0.05);
    rt.fill(this.darknessTint ?? cfg.darknessColor, this.ambient);

    const inView = (x: number, y: number, r: number): boolean =>
      x + r > ox && x - r < ox + w && y + r > oy && y - r < oy + h;

    // Luminárias
    // Alarme: todas as luzes pulsam juntas em vermelho.
    const alarmPulse = this.alarm ? 0.35 + 0.65 * Math.abs(Math.sin(time / 260)) : 1;
    // Energia: ao ligar, as luzes oscilam antes de firmar.
    const pw = this.power;
    const powered = time - pw.changedAt < pw.flickerMs ? Math.sin(time * 0.041) * Math.sin(time * 0.013) > 0 : pw.on;
    for (const lamp of this.lamps) {
      const mains = powered ? 1 : lamp.needsPower ? 0 : lamp.emergency ? 1 : powerConfig.lampFactorOff;
      const power = mains * (1 - b.level * (lamp.emergency ? 1 - b.emergencyFactor : 1));
      const intensity = this.lampIntensity(lamp, time) * alarmPulse * power;
      lamp.glow.setAlpha((cfg.lampGlowAlpha * intensity) / lamp.intensity);
      if (!inView(lamp.x, lamp.y, lamp.radius) || intensity <= 0.01) continue;
      this.eraseRadial(lamp.x - ox, lamp.y - oy, lamp.radius, intensity);
    }

    for (const light of this.dynamicLights) {
      light.glow.setPosition(light.x, light.y);
      if (inView(light.x, light.y, light.radius)) this.eraseRadial(light.x - ox, light.y - oy, light.radius, light.intensity);
    }

    // Lanterna do jogador
    const fl = cfg.flashlight;
    const owner = this.owner;
    this.flashlightGlow.setVisible(owner.isAlive).setPosition(owner.x, owner.y).setRotation(owner.rotation);
    if (owner.isAlive) {
      rt.stamp(FX_KEYS.lightCone, undefined, owner.x - ox, owner.y - oy, {
        rotation: owner.rotation,
        originX: 0,
        originY: 0.5,
        scale: (fl.range * this.fog.flashlight) / CONE_LENGTH,
        alpha: fl.intensity,
        erase: true,
      });
    }
    this.eraseRadial(owner.x - ox, owner.y - oy, fl.aura, fl.auraIntensity);

    // Clarões (disparos, impactos)
    this.flashes = this.flashes.filter((f) => time - f.start < f.duration);
    for (const f of this.flashes) {
      const k = 1 - (time - f.start) / f.duration;
      this.eraseRadial(f.x - ox, f.y - oy, f.radius, f.intensity * k);
    }
  }

  private eraseRadial(x: number, y: number, radius: number, intensity: number): void {
    this.darkness.stamp(FX_KEYS.lightRadial, undefined, x, y, {
      scale: (radius * 2) / RADIAL_SIZE,
      alpha: Phaser.Math.Clamp(intensity, 0, 1),
      erase: true,
    });
  }

  /** Luzes defeituosas: quedas aleatórias de intensidade, proporcionais a `flicker`. */
  private lampIntensity(lamp: LampState, time: number): number {
    if (time < lamp.dimUntil) return lamp.intensity * lamp.dimFactor;
    if (Math.random() < lamp.flicker * 0.025) {
      lamp.dimUntil = time + Phaser.Math.Between(40, 220);
      lamp.dimFactor = Phaser.Math.FloatBetween(0, 0.45);
    }
    return lamp.intensity * (1 - lamp.flicker * 0.08 * Math.random());
  }
}
