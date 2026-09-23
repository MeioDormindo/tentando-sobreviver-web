import { adExp, bandpass, buffer, drive, envelope, highpass, lowpass, mixInto, normalize, osc, reverb, white, type Rng } from '../dsp';
import { musicConfig } from '../../config/audio.config';

/*
 * Música adaptativa (GDD §58), toda sintetizada. As camadas em loop têm o mesmo
 * andamento e duração (8 compassos em ré menor) e tocam juntas, sincronizadas;
 * o MusicSystem só mexe no volume de cada uma conforme a intensidade.
 *   pad    → exploração (acordes e drone)
 *   pulse  → wave normal (baixo em colcheias, bumbo e chimbal leves)
 *   drive  → alta intensidade (bateria completa e arpejo tenso)
 *   boss   → luta contra o boss (meio-tempo pesado, riff distorcido, trítonos)
 */

const BEAT = 60 / musicConfig.bpm;
const BAR = BEAT * 4;
const LOOP = BAR * musicConfig.bars;
/** Cauda renderizada além do loop (reverb e notas soltas), dobrada de volta no começo. */
const TAIL = 3;

const hz = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);
/** Frequência ajustada para caber um número inteiro de ciclos no loop (sem estalo na emenda). */
const loopHz = (midi: number): number => Math.round(hz(midi) * LOOP) / LOOP;

/** Progressão: Dm – Bb – Gm – A (2 compassos cada). */
const CHORDS: number[][] = [
  [62, 65, 69],
  [58, 62, 65],
  [55, 58, 62],
  [57, 61, 64],
];
const ROOTS = [38, 34, 31, 33];
const chordAt = (bar: number): number => Math.floor(bar / 2) % CHORDS.length;

/** Buffer com espaço para a cauda. */
const stem = (sr: number): Float32Array => buffer(sr, LOOP + TAIL);

/** Dobra a cauda sobre o início: o loop fica perfeito, sem emenda audível. */
function wrap(buf: Float32Array, sr: number): Float32Array {
  const n = Math.round(LOOP * sr);
  const out = buf.slice(0, n);
  for (let i = n; i < buf.length; i++) out[i - n] += buf[i];
  return out;
}

// ───────────────────────── Instrumentos ─────────────────────────

function pad(out: Float32Array, sr: number, notes: number[], at: number, dur: number, gain: number, cutoff = 900): void {
  const b = buffer(sr, dur + 1.2);
  for (const n of notes) {
    const f = hz(n);
    osc(b, sr, 'saw', () => f * 0.997, 0.5);
    osc(b, sr, 'saw', () => f * 1.004, 0.5);
    osc(b, sr, 'sine', () => f / 2, 0.4);
  }
  lowpass(b, sr, (t) => cutoff * (0.8 + 0.2 * Math.sin(t * 1.3)), 0.8);
  envelope(b, sr, (t) => Math.min(1, t / 0.9) * (t < dur ? 1 : Math.max(0, 1 - (t - dur) / 1.2)));
  mixInto(out, b, sr, at, gain / notes.length);
}

function bassNote(out: Float32Array, sr: number, midi: number, at: number, dur: number, gain: number, grit = 0): void {
  const b = buffer(sr, dur + 0.1);
  const f = hz(midi);
  osc(b, sr, 'saw', () => f, 0.6);
  osc(b, sr, 'sine', () => f, 0.8);
  lowpass(b, sr, (t) => 260 + 900 * Math.exp(-t / 0.08), 1.2);
  if (grit > 0) drive(b, grit);
  envelope(b, sr, (t) => Math.min(1, t / 0.005) * Math.exp(-t / (dur * 0.9)));
  mixInto(out, b, sr, at, gain);
}

function kick(out: Float32Array, sr: number, at: number, gain: number): void {
  const b = buffer(sr, 0.35);
  osc(b, sr, 'sine', (t) => 45 + 110 * Math.exp(-t / 0.03), 1);
  envelope(b, sr, adExp(0.001, 0.12));
  mixInto(out, b, sr, at, gain);
}

function snare(out: Float32Array, sr: number, r: Rng, at: number, gain: number): void {
  const b = buffer(sr, 0.3);
  white(b, r, 0.8);
  bandpass(b, sr, 1900, 0.7);
  osc(b, sr, 'triangle', () => 190, 0.5);
  envelope(b, sr, adExp(0.001, 0.07));
  mixInto(out, b, sr, at, gain);
}

function hat(out: Float32Array, sr: number, r: Rng, at: number, gain: number, open = false): void {
  const b = buffer(sr, open ? 0.25 : 0.06);
  white(b, r);
  highpass(b, sr, 7000);
  envelope(b, sr, adExp(0.001, open ? 0.08 : 0.018));
  mixInto(out, b, sr, at, gain);
}

function tom(out: Float32Array, sr: number, at: number, midi: number, gain: number): void {
  const b = buffer(sr, 0.4);
  const f = hz(midi);
  osc(b, sr, 'sine', (t) => f * (1 + 0.5 * Math.exp(-t / 0.04)), 1);
  envelope(b, sr, adExp(0.002, 0.14));
  mixInto(out, b, sr, at, gain);
}

function pluck(out: Float32Array, sr: number, midi: number, at: number, gain: number, wave: 'square' | 'saw' = 'square'): void {
  const b = buffer(sr, 0.35);
  const f = hz(midi);
  osc(b, sr, wave, () => f, 1);
  lowpass(b, sr, (t) => 600 + 2400 * Math.exp(-t / 0.05), 1.5);
  envelope(b, sr, adExp(0.002, 0.09));
  mixInto(out, b, sr, at, gain);
}

// ───────────────────────── Camadas (loops) ─────────────────────────

/** Exploração: acordes longos, drone grave e sinos distantes. */
export function musicPad(sr: number, _r: Rng): Float32Array {
  const out = stem(sr);
  for (let bar = 0; bar < musicConfig.bars; bar += 2) {
    const c = chordAt(bar);
    pad(out, sr, CHORDS[c], bar * BAR, BAR * 2, 0.9);
    // Sino agudo na 5ª do acorde, uma vez a cada dois compassos
    const bell = buffer(sr, 3);
    osc(bell, sr, 'sine', () => hz(CHORDS[c][2] + 12), 0.5);
    osc(bell, sr, 'sine', () => hz(CHORDS[c][2] + 12) * 2.76, 0.12);
    envelope(bell, sr, adExp(0.003, 0.9));
    mixInto(out, bell, sr, bar * BAR + BEAT * 2, 0.18);
  }
  const drone = buffer(sr, LOOP);
  osc(drone, sr, 'sine', () => loopHz(26), 0.8);
  osc(drone, sr, 'triangle', () => loopHz(38), 0.3);
  lowpass(drone, sr, 200);
  mixInto(out, drone, sr, 0, 0.35);
  reverb(out, sr, 0.9, 0.4, 0.3);
  return normalize(wrap(out, sr), 0.7);
}

/** Wave normal: baixo pulsando em colcheias, bumbo nos tempos 1 e 3, chimbal no contratempo. */
export function musicPulse(sr: number, r: Rng): Float32Array {
  const out = stem(sr);
  for (let bar = 0; bar < musicConfig.bars; bar++) {
    const root = ROOTS[chordAt(bar)];
    const t0 = bar * BAR;
    for (let e = 0; e < 8; e++) {
      const note = e % 4 === 3 ? root + 12 : root;
      bassNote(out, sr, note, t0 + e * (BEAT / 2), BEAT / 2, e % 2 === 0 ? 0.9 : 0.6);
      if (e % 2 === 1) hat(out, sr, r, t0 + e * (BEAT / 2), 0.25);
    }
    kick(out, sr, t0, 0.8);
    kick(out, sr, t0 + BEAT * 2, 0.7);
  }
  reverb(out, sr, 0.5, 0.15, 0.4);
  return normalize(wrap(out, sr), 0.75);
}

/** Alta intensidade: bateria completa, viradas de tom e arpejo em semicolcheias. */
export function musicDrive(sr: number, r: Rng): Float32Array {
  const out = stem(sr);
  const s16 = BEAT / 4;
  for (let bar = 0; bar < musicConfig.bars; bar++) {
    const chord = CHORDS[chordAt(bar)];
    const t0 = bar * BAR;
    for (let i = 0; i < 16; i++) {
      const t = t0 + i * s16;
      hat(out, sr, r, t, i % 4 === 2 ? 0.3 : 0.15, i === 14);
      if (i === 0 || i === 6 || i === 8 || i === 11) kick(out, sr, t, 1);
      if (i === 4 || i === 12) snare(out, sr, r, t, 0.8);
      // Arpejo: sobe e desce pelas notas do acorde, oitava acima
      const seq = [0, 1, 2, 1];
      pluck(out, sr, chord[seq[i % 4]] + (i >= 8 ? 12 : 0), t, 0.28);
    }
    // Virada de tons no fim de cada 2 compassos
    if (bar % 2 === 1) for (let k = 0; k < 4; k++) tom(out, sr, t0 + BEAT * 3 + k * s16, 50 - k * 3, 0.7);
  }
  reverb(out, sr, 0.55, 0.18, 0.4);
  drive(out, 1.3);
  return normalize(wrap(out, sr), 0.8);
}

/** Boss: meio-tempo pesado, riff distorcido com trítono e acordes dissonantes. */
export function musicBoss(sr: number, r: Rng): Float32Array {
  const out = stem(sr);
  const riff = [38, 38, 44, 43, 38, 38, 41, 44];
  for (let bar = 0; bar < musicConfig.bars; bar++) {
    const t0 = bar * BAR;
    kick(out, sr, t0, 1.1);
    kick(out, sr, t0 + BEAT / 2, 0.8);
    kick(out, sr, t0 + BEAT * 2.5, 0.9);
    snare(out, sr, r, t0 + BEAT * 2, 1.1);
    for (let e = 0; e < 8; e++) {
      bassNote(out, sr, riff[e] + (bar % 4 === 3 && e > 5 ? 1 : 0), t0 + e * (BEAT / 2), BEAT / 2, 0.8, 3);
      hat(out, sr, r, t0 + e * (BEAT / 2), 0.12);
    }
    // Acorde dissonante (D + Eb + Ab) no início de cada 2 compassos
    if (bar % 2 === 0) pad(out, sr, [62, 63, 68], t0, BAR * 1.5, 0.8, 1600);
    if (bar % 4 === 3) for (let k = 0; k < 6; k++) tom(out, sr, t0 + BEAT * 2.5 + k * (BEAT / 4), 45 - k * 2, 0.8);
  }
  reverb(out, sr, 0.7, 0.22, 0.35);
  drive(out, 1.6);
  return normalize(wrap(out, sr), 0.85);
}

// ───────────────────────── Vinhetas ─────────────────────────

/** Vitória (fim de wave / boss derrotado): arpejo que termina em ré maior. */
export function musicVictory(sr: number, _r: Rng): Float32Array {
  const out = buffer(sr, 4.5);
  const notes = [62, 65, 69, 74];
  notes.forEach((n, i) => pluck(out, sr, n, i * 0.14, 0.6, 'saw'));
  pad(out, sr, [62, 66, 69, 74], 0.56, 1.8, 1.2, 2200);
  const bell = buffer(sr, 3);
  osc(bell, sr, 'sine', () => hz(86), 0.5);
  envelope(bell, sr, adExp(0.003, 1));
  mixInto(out, bell, sr, 0.56, 0.3);
  reverb(out, sr, 0.85, 0.35, 0.3);
  return normalize(out, 0.75);
}

/** Game Over: acorde menor descendo lentamente e um estrondo grave. */
export function musicGameOver(sr: number, _r: Rng): Float32Array {
  const out = buffer(sr, 6);
  const b = buffer(sr, 5);
  for (const n of [62, 65, 69]) {
    osc(b, sr, 'saw', (t) => hz(n) * Math.pow(2, -t / 5), 0.4);
    osc(b, sr, 'saw', (t) => hz(n) * 1.005 * Math.pow(2, -t / 5), 0.4);
  }
  lowpass(b, sr, (t) => 1400 * Math.exp(-t / 2) + 200, 0.9);
  envelope(b, sr, (t) => Math.min(1, t / 0.3) * Math.max(0, 1 - t / 5));
  mixInto(out, b, sr, 0, 0.5);
  kick(out, sr, 0, 1.2);
  const boom = buffer(sr, 2);
  osc(boom, sr, 'sine', () => hz(26), 1);
  envelope(boom, sr, adExp(0.01, 0.8));
  mixInto(out, boom, sr, 0, 0.8);
  reverb(out, sr, 0.95, 0.45, 0.3);
  return normalize(out, 0.8);
}
