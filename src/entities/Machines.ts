import Phaser from 'phaser';
import { FX_KEYS, gunIconKey, machineKeys, WEAPON_KINDS } from '../config/assets.config';
import { mysteryBoxConfig, perks, weaponLabConfig, type PerkId } from '../config/machines.config';
import { ART_SCALE, DEPTH } from '../config/visual.config';
import { weapons, type Rarity, type WeaponConfig } from '../config/weapons.config';
import type { EffectsSystem } from '../effects/EffectsSystem';
import type { LightingSystem } from '../effects/LightingSystem';
import type { InteractionPromptPayload } from '../game/events';
import type { EconomySystem } from '../systems/EconomySystem';
import type { Interactable } from '../systems/InteractionSystem';
import type { PerkSystem } from '../systems/PerkSystem';
import type { WeaponSystem } from '../weapons/WeaponSystem';
import { audio } from '../audio/AudioSystem';

/** Coloca um corpo sólido (colisão + bloqueio de navegação). */
export interface SolidPlacer {
  addSolid(cx: number, cy: number, w: number, h: number): void;
}

export interface MachineDeps {
  economy: EconomySystem;
  weapons: WeaponSystem;
  perks: PerkSystem;
  effects: EffectsSystem;
  lighting: LightingSystem;
  solids: SolidPlacer;
}

const money = (n: number): string => `$${n.toLocaleString('pt-BR')}`;

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
export function rollMysteryWeapon(random: () => number = Math.random): WeaponConfig {
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
    const pool = Object.values(weapons).filter((w) => w.rarity === RARITY_ORDER[i]);
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

// ───────────────────────────── Mystery Box ─────────────────────────────

type BoxState = 'idle' | 'rolling' | 'ready';

/** Mystery Box (GDD §37): paga, a roleta gira e a arma sorteada fica disponível por alguns segundos. */
export class MysteryBox implements Interactable {
  readonly radius = 60;
  private state: BoxState = 'idle';
  private result: WeaponConfig | null = null;
  private readonly icon: Phaser.GameObjects.Image;
  private readonly glow: Phaser.GameObjects.Image;
  private readonly label: Phaser.GameObjects.Text;
  private cycleTimer: Phaser.Time.TimerEvent | null = null;
  private expireTimer: Phaser.Time.TimerEvent | null = null;

  constructor(private readonly scene: Phaser.Scene, readonly x: number, readonly y: number, private readonly deps: MachineDeps) {
    scene.add.image(x, y, machineKeys.mysteryBox).setScale(ART_SCALE).setDepth(y + 18);
    deps.solids.addSolid(x - 2, y - 2, 64, 36);
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
    this.result = rollMysteryWeapon();
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
  }
}

// ───────────────────────────── Weapon Lab ─────────────────────────────

/** Weapon Lab (GDD §38): transforma a arma em mãos na versão Mk II. */
export class WeaponLab implements Interactable {
  readonly radius = 62;

  constructor(private readonly scene: Phaser.Scene, readonly x: number, readonly y: number, private readonly deps: MachineDeps) {
    scene.add.image(x, y, machineKeys.weaponLab).setScale(ART_SCALE).setDepth(y + 22);
    deps.solids.addSolid(x - 2, y - 2, 70, 42);
  }

  getPrompt(): InteractionPromptPayload | null {
    const weapon = this.deps.weapons.current.config;
    if (weapon.upgraded) return { text: `WEAPON LAB — ${weapon.name.toUpperCase()} JÁ MELHORADA`, affordable: false };
    const price = weaponLabConfig.price;
    return { text: `[E] WEAPON LAB: ${weapon.name.toUpperCase()} → MK II — ${money(price)}`, affordable: this.deps.economy.canAfford(price) };
  }

  interact(): void {
    const { weapons, economy, effects, lighting } = this.deps;
    if (weapons.current.config.upgraded || !economy.spend(weaponLabConfig.price)) return;
    weapons.upgradeCurrent();
    audio.playAt('lab_upgrade', this.x, this.y, { category: 'ui', volume: 1, pitchJitter: 0 });
    effects.surfaceImpact(this.x, this.y - 10, -Math.PI / 2);
    effects.floatingText(this.x, this.y - 40, weapons.current.config.name.toUpperCase(), '#c38bff', true);
    lighting.addFlash(this.x, this.y, 220, 1, 700);
    this.scene.cameras.main.shake(180, 0.003);
  }
}

// ───────────────────────────── Perks ─────────────────────────────

/** Máquina de perk (GDD §39–40). */
export class PerkMachine implements Interactable {
  readonly radius = 50;

  constructor(scene: Phaser.Scene, readonly x: number, readonly y: number, private readonly perkId: PerkId, private readonly deps: MachineDeps) {
    scene.add.image(x, y, machineKeys.perk(perkId)).setScale(ART_SCALE).setDepth(y + 18);
    deps.solids.addSolid(x - 2, y - 2, 38, 30);
  }

  getPrompt(): InteractionPromptPayload | null {
    const def = perks[this.perkId];
    const { perks: perkSystem, economy } = this.deps;
    if (perkSystem.isMaxed(this.perkId)) return { text: `${def.name.toUpperCase()} ✓  ${def.description}`, affordable: false };
    const price = perkSystem.priceOf(this.perkId);
    return { text: `[E] ${def.name.toUpperCase()} — ${money(price)}  ·  ${def.description}`, affordable: economy.canAfford(price) };
  }

  interact(): void {
    const { perks: perkSystem, economy, effects } = this.deps;
    if (perkSystem.isMaxed(this.perkId) || !economy.spend(perkSystem.priceOf(this.perkId))) return;
    perkSystem.grant(this.perkId);
    audio.playAt('perk', this.x, this.y, { category: 'ui', volume: 1, pitchJitter: 0 });
    const def = perks[this.perkId];
    effects.floatingText(this.x, this.y - 30, def.name.toUpperCase(), `#${def.color.toString(16).padStart(6, '0')}`, true);
  }
}
