import Phaser from 'phaser';
import { ASSET_KEYS } from '../config/assets.config';
import { TILE_SIZE } from '../config/game.config';
import { interactionsConfig } from '../config/interactions.config';
import type { WorldEventId } from '../config/events.config';
import { ART_SCALE, DEPTH } from '../config/visual.config';
import type { EffectsSystem } from '../effects/EffectsSystem';
import type { LightingSystem } from '../effects/LightingSystem';
import { emitGameEvent, GameEvents, type InteractionPromptPayload } from '../game/events';
import { INTERACTIONS, type MapInteractionDef, type Rect } from '../map/terminal/layout';
import type { EconomySystem } from '../systems/EconomySystem';
import type { InteractionSystem, Interactable } from '../systems/InteractionSystem';
import { audio } from '../audio/AudioSystem';
import { HoldProgress } from './HoldProgress';
import type { SolidPlacer } from './Machines';
import type { Zombie } from './Zombie';

type Light = { x: number; y: number; radius: number; intensity: number; color?: number };

export interface MapInteractionDeps {
  economy: EconomySystem;
  effects: EffectsSystem;
  lighting: LightingSystem;
  solids: SolidPlacer;
  zombies: Phaser.Physics.Arcade.Group;
  events: {
    readonly activeId: WorldEventId | null;
    endEvent(id: WorldEventId): boolean;
    callTrain(): boolean;
  };
}

const money = (n: number): string => `$${n.toLocaleString('pt-BR')}`;
const center = (tx: number, ty: number) => ({ x: tx * TILE_SIZE + TILE_SIZE / 2, y: ty * TILE_SIZE + TILE_SIZE / 2 });

/** Painel de parede com corpo sólido. */
abstract class Panel implements Interactable {
  readonly radius = 44;
  readonly x: number;
  readonly y: number;

  constructor(protected readonly scene: Phaser.Scene, def: MapInteractionDef, texture: string, protected readonly deps: MapInteractionDeps) {
    const p = center(def.tx, def.ty);
    this.x = p.x;
    this.y = p.y;
    scene.add.image(p.x, p.y, texture).setScale(ART_SCALE).setDepth(p.y + 12);
    deps.solids.addSolid(p.x, p.y, 28, 18);
  }

  abstract getPrompt(): InteractionPromptPayload | null;
  interact(): void {}

  protected toast(text: string): void {
    emitGameEvent(this.scene.game.events, GameEvents.Toast, { text });
  }
}

/** Segurar E durante um evento para encerrá-lo pagando (Apagão, Alarme). */
class EventSwitch extends Panel {
  private readonly progress: HoldProgress;

  constructor(
    scene: Phaser.Scene,
    def: MapInteractionDef,
    texture: string,
    deps: MapInteractionDeps,
    private readonly event: WorldEventId,
    private readonly label: string,
    private readonly idle: string,
    private readonly price: number,
    holdMs: number,
  ) {
    super(scene, def, texture, deps);
    this.progress = new HoldProgress(holdMs);
  }

  getPrompt(): InteractionPromptPayload | null {
    if (this.deps.events.activeId !== this.event) return { text: this.idle, affordable: false };
    return { text: `SEGURE E: ${this.label} — ${money(this.price)}${this.progress.bar(this.scene.time.now)}`, affordable: this.deps.economy.canAfford(this.price) };
  }

  onHold(time: number, delta: number): void {
    if (this.deps.events.activeId !== this.event || !this.progress.hold(time, delta)) return;
    if (!this.deps.economy.spend(this.price)) return;
    this.deps.events.endEvent(this.event);
    audio.playAt('lab_upgrade', this.x, this.y, { category: 'ui', volume: 0.8, pitchJitter: 0 });
    this.deps.effects.shockwave(this.x, this.y, 50, 0xe8c14a);
  }
}

/** Painel da Plataforma: paga para o trem passar agora. */
class TrainPanel extends Panel {
  private readyAt = 0;

  getPrompt(): InteractionPromptPayload | null {
    const cfg = interactionsConfig.train;
    const wait = Math.ceil((this.readyAt - this.scene.time.now) / 1000);
    if (wait > 0) return { text: `PAINEL DO TREM — DISPONÍVEL EM ${wait}s`, affordable: false };
    return { text: `[E] CHAMAR O TREM — ${money(cfg.price)}`, affordable: this.deps.economy.canAfford(cfg.price) };
  }

  override interact(): void {
    const cfg = interactionsConfig.train;
    if (this.scene.time.now < this.readyAt || !this.deps.economy.spend(cfg.price)) return;
    if (!this.deps.events.callTrain()) {
      // Trem já passando (ou Plataforma fechada): devolve o dinheiro.
      this.deps.economy.earn(cfg.price);
      this.toast('O TREM NÃO PODE VIR AGORA');
      return;
    }
    this.readyAt = this.scene.time.now + cfg.cooldownMs;
  }
}

/** Armadilha elétrica: paga para eletrificar a grade; mata os zumbis que passam por ela. */
class ElectricTrap extends Panel {
  private activeUntil = 0;
  private readyAt = 0;
  private nextTickAt = 0;
  private readonly zone: Phaser.Geom.Rectangle;
  private readonly grate: Phaser.GameObjects.TileSprite;
  private light: Light | null = null;

  constructor(scene: Phaser.Scene, def: MapInteractionDef & { zone: Rect }, deps: MapInteractionDeps) {
    super(scene, def, ASSET_KEYS.panelTrap, deps);
    const z = def.zone;
    this.zone = new Phaser.Geom.Rectangle(z.x * TILE_SIZE, z.y * TILE_SIZE, z.w * TILE_SIZE, z.h * TILE_SIZE);
    this.grate = scene.add
      .tileSprite(this.zone.x, this.zone.y, this.zone.width, this.zone.height, ASSET_KEYS.trapGrate)
      .setOrigin(0)
      .setTileScale(ART_SCALE)
      .setAlpha(0.8)
      .setDepth(DEPTH.decals + 1);
  }

  get active(): boolean {
    return this.scene.time.now < this.activeUntil;
  }

  getPrompt(): InteractionPromptPayload | null {
    const cfg = interactionsConfig.trap;
    const now = this.scene.time.now;
    if (this.active) return { text: `ARMADILHA ELÉTRICA LIGADA — ${Math.ceil((this.activeUntil - now) / 1000)}s`, affordable: false };
    if (now < this.readyAt) return { text: `ARMADILHA RECARREGANDO — ${Math.ceil((this.readyAt - now) / 1000)}s`, affordable: false };
    return { text: `[E] LIGAR ARMADILHA ELÉTRICA — ${money(cfg.price)}`, affordable: this.deps.economy.canAfford(cfg.price) };
  }

  override interact(): void {
    const cfg = interactionsConfig.trap;
    const now = this.scene.time.now;
    if (this.active || now < this.readyAt || !this.deps.economy.spend(cfg.price)) return;
    this.activeUntil = now + cfg.activeMs;
    this.readyAt = this.activeUntil + cfg.cooldownMs;
    this.light = this.deps.lighting.addDynamicLight({ x: this.zone.centerX, y: this.zone.centerY, radius: 140, intensity: 0.7, color: 0x7fd8ff });
    audio.playAt('shot_arc_gun', this.x, this.y, { category: 'world', volume: 1, pitchJitter: 0 });
  }

  update(time: number): void {
    if (!this.active) {
      if (this.light) {
        this.deps.lighting.removeDynamicLight(this.light);
        this.light = null;
        this.grate.clearTint();
      }
      return;
    }
    if (time < this.nextTickAt) return;
    this.nextTickAt = time + interactionsConfig.trap.tickMs;
    const z = this.zone;
    this.grate.setTint(Math.random() < 0.5 ? 0x9fe8ff : 0xffffff);
    if (this.light) this.light.intensity = 0.5 + Math.random() * 0.4;
    // Faíscas aleatórias na grade
    const rx = () => z.x + Math.random() * z.width;
    const ry = () => z.y + Math.random() * z.height;
    this.deps.effects.lightning([{ x: rx(), y: ry() }, { x: rx(), y: ry() }], 0x7fd8ff);
    for (const child of this.deps.zombies.getChildren()) {
      const zb = child as Zombie;
      if (!zb.active || !zb.isAlive || !z.contains(zb.x, zb.y)) continue;
      const { x, y } = zb;
      this.deps.effects.lightning([{ x: rx(), y: ry() }, { x, y }], 0xbff4ff);
      if (zb.takeDamage(zb.hp + 1, false, 'hazard')) this.deps.effects.zombieDeath(x, y, Math.random() * Math.PI * 2, zb.skin);
    }
  }
}

/** Cria todos os painéis e armadilhas do mapa e atualiza as armadilhas a cada quadro. */
export class MapInteractions {
  private readonly traps: ElectricTrap[] = [];

  constructor(scene: Phaser.Scene, interaction: InteractionSystem, deps: MapInteractionDeps) {
    const p = interactionsConfig;
    for (const def of INTERACTIONS) {
      if (def.type === 'trap') {
        const trap = new ElectricTrap(scene, def, deps);
        this.traps.push(trap);
        interaction.add(trap);
      } else if (def.type === 'power') {
        interaction.add(new EventSwitch(scene, def, ASSET_KEYS.panelPower, deps, 'blackout', 'RELIGAR A ENERGIA', 'PAINEL DE ENERGIA — FUNCIONANDO', p.power.price, p.power.holdMs));
      } else if (def.type === 'alarm') {
        interaction.add(new EventSwitch(scene, def, ASSET_KEYS.panelAlarm, deps, 'emergency_alarm', 'DESLIGAR O ALARME', 'ALARME DE EMERGÊNCIA — DESLIGADO', p.alarm.price, p.alarm.holdMs));
      } else {
        interaction.add(new TrainPanel(scene, def, ASSET_KEYS.panelTrain, deps));
      }
    }
  }

  update(time: number): void {
    for (const t of this.traps) t.update(time);
  }
}
