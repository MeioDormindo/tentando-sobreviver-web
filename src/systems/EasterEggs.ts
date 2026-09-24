import Phaser from 'phaser';
import { ASSET_KEYS } from '../config/assets.config';
import { TILE_SIZE } from '../config/game.config';
import { secretsConfig } from '../config/secrets.config';
import type { MapSecrets } from '../map/types';
import { ART_SCALE } from '../config/visual.config';
import { audio } from '../audio/AudioSystem';
import { HoldProgress } from '../entities/HoldProgress';
import type { Player } from '../entities/Player';
import { emitGameEvent, GameEvents, type InteractionPromptPayload } from '../game/events';
import { save } from '../save/SaveStore';
import type { InteractionSystem, Interactable } from './InteractionSystem';

const RADIO_BUSY_MS = 6000;
const TEDDY_GLOW = 0xffc8e0;

const center = (tx: number, ty: number) => ({ x: tx * TILE_SIZE + TILE_SIZE / 2, y: ty * TILE_SIZE + TILE_SIZE / 2 });

export interface EasterEggDeps {
  interaction: InteractionSystem;
  player: Player;
  spawnGoldenDrop: (x: number, y: number) => void;
  secrets: MapSecrets;
}

/** Ursinho escondido: pegar os 3 na mesma partida toca a canção secreta e solta um Golden Drop. */
class Teddy implements Interactable {
  readonly radius = 40;
  readonly x: number;
  readonly y: number;
  private readonly sprite: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, tx: number, ty: number, private readonly onFound: (t: Teddy) => void) {
    const p = center(tx, ty);
    this.x = p.x;
    this.y = p.y;
    this.sprite = scene.add.image(p.x, p.y, ASSET_KEYS.teddy).setScale(ART_SCALE).setRotation(Phaser.Math.FloatBetween(-0.6, 0.6)).setDepth(p.y);
  }

  getPrompt(): InteractionPromptPayload {
    return { text: '[E] PEGAR O URSINHO', affordable: true };
  }

  interact(): void {
    const scene = this.sprite.scene;
    scene.tweens.add({ targets: this.sprite, scale: ART_SCALE * 1.6, alpha: 0, angle: 200, duration: 450, onComplete: () => this.sprite.destroy() });
    this.onFound(this);
  }
}

/** Rádio velho: segurar E sintoniza uma transmissão com a história do terminal. */
class Radio implements Interactable {
  readonly radius = 48;
  readonly x: number;
  readonly y: number;
  private readonly progress: HoldProgress;
  private next = 0;
  private busyUntil = 0;

  constructor(private readonly scene: Phaser.Scene, private readonly secrets: MapSecrets) {
    this.progress = new HoldProgress(secrets.radio.holdMs);
    const p = center(secrets.radio.tx, secrets.radio.ty);
    this.x = p.x;
    this.y = p.y;
    scene.add.image(p.x, p.y, ASSET_KEYS.radio).setScale(ART_SCALE).setDepth(p.y);
  }

  getPrompt(): InteractionPromptPayload {
    if (this.scene.time.now < this.busyUntil) return { text: 'RÁDIO — CHIADO...', affordable: false };
    return { text: `SEGURE E: ${this.secrets.radio.label}${this.progress.bar(this.scene.time.now)}`, affordable: true };
  }

  interact(): void {}

  onHold(time: number, delta: number): void {
    if (time < this.busyUntil || !this.progress.hold(time, delta)) return;
    this.busyUntil = time + RADIO_BUSY_MS;
    const lore = this.secrets.loreMessages;
    const text = lore[this.next % lore.length];
    this.next++;
    audio.playAt('radio_static', this.x, this.y, { category: 'world', volume: 0.9, pitchJitter: 0 });
    emitGameEvent(this.scene.game.events, GameEvents.Toast, { text });
  }
}

/** Placa de créditos. */
class CreditsSign implements Interactable {
  readonly x: number;
  readonly y: number;

  constructor(private readonly scene: Phaser.Scene, sign: { tx: number; ty: number }) {
    const p = center(sign.tx, sign.ty);
    this.x = p.x;
    this.y = p.y;
  }

  getPrompt(): InteractionPromptPayload {
    return { text: '[E] LER A PLACA', affordable: true };
  }

  interact(): void {
    emitGameEvent(this.scene.game.events, GameEvents.Toast, { text: secretsConfig.credits });
  }
}

/** Easter eggs do mapa: ursinhos, rádio e placa de créditos. */
export class EasterEggs {
  private found = 0;

  constructor(private readonly scene: Phaser.Scene, private readonly deps: EasterEggDeps) {
    const { secrets } = deps;
    for (const t of secrets.teddies) deps.interaction.add(new Teddy(scene, t.tx, t.ty, (teddy) => this.onTeddy(teddy)));
    deps.interaction.add(new Radio(scene, secrets));
    deps.interaction.add(new CreditsSign(scene, secrets.creditsSign));
  }

  get teddiesFound(): number {
    return this.found;
  }

  private onTeddy(teddy: Teddy): void {
    this.deps.interaction.remove(teddy);
    this.found++;
    const total = this.deps.secrets.teddies.length;
    const events = this.scene.game.events;
    if (this.found < total) {
      audio.play('box_reveal', { category: 'ui', volume: 0.5, rate: 1.4, pitchJitter: 0 });
      emitGameEvent(events, GameEvents.Toast, { text: `URSINHO ${this.found}/${total}` });
      return;
    }
    audio.play('secret_song', { category: 'ui', volume: 0.9, pitchJitter: 0 });
    const p = this.deps.player;
    this.deps.spawnGoldenDrop(p.x + Math.cos(p.rotation) * 40, p.y + Math.sin(p.rotation) * 40);
    const first = save.discover('teddies');
    emitGameEvent(events, GameEvents.PowerUpCollected, {
      id: 'teddies',
      name: 'SEGREDO DOS URSINHOS',
      color: TEDDY_GLOW,
      detail: first ? 'Você achou todos! Segredo salvo.' : 'Todos os ursinhos de novo!',
    });
  }
}
