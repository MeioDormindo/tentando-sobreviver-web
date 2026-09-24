/**
 * Migração das máquinas e da loja: barricadas, Mystery Box, Weapon Lab, perks e energia.
 * Gera .tres em godot/data (chamado por export-data.ts).
 */
import { barricadeConfig } from '../../src/config/economy.config';
import { mysteryBoxConfig, weaponLabConfig, perks, quickReviveConfig } from '../../src/config/machines.config';
import { powerConfig } from '../../src/config/power.config';
import { weaponUpgrade, weaponUpgradeMk3 } from '../../src/config/weapons.config';

type Writer = (path: string, content: string) => void;
type Tres = (scriptClass: string, scriptPath: string, props: Record<string, unknown>) => string;

const s = (ms: number): number => Math.round(ms) / 1000;
const PX = 32;
const m = (px: number): number => Math.round((px / PX) * 1000) / 1000;
const raw = (v: string): { raw: string } => ({ raw: v });
const color = (hex: number): { raw: string } =>
  raw(`Color(${(((hex >> 16) & 255) / 255).toFixed(3)}, ${(((hex >> 8) & 255) / 255).toFixed(3)}, ${((hex & 255) / 255).toFixed(3)}, 1)`);

export function exportMachines(write: Writer, tres: Tres): void {
  write('configs/barricade.tres', tres('BarricadeData', 'res://scripts/interactables/barricade_data.gd', {
    max_planks: barricadeConfig.maxPlanks,
    repair_reward: barricadeConfig.repairReward,
    repair_time: s(barricadeConfig.repairTimeMs),
    repair_interrupt: s(barricadeConfig.repairInterruptMs),
  }));

  const b = mysteryBoxConfig;
  write('configs/mystery_box.tres', tres('MysteryBoxData', 'res://scripts/interactables/mystery_box_data.gd', {
    price: b.price,
    fire_sale_price: b.fireSalePrice,
    roll_time: s(b.rollMs),
    take_time: s(b.takeMs),
    rarity_weights: raw(`{\n${Object.entries(b.rarityWeights).map(([k, v]) => `&"${k}": ${v}`).join(',\n')}\n}`),
    uses_before_move: b.usesBeforeMove,
    move_out_time: s(b.moveOutMs),
    move_gap_time: s(b.moveGapMs),
  }));

  const u = weaponUpgrade;
  const u3 = weaponUpgradeMk3;
  write('configs/weapon_lab.tres', tres('WeaponLabData', 'res://scripts/interactables/weapon_lab_data.gd', {
    price_mk2: weaponLabConfig.price,
    price_mk3: weaponLabConfig.priceMk3,
    damage_multiplier: u.damage,
    magazine_multiplier: u.magazine,
    reserve_multiplier: u.reserve,
    reload_multiplier: u.reload,
    // No jogo web o upgrade multiplica o intervalo entre tiros; aqui guardamos tiros/s.
    fire_rate_multiplier: Math.round((1 / u.fireRate) * 1000) / 1000,
    extra_pierce: 1,
    tracer_mk2: color(u.tracerTint),
    mk3_pellet_multiplier: u3.pelletMultiplier,
    mk3_extra_spread: u3.extraSpread,
    tracer_mk3: color(u3.tracerTint),
  }));

  for (const p of Object.values(perks)) {
    const e = p.effect;
    write(`perks/${p.id}.tres`, tres('PerkData', 'res://scripts/interactables/perk_data.gd', {
      id: raw(`&"${p.id}"`),
      display_name: p.name,
      description: p.description,
      price: p.price,
      color: color(p.color),
      max_purchases: p.maxPurchases ?? 1,
      works_without_power: powerConfig.worksWithoutPower.includes(p.id),
      max_health_bonus: e.maxHpBonus ?? 0,
      speed_multiplier: e.speedMultiplier ?? 1,
      reload_multiplier: e.reloadMultiplier ?? 1,
      headshot_bonus: e.headshotBonus ?? 0,
      regen_multiplier: e.regenMultiplier ?? 1,
      damage_multiplier: e.damageMultiplier ?? 1,
      self_revive: p.id === 'quick_revive',
      down_time: p.id === 'quick_revive' ? s(quickReviveConfig.downMs) : 0,
      revive_push_radius: p.id === 'quick_revive' ? m(quickReviveConfig.pushRadius) : 0,
      revive_push_speed: p.id === 'quick_revive' ? m(quickReviveConfig.pushSpeed) : 0,
    }));
  }

  write('configs/power.tres', tres('PowerData', 'res://scripts/systems/power_data.gd', {
    breaker_hold_time: s(powerConfig.breakerHoldMs),
    lamp_factor_off: powerConfig.lampFactorOff,
    restore_flicker_time: s(powerConfig.restoreFlickerMs),
  }));
}
