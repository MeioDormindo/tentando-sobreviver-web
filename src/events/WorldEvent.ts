import Phaser from 'phaser';
import type { WorldEventId } from '../config/events.config';
import type { EffectsSystem } from '../effects/EffectsSystem';
import type { LightingSystem } from '../effects/LightingSystem';
import type { Player } from '../entities/Player';
import type { Zombie } from '../entities/Zombie';
import type { ZombieConfig } from '../config/zombies.config';
import type { PowerUpId } from '../config/powerups.config';
import type { TerminalMap } from '../map/TerminalMap';
import type { EconomySystem } from '../systems/EconomySystem';
import type { InteractionSystem } from '../systems/InteractionSystem';
import type { SpawnModifier } from '../systems/WaveSystem';
import type { WeaponSystem } from '../weapons/WeaponSystem';

/** O que os eventos podem controlar nas waves. */
export interface WaveControl {
  readonly currentWave: number;
  setSpawnModifier(id: string, mod: SpawnModifier | null): void;
  addEnemies(count: number): void;
  /** Zumbis criados por eventos entram na conta da wave. */
  addSummoned(count: number): void;
}

/** Acesso dos eventos ao mundo (montado pela GameScene). */
export interface EventContext {
  scene: Phaser.Scene;
  player: Player;
  map: TerminalMap;
  lighting: LightingSystem;
  effects: EffectsSystem;
  waves: WaveControl;
  zombies: Phaser.Physics.Arcade.Group;
  interaction: InteractionSystem;
  weapons: WeaponSystem;
  economy: EconomySystem;
  isAreaOpen(area: string): boolean;
  /** Cria um zumbi (tipo + ajustes) num ponto livre; null se não couber. */
  spawnZombie(type: string, x: number, y: number, overrides?: Partial<ZombieConfig>): Zombie | null;
  spawnPowerUp(id: PowerUpId, x: number, y: number): void;
  setZombieSpeed(multiplier: number): void;
  /** Dinheiro e pontos (1 = normal). */
  setRewardMultiplier(multiplier: number): void;
  /** Mensagem curta na HUD. */
  toast(text: string): void;
}

/**
 * Evento dinâmico (GDD §49): id, duração, cooldown, condições, start/update/end.
 * O EventSystem decide quando começa e chama end() ao fim da duração, quando
 * update() devolve false ou quando a wave acaba (se `endsWithWave`).
 */
export interface WorldEvent {
  readonly id: WorldEventId;
  /** Duração (ms); null = até o fim da wave ou até o próprio evento terminar. */
  readonly durationMs: number | null;
  /** Termina junto com a wave (Horda, Alarme). */
  readonly endsWithWave: boolean;
  /** Começa no início da wave (em vez de após um atraso). */
  readonly atWaveStart: boolean;
  /** Condições extras além de wave mínima e cooldown. */
  canStart(ctx: EventContext): boolean;
  start(ctx: EventContext): void;
  /** Retorna false para encerrar antes do tempo. */
  update(time: number, delta: number): boolean;
  end(): void;
}

/** Zumbis vivos do grupo. */
export function liveZombies(group: Phaser.Physics.Arcade.Group): Zombie[] {
  const list: Zombie[] = [];
  for (const child of group.getChildren()) {
    const z = child as Zombie;
    if (z.active && z.isAlive) list.push(z);
  }
  return list;
}

/**
 * Ponto de chão livre em uma área aberta, a uma distância do jogador dentro do
 * intervalo dado (tenta primeiro a área onde o jogador está).
 */
export function pickFloorPoint(ctx: EventContext, minDist: number, maxDist: number, tries = 80): Phaser.Math.Vector2 | null {
  const { map, player } = ctx;
  const nav = map.nav;
  const open = map.areas.filter((a) => ctx.isAreaOpen(a.id));
  const here = map.areaAt(player.x, player.y);
  for (let i = 0; i < tries; i++) {
    const area = here && i < tries / 2 ? here : Phaser.Utils.Array.GetRandom(open);
    if (!area) return null;
    const rect = Phaser.Utils.Array.GetRandom(area.rects);
    const tx = Phaser.Math.Between(rect.x + 1, rect.x + rect.w - 2);
    const ty = Phaser.Math.Between(rect.y + 1, rect.y + rect.h - 2);
    // Exige folga: o tile e os vizinhos precisam ser chão.
    let clear = true;
    for (let dy = -1; dy <= 1 && clear; dy++) for (let dx = -1; dx <= 1; dx++) if (nav.getCost(tx + dx, ty + dy) !== 1) clear = false;
    if (!clear) continue;
    const x = (tx + 0.5) * nav.tileSize;
    const y = (ty + 0.5) * nav.tileSize;
    const d = Phaser.Math.Distance.Between(player.x, player.y, x, y);
    if (d >= minDist && d <= maxDist) return new Phaser.Math.Vector2(x, y);
  }
  return null;
}
