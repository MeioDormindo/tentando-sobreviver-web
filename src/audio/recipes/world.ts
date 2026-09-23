import {
  adExp, bandpass, brown, buffer, drive, echo, envelope, fadeEdges, highpass, lowpass, mixInto, normalize, osc, pink,
  range, resonantHit, reverb, white, type Rng,
} from '../dsp';

// ───────────────────────── Passos por tipo de piso ─────────────────────────

export type Surface = 'terminal' | 'concrete' | 'metal' | 'tracks' | 'tunnel' | 'wagon';

function thud(sr: number, freq: number, tau: number, gain: number): Float32Array {
  const b = buffer(sr, tau * 6);
  osc(b, sr, 'sine', (t) => freq * (1 + Math.exp(-t / 0.008)));
  envelope(b, sr, adExp(0.002, tau));
  for (let i = 0; i < b.length; i++) b[i] *= gain;
  return b;
}

export const footstep: Record<Surface, (sr: number, r: Rng) => Float32Array> = {
  // Piso de pedra do terminal: "toc" seco
  terminal: (sr, r) => {
    const out = buffer(sr, 0.18);
    const tap = buffer(sr, 0.08);
    white(tap, r);
    envelope(tap, sr, adExp(0.001, range(r, 0.012, 0.018)));
    bandpass(tap, sr, range(r, 1600, 2200), 1.4);
    mixInto(out, tap, sr, 0, 1);
    mixInto(out, thud(sr, 90, 0.02, 0.5), sr, 0, 1);
    return fadeEdges(normalize(out, 0.6), sr);
  },
  // Concreto: mais abafado, com areia
  concrete: (sr, r) => {
    const out = buffer(sr, 0.2);
    const scuff = buffer(sr, 0.12);
    white(scuff, r);
    envelope(scuff, sr, adExp(0.002, range(r, 0.02, 0.03)));
    bandpass(scuff, sr, range(r, 800, 1100), 1);
    mixInto(out, scuff, sr, 0, 1);
    mixInto(out, thud(sr, 75, 0.025, 0.6), sr, 0, 1);
    return fadeEdges(normalize(out, 0.55), sr);
  },
  // Chapa de metal: batida ressonante
  metal: (sr, r) => {
    const out = resonantHit(sr, r, [
      { f: range(r, 1100, 1300), q: 18, gain: 0.8 },
      { f: range(r, 2600, 2900), q: 22, gain: 0.5 },
      { f: range(r, 4100, 4500), q: 25, gain: 0.3 },
      { f: 180, q: 3, gain: 1 },
    ], 0.3, 0.004);
    return fadeEdges(normalize(out, 0.5), sr);
  },
  // Brita dos trilhos: estalinhos espalhados
  tracks: (sr, r) => {
    const out = buffer(sr, 0.2);
    for (let i = 0; i < out.length; i++) if (r() < 0.012) out[i] = (r() * 2 - 1) * Math.exp(-(i / sr) / 0.06);
    highpass(out, sr, 1500);
    mixInto(out, thud(sr, 70, 0.02, 0.35), sr, 0, 1);
    return fadeEdges(normalize(out, 0.55), sr);
  },
  // Túneis: chão molhado (splash)
  tunnel: (sr, r) => {
    const out = buffer(sr, 0.3);
    white(out, r);
    envelope(out, sr, adExp(0.004, 0.05));
    bandpass(out, sr, (t) => 900 + t * 5000, 1.2);
    for (let i = 0; i < 3; i++) {
      const drop = buffer(sr, 0.05);
      const f0 = range(r, 900, 1600);
      osc(drop, sr, 'sine', (t) => f0 * (1 + t * 10));
      envelope(drop, sr, adExp(0.001, 0.01));
      mixInto(out, drop, sr, range(r, 0.02, 0.12), 0.4);
    }
    return fadeEdges(normalize(out, 0.55), sr);
  },
  // Borracha do vagão: batida surda
  wagon: (sr, r) => {
    const out = thud(sr, 110, 0.03, 1);
    const soft = buffer(sr, out.length / sr);
    white(soft, r, 0.3);
    envelope(soft, sr, adExp(0.002, 0.015));
    lowpass(soft, sr, 500);
    mixInto(out, soft, sr, 0, 1);
    return fadeEdges(normalize(out, 0.5), sr);
  },
};

// ───────────────────────── Impactos e explosões ─────────────────────────

/** Tiro acertando parede/metal: estalo + às vezes um ricochete assobiando. */
export function impactHard(sr: number, r: Rng): Float32Array {
  const out = buffer(sr, 0.45);
  const hit = resonantHit(sr, r, [{ f: range(r, 1800, 2600), q: 4, gain: 1 }, { f: range(r, 4000, 5500), q: 6, gain: 0.5 }], 0.12, 0.003);
  mixInto(out, hit, sr, 0, 1);
  if (r() < 0.5) {
    const ric = buffer(sr, 0.35);
    const f0 = range(r, 2500, 4200);
    osc(ric, sr, 'sine', (t) => f0 * (1 - t * 1.4));
    envelope(ric, sr, adExp(0.004, 0.09));
    mixInto(out, ric, sr, 0.01, 0.35);
  }
  return fadeEdges(normalize(out, 0.5), sr);
}

/** Tiro acertando carne: batida úmida. */
export function impactFlesh(sr: number, r: Rng): Float32Array {
  const out = buffer(sr, 0.2);
  white(out, r);
  envelope(out, sr, adExp(0.001, 0.025));
  lowpass(out, sr, 1400);
  mixInto(out, thud(sr, 140, 0.03, 0.8), sr, 0, 1);
  return fadeEdges(normalize(out, 0.55), sr);
}

export function explosion(sr: number, r: Rng): Float32Array {
  const out = buffer(sr, 2.2);
  white(out, r);
  envelope(out, sr, adExp(0.003, 0.35));
  lowpass(out, sr, (t) => 4000 * Math.exp(-t * 2.5) + 150);
  const boom = buffer(sr, 1.2);
  osc(boom, sr, 'sine', (t) => 42 * (1 + 2.5 * Math.exp(-t / 0.05)));
  envelope(boom, sr, adExp(0.002, 0.3));
  mixInto(out, boom, sr, 0, 1.4);
  const crackle = buffer(sr, 1.2);
  for (let i = 0; i < crackle.length; i++) if (r() < 0.004) crackle[i] = r() * 2 - 1;
  envelope(crackle, sr, adExp(0.05, 0.3));
  highpass(crackle, sr, 1500);
  mixInto(out, crackle, sr, 0.05, 1.5);
  drive(out, 3);
  reverb(out, sr, 0.9, 0.3, 0.35);
  return fadeEdges(normalize(out, 0.98), sr);
}

// ───────────────────────── Barricadas e portas ─────────────────────────

/** Tábua sendo arrancada (madeira rachando). */
export function woodBreak(sr: number, r: Rng): Float32Array {
  const out = buffer(sr, 0.55);
  for (let i = 0; i < 6; i++) {
    const crack = resonantHit(sr, r, [{ f: range(r, 400, 900), q: 3, gain: 1 }, { f: range(r, 1800, 2600), q: 5, gain: 0.5 }], 0.1, 0.004);
    mixInto(out, crack, sr, i * range(r, 0.015, 0.05), range(r, 0.4, 1));
  }
  mixInto(out, thud(sr, 120, 0.05, 0.8), sr, 0.25, 1);
  return fadeEdges(normalize(out, 0.75), sr);
}

/** Martelada ao consertar a barricada. */
export function hammer(sr: number, r: Rng): Float32Array {
  const out = resonantHit(sr, r, [{ f: range(r, 280, 340), q: 6, gain: 1 }, { f: 950, q: 8, gain: 0.5 }, { f: 2400, q: 10, gain: 0.25 }], 0.3, 0.003);
  reverb(out, sr, 0.4, 0.15);
  return fadeEdges(normalize(out, 0.7), sr);
}

/** Porta de enrolar subindo: chocalho metálico + motor. */
export function doorOpen(sr: number, r: Rng): Float32Array {
  const dur = 1.3;
  const out = buffer(sr, dur);
  for (let t = 0; t < dur - 0.1; t += range(r, 0.03, 0.05)) {
    const rattle = resonantHit(sr, r, [{ f: range(r, 700, 1000), q: 8, gain: 1 }, { f: range(r, 2000, 2600), q: 10, gain: 0.4 }], 0.08, 0.002);
    mixInto(out, rattle, sr, t, 0.5);
  }
  osc(out, sr, 'saw', (t) => 90 + t * 30, 0.15);
  lowpass(out, sr, 3500);
  envelope(out, sr, (t) => Math.min(1, t / 0.1) * Math.min(1, (dur - t) / 0.3));
  reverb(out, sr, 0.6, 0.2);
  return fadeEdges(normalize(out, 0.8), sr);
}

// ───────────────────────── Ambiente: sons pontuais ─────────────────────────

/** Estrondo metálico distante (algo caindo lá longe). */
export function distantBang(sr: number, r: Rng): Float32Array {
  const out = buffer(sr, 2.5);
  const hit = resonantHit(sr, r, [{ f: range(r, 180, 260), q: 6, gain: 1 }, { f: range(r, 500, 700), q: 9, gain: 0.6 }, { f: 1300, q: 12, gain: 0.3 }], 0.8, 0.01);
  mixInto(out, hit, sr, 0, 1);
  lowpass(out, sr, 1400);
  reverb(out, sr, 0.95, 0.6, 0.3);
  return fadeEdges(normalize(out, 0.6), sr);
}

/** Gota d'água com eco. */
export function drip(sr: number, r: Rng): Float32Array {
  const out = buffer(sr, 1.2);
  const d = buffer(sr, 0.06);
  const f0 = range(r, 900, 1500);
  osc(d, sr, 'sine', (t) => f0 * (1 + t * 14));
  envelope(d, sr, adExp(0.001, 0.012));
  mixInto(out, d, sr, 0, 1);
  echo(out, sr, 0.18, 0.45, 0.6);
  reverb(out, sr, 0.9, 0.4);
  return fadeEdges(normalize(out, 0.4), sr);
}

/** Buzina de trem distante ecoando pelos túneis. */
export function trainHorn(sr: number, _r: Rng): Float32Array {
  const dur = 3;
  const out = buffer(sr, dur);
  for (const f of [277, 349, 415]) osc(out, sr, 'saw', () => f, 0.25);
  lowpass(out, sr, 900);
  envelope(out, sr, (t) => Math.min(1, t / 0.4) * Math.min(1, (2.2 - t) / 0.6) * (t < 2.2 ? 1 : 0));
  reverb(out, sr, 0.97, 0.7, 0.3);
  return fadeEdges(normalize(out, 0.5), sr);
}

/** Rangido metálico lento. */
export function creak(sr: number, r: Rng): Float32Array {
  const dur = range(r, 1.2, 2);
  const out = buffer(sr, dur);
  const f0 = range(r, 300, 520);
  osc(out, sr, 'saw', (t) => f0 * (1 + 0.3 * Math.sin(t * 2.2)) + 20 * Math.sin(t * 60), 0.4);
  // "stick-slip": pulsos irregulares
  envelope(out, sr, (t) => (0.5 + 0.5 * Math.sin(t * 90 + Math.sin(t * 13) * 4)) * Math.sin((t / dur) * Math.PI));
  bandpass(out, sr, 1400, 1.5);
  reverb(out, sr, 0.9, 0.5);
  return fadeEdges(normalize(out, 0.35), sr);
}

/** Gemido distante (zumbi longe, abafado e com eco). */
export function distantMoan(sr: number, r: Rng): Float32Array {
  const out = buffer(sr, 2.6);
  const src = buffer(sr, 1.6);
  osc(src, sr, 'saw', (t) => range(r, 90, 120) * (1 - t * 0.2) * (1 + 0.04 * Math.sin(t * 30)));
  pink(src, r, 0.3);
  bandpass(src, sr, 600, 2);
  envelope(src, sr, (t) => Math.sin((t / 1.6) * Math.PI));
  mixInto(out, src, sr, 0, 1);
  lowpass(out, sr, 1000);
  reverb(out, sr, 0.97, 0.65, 0.3);
  return fadeEdges(normalize(out, 0.35), sr);
}

/** Vapor escapando (manutenção). */
export function steamHiss(sr: number, r: Rng): Float32Array {
  const dur = range(r, 1, 1.8);
  const out = buffer(sr, dur);
  white(out, r);
  highpass(out, sr, 3000);
  envelope(out, sr, (t) => Math.min(1, t / 0.05) * Math.exp(-t / (dur * 0.5)));
  return fadeEdges(normalize(out, 0.3), sr);
}

export { brown };
