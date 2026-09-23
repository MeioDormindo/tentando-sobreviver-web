/**
 * Mini biblioteca de síntese (DSP) para gerar todos os sons do jogo em código.
 * Tudo trabalha com Float32Array mono na taxa `sr`.
 */

export type Rng = () => number;

/** Aleatório determinístico (mulberry32) — cada variação de som é reproduzível. */
export function rng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const range = (r: Rng, min: number, max: number): number => min + r() * (max - min);

export function buffer(sr: number, seconds: number): Float32Array {
  return new Float32Array(Math.max(1, Math.round(sr * seconds)));
}

// ───────────────────────── Fontes ─────────────────────────

export function white(out: Float32Array, r: Rng, gain = 1): Float32Array {
  for (let i = 0; i < out.length; i++) out[i] += (r() * 2 - 1) * gain;
  return out;
}

/** Ruído marrom (grave, "ronco"). */
export function brown(out: Float32Array, r: Rng, gain = 1): Float32Array {
  let last = 0;
  for (let i = 0; i < out.length; i++) {
    last = (last + (r() * 2 - 1) * 0.02) / 1.02;
    out[i] += last * 3.5 * gain;
  }
  return out;
}

/** Ruído rosa aproximado (Paul Kellet). */
export function pink(out: Float32Array, r: Rng, gain = 1): Float32Array {
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < out.length; i++) {
    const w = r() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    out[i] += (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11 * gain;
    b6 = w * 0.115926;
  }
  return out;
}

export type Wave = 'sine' | 'saw' | 'square' | 'triangle';

/** Oscilador com frequência variável: freq(t) em Hz. */
export function osc(out: Float32Array, sr: number, wave: Wave, freq: (t: number) => number, gain = 1, start = 0, dur = Infinity): Float32Array {
  let phase = 0;
  const s0 = Math.floor(start * sr);
  const s1 = Math.min(out.length, s0 + Math.floor(dur * sr));
  for (let i = s0; i < s1; i++) {
    const t = (i - s0) / sr;
    phase += freq(t) / sr;
    phase -= Math.floor(phase);
    let v: number;
    switch (wave) {
      case 'sine': v = Math.sin(phase * Math.PI * 2); break;
      case 'saw': v = phase * 2 - 1; break;
      case 'square': v = phase < 0.5 ? 1 : -1; break;
      default: v = 1 - 4 * Math.abs(phase - 0.5);
    }
    out[i] += v * gain;
  }
  return out;
}

// ───────────────────────── Envelopes ─────────────────────────

/** Multiplica por uma função de envelope env(t). */
export function envelope(buf: Float32Array, sr: number, env: (t: number) => number): Float32Array {
  for (let i = 0; i < buf.length; i++) buf[i] *= env(i / sr);
  return buf;
}

/** Ataque linear + decaimento exponencial. */
export const adExp = (attack: number, tau: number) => (t: number): number =>
  t < attack ? t / attack : Math.exp(-(t - attack) / tau);

/** Ataque, sustentação e soltura lineares (em segundos). */
export const asr = (attack: number, sustain: number, release: number) => (t: number): number => {
  if (t < attack) return t / attack;
  if (t < attack + sustain) return 1;
  return Math.max(0, 1 - (t - attack - sustain) / release);
};

// ───────────────────────── Filtros ─────────────────────────

export type FilterType = 'lowpass' | 'highpass' | 'bandpass' | 'peak';

/** Biquad (RBJ cookbook) com frequência opcionalmente variável no tempo. */
export function biquad(buf: Float32Array, sr: number, type: FilterType, freq: number | ((t: number) => number), q = 0.707, gainDb = 0): Float32Array {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  let b0 = 0, b1 = 0, b2 = 0, a1 = 0, a2 = 0;
  const fixed = typeof freq === 'number';
  const compute = (f: number) => {
    const w0 = (2 * Math.PI * Math.min(f, sr * 0.45)) / sr;
    const cos = Math.cos(w0);
    const alpha = Math.sin(w0) / (2 * q);
    let a0: number;
    if (type === 'lowpass') {
      b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = (1 - cos) / 2; a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha;
    } else if (type === 'highpass') {
      b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = (1 + cos) / 2; a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha;
    } else if (type === 'bandpass') {
      b0 = alpha; b1 = 0; b2 = -alpha; a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha;
    } else {
      const A = Math.pow(10, gainDb / 40);
      b0 = 1 + alpha * A; b1 = -2 * cos; b2 = 1 - alpha * A; a0 = 1 + alpha / A; a1 = -2 * cos; a2 = 1 - alpha / A;
    }
    b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
  };
  if (fixed) compute(freq);
  for (let i = 0; i < buf.length; i++) {
    if (!fixed && i % 32 === 0) compute((freq as (t: number) => number)(i / sr));
    const x = buf[i];
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    buf[i] = y;
  }
  return buf;
}

export const lowpass = (b: Float32Array, sr: number, f: number | ((t: number) => number), q = 0.707) => biquad(b, sr, 'lowpass', f, q);
export const highpass = (b: Float32Array, sr: number, f: number | ((t: number) => number), q = 0.707) => biquad(b, sr, 'highpass', f, q);
export const bandpass = (b: Float32Array, sr: number, f: number | ((t: number) => number), q = 1) => biquad(b, sr, 'bandpass', f, q);

/** Vários bandpass em paralelo somados (formantes de voz, corpo ressonante). */
export function formants(src: Float32Array, sr: number, bands: Array<{ f: number | ((t: number) => number); q: number; gain: number }>): Float32Array {
  const out = new Float32Array(src.length);
  for (const band of bands) {
    const copy = src.slice();
    bandpass(copy, sr, band.f, band.q);
    for (let i = 0; i < out.length; i++) out[i] += copy[i] * band.gain;
  }
  return out;
}

// ───────────────────────── Efeitos ─────────────────────────

/** Saturação suave (tanh). */
export function drive(buf: Float32Array, amount: number): Float32Array {
  const norm = Math.tanh(amount);
  for (let i = 0; i < buf.length; i++) buf[i] = Math.tanh(buf[i] * amount) / norm;
  return buf;
}

/** Reverb simples de Schroeder (4 combs + 2 allpass), mistura seco/molhado. */
export function reverb(buf: Float32Array, sr: number, size = 0.8, wet = 0.3, damp = 0.4): Float32Array {
  const scale = sr / 44100;
  const combTimes = [1557, 1617, 1491, 1422].map((n) => Math.floor(n * scale * (0.6 + size * 0.6)));
  const allpassTimes = [225, 556].map((n) => Math.floor(n * scale));
  const feedback = 0.7 + size * 0.26;
  const wetBuf = new Float32Array(buf.length);
  for (const len of combTimes) {
    const line = new Float32Array(len);
    let idx = 0;
    let store = 0;
    for (let i = 0; i < buf.length; i++) {
      const out = line[idx];
      store = out * (1 - damp) + store * damp;
      line[idx] = buf[i] + store * feedback;
      idx = (idx + 1) % len;
      wetBuf[i] += out * 0.25;
    }
  }
  for (const len of allpassTimes) {
    const line = new Float32Array(len);
    let idx = 0;
    for (let i = 0; i < wetBuf.length; i++) {
      const bufOut = line[idx];
      const input = wetBuf[i];
      line[idx] = input + bufOut * 0.5;
      wetBuf[i] = bufOut - input;
      idx = (idx + 1) % len;
    }
  }
  for (let i = 0; i < buf.length; i++) buf[i] = buf[i] * (1 - wet) + wetBuf[i] * wet;
  return buf;
}

/** Eco simples (delay com realimentação). */
export function echo(buf: Float32Array, sr: number, time: number, feedback: number, mix: number): Float32Array {
  const d = Math.floor(time * sr);
  const out = buf.slice();
  for (let i = d; i < out.length; i++) out[i] += out[i - d] * feedback;
  for (let i = 0; i < buf.length; i++) buf[i] = buf[i] * (1 - mix) + out[i] * mix;
  return buf;
}

/** Soma `src` em `dst` a partir de `at` segundos. */
export function mixInto(dst: Float32Array, src: Float32Array, sr: number, at = 0, gain = 1): Float32Array {
  const offset = Math.floor(at * sr);
  for (let i = 0; i < src.length && i + offset < dst.length; i++) dst[i + offset] += src[i] * gain;
  return dst;
}

/** Normaliza o pico para `peak`. */
export function normalize(buf: Float32Array, peak = 0.9): Float32Array {
  let max = 0;
  for (let i = 0; i < buf.length; i++) max = Math.max(max, Math.abs(buf[i]));
  if (max > 0) for (let i = 0; i < buf.length; i++) buf[i] *= peak / max;
  return buf;
}

/** Fade-in/out curtos para evitar estalos. */
export function fadeEdges(buf: Float32Array, sr: number, fadeIn = 0.002, fadeOut = 0.01): Float32Array {
  const a = Math.floor(fadeIn * sr);
  const b = Math.floor(fadeOut * sr);
  for (let i = 0; i < a && i < buf.length; i++) buf[i] *= i / a;
  for (let i = 0; i < b && i < buf.length; i++) buf[buf.length - 1 - i] *= i / b;
  return buf;
}

/** Transforma um som longo em loop contínuo: sobrepõe o fim ao começo com crossfade. */
export function makeLoop(buf: Float32Array, sr: number, crossfade = 1): Float32Array {
  const n = Math.floor(crossfade * sr);
  const out = buf.slice(0, buf.length - n);
  for (let i = 0; i < n; i++) {
    const t = i / n;
    out[i] = out[i] * Math.sqrt(t) + buf[buf.length - n + i] * Math.sqrt(1 - t);
  }
  return out;
}

/** Impacto ressonante: ruído curto excitando parciais (metal, madeira, vidro). */
export function resonantHit(sr: number, r: Rng, partials: Array<{ f: number; q: number; gain: number }>, dur: number, noiseTau = 0.004): Float32Array {
  const exc = buffer(sr, dur);
  white(exc, r);
  envelope(exc, sr, adExp(0.0005, noiseTau));
  return formants(exc, sr, partials);
}
