import Phaser from 'phaser';
import { powerConfig } from '../config/power.config';
import { audio } from '../audio/AudioSystem';
import type { LightingSystem } from '../effects/LightingSystem';
import { emitGameEvent, GameEvents } from '../game/events';

/** Energia do mapa: começa desligada; o disjuntor liga para o resto da partida. */
export class PowerSystem {
  private on = false;

  constructor(private readonly scene: Phaser.Scene, private readonly lighting: LightingSystem) {
    lighting.setPowered(false, 0);
  }

  get isOn(): boolean {
    return this.on;
  }

  /** Liga a energia (uma vez só). */
  turnOn(): boolean {
    if (this.on) return false;
    this.on = true;
    this.lighting.setPowered(true, powerConfig.restoreFlickerMs);
    this.scene.cameras.main.shake(400, 0.004);
    audio.play('lab_upgrade', { category: 'ui', volume: 0.9, rate: 0.6, pitchJitter: 0 });
    emitGameEvent(this.scene.game.events, GameEvents.PowerChanged, { on: true });
    return true;
  }
}
