import Phaser from 'phaser';
import { machineKeys } from '../config/assets.config';
import { perks, weaponLabConfig, type PerkId } from '../config/machines.config';
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
}

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
