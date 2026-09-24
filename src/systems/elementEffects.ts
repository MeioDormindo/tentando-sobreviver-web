import Phaser from 'phaser';
import { elementParams, elements, type ElementId } from '../config/elements.config';
import type { EffectsSystem } from '../effects/EffectsSystem';
import { Boss } from '../entities/Boss';
import type { Player } from '../entities/Player';
import { Zombie } from '../entities/Zombie';
import { audio } from '../audio/AudioSystem';

type Target = Zombie | Boss;

/** O que os elementos usam do combate (o CombatSystem fornece). */
export interface ElementHooks {
  effects: EffectsSystem;
  player: Player;
  targets(): Target[];
  lineOfSight(ax: number, ay: number, bx: number, by: number): boolean;
  /** Dano de arma num alvo (cuida de morte, cadáver e estatísticas). */
  hurt(target: Target, amount: number, angle: number): void;
  ignite(target: Target, dps: number, ms: number): void;
  /** Explosão da arma do jogador (não fere o jogador). */
  blast(x: number, y: number, radius: number, damage: number): void;
}

/**
 * Efeito do elemento da arma quando o tiro acerta. `damage` é o dano do tiro e `chance`
 * a probabilidade deste projétil disparar os efeitos "por disparo" (espingardas dividem).
 */
export function applyElement(h: ElementHooks, id: ElementId, target: Target, damage: number, angle: number, chance: number): void {
  const { effects } = h;
  const color = elements[id].color;
  const { x, y } = target;
  const alive = target.isAlive;
  switch (id) {
    case 'fire': {
      const p = elementParams.fire;
      if (alive) h.ignite(target, p.dps, p.burnMs);
      return;
    }
    case 'ice': {
      const p = elementParams.ice;
      if (!alive || !(target instanceof Zombie)) return;
      target.chill(p.slowMs, p.slowFactor);
      if (Math.random() < p.freezeChance) {
        target.stun(p.freezeMs);
        effects.shockwave(x, y, 26, color, 260);
        audio.playAt('impact_hard', x, y, { category: 'world', volume: 0.5, rate: 1.7 });
      }
      return;
    }
    case 'light': {
      const p = elementParams.light;
      if (target instanceof Boss) {
        if (alive) h.hurt(target, damage * p.bossBonus, angle);
      } else if (alive) {
        target.stun(p.stunMs);
      }
      effects.glow(x, y, 60, 120);
      return;
    }
    case 'shadow': {
      const p = elementParams.shadow;
      h.player.healBy(Math.min(p.maxHealPerHit, damage * p.leech));
      effects.flareSmoke(x, y, color);
      return;
    }
    case 'lightning': {
      const p = elementParams.lightning;
      if (Math.random() >= chance) return;
      const points = [{ x, y }];
      const hit = new Set<Target>([target]);
      let from: { x: number; y: number } = target;
      for (let i = 0; i < p.chains; i++) {
        let next: Target | null = null;
        let best: number = p.range;
        for (const t of h.targets()) {
          if (hit.has(t) || !t.isAlive) continue;
          const d = Phaser.Math.Distance.Between(from.x, from.y, t.x, t.y);
          if (d < best && h.lineOfSight(from.x, from.y, t.x, t.y)) {
            next = t;
            best = d;
          }
        }
        if (!next) break;
        hit.add(next);
        points.push({ x: next.x, y: next.y });
        h.hurt(next, damage * p.damageFactor, Phaser.Math.Angle.Between(from.x, from.y, next.x, next.y));
        from = next;
      }
      if (points.length > 1) effects.lightning(points, color);
      return;
    }
    case 'explosive': {
      const p = elementParams.explosive;
      if (Math.random() >= chance) return;
      h.blast(x, y, p.radius, damage * p.damageFactor);
      return;
    }
  }
}
