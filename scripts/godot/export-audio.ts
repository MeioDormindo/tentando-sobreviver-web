/**
 * Exporta os sons do jogo web (todos sintetizados em código, src/audio) para o Godot:
 * cada variação vira um WAV 16-bit mono em godot/assets/audio/<som>_<n>.wav, com as mesmas
 * sementes do jogo web (o mesmo som, bit a bit). Junto vai godot/data/configs/audio.json com
 * as variações de cada som e a mixagem (categorias, vozes, distâncias em m, tempos em s),
 * o ambiente por área e a música adaptativa.
 *
 * npm run godot:audio
 */
import { mkdirSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { SOUND_DEFS } from '../../src/audio/SoundBank';
import { rng } from '../../src/audio/dsp';
import { audioConfig, musicConfig, ambientEvents, ambienceAlias, stepAlias } from '../../src/config/audio.config';
import { TEMPLE_SOUNDS, TEMPLE_AMBIENCE_ALIAS, TEMPLE_AMBIENT_EVENTS, TEMPLE_STEP_ALIAS } from './temple-audio';

const OUT = 'godot/assets/audio';
const PX = 32;
const m = (px: number): number => Math.round((px / PX) * 1000) / 1000;
const s = (ms: number): number => Math.round(ms) / 1000;

/** Mesmo hash do SoundBank (semente de cada som). */
const hash = (text: string): number => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
};

function wav(data: Float32Array, sampleRate: number): Buffer {
  const bytes = data.length * 2;
  const out = Buffer.alloc(44 + bytes);
  out.write('RIFF', 0);
  out.writeUInt32LE(36 + bytes, 4);
  out.write('WAVE', 8);
  out.write('fmt ', 12);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20); // PCM
  out.writeUInt16LE(1, 22); // mono
  out.writeUInt32LE(sampleRate, 24);
  out.writeUInt32LE(sampleRate * 2, 28);
  out.writeUInt16LE(2, 32);
  out.writeUInt16LE(16, 34);
  out.write('data', 36);
  out.writeUInt32LE(bytes, 40);
  for (let i = 0; i < data.length; i++) out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, data[i])) * 32767), 44 + i * 2);
  return out;
}

mkdirSync(OUT, { recursive: true });
// Recria só os WAV (os .import do Godot de sons que continuam valem).
for (const file of readdirSync(OUT)) if (file.endsWith('.wav')) rmSync(join(OUT, file));

const sounds: Record<string, number> = {};
let total = 0;
// Os do jogo web e os só do Godot (ambiente do Templo).
for (const def of [...SOUND_DEFS, ...TEMPLE_SOUNDS]) {
  for (let v = 0; v < def.variants; v++) {
    const data = def.make(def.sr, rng(hash(def.key) + v * 7919));
    if (def.gain && def.gain !== 1) for (let i = 0; i < data.length; i++) data[i] = Math.max(-1, Math.min(1, data[i] * def.gain));
    const buffer = wav(data, def.sr);
    writeFileSync(join(OUT, `${def.key}_${v}.wav`), buffer);
    total += buffer.length;
  }
  sounds[def.key] = def.variants;
}

const config = {
  sounds,
  master: audioConfig.master,
  categories: audioConfig.categories,
  max_voices: audioConfig.maxVoices,
  hearing_distance: m(audioConfig.hearingDistance),
  step_distance: m(audioConfig.stepDistance),
  ambient_event_time: audioConfig.ambientEventMs.map(s),
  ambience_crossfade: s(audioConfig.ambienceCrossfadeMs),
  heartbeat_below: audioConfig.heartbeatBelow,
  ambient_events: { ...ambientEvents, ...TEMPLE_AMBIENT_EVENTS },
  ambience_alias: { ...ambienceAlias, ...TEMPLE_AMBIENCE_ALIAS },
  step_alias: { ...stepAlias, ...TEMPLE_STEP_ALIAS },
  music: {
    fade_per_second: musicConfig.fadePerSecond,
    high_alive: musicConfig.highAlive,
    high_hp: musicConfig.highHp,
    high_events: musicConfig.highEvents,
    mix: musicConfig.mix,
    sting_duck: musicConfig.stingDuck,
    sting_duck_time: s(musicConfig.stingDuckMs),
  },
};
writeFileSync('godot/data/configs/audio.json', JSON.stringify(config, null, 1) + '\n');
console.log(`  ${Object.keys(sounds).length} sons, ${Object.values(sounds).reduce((a, b) => a + b, 0)} arquivos WAV (${(total / 1048576).toFixed(1)} MB) em ${OUT}`);
