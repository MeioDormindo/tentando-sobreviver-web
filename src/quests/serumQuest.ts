import Phaser from 'phaser';
import { ASSET_KEYS } from '../config/assets.config';
import { TILE_SIZE } from '../config/game.config';
import { ART_SCALE } from '../config/visual.config';
import { serumQuestConfig as cfg } from '../config/quests.config';
import { audio } from '../audio/AudioSystem';
import type { EffectsSystem } from '../effects/EffectsSystem';
import type { LightingSystem } from '../effects/LightingSystem';
import type { Projectile } from '../entities/Projectile';
import type { Zombie } from '../entities/Zombie';
import { emitGameEvent, GameEvents, onGameEvent } from '../game/events';
import type { SpawnModifier } from '../systems/WaveSystem';
import type { InteractionSystem } from '../systems/InteractionSystem';
import { QuestSpot } from './questProps';
import { QuestSystem, type QuestStep } from './QuestSystem';

type Point = { x: number; y: number };

export interface SerumQuestDeps {
  interaction: InteractionSystem;
  player: Point;
  power: { readonly isOn: boolean };
  /** Onde fica o disjuntor (etapa 1). */
  breaker: Point | null;
  zombies: Phaser.Physics.Arcade.Group;
  projectiles: Phaser.Physics.Arcade.Group;
  /** Um Blindado com o cartão de acesso (null se não houver onde surgir agora). */
  spawnArmored(): Zombie | null;
  waves: {
    forceBossNextWave(healthMultiplier: number): number;
    setSpawnModifier(id: string, mod: SpawnModifier | null): void;
  };
  effects: EffectsSystem;
  lighting: LightingSystem;
  /** Recompensas do final (todos os perks, Tornado). */
  reward(): void;
}

const at = (p: { tx: number; ty: number }): Point => ({ x: p.tx * TILE_SIZE + TILE_SIZE / 2, y: p.ty * TILE_SIZE + TILE_SIZE / 2 });
const RETRY_MS = 2000;

/**
 * "O Soro do Dr. Almeida" (Hospital): ligar a energia → três componentes (UTI, Farmácia,
 * cartão do Blindado) → defender a centrífuga → Paciente Zero enfurecido → aplicar o soro.
 */
export function createSerumQuest(scene: Phaser.Scene, deps: SerumQuestDeps): QuestSystem {
  const toast = (text: string) => emitGameEvent(scene.game.events, GameEvents.Toast, { text });
  const spots: QuestSpot[] = [];
  const addSpot = (spot: QuestSpot) => {
    spots.push(spot);
    deps.interaction.add(spot);
    return spot;
  };
  const removeSpot = (spot: QuestSpot) => {
    deps.interaction.remove(spot);
    spot.destroy();
    spots.splice(spots.indexOf(spot), 1);
  };

  // ── 1. Energia ──
  const power: QuestStep = {
    objective: () => 'Ligue a energia (disjuntor no Necrotério)',
    target: () => deps.breaker,
    update: () => deps.power.isOn,
  };

  // ── 2. Componentes ──
  const got = { fridge: false, cabinet: false, drawer: false };
  const count = () => Number(got.fridge) + Number(got.cabinet) + Number(got.drawer);
  const collected = (what: string) => {
    audio.play('box_reveal', { category: 'ui', volume: 0.7, pitchJitter: 0 });
    toast(`${what} (${count()}/3)`);
  };
  let lock: Phaser.GameObjects.Image | null = null;
  let armored: Zombie | null = null;
  let armoredLife = 0;
  let armoredLast: Point | null = null;
  let nextArmoredAt = 0;
  let hasCard = false;
  let cardSpot: QuestSpot | null = null;
  const cabinet = at(cfg.cabinet);

  const components: QuestStep = {
    objective: () => `Componentes do soro ${count()}/3 — UTI · Farmácia · cartão do Blindado`,
    target: () => {
      if (!got.fridge) return at(cfg.fridge);
      if (!got.cabinet) return cabinet;
      if (hasCard) return at(cfg.drawer);
      if (cardSpot) return { x: cardSpot.x, y: cardSpot.y };
      if (armored?.isAlive && armored.lifeId === armoredLife) return { x: armored.x, y: armored.y };
      return at(cfg.drawer);
    },
    enter: () => {
      addSpot(new QuestSpot(scene, {
        ...at(cfg.fridge), texture: ASSET_KEYS.sampleFridge, label: 'PEGAR AS AMOSTRAS', holdMs: cfg.fridge.holdMs,
        onDone: () => { got.fridge = true; collected('AMOSTRAS COLETADAS'); },
      }));
      scene.add.image(cabinet.x, cabinet.y, ASSET_KEYS.medCabinet).setScale(ART_SCALE).setDepth(cabinet.y);
      lock = scene.add.image(cabinet.x, cabinet.y + 4, ASSET_KEYS.padlock).setScale(ART_SCALE).setDepth(cabinet.y + 1);
      addSpot(new QuestSpot(scene, {
        ...cabinet, label: 'PEGAR O REAGENTE', lockedLabel: 'ARMÁRIO TRANCADO — ATIRE NO CADEADO',
        enabled: () => lock === null,
        onDone: () => { got.cabinet = true; collected('REAGENTE COLETADO'); },
      }));
      addSpot(new QuestSpot(scene, {
        ...at(cfg.drawer), label: 'ABRIR A GAVETA COM O CARTÃO', lockedLabel: 'GAVETA TRANCADA — PRECISA DO CARTÃO DE ACESSO',
        enabled: () => hasCard,
        onDone: () => { got.drawer = true; collected('CATALISADOR COLETADO'); },
      }));
    },
    update: (time) => {
      for (const s of spots) s.update();
      // Cadeado: um tiro perto dele abre o armário.
      if (lock) {
        for (const child of deps.projectiles.getChildren()) {
          const pr = child as Projectile;
          if (!pr.active || Phaser.Math.Distance.Between(pr.x, pr.y, lock.x, lock.y) > cfg.cabinet.lockRadius) continue;
          pr.kill();
          deps.effects.dustBurst(lock.x, lock.y, 8);
          audio.playAt('armor_hit', lock.x, lock.y, { category: 'world', volume: 1 });
          lock.destroy();
          lock = null;
          toast('CADEADO ABERTO');
          break;
        }
      }
      // Blindado com o cartão: surge quando dá, e deixa o cartão onde morrer.
      if (!hasCard && !cardSpot) {
        if (armored && armored.lifeId === armoredLife && armored.isAlive) {
          armoredLast = { x: armored.x, y: armored.y };
        } else if (armored && armoredLast) {
          const drop = armoredLast;
          armored = null;
          cardSpot = addSpot(new QuestSpot(scene, {
            ...drop, texture: ASSET_KEYS.keycard, label: 'PEGAR O CARTÃO DE ACESSO',
            onDone: () => { hasCard = true; toast('CARTÃO DE ACESSO — abra a gaveta do Necrotério'); },
          }));
        } else if (!armored && time >= nextArmoredAt) {
          nextArmoredAt = time + RETRY_MS;
          armored = deps.spawnArmored();
          if (armored) {
            armoredLife = armored.lifeId;
            armoredLast = { x: armored.x, y: armored.y };
            toast('UM SEGURANÇA BLINDADO ESTÁ COM O CARTÃO DE ACESSO');
          }
        }
      }
      return count() === 3;
    },
    exit: () => [...spots].forEach(removeSpot),
  };

  // ── 3. Centrífuga ──
  const centrifugePos = at(cfg.centrifuge);
  let centrifuge: Phaser.GameObjects.Image | null = null;
  let running = false;
  let progress = 0;
  let underAttack = false;
  let glow: { x: number; y: number; radius: number; intensity: number; color?: number } | null = null;
  const defense: QuestStep = {
    objective: () => {
      if (!running) return 'Leve os componentes à centrífuga do Laboratório';
      const left = Math.ceil((cfg.centrifuge.defendMs - progress) / 1000);
      return underAttack ? `CENTRÍFUGA SOB ATAQUE! Afaste os zumbis (${left}s)` : `Defenda a centrífuga: ${left}s`;
    },
    target: () => centrifugePos,
    enter: () => {
      centrifuge = scene.add.image(centrifugePos.x, centrifugePos.y, ASSET_KEYS.centrifuge).setScale(ART_SCALE).setDepth(centrifugePos.y + 12);
      addSpot(new QuestSpot(scene, {
        ...centrifugePos, radius: 60, label: 'COLOCAR OS COMPONENTES NA CENTRÍFUGA',
        onDone: () => {
          running = true;
          deps.waves.setSpawnModifier('serum', cfg.centrifuge.spawn);
          glow = deps.lighting.addDynamicLight({ ...centrifugePos, radius: 140, intensity: 0.6, color: 0x9ccf2a });
          audio.playAt('minigun_spin', centrifugePos.x, centrifugePos.y, { category: 'world', volume: 1, rate: 0.5, pitchJitter: 0 });
          toast('A CENTRÍFUGA ESTÁ GIRANDO — DEFENDA!');
        },
      }));
    },
    update: (_time, delta) => {
      if (!running) return false;
      underAttack = deps.zombies.getChildren().some((c) => {
        const z = c as Zombie;
        return z.active && z.isAlive && Phaser.Math.Distance.Between(z.x, z.y, centrifugePos.x, centrifugePos.y) <= cfg.centrifuge.threatRadius;
      });
      if (!underAttack) progress += delta;
      if (centrifuge) centrifuge.rotation += (underAttack ? 0.01 : 0.12) * (delta / 16);
      if (glow) glow.intensity = underAttack ? 0.2 + 0.4 * Math.abs(Math.sin(scene.time.now / 90)) : 0.6;
      return progress >= cfg.centrifuge.defendMs;
    },
    exit: () => {
      deps.waves.setSpawnModifier('serum', null);
      if (glow) deps.lighting.removeDynamicLight(glow);
      [...spots].forEach(removeSpot);
      audio.play('secret_song', { category: 'ui', volume: 0.6, rate: 1.2, pitchJitter: 0 });
      toast('SORO PRONTO! O Paciente Zero sentiu o cheiro...');
    },
  };

  // ── 4. Paciente Zero enfurecido ──
  let bossWave = 0;
  let bossDown: Point | null = null;
  const boss: QuestStep = {
    objective: () => `Derrote o Paciente Zero enfurecido (wave ${bossWave})`,
    target: () => null,
    enter: () => {
      bossWave = deps.waves.forceBossNextWave(cfg.bossHealthMultiplier);
      const off = onGameEvent(scene.game.events, GameEvents.BossDefeated, (b) => {
        if (b.id !== 'patient_zero') return;
        bossDown = { x: b.x, y: b.y };
        off();
      });
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
    },
    update: () => bossDown !== null,
  };

  // ── 5. Aplicar o soro ──
  let applied = false;
  const apply: QuestStep = {
    objective: () => 'Aplique o soro no Paciente Zero',
    target: () => bossDown,
    enter: () => {
      const p = bossDown ?? deps.player;
      addSpot(new QuestSpot(scene, {
        x: p.x, y: p.y, radius: 70, texture: ASSET_KEYS.serumVial, label: 'APLICAR O SORO', holdMs: cfg.applyHoldMs,
        onDone: () => { applied = true; },
      }));
    },
    update: () => applied,
    exit: () => [...spots].forEach(removeSpot),
  };

  return new QuestSystem(scene, cfg.title, [power, components, defense, boss, apply], () => {
    deps.reward();
    deps.effects.shockwave(deps.player.x, deps.player.y, 260, 0x9ccf2a, 900);
    deps.lighting.addFlash(deps.player.x, deps.player.y, 400, 1, 1200);
    audio.play('secret_song', { category: 'ui', volume: 1, pitchJitter: 0 });
    emitGameEvent(scene.game.events, GameEvents.QuestComplete, {
      id: 'serum',
      title: 'VOCÊ CUROU O PACIENTE ZERO',
      subtitle: 'Todos os perks + Tornado. A luta continua...',
    });
  });
}
