import Phaser from 'phaser';
import { FX_KEYS } from '../config/assets.config';
import { DEPTH, lightingConfig } from '../config/visual.config';
import type { Lamp } from '../map/TerminalMap';

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
    this.ambient = Phaser.Math.Linear(this.ambient, this.darknessAt(this.owner.x, this.owner.y), 0.03);
    rt.fill(cfg.darknessColor, this.ambient);

    const inView = (x: number, y: number, r: number): boolean =>
      x + r > ox && x - r < ox + w && y + r > oy && y - r < oy + h;

    // Luminárias
    for (const lamp of this.lamps) {
      const intensity = this.lampIntensity(lamp, time);
      lamp.glow.setAlpha(cfg.lampGlowAlpha * intensity / lamp.intensity);
      if (!inView(lamp.x, lamp.y, lamp.radius) || intensity <= 0.01) continue;
      this.eraseRadial(lamp.x - ox, lamp.y - oy, lamp.radius, intensity);
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
        scale: fl.range / CONE_LENGTH,
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
