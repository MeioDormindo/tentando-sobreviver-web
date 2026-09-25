/**
 * Música tema de cada sala dos 3 mapas (só do Godot): um loop por área, "mus_area_<área>", que
 * substitui a camada de exploração (pad) da música adaptativa quando o jogador está nela.
 *
 * Mesmo andamento, compasso, duração e progressão das camadas de combate do jogo web
 * (Rém – Si♭ – Solm – Lá, 2 compassos cada, 100 bpm, 8 compassos = 19,2 s): as camadas de
 * pulso, tensão e boss continuam somando por cima sem desafinar. Cada área tem o seu
 * instrumento de acordes, melodia (motivo gerado pela semente da área, no modo dela), textura
 * rítmica e drone. Gravado pelo export-audio.ts (npm run godot:audio).
 */
import {
  adExp, bandpass, brown, buffer, drive, envelope, highpass, lowpass, mixInto, normalize, osc, pink, reverb, rng, white, type Rng,
} from '../../src/audio/dsp';

const BPM = 100;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const BARS = 8;
const LOOP = BAR * BARS;
const TAIL = 3;
const SR = 22050;

const hz = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);
const loopHz = (midi: number): number => Math.round(hz(midi) * LOOP) / LOOP;

/** Progressão das camadas do jogo web: Dm – Bb – Gm – A. */
const CHORDS: number[][] = [[62, 65, 69], [58, 62, 65], [55, 58, 62], [57, 61, 64]];
const ROOTS = [38, 34, 31, 33];
const chordAt = (bar: number): number => Math.floor(bar / 2) % CHORDS.length;

/** Modos sobre Ré (semitons a partir de D): cada área escolhe o seu para a melodia. */
const MODES: Record<string, number[]> = {
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11],
  pentatonic: [0, 3, 5, 7, 10],
};

const stem = (sr: number): Float32Array => buffer(sr, LOOP + TAIL);

function wrap(buf: Float32Array, sr: number): Float32Array {
  const n = Math.round(LOOP * sr);
  const out = buf.slice(0, n);
  for (let i = n; i < buf.length; i++) out[i - n] += buf[i];
  return out;
}

const hash = (text: string): number => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
};

// ───────────────────────── Instrumentos ─────────────────────────

type Voice = (out: Float32Array, sr: number, r: Rng, midi: number, at: number, dur: number, gain: number) => void;

const note = (sr: number, dur: number): Float32Array => buffer(sr, dur);

/** Acordes (notas longas). */
const CHORD_VOICES: Record<string, Voice> = {
  pad: (out, sr, _r, m, at, dur, g) => {
    const b = note(sr, dur + 1.2);
    osc(b, sr, 'saw', () => hz(m) * 0.997, 0.5); osc(b, sr, 'saw', () => hz(m) * 1.004, 0.5);
    lowpass(b, sr, (t) => 800 * (0.8 + 0.2 * Math.sin(t * 1.3)), 0.8);
    envelope(b, sr, (t) => Math.min(1, t / 0.9) * (t < dur ? 1 : Math.max(0, 1 - (t - dur) / 1.2)));
    mixInto(out, b, sr, at, g);
  },
  organ: (out, sr, _r, m, at, dur, g) => {
    const b = note(sr, dur + 0.6);
    for (const [k, a] of [[1, 1], [2, 0.5], [3, 0.3], [4, 0.2], [6, 0.08]] as const) osc(b, sr, 'sine', (t) => hz(m) * k * (1 + 0.002 * Math.sin(t * 6)), a);
    envelope(b, sr, (t) => Math.min(1, t / 0.08) * (t < dur ? 1 : Math.max(0, 1 - (t - dur) / 0.6)) * (0.85 + 0.15 * Math.sin(t * 5.5)));
    mixInto(out, b, sr, at, g * 0.5);
  },
  strings: (out, sr, _r, m, at, dur, g) => {
    const b = note(sr, dur + 1.5);
    for (const d of [0.994, 1.0, 1.006]) osc(b, sr, 'saw', (t) => hz(m) * d * (1 + 0.004 * Math.sin(t * 5.2)), 0.4);
    lowpass(b, sr, 1700, 0.7);
    envelope(b, sr, (t) => Math.min(1, t / 1.2) * (t < dur ? 1 : Math.max(0, 1 - (t - dur) / 1.5)));
    mixInto(out, b, sr, at, g);
  },
  choir: (out, sr, _r, m, at, dur, g) => {
    const b = note(sr, dur + 1.5);
    for (const d of [0.996, 1.004]) osc(b, sr, 'saw', (t) => hz(m) * d * (1 + 0.005 * Math.sin(t * 4.8)), 0.5);
    const a = b.slice(); const o = b.slice();
    bandpass(a, sr, 700, 2.5); bandpass(o, sr, 1150, 3);
    const v = note(sr, dur + 1.5);
    mixInto(v, a, sr, 0, 1); mixInto(v, o, sr, 0, 0.7);
    envelope(v, sr, (t) => Math.min(1, t / 1.4) * (t < dur ? 1 : Math.max(0, 1 - (t - dur) / 1.5)));
    mixInto(out, v, sr, at, g * 1.6);
  },
  drone: (out, sr, _r, m, at, dur, g) => {
    const b = note(sr, dur + 1.0);
    osc(b, sr, 'triangle', () => hz(m - 12), 0.8); osc(b, sr, 'sine', () => hz(m - 24), 0.6);
    lowpass(b, sr, 500);
    envelope(b, sr, (t) => Math.min(1, t / 1.0) * (t < dur ? 1 : Math.max(0, 1 - (t - dur) / 1.0)));
    mixInto(out, b, sr, at, g);
  },
};

/** Notas curtas (melodia, arpejo). */
const LEAD_VOICES: Record<string, Voice> = {
  bell: (out, sr, _r, m, at, _d, g) => {
    const b = note(sr, 2.5);
    osc(b, sr, 'sine', () => hz(m), 0.6); osc(b, sr, 'sine', () => hz(m) * 2.76, 0.18); osc(b, sr, 'sine', () => hz(m) * 5.4, 0.06);
    envelope(b, sr, adExp(0.002, 0.8));
    mixInto(out, b, sr, at, g);
  },
  celesta: (out, sr, _r, m, at, _d, g) => {
    const b = note(sr, 1.4);
    osc(b, sr, 'sine', () => hz(m), 0.7); osc(b, sr, 'sine', () => hz(m) * 4, 0.12);
    envelope(b, sr, adExp(0.002, 0.45));
    mixInto(out, b, sr, at, g);
  },
  musicbox: (out, sr, _r, m, at, _d, g) => {  // desafinada (pediatria)
    const b = note(sr, 1.2);
    osc(b, sr, 'sine', () => hz(m) * 1.012, 0.6); osc(b, sr, 'sine', () => hz(m) * 3.01, 0.15);
    envelope(b, sr, adExp(0.001, 0.35));
    mixInto(out, b, sr, at, g);
  },
  epiano: (out, sr, _r, m, at, _d, g) => {
    const b = note(sr, 1.6);
    osc(b, sr, 'sine', (t) => hz(m) * (1 + 0.004 * Math.sin(t * 30 * Math.exp(-t * 3))), 0.7);
    osc(b, sr, 'sine', () => hz(m) * 2, 0.2);
    envelope(b, sr, adExp(0.003, 0.55));
    mixInto(out, b, sr, at, g);
  },
  glass: (out, sr, _r, m, at, _d, g) => {
    const b = note(sr, 2.2);
    osc(b, sr, 'sine', () => hz(m + 12), 0.5); osc(b, sr, 'sine', () => hz(m + 12) * 1.003, 0.5);
    envelope(b, sr, (t) => Math.min(1, t / 0.12) * Math.exp(-t / 0.9));
    mixInto(out, b, sr, at, g * 0.7);
  },
  lyre: (out, sr, r, m, at, _d, g) => {  // corda dedilhada (lira, harpa)
    const b = note(sr, 1.6);
    osc(b, sr, 'triangle', () => hz(m), 0.7); osc(b, sr, 'sine', () => hz(m) * 2, 0.25);
    const pick = note(sr, 0.02); white(pick, r, 0.4); highpass(pick, sr, 2500);
    mixInto(b, pick, sr, 0, 0.3);
    lowpass(b, sr, (t) => 900 + 3000 * Math.exp(-t / 0.08), 0.9);
    envelope(b, sr, adExp(0.002, 0.5));
    mixInto(out, b, sr, at, g);
  },
  flute: (out, sr, r, m, at, dur, g) => {
    const len = Math.max(0.3, dur);
    const b = note(sr, len + 0.3);
    osc(b, sr, 'sine', (t) => hz(m) * (1 + 0.006 * Math.sin(t * 5.5) * Math.min(1, t / 0.4)), 0.8);
    const breath = note(sr, len + 0.3); pink(breath, r, 0.25); bandpass(breath, sr, hz(m) * 2, 3);
    mixInto(b, breath, sr, 0, 0.6);
    envelope(b, sr, (t) => Math.min(1, t / 0.06) * (t < len ? 1 : Math.max(0, 1 - (t - len) / 0.25)));
    mixInto(out, b, sr, at, g);
  },
  synth: (out, sr, _r, m, at, _d, g) => {  // pulso de sintetizador (laboratório, técnica)
    const b = note(sr, 0.4);
    osc(b, sr, 'square', () => hz(m), 0.5);
    lowpass(b, sr, (t) => 500 + 2200 * Math.exp(-t / 0.06), 2.0);
    envelope(b, sr, adExp(0.002, 0.12));
    mixInto(out, b, sr, at, g);
  },
  brass: (out, sr, _r, m, at, dur, g) => {  // metal grave (túneis)
    const len = Math.max(0.4, dur);
    const b = note(sr, len + 0.4);
    osc(b, sr, 'saw', () => hz(m), 0.6); osc(b, sr, 'saw', () => hz(m) * 1.005, 0.4);
    lowpass(b, sr, (t) => 400 + 700 * Math.min(1, t / 0.3), 1.2);
    envelope(b, sr, (t) => Math.min(1, t / 0.12) * (t < len ? 1 : Math.max(0, 1 - (t - len) / 0.3)));
    mixInto(out, b, sr, at, g);
  },
};

/** Texturas rítmicas (por compasso). */
type Texture = (out: Float32Array, sr: number, r: Rng, bar: number, gain: number) => void;
const hit = (out: Float32Array, sr: number, at: number, f0: number, decay: number, gain: number, sweep = 0.5): void => {
  const b = note(sr, decay * 4);
  osc(b, sr, 'sine', (t) => f0 * (1 + sweep * Math.exp(-t / 0.03)), 1);
  envelope(b, sr, adExp(0.001, decay));
  mixInto(out, b, sr, at, gain);
};
const noiseHit = (out: Float32Array, sr: number, r: Rng, at: number, freq: number, decay: number, gain: number): void => {
  const b = note(sr, decay * 4);
  white(b, r); bandpass(b, sr, freq, 1.5);
  envelope(b, sr, adExp(0.001, decay));
  mixInto(out, b, sr, at, gain);
};
const TEXTURES: Record<string, Texture> = {
  none: () => {},
  heartbeat: (out, sr, _r, bar, g) => { for (const b of [0, 2]) { hit(out, sr, bar * BAR + b * BEAT, 55, 0.09, g); hit(out, sr, bar * BAR + b * BEAT + 0.22, 50, 0.08, g * 0.7); } },
  monitor: (out, sr, _r, bar, g) => {
    for (let b = 0; b < 4; b += 2) { const x = note(sr, 0.12); osc(x, sr, 'sine', () => 1046.5, 0.5); envelope(x, sr, (t) => (t < 0.09 ? 1 : 0)); mixInto(out, x, sr, bar * BAR + b * BEAT, g * 0.35); }
  },
  metal: (out, sr, r, bar, g) => {
    noiseHit(out, sr, r, bar * BAR, 2600, 0.12, g * 0.8); hit(out, sr, bar * BAR, 180, 0.3, g * 0.5, 0.1);
    if (bar % 2) noiseHit(out, sr, r, bar * BAR + BEAT * 2.5, 3400, 0.08, g * 0.5);
  },
  frame: (out, sr, r, bar, g) => {  // tambor de moldura grego
    hit(out, sr, bar * BAR, 70, 0.18, g); noiseHit(out, sr, r, bar * BAR + BEAT * 1.5, 900, 0.05, g * 0.5);
    hit(out, sr, bar * BAR + BEAT * 2, 90, 0.12, g * 0.6); noiseHit(out, sr, r, bar * BAR + BEAT * 3, 900, 0.05, g * 0.4);
  },
  war: (out, sr, r, bar, g) => {  // percussão épica (arena)
    for (const b of [0, 1.5, 2, 3]) hit(out, sr, bar * BAR + b * BEAT, b === 0 ? 55 : 75, 0.2, g * (b === 0 ? 1 : 0.7));
    noiseHit(out, sr, r, bar * BAR + BEAT * 2, 1800, 0.1, g * 0.6);
  },
  toll: (out, sr, _r, bar, g) => {  // sino fúnebre a cada 2 compassos
    if (bar % 2 === 0) LEAD_VOICES.bell(out, sr, rng(1), 50, bar * BAR, 2, g);
  },
  drip: (out, sr, r, bar, g) => {
    for (let i = 0; i < 2; i++) { const at = bar * BAR + r() * BAR; const x = note(sr, 0.1); osc(x, sr, 'sine', (t) => 1400 * (1 + 2 * Math.exp(-t * 40)), 1); envelope(x, sr, (t) => Math.exp(-t * 45)); mixInto(out, x, sr, at, g * 0.4); }
  },
  waltz: (out, sr, _r, bar, g) => {  // "oom-pa-pa" torto (refeitório)
    const root = ROOTS[chordAt(bar)] + 12;
    LEAD_VOICES.epiano(out, sr, rng(2), root, bar * BAR, 0.3, g);
    for (const b of [1.33, 2.66]) for (const n of CHORDS[chordAt(bar)]) LEAD_VOICES.epiano(out, sr, rng(3), n, bar * BAR + b * BEAT * 1.01, 0.2, g * 0.35);
  },
  arp: (out, sr, _r, bar, g) => {  // arpejo em semicolcheias (técnica, laboratório)
    const c = CHORDS[chordAt(bar)];
    for (let s = 0; s < 16; s++) LEAD_VOICES.synth(out, sr, rng(4), c[[0, 1, 2, 1][s % 4]] + (s >= 8 ? 12 : 0), bar * BAR + s * BEAT / 4, 0.1, g * 0.45);
  },
  rail: (out, sr, r, bar, g) => {  // trilho rangendo (plataforma)
    noiseHit(out, sr, r, bar * BAR + BEAT * 0.5, 1200, 0.25, g * 0.3); noiseHit(out, sr, r, bar * BAR + BEAT * 2.5, 1300, 0.25, g * 0.25);
  },
};

// ───────────────────────── Temas por área ─────────────────────────

interface Theme {
  chords: keyof typeof CHORD_VOICES;
  chordGain: number;
  lead: keyof typeof LEAD_VOICES;
  leadGain: number;
  mode: keyof typeof MODES;
  /** Oitava da melodia (MIDI da tônica Ré). */
  register: number;
  /** Notas por compasso (média). */
  density: number;
  texture: keyof typeof TEXTURES;
  textureGain: number;
  drone: number;
  verb: number;
}

const T = (chords: Theme['chords'], lead: Theme['lead'], mode: Theme['mode'], texture: Theme['texture'], o: Partial<Theme> = {}): Theme => ({
  chords, lead, mode, texture, chordGain: 0.5, leadGain: 0.3, register: 74, density: 3, textureGain: 0.35, drone: 0.3, verb: 0.35, ...o,
});

/** Tema de cada área (ids iguais aos dos mapas). */
export const AREA_THEMES: Record<string, Theme> = {
  // Terminal Central: industrial, ecos de estação.
  hall: T('organ', 'bell', 'aeolian', 'none', { density: 2, verb: 0.55 }),
  platform: T('drone', 'lyre', 'aeolian', 'rail', { density: 3, register: 62, drone: 0.45 }),
  ticket: T('pad', 'epiano', 'dorian', 'none', { density: 4 }),
  shops: T('pad', 'musicbox', 'harmonic', 'drip', { density: 4, leadGain: 0.25 }),
  tech: T('pad', 'synth', 'aeolian', 'arp', { density: 2, leadGain: 0.25, textureGain: 0.3 }),
  tunnels: T('drone', 'brass', 'phrygian', 'drip', { density: 1.5, register: 50, drone: 0.55, leadGain: 0.35 }),
  maintenance: T('drone', 'brass', 'aeolian', 'metal', { density: 1.5, register: 50, textureGain: 0.4 }),
  // Hospital Santa Luzia: frio, vítreo, clínico.
  reception: T('pad', 'bell', 'aeolian', 'none', { density: 2, verb: 0.5 }),
  surgery: T('strings', 'glass', 'harmonic', 'monitor', { density: 2 }),
  icu: T('pad', 'glass', 'aeolian', 'heartbeat', { density: 1.5, textureGain: 0.5 }),
  ward: T('strings', 'celesta', 'dorian', 'none', { density: 3 }),
  radiology: T('drone', 'synth', 'phrygian', 'monitor', { density: 2, drone: 0.5 }),
  pharmacy: T('pad', 'glass', 'dorian', 'drip', { density: 3 }),
  pediatrics: T('pad', 'musicbox', 'aeolian', 'none', { density: 4, leadGain: 0.35 }),
  morgue: T('choir', 'bell', 'harmonic', 'toll', { density: 1, register: 62, verb: 0.6 }),
  cafeteria: T('organ', 'epiano', 'harmonic', 'waltz', { density: 2, chordGain: 0.25, textureGain: 0.45 }),
  lab: T('pad', 'synth', 'harmonic', 'arp', { density: 3, textureGain: 0.4 }),
  // Templo dos Mortos: grego e sobrenatural.
  ruins: T('strings', 'lyre', 'dorian', 'frame', { density: 4, textureGain: 0.3 }),
  necropolis: T('choir', 'bell', 'aeolian', 'toll', { density: 1, register: 62, verb: 0.65 }),
  labyrinth: T('drone', 'flute', 'phrygian', 'frame', { density: 2.5, drone: 0.45 }),
  forest: T('strings', 'flute', 'pentatonic', 'none', { density: 3, register: 79 }),
  gorgon_temple: T('strings', 'lyre', 'phrygian', 'drip', { density: 3, chordGain: 0.6 }),
  underworld: T('drone', 'brass', 'phrygian', 'war', { density: 1.5, register: 50, drone: 0.6, textureGain: 0.4 }),
  arena: T('choir', 'brass', 'harmonic', 'war', { density: 2, register: 62, textureGain: 0.5 }),
  sanctuary: T('choir', 'lyre', 'dorian', 'none', { density: 5, register: 79, verb: 0.6 }),
};

/** Uma nota da escala do modo, perto do acorde, na oitava `register`. */
function melodyNote(r: Rng, theme: Theme, chord: number[]): number {
  const scale = MODES[theme.mode];
  // Metade das vezes uma nota do acorde (consonante com as camadas de combate).
  if (r() < 0.55) {
    const c = chord[Math.floor(r() * chord.length)] % 12;
    const base = theme.register - (theme.register % 12) + c;
    return base < theme.register - 3 ? base + 12 : base;
  }
  const deg = scale[Math.floor(r() * scale.length)];
  return theme.register + deg - (deg > 7 ? 12 : 0);
}

export function areaMusic(area: string): (sr: number, r: Rng) => Float32Array {
  const theme = AREA_THEMES[area];
  return (sr) => {
    const r = rng(hash(area));
    const out = stem(sr);
    // Motivo de 2 compassos repetido com variações (a melodia tem cara de tema).
    const motif: Array<[number, number, number]> = [];  // [compasso 0/1, tempo em colcheias, duração]
    for (let bar = 0; bar < 2; bar++) {
      const count = Math.max(1, Math.round(theme.density + (r() - 0.5)));
      const slots = Array.from({ length: 8 }, (_, i) => i).sort(() => r() - 0.5).slice(0, count).sort((a, b) => a - b);
      for (const s of slots) motif.push([bar, s, (1 + Math.floor(r() * 3)) * BEAT / 2]);
    }
    for (let bar = 0; bar < BARS; bar++) {
      const c = CHORDS[chordAt(bar)];
      if (bar % 2 === 0) for (const n of c) CHORD_VOICES[theme.chords](out, sr, r, theme.chords === 'drone' ? n - 12 : n, bar * BAR, BAR * 2, theme.chordGain / c.length);
      TEXTURES[theme.texture](out, sr, r, bar, theme.textureGain);
      const variation = rng(hash(area) + bar * 97);
      for (const [mb, slot, dur] of motif) {
        if (mb !== bar % 2) continue;
        if (bar >= 6 && variation() < 0.3) continue;  // respiros no fim do loop
        LEAD_VOICES[theme.lead](out, sr, r, melodyNote(variation, theme, c), bar * BAR + slot * BEAT / 2, dur, theme.leadGain);
      }
    }
    // Drone grave na tônica (loop exato) e um ar de sala.
    const drone = buffer(sr, LOOP);
    osc(drone, sr, 'sine', () => loopHz(26), 0.8);
    osc(drone, sr, 'triangle', () => loopHz(38), 0.3);
    lowpass(drone, sr, 220);
    mixInto(out, drone, sr, 0, theme.drone);
    const air = buffer(sr, LOOP);
    brown(air, r, 0.3);
    lowpass(air, sr, 400);
    mixInto(out, air, sr, 0, 0.04);
    reverb(out, sr, 0.9, theme.verb, 0.35);
    drive(out, 1.05);
    return normalize(wrap(out, sr), 0.7);
  };
}

export const AREA_MUSIC = Object.keys(AREA_THEMES).map((area) => ({ key: `mus_area_${area}`, variants: 1, sr: SR, make: areaMusic(area) }));
