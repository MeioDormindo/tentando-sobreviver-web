import Phaser from 'phaser';
import { powerConfig } from '../config/power.config';
import { machineKeys } from '../config/assets.config';
import { perks, weaponLabConfig, type PerkId } from '../config/machines.config';
import { MAX_UPGRADE_LEVEL } from '../config/weapons.config';
import { ART_SCALE } from '../config/visual.config';
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
  addSolid(cx: number, cy: number, w: number, h: number): unknown;
}

export interface MachineDeps {
  player: { readonly x: number; readonly y: number };
  economy: EconomySystem;
  weapons: WeaponSystem;
  perks: PerkSystem;
  effects: EffectsSystem;
  lighting: LightingSystem;
  solids: SolidPlacer;
  /** Energia do mapa (perks e Weapon Lab só funcionam com ela). */
  power: { readonly isOn: boolean };
}

/** Aviso das máquinas sem energia. */
const NO_POWER = 'SEM ENERGIA — ligue o disjuntor';

/** Preço formatado ($1.500). */
export const money = (n: number): string => `$${n.toLocaleString('pt-BR')}`;

// ───────────────────────────── Weapon Lab ─────────────────────────────

/** Weapon Lab (GDD §38): transforma a arma em mãos na versão Mk II. */
export class WeaponLab implements Interactable {
  readonly radius = 62;

  constructor(private readonly scene: Phaser.Scene, readonly x: number, readonly y: number, private readonly deps: MachineDeps) {
    scene.add.image(x, y, machineKeys.weaponLab).setScale(ART_SCALE).setDepth(y + 22);
    deps.solids.addSolid(x - 2, y - 2, 70, 42);
  }

  getPrompt(): InteractionPromptPayload | null {
    if (!this.deps.power.isOn) return { text: `WEAPON LAB — ${NO_POWER}`, affordable: false };
    const current = this.deps.weapons.current;
    const weapon = current.config;
    if (current.level >= MAX_UPGRADE_LEVEL) return { text: `WEAPON LAB — ${weapon.name.toUpperCase()} NO NÍVEL MÁXIMO`, affordable: false };
    const next = current.level === 0 ? 'MK II' : 'MK III (PROJÉTEIS EM DOBRO)';
    const price = this.price();
    return { text: `[E] WEAPON LAB: ${weapon.name.toUpperCase()} → ${next} — ${money(price)}`, affordable: this.deps.economy.canAfford(price) };
  }

  /** Preço do próximo nível da arma em mãos. */
  private price(): number {
    return this.deps.weapons.current.level === 0 ? weaponLabConfig.price : weaponLabConfig.priceMk3;
  }

  interact(): void {
    const { weapons, economy, effects, lighting, power } = this.deps;
    if (!power.isOn || weapons.current.level >= MAX_UPGRADE_LEVEL || !economy.spend(this.price())) return;
    weapons.upgradeCurrent();
    const mk3 = weapons.current.level >= MAX_UPGRADE_LEVEL;
    audio.playAt('lab_upgrade', this.x, this.y, { category: 'ui', volume: 1, pitchJitter: 0, rate: mk3 ? 0.8 : 1 });
    effects.surfaceImpact(this.x, this.y - 10, -Math.PI / 2);
    effects.floatingText(this.x, this.y - 40, weapons.current.config.name.toUpperCase(), mk3 ? '#ffd35a' : '#c38bff', true);
    if (mk3) effects.shockwave(this.x, this.y, 90, 0xffd35a, 600);
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
    if (!this.powered) return { text: `${def.name.toUpperCase()} — ${NO_POWER}`, affordable: false };
    if (perkSystem.isMaxed(this.perkId)) {
      const soldOut = perkSystem.level(this.perkId) === 0;
      return { text: soldOut ? `${def.name.toUpperCase()} — ESGOTADO` : `${def.name.toUpperCase()} ✓  ${def.description}`, affordable: false };
    }
    const price = perkSystem.priceOf(this.perkId);
    return { text: `[E] ${def.name.toUpperCase()} — ${money(price)}  ·  ${def.description}`, affordable: economy.canAfford(price) };
  }

  interact(): void {
    const { perks: perkSystem, economy, effects } = this.deps;
    if (!this.powered || perkSystem.isMaxed(this.perkId) || !economy.spend(perkSystem.priceOf(this.perkId))) return;
    perkSystem.grant(this.perkId);
    audio.playAt('perk', this.x, this.y, { category: 'ui', volume: 1, pitchJitter: 0 });
    const def = perks[this.perkId];
    effects.floatingText(this.x, this.y - 30, def.name.toUpperCase(), `#${def.color.toString(16).padStart(6, '0')}`, true);
  }

  /** Com energia, ou um perk que funciona sem ela (Quick Revive). */
  private get powered(): boolean {
    return this.deps.power.isOn || powerConfig.worksWithoutPower.includes(this.perkId);
  }
}
