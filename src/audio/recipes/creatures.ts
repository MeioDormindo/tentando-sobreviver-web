import {
  adExp, asr, buffer, drive, envelope, fadeEdges, formants, highpass, lowpass, mixInto, normalize, osc, range, reverb,
  white, type Rng,
} from '../dsp';

type Vowel = 'a' | 'o' | 'u' | 'e';
const VOWELS: Record<Vowel, [number, number, number]> = {
  a: [720, 1150, 2500],
  o: [460, 820, 2400],
  u: [340, 720, 2300],
  e: [520, 1750, 2500],
};

interface VoiceSpec {
  dur: number;
  pitch: number;
  pitchEnd: number;
  from: Vowel;
  to: Vowel;
  /** Rouquidão (modulação de amplitude tipo "vocal fry"). */
  fry: number;
  /** Ar/respiração misturados. */
  breath: number;
  drive: number;
  attack: number;
  release: number;
  /** Escala das formantes (<1 = garganta maior). */
  size?: number;
  room?: number;
}

/**
 * Voz sintetizada: fonte dente-de-serra com pitch instável + ruído, filtrada por
 * formantes que migram de uma vogal para outra (gemidos, rugidos, gritos).
 */
function voice(sr: number, r: Rng, v: VoiceSpec): Float32Array {
  const src = buffer(sr, v.dur);
  const wobble = range(r, 4, 7);
  const phase = r() * 10;
  osc(src, sr, 'saw', (t) => {
    const k = t / v.dur;
    const base = v.pitch + (v.pitchEnd - v.pitch) * k;
    return base * (1 + 0.04 * Math.sin(2 * Math.PI * wobble * t + phase) + 0.03 * Math.sin(17 * t + phase));
  });
  white(src, r, v.breath);
  // "Vocal fry": pulsos de amplitude
  const fryRate = range(r, 22, 38);
  envelope(src, sr, (t) => 1 - v.fry * 0.5 * (1 + Math.sin(2 * Math.PI * fryRate * t)));
  const size = v.size ?? 1;
  const [a1, a2, a3] = VOWELS[v.from];
  const [b1, b2, b3] = VOWELS[v.to];
  const lerp = (a: number, b: number) => (t: number) => (a + (b - a) * Math.min(1, t / v.dur)) * size;
  const out = formants(src, sr, [
    { f: lerp(a1, b1), q: 5, gain: 1 },
    { f: lerp(a2, b2), q: 6, gain: 0.6 },
    { f: lerp(a3, b3), q: 8, gain: 0.25 },
  ]);
  envelope(out, sr, asr(v.attack, Math.max(0, v.dur - v.attack - v.release), v.release));
  drive(out, v.drive);
  if (v.room) reverb(out, sr, 0.6, v.room, 0.5);
  return fadeEdges(normalize(out, 0.9), sr);
}

/** Bolhas (gorgolejo): senoides curtas subindo de tom. */
function bubbles(sr: number, r: Rng, dur: number, rate: number): Float32Array {
  const out = buffer(sr, dur);
  const count = Math.floor(dur * rate);
  for (let i = 0; i < count; i++) {
    const b = buffer(sr, 0.05);
    const f0 = range(r, 180, 650);
    osc(b, sr, 'sine', (t) => f0 * (1 + t * 12));
    envelope(b, sr, adExp(0.002, 0.012));
    mixInto(out, b, sr, r() * (dur - 0.05), range(r, 0.3, 0.8));
  }
  return out;
}

const withBubbles = (sr: number, r: Rng, base: Float32Array, rate: number, gain: number) =>
  normalize(mixInto(base, bubbles(sr, r, base.length / sr, rate), sr, 0, gain), 0.9);

// ───────────────────────── Zumbis ─────────────────────────

export const zombieSounds = {
  walker: {
    groan: (sr: number, r: Rng) => voice(sr, r, { dur: range(r, 1.1, 1.8), pitch: range(r, 85, 115), pitchEnd: range(r, 65, 90), from: 'a', to: r() < 0.5 ? 'o' : 'u', fry: 0.6, breath: 0.35, drive: 2.5, attack: 0.25, release: 0.6, room: 0.15 }),
    attack: (sr: number, r: Rng) => voice(sr, r, { dur: 0.45, pitch: range(r, 140, 170), pitchEnd: 110, from: 'a', to: 'a', fry: 0.8, breath: 0.6, drive: 4, attack: 0.03, release: 0.2 }),
    death: (sr: number, r: Rng) => withBubbles(sr, r, voice(sr, r, { dur: 0.9, pitch: range(r, 110, 130), pitchEnd: 50, from: 'a', to: 'u', fry: 0.9, breath: 0.5, drive: 3, attack: 0.02, release: 0.5 }), 12, 0.25),
  },
  runner: {
    groan: (sr: number, r: Rng) => voice(sr, r, { dur: range(r, 0.6, 0.9), pitch: range(r, 220, 260), pitchEnd: range(r, 300, 360), from: 'e', to: 'a', fry: 0.5, breath: 0.9, drive: 4, attack: 0.05, release: 0.35, room: 0.12 }),
    attack: (sr: number, r: Rng) => voice(sr, r, { dur: 0.35, pitch: range(r, 360, 420), pitchEnd: 470, from: 'e', to: 'e', fry: 0.4, breath: 1, drive: 5, attack: 0.02, release: 0.15 }),
    death: (sr: number, r: Rng) => voice(sr, r, { dur: 0.6, pitch: 320, pitchEnd: 120, from: 'e', to: 'u', fry: 0.7, breath: 0.8, drive: 3, attack: 0.01, release: 0.35 }),
  },
  tank: {
    groan: (sr: number, r: Rng) => voice(sr, r, { dur: range(r, 1.6, 2.2), pitch: range(r, 48, 60), pitchEnd: 42, from: 'o', to: 'u', fry: 0.8, breath: 0.3, drive: 5, attack: 0.3, release: 0.8, size: 0.75, room: 0.25 }),
    attack: (sr: number, r: Rng) => voice(sr, r, { dur: 0.7, pitch: 70, pitchEnd: 55, from: 'a', to: 'o', fry: 0.9, breath: 0.5, drive: 6, attack: 0.05, release: 0.3, size: 0.75 }),
    death: (sr: number, r: Rng) => voice(sr, r, { dur: 1.5, pitch: 65, pitchEnd: 32, from: 'a', to: 'u', fry: 1, breath: 0.4, drive: 5, attack: 0.03, release: 0.8, size: 0.75, room: 0.3 }),
  },
  exploder: {
    groan: (sr: number, r: Rng) => withBubbles(sr, r, voice(sr, r, { dur: range(r, 1, 1.4), pitch: range(r, 80, 95), pitchEnd: 70, from: 'u', to: 'o', fry: 0.7, breath: 0.4, drive: 2.5, attack: 0.2, release: 0.5 }), 25, 0.6),
    attack: (sr: number, r: Rng) => withBubbles(sr, r, voice(sr, r, { dur: 0.4, pitch: 120, pitchEnd: 100, from: 'u', to: 'a', fry: 0.6, breath: 0.5, drive: 3, attack: 0.03, release: 0.2 }), 30, 0.5),
    death: (sr: number, r: Rng) => withBubbles(sr, r, voice(sr, r, { dur: 0.5, pitch: 100, pitchEnd: 60, from: 'u', to: 'u', fry: 0.8, breath: 0.4, drive: 2, attack: 0.02, release: 0.3 }), 40, 0.8),
  },
};

/** Exploder armando: chiado crescente e borbulhar acelerado. */
export function exploderFuse(sr: number, r: Rng): Float32Array {
  const dur = 0.7;
  const out = buffer(sr, dur);
  white(out, r, 0.6);
  highpass(out, sr, (t) => 2000 + t * 6000, 1.5);
  envelope(out, sr, (t) => t / dur);
  mixInto(out, bubbles(sr, r, dur, 80), sr, 0, 0.8);
  return fadeEdges(normalize(out, 0.8), sr);
}

// ───────────────────────── Boss ─────────────────────────

export const bossSounds = {
  roar: (sr: number, r: Rng) => {
    const a = voice(sr, r, { dur: 2, pitch: 58, pitchEnd: 46, from: 'a', to: 'o', fry: 0.9, breath: 0.5, drive: 6, attack: 0.15, release: 0.9, size: 0.7 });
    const b = voice(sr, r, { dur: 2, pitch: 116, pitchEnd: 90, from: 'a', to: 'a', fry: 0.6, breath: 0.6, drive: 4, attack: 0.2, release: 0.9, size: 0.8 });
    mixInto(a, b, sr, 0, 0.5);
    reverb(a, sr, 0.9, 0.35, 0.4);
    return fadeEdges(normalize(a, 0.95), sr);
  },
  charge: (sr: number, r: Rng) => voice(sr, r, { dur: 0.9, pitch: 60, pitchEnd: 110, from: 'o', to: 'a', fry: 0.9, breath: 0.6, drive: 6, attack: 0.1, release: 0.3, size: 0.7 }),
  step: (sr: number, r: Rng) => {
    const out = buffer(sr, 0.4);
    osc(out, sr, 'sine', (t) => 45 * (1 + 1.5 * Math.exp(-t / 0.02)));
    envelope(out, sr, adExp(0.002, 0.08));
    const grit = buffer(sr, 0.15);
    white(grit, r, 0.4);
    envelope(grit, sr, adExp(0.001, 0.03));
    lowpass(grit, sr, 900);
    mixInto(out, grit, sr, 0, 1);
    return fadeEdges(normalize(out, 0.9), sr);
  },
  slam: (sr: number, r: Rng) => {
    const out = buffer(sr, 1.6);
    osc(out, sr, 'sine', (t) => 38 * (1 + 2 * Math.exp(-t / 0.04)));
    envelope(out, sr, adExp(0.003, 0.35));
    const debris = buffer(sr, 1.2);
    white(debris, r);
    envelope(debris, sr, adExp(0.002, 0.25));
    lowpass(debris, sr, (t) => 3000 * Math.exp(-t * 3) + 200);
    mixInto(out, debris, sr, 0, 0.8);
    drive(out, 3);
    reverb(out, sr, 0.9, 0.3, 0.3);
    return fadeEdges(normalize(out, 0.95), sr);
  },
  stun: (sr: number, r: Rng) => voice(sr, r, { dur: 1.1, pitch: 70, pitchEnd: 55, from: 'u', to: 'o', fry: 1, breath: 0.4, drive: 4, attack: 0.05, release: 0.6, size: 0.7 }),
  summon: (sr: number, r: Rng) => {
    const dur = 1.4;
    const out = buffer(sr, dur);
    for (const f of [110, 116.5, 164.8, 233]) osc(out, sr, 'saw', (t) => f * (1 + 0.02 * Math.sin(t * 9)), 0.3);
    lowpass(out, sr, (t) => 300 + t * 1800);
    white(out, r, 0.2);
    envelope(out, sr, (t) => Math.pow(t / dur, 2) * (t < dur - 0.1 ? 1 : (dur - t) / 0.1));
    reverb(out, sr, 0.9, 0.4, 0.3);
    return fadeEdges(normalize(out, 0.8), sr);
  },
  areaWarn: (sr: number, _r: Rng) => {
    const dur = 1;
    const out = buffer(sr, dur);
    osc(out, sr, 'square', (t) => 600 + 900 * (t / dur), 0.4);
    envelope(out, sr, (t) => 0.5 + 0.5 * Math.sign(Math.sin(2 * Math.PI * (4 + t * 12) * t)));
    lowpass(out, sr, 3000);
    return fadeEdges(normalize(out, 0.45), sr);
  },
  death: (sr: number, r: Rng) => {
    const a = voice(sr, r, { dur: 2.6, pitch: 70, pitchEnd: 28, from: 'a', to: 'u', fry: 1, breath: 0.6, drive: 6, attack: 0.05, release: 1.4, size: 0.7 });
    reverb(a, sr, 0.95, 0.45, 0.35);
    return fadeEdges(normalize(a, 0.95), sr);
  },
};

// ───────────────────────── Jogador ─────────────────────────

export const playerSounds = {
  hurt: (sr: number, r: Rng) => voice(sr, r, { dur: 0.28, pitch: range(r, 130, 150), pitchEnd: 115, from: 'e', to: 'u', fry: 0.3, breath: 0.6, drive: 2, attack: 0.01, release: 0.15 }),
  death: (sr: number, r: Rng) => voice(sr, r, { dur: 1.2, pitch: 140, pitchEnd: 70, from: 'a', to: 'u', fry: 0.6, breath: 0.7, drive: 2, attack: 0.02, release: 0.8, room: 0.3 }),
  heartbeat: (sr: number, _r: Rng) => {
    const out = buffer(sr, 0.9);
    for (const [at, gain] of [[0, 1], [0.22, 0.7]]) {
      const beat = buffer(sr, 0.2);
      osc(beat, sr, 'sine', (t) => 55 * (1 + Math.exp(-t / 0.02)));
      envelope(beat, sr, adExp(0.004, 0.05));
      mixInto(out, beat, sr, at, gain);
    }
    return fadeEdges(normalize(out, 0.9), sr);
  },
};
