import Phaser from 'phaser';
import { rng, type Rng } from './dsp';
import { ambience } from './recipes/ambience';
import { bossSounds, exploderFuse, playerSounds, zombieSounds } from './recipes/creatures';
import * as ev from './recipes/events';
import * as ui from './recipes/ui';
import { dryFire, mk2Layer, plasmaBurst, reload, shellCasing, shot, weaponSwitch } from './recipes/weapons';
import * as world from './recipes/world';

type Recipe = (sr: number, r: Rng) => Float32Array;

interface SoundDef {
  key: string;
  /** Quantas versões diferentes gerar (evita repetição). */
  variants: number;
  sr: number;
  make: Recipe;
  /** Ganho final (acerta o volume percebido entre sons de energias diferentes). */
  gain?: number;
}

const HI = 44100;
const MID = 32000;
const LO = 22050;

const WEAPON_IDS = ['m1911', 'glock', 'mp5', 'vector', 'm4', 'ak', 'pump', 'combat_shotgun', 'rpk', 'rail',
  'grenade_launcher', 'flamethrower', 'arc_gun', 'energy_cannon'];
const WEAPON_KINDS = ['pistol', 'smg', 'rifle', 'ak', 'shotgun', 'launcher', 'flamer', 'arc', 'energy'];
const ZOMBIE_TYPES = ['walker', 'runner', 'tank', 'exploder'] as const;
const SURFACES: world.Surface[] = ['terminal', 'concrete', 'metal', 'tracks', 'tunnel', 'wagon'];
export const AMBIENCE_AREAS = Object.keys(ambience);

/** Catálogo de todos os sons do jogo (todos sintetizados em código). */
export const SOUND_DEFS: SoundDef[] = [
  ...WEAPON_IDS.map((id) => ({ key: `shot_${id}`, variants: 3, sr: HI, make: shot(id) })),
  { key: 'mk2_layer', variants: 2, sr: HI, make: mk2Layer },
  ...WEAPON_KINDS.map((kind) => ({ key: `reload_${kind}`, variants: 1, sr: MID, make: reload(kind) })),
  { key: 'dry_fire', variants: 1, sr: MID, make: dryFire },
  { key: 'weapon_switch', variants: 1, sr: MID, make: weaponSwitch },
  { key: 'shell', variants: 4, sr: MID, make: shellCasing },
  ...SURFACES.map((s) => ({ key: `step_${s}`, variants: 5, sr: MID, make: world.footstep[s], gain: s === 'metal' ? 1.5 : 1 })),
  ...ZOMBIE_TYPES.flatMap((type) => [
    { key: `zombie_${type}_groan`, variants: 5, sr: LO, make: zombieSounds[type].groan, gain: type === 'runner' ? 0.55 : 1 },
    { key: `zombie_${type}_attack`, variants: 3, sr: LO, make: zombieSounds[type].attack, gain: type === 'runner' ? 0.5 : 1 },
    { key: `zombie_${type}_death`, variants: 3, sr: LO, make: zombieSounds[type].death, gain: type === 'runner' ? 0.65 : 1 },
  ]),
  { key: 'exploder_fuse', variants: 1, sr: LO, make: exploderFuse },
  { key: 'boss_roar', variants: 2, sr: LO, make: bossSounds.roar },
  { key: 'boss_charge', variants: 1, sr: LO, make: bossSounds.charge },
  { key: 'boss_step', variants: 3, sr: LO, make: bossSounds.step },
  { key: 'boss_slam', variants: 1, sr: LO, make: bossSounds.slam },
  { key: 'boss_stun', variants: 1, sr: LO, make: bossSounds.stun },
  { key: 'boss_summon', variants: 1, sr: LO, make: bossSounds.summon },
  { key: 'boss_area', variants: 1, sr: LO, make: bossSounds.areaWarn },
  { key: 'boss_death', variants: 1, sr: LO, make: bossSounds.death },
  { key: 'player_hurt', variants: 3, sr: LO, make: playerSounds.hurt },
  { key: 'player_death', variants: 1, sr: LO, make: playerSounds.death },
  { key: 'heartbeat', variants: 1, sr: LO, make: playerSounds.heartbeat },
  { key: 'impact_hard', variants: 4, sr: MID, make: world.impactHard, gain: 1.9 },
  { key: 'impact_flesh', variants: 4, sr: MID, make: world.impactFlesh },
  { key: 'explosion', variants: 2, sr: MID, make: world.explosion },
  { key: 'plasma_burst', variants: 1, sr: MID, make: plasmaBurst },
  { key: 'wood_break', variants: 3, sr: MID, make: world.woodBreak },
  { key: 'hammer', variants: 3, sr: MID, make: world.hammer },
  { key: 'door_open', variants: 1, sr: MID, make: world.doorOpen },
  { key: 'purchase', variants: 1, sr: MID, make: ui.purchase },
  { key: 'denied', variants: 1, sr: MID, make: ui.denied },
  { key: 'box_music', variants: 1, sr: MID, make: ui.boxMusic },
  { key: 'box_reveal', variants: 1, sr: MID, make: ui.boxReveal },
  { key: 'lab_upgrade', variants: 1, sr: MID, make: ui.labUpgrade },
  { key: 'perk', variants: 1, sr: MID, make: ui.perkJingle },
  { key: 'powerup', variants: 1, sr: MID, make: ui.powerUp },
  { key: 'wave_start', variants: 1, sr: LO, make: ui.waveStart },
  { key: 'wave_end', variants: 1, sr: MID, make: ui.waveEnd },
  { key: 'boss_warning', variants: 1, sr: LO, make: ui.bossWarning },
  { key: 'ui_beep', variants: 1, sr: MID, make: ui.uiBeep },
  ...AMBIENCE_AREAS.map((area) => ({ key: `amb_${area}`, variants: 1, sr: LO, make: ambience[area] })),
  { key: 'amb_bang', variants: 3, sr: LO, make: world.distantBang },
  { key: 'amb_drip', variants: 3, sr: LO, make: world.drip },
  { key: 'amb_horn', variants: 1, sr: LO, make: world.trainHorn },
  { key: 'amb_creak', variants: 3, sr: LO, make: world.creak },
  { key: 'amb_moan', variants: 3, sr: LO, make: world.distantMoan },
  { key: 'amb_steam', variants: 2, sr: LO, make: world.steamHiss },
  // Eventos
  { key: 'evt_siren', variants: 1, sr: LO, make: ev.siren },
  { key: 'evt_power_down', variants: 1, sr: LO, make: ev.powerDown },
  { key: 'evt_power_up', variants: 1, sr: LO, make: ev.powerUpSurge },
  { key: 'evt_train_pass', variants: 1, sr: LO, make: ev.trainPass },
  { key: 'evt_train_warning', variants: 1, sr: LO, make: ev.trainWarning },
  { key: 'evt_plane', variants: 1, sr: LO, make: ev.supplyPlane },
  { key: 'evt_crate_land', variants: 1, sr: MID, make: ev.crateLand },
  { key: 'evt_gas', variants: 1, sr: MID, make: ev.gasHiss },
  { key: 'evt_horde', variants: 1, sr: LO, make: ev.hordeRoar },
];

/** Quantas variações existem de cada som (preenchido na geração). */
export const soundVariants = new Map<string, number>();

const hash = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

/**
 * Gera todos os sons como AudioBuffers e os registra no cache de áudio do Phaser
 * (em lotes, cedendo o controle entre eles para a tela de carregamento continuar viva).
 */
export async function generateSounds(scene: Phaser.Scene, onProgress: (p: number) => void): Promise<void> {
  const manager = scene.sound;
  if (!(manager instanceof Phaser.Sound.WebAudioSoundManager)) return;
  const ctx = manager.context;
  const jobs = SOUND_DEFS.flatMap((def) => Array.from({ length: def.variants }, (_, v) => ({ def, v })));
  let done = 0;
  for (const { def, v } of jobs) {
    const key = `${def.key}#${v}`;
    if (!scene.cache.audio.exists(key)) {
      const data = def.make(def.sr, rng(hash(def.key) + v * 7919));
      if (def.gain && def.gain !== 1) for (let i = 0; i < data.length; i++) data[i] = Math.max(-1, Math.min(1, data[i] * def.gain));
      const buf = ctx.createBuffer(1, data.length, def.sr);
      buf.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
      scene.cache.audio.add(key, buf);
    }
    soundVariants.set(def.key, def.variants);
    done++;
    if (done % 6 === 0) {
      onProgress(done / jobs.length);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  onProgress(1);
}
