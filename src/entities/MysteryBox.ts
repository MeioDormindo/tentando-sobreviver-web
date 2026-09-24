import Phaser from 'phaser';
import type { MapId } from '../config/maps.config';
import { FX_KEYS, gunIconKey, machineKeys, WEAPON_KINDS } from '../config/assets.config';
import { mysteryBoxConfig } from '../config/machines.config';
import { ART_SCALE, DEPTH } from '../config/visual.config';
import { weapons, type Rarity, type WeaponConfig } from '../config/weapons.config';
import { emitGameEvent, GameEvents, type InteractionPromptPayload } from '../game/events';
import type { Interactable } from '../systems/InteractionSystem';
import { audio } from '../audio/AudioSystem';
import { money, type MachineDeps } from './Machines';

/** Sólidos que podem ser retirados (a Mystery Box muda de lugar). */
export interface MovableSolids<H> {
  addSolid(cx: number, cy: number, w: number, h: number): H;
  removeSolid(handle: H): void;
  isFree(cx: number, cy: number, w: number, h: number): boolean;
}

/** Onde a Mystery Box pode aparecer. */
export interface BoxSpots<H> {
  spots: ReadonlyArray<{ x: number; y: number; area: string }>;
  solids: MovableSolids<H>;
  /** A área já foi aberta (o aviso diz quando a caixa foi para uma área fechada). */
  isAreaOpen(area: string): boolean;
  areaName(area: string): string;
  /** Mapa atual (armas-maravilha só saem no mapa delas). */
  mapId: MapId;
}

export const RARITY_COLORS: Record<Rarity, string> = {
  common: '#d6d6d0',
  uncommon: '#7bd67b',
  rare: '#5aa9ff',
  epic: '#b98cff',
  legendary: '#ffb347',
};

const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
/** Cor da silhueta brilhante da arma sobre a caixa. */
const ICON_GLOW = 0xfff0c8;

/** Sorteio da Mystery Box: primeiro a raridade (pelos pesos), depois uma arma dela. */
export function rollMysteryWeapon(map: MapId, random: () => number = Math.random): WeaponConfig {
  const weights = mysteryBoxConfig.rarityWeights;
  const total = RARITY_ORDER.reduce((sum, r) => sum + weights[r], 0);
  let pick = random() * total;
  let rarity: Rarity = 'common';
  for (const r of RARITY_ORDER) {
    pick -= weights[r];
    if (pick < 0) {
      rarity = r;
      break;
    }
  }
  // Se a raridade não tiver armas, desce até achar uma que tenha.
  for (let i = RARITY_ORDER.indexOf(rarity); i >= 0; i--) {
    const pool = Object.values(weapons).filter((w) => w.rarity === RARITY_ORDER[i] && (!w.maps || w.maps.includes(map)));
    if (pool.length > 0) return pool[Math.floor(random() * pool.length)];
  }
  return weapons.m1911;
}

const floatingLabel = (scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Text =>
  scene.add
    .text(x, y, '', {
      fontFamily: 'Impact, "Arial Black", sans-serif',
      fontSize: '13px',
      color: '#f2d27a',
      stroke: '#000',
      strokeThickness: 3,
      resolution: 3,
    })
    .setOrigin(0.5)
    .setDepth(DEPTH.muzzle + 1);

type BoxState = 'idle' | 'rolling' | 'ready' | 'moving';
type Light = { x: number; y: number; radius: number; intensity: number; color?: number };

/** Corpo sólido da caixa (px do mundo), relativo ao centro. */
const BOX_BODY = { w: 64, h: 36, ox: -2, oy: -2 };
const BOX_LIGHT = { radius: 95, intensity: 0.6, color: 0xffd27a };
/** Distância mínima do jogador para a caixa reaparecer (não prende ninguém). */
const MIN_RESPAWN_DISTANCE = 160;

/**
 * Mystery Box (GDD §37): paga, a roleta gira e a arma sorteada fica disponível por
 * alguns segundos. Depois de alguns usos no mesmo lugar, some e reaparece em outra
 * área aberta (marcada por uma coluna de luz).
 */
export class MysteryBox<H = unknown> implements Interactable {
  readonly radius = 60;
  x: number;
  y: number;
  private state: BoxState = 'idle';
  private result: WeaponConfig | null = null;
  private uses = 0;
  private readonly image: Phaser.GameObjects.Image;
  private readonly icon: Phaser.GameObjects.Image;
  private readonly glow: Phaser.GameObjects.Image;
  private readonly label: Phaser.GameObjects.Text;
  private readonly light: Light;
  private solid: H;
  private cycleTimer: Phaser.Time.TimerEvent | null = null;
  private expireTimer: Phaser.Time.TimerEvent | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly deps: MachineDeps,
    private readonly places: BoxSpots<H>,
  ) {
    this.x = x;
    this.y = y;
    this.image = scene.add.image(x, y, machineKeys.mysteryBox).setScale(ART_SCALE).setDepth(y + 18);
    this.solid = places.solids.addSolid(x + BOX_BODY.ox, y + BOX_BODY.oy, BOX_BODY.w, BOX_BODY.h);
    this.light = deps.lighting.addDynamicLight({ x, y, ...BOX_LIGHT });
    this.glow = scene.add
      .image(x, y - 26, FX_KEYS.lightRadial)
      .setTint(0xffd27a)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0.5)
      .setAlpha(0)
      .setDepth(DEPTH.glow);
    this.icon = scene.add
      .image(x, y - 30, gunIconKey('pistol'))
      .setScale(ART_SCALE)
      .setTintFill(ICON_GLOW)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.muzzle)
      .setVisible(false);
    this.label = floatingLabel(scene, x, y - 48);
  }

  getPrompt(): InteractionPromptPayload | null {
    const price = mysteryBoxConfig.price;
    if (this.state === 'idle') return { text: `[E] MYSTERY BOX — ${money(price)}`, affordable: this.deps.economy.canAfford(price) };
    if (this.state === 'ready' && this.result) {
      const owned = this.deps.weapons.owns(this.result.id);
      return { text: `[E] PEGAR ${this.result.name.toUpperCase()}${owned ? ' (MUNIÇÃO)' : ''}`, affordable: true };
    }
    return null;
  }

  /** Usos restantes antes de a caixa mudar de lugar (para testes/HUD). */
  get usesLeft(): number {
    return mysteryBoxConfig.usesBeforeMove - this.uses;
  }

  interact(): void {
    if (this.state === 'idle') {
      if (this.deps.economy.spend(mysteryBoxConfig.price)) this.roll();
    } else if (this.state === 'ready' && this.result) {
      const { weapons } = this.deps;
      if (weapons.owns(this.result.id)) weapons.refillAmmo(this.result.id);
      else weapons.give(this.result.id);
      this.reset();
    }
  }

  private roll(): void {
    this.state = 'rolling';
    this.uses++;
    this.result = rollMysteryWeapon(this.places.mapId);
    audio.playAt('box_music', this.x, this.y, { category: 'ui', volume: 0.9, pitchJitter: 0 });
    this.icon.setVisible(true).setAlpha(1).setY(this.y - 30);
    this.label.setText('').setAlpha(1);
    this.scene.tweens.add({ targets: this.glow, alpha: 0.45, duration: 250 });
    this.scene.tweens.add({ targets: this.icon, y: this.y - 44, duration: mysteryBoxConfig.rollMs, ease: 'Sine.easeOut' });
    this.deps.lighting.addFlash(this.x, this.y - 20, 150, 0.85, mysteryBoxConfig.rollMs + 400);

    // Roleta: troca o ícone cada vez mais devagar
    let delay = 60;
    const cycle = () => {
      this.icon.setTexture(gunIconKey(Phaser.Utils.Array.GetRandom(WEAPON_KINDS)));
      delay *= 1.12;
      this.cycleTimer = this.scene.time.delayedCall(delay, cycle);
    };
    cycle();
    this.scene.time.delayedCall(mysteryBoxConfig.rollMs, () => this.reveal());
  }

  private reveal(): void {
    this.cycleTimer?.remove();
    const result = this.result;
    if (!result) return;
    this.state = 'ready';
    audio.playAt('box_reveal', this.x, this.y, { category: 'ui', volume: 0.9, pitchJitter: 0 });
    this.icon.setTexture(gunIconKey(result.kind)).setTintFill(result.tracerTint ?? ICON_GLOW);
    this.label.setText(result.name.toUpperCase()).setColor(RARITY_COLORS[result.rarity]);
    this.deps.effects.floatingText(this.x, this.y - 60, result.rarity.toUpperCase(), RARITY_COLORS[result.rarity], true);
    this.scene.tweens.add({ targets: this.icon, scale: { from: ART_SCALE * 1.3, to: ART_SCALE }, duration: 300, ease: 'Back.easeOut' });
    // Se ninguém pegar, a arma afunda de volta na caixa.
    this.expireTimer = this.scene.time.delayedCall(mysteryBoxConfig.takeMs, () => {
      this.scene.tweens.add({ targets: [this.icon, this.label], alpha: 0, y: '+=14', duration: 500, onComplete: () => this.reset() });
    });
  }

  private reset(): void {
    this.expireTimer?.remove();
    this.cycleTimer?.remove();
    this.state = 'idle';
    this.result = null;
    this.scene.tweens.killTweensOf([this.icon, this.label]);
    this.icon.setVisible(false).setTintFill(ICON_GLOW).setAlpha(1).setScale(ART_SCALE).setY(this.y - 30);
    this.label.setText('').setAlpha(1).setY(this.y - 48);
    this.scene.tweens.add({ targets: this.glow, alpha: 0, duration: 400 });
    if (this.uses >= mysteryBoxConfig.usesBeforeMove) this.moveAway();
  }

  // ───────────── Troca de lugar ─────────────

  /**
   * Próximo local: qualquer outro ponto do mapa (inclusive em áreas ainda fechadas — aí é
   * preciso abrir a porta para alcançá-la), livre e longe do jogador.
   */
  private pickSpot(): { x: number; y: number; area: string } | null {
    const { spots, solids } = this.places;
    const player = this.deps.player;
    const options = spots.filter(
      (s) =>
        (s.x !== this.x || s.y !== this.y) &&
        Phaser.Math.Distance.Between(s.x, s.y, player.x, player.y) >= MIN_RESPAWN_DISTANCE &&
        solids.isFree(s.x + BOX_BODY.ox, s.y + BOX_BODY.oy, BOX_BODY.w, BOX_BODY.h),
    );
    return options.length > 0 ? Phaser.Utils.Array.GetRandom(options) : null;
  }

  /** A caixa treme, sobe e some; depois reaparece em outro local. */
  private moveAway(): void {
    const spot = this.pickSpot();
    this.uses = 0;
    if (!spot) return; // Nenhuma outra área aberta: continua onde está.
    const { scene } = this;
    this.state = 'moving';
    audio.playAt('box_move', this.x, this.y, { category: 'ui', volume: 1, pitchJitter: 0 });
    const out = mysteryBoxConfig.moveOutMs;
    scene.tweens.add({ targets: this.image, x: this.x + 3, duration: 60, yoyo: true, repeat: Math.floor(out / 240) });
    scene.tweens.add({ targets: this.glow, alpha: 0.6, duration: out / 2, yoyo: true });
    scene.tweens.add({
      targets: this.image,
      y: this.y - 40,
      alpha: 0,
      delay: out / 2,
      duration: out / 2,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.deps.lighting.addFlash(this.x, this.y - 20, 180, 1, 400);
        this.deps.effects.dustBurst(this.x, this.y, 14);
        this.places.solids.removeSolid(this.solid);
        this.light.intensity = 0;
        scene.time.delayedCall(mysteryBoxConfig.moveGapMs, () => this.appearAt(spot));
      },
    });
    const closed = this.places.isAreaOpen(spot.area) ? '' : ' (ÁREA FECHADA)';
    emitGameEvent(scene.game.events, GameEvents.Toast, { text: `A MYSTERY BOX MUDOU DE LUGAR — ${this.places.areaName(spot.area).toUpperCase()}${closed}` });
  }

  private appearAt(spot: { x: number; y: number; area: string }): void {
    const { scene } = this;
    this.x = spot.x;
    this.y = spot.y;
    this.solid = this.places.solids.addSolid(spot.x + BOX_BODY.ox, spot.y + BOX_BODY.oy, BOX_BODY.w, BOX_BODY.h);
    this.image.setPosition(spot.x, spot.y - 60).setDepth(spot.y + 18).setAlpha(0);
    this.glow.setPosition(spot.x, spot.y - 26);
    this.icon.setPosition(spot.x, spot.y - 30);
    this.label.setPosition(spot.x, spot.y - 48);
    this.light.x = spot.x;
    this.light.y = spot.y;
    scene.tweens.add({ targets: this.image, y: spot.y, alpha: 1, duration: 500, ease: 'Bounce.easeOut' });
    audio.playAt('box_reveal', spot.x, spot.y, { category: 'ui', volume: 1, pitchJitter: 0 });
    this.deps.effects.dustBurst(spot.x, spot.y, 18);
    // Coluna de luz dourada marcando o novo local por alguns segundos.
    const beacon = { v: 1 };
    scene.tweens.add({
      targets: beacon,
      v: 0,
      duration: mysteryBoxConfig.beaconMs,
      onUpdate: () => {
        this.light.radius = BOX_LIGHT.radius + 160 * beacon.v;
        this.light.intensity = BOX_LIGHT.intensity + 0.4 * beacon.v * (0.7 + 0.3 * Math.sin(scene.time.now / 120));
      },
      onComplete: () => {
        this.light.radius = BOX_LIGHT.radius;
        this.light.intensity = BOX_LIGHT.intensity;
      },
    });
    this.state = 'idle';
  }
}

