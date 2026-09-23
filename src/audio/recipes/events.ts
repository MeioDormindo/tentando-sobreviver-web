import {
  adExp, bandpass, brown, buffer, drive, envelope, fadeEdges, formants, highpass, lowpass, makeLoop, mixInto, normalize, osc,
  pink, range, resonantHit, reverb, white, type Rng,
} from '../dsp';

// Sons dos eventos dinâmicos (GDD §48): sirene, apagão, trem, suprimentos, gás e horda.

/** Sirene de emergência (loop de 4 s): varredura sobe/desce com eco do terminal. */
export function siren(sr: number, _r: Rng): Float32Array {
  const period = 2;
  const len = period * 2 + 0.6;
  const out = buffer(sr, len);
  const f = (t: number) => 620 + 360 * (0.5 - 0.5 * Math.cos(((t % period) / period) * Math.PI * 2));
  osc(out, sr, 'saw', f, 0.5);
  osc(out, sr, 'square', (t) => f(t) * 1.005, 0.25);
  lowpass(out, sr, 2600);
  bandpass(out, sr, 900, 0.6);
  reverb(out, sr, 0.8, 0.35, 0.4);
  return normalize(makeLoop(out, sr, 0.6), 0.75);
}

/** Queda de energia: estalo do disjuntor e o zumbido elétrico morrendo. */
export function powerDown(sr: number, r: Rng): Float32Array {
  const out = buffer(sr, 2.2);
  mixInto(out, resonantHit(sr, r, [{ f: 180, q: 4, gain: 1 }, { f: 950, q: 8, gain: 0.5 }], 0.3, 0.006), sr, 0, 1.4);
  const hum = buffer(sr, 2);
  for (const [k, g] of [[1, 1], [2, 0.5], [3, 0.3]] as const) osc(hum, sr, 'sine', (t) => 60 * k * (1 - 0.45 * t), g);
  envelope(hum, sr, (t) => Math.max(0, 1 - t / 1.8));
  mixInto(out, hum, sr, 0.05, 0.9);
  reverb(out, sr, 0.85, 0.35, 0.3);
  return fadeEdges(normalize(out, 0.8), sr);
}

/** Energia voltando: zumbido subindo e as luminárias acendendo em estalos. */
export function powerUpSurge(sr: number, r: Rng): Float32Array {
  const out = buffer(sr, 2);
  const hum = buffer(sr, 1.6);
  for (const [k, g] of [[1, 1], [2, 0.5], [3, 0.3]] as const) osc(hum, sr, 'sine', (t) => 60 * k * (0.55 + 0.45 * Math.min(1, t / 0.9)), g);
  envelope(hum, sr, (t) => Math.min(1, t / 0.4) * Math.max(0, 1 - Math.max(0, t - 1) / 0.6));
  mixInto(out, hum, sr, 0, 0.8);
  for (let i = 0; i < 5; i++) mixInto(out, resonantHit(sr, r, [{ f: range(r, 1800, 2600), q: 9, gain: 1 }], 0.08, 0.002), sr, 0.3 + i * range(r, 0.12, 0.2), 0.6);
  reverb(out, sr, 0.7, 0.3, 0.4);
  return fadeEdges(normalize(out, 0.75), sr);
}

/** Trem passando (loop de 3 s): ronco grave, rodas batendo nos trilhos e chiado. */
export function trainPass(sr: number, r: Rng): Float32Array {
  const len = 3.5;
  const out = buffer(sr, len);
  const rum = buffer(sr, len);
  brown(rum, r);
  lowpass(rum, sr, 160);
  mixInto(out, rum, sr, 0, 3);
  const air = buffer(sr, len);
  pink(air, r);
  bandpass(air, sr, 1400, 0.6);
  mixInto(out, air, sr, 0, 0.5);
  // "ta-dam ta-dam" das rodas nas emendas
  for (let t = 0.05; t < len - 0.2; t += 0.36) {
    mixInto(out, resonantHit(sr, r, [{ f: 140, q: 3, gain: 1 }, { f: 520, q: 6, gain: 0.5 }], 0.12, 0.004), sr, t, 1.2);
    mixInto(out, resonantHit(sr, r, [{ f: 150, q: 3, gain: 1 }, { f: 560, q: 6, gain: 0.5 }], 0.12, 0.004), sr, t + 0.1, 1);
  }
  drive(out, 1.5);
  return normalize(makeLoop(out, sr, 0.5), 0.9);
}

/** Buzina forte do trem se aproximando (dois tons). */
export function trainWarning(sr: number, _r: Rng): Float32Array {
  const out = buffer(sr, 2.6);
  for (const [f, g] of [[311, 1], [370, 0.8], [466, 0.5]] as const) {
    const tone = buffer(sr, 2.2);
    osc(tone, sr, 'saw', () => f, g);
    envelope(tone, sr, (t) => Math.min(1, t / 0.05) * (t < 0.9 || t > 1.1 ? 1 : 0.2) * Math.max(0, 1 - Math.max(0, t - 1.9) / 0.3));
    mixInto(out, tone, sr, 0, 1);
  }
  lowpass(out, sr, 2200);
  reverb(out, sr, 0.9, 0.4, 0.3);
  return fadeEdges(normalize(out, 0.9), sr);
}

/** Avião passando para soltar os suprimentos. */
export function supplyPlane(sr: number, r: Rng): Float32Array {
  const len = 4;
  const out = buffer(sr, len);
  const drone = buffer(sr, len);
  osc(drone, sr, 'saw', (t) => 92 * (1 + 0.04 * (1 - t / len)), 0.6);
  osc(drone, sr, 'saw', (t) => 184 * (1 + 0.04 * (1 - t / len)), 0.3);
  lowpass(drone, sr, 700);
  const wind = buffer(sr, len);
  pink(wind, r, 0.6);
  bandpass(wind, sr, 800, 0.7);
  mixInto(drone, wind, sr, 0, 1);
  envelope(drone, sr, (t) => Math.sin((t / len) * Math.PI));
  mixInto(out, drone, sr, 0, 1);
  reverb(out, sr, 0.8, 0.3, 0.4);
  return fadeEdges(normalize(out, 0.7), sr, 0.2, 0.3);
}

/** Caixa batendo no chão. */
export function crateLand(sr: number, r: Rng): Float32Array {
  const out = buffer(sr, 0.8);
  const thud = buffer(sr, 0.4);
  osc(thud, sr, 'sine', (t) => 70 * (1 + 1.5 * Math.exp(-t / 0.02)));
  envelope(thud, sr, adExp(0.001, 0.08));
  mixInto(out, thud, sr, 0, 1.5);
  mixInto(out, resonantHit(sr, r, [{ f: 240, q: 5, gain: 1 }, { f: 610, q: 7, gain: 0.6 }], 0.3, 0.008), sr, 0, 1);
  const dust = buffer(sr, 0.5);
  white(dust, r, 0.4);
  envelope(dust, sr, adExp(0.005, 0.12));
  lowpass(dust, sr, 1800);
  mixInto(out, dust, sr, 0.01, 0.6);
  reverb(out, sr, 0.6, 0.25, 0.4);
  return fadeEdges(normalize(out, 0.85), sr);
}

/** Vazamento de gás (loop de 3 s): chiado forte com pulsos de pressão. */
export function gasHiss(sr: number, r: Rng): Float32Array {
  const len = 3.5;
  const out = buffer(sr, len);
  white(out, r);
  highpass(out, sr, 2200);
  bandpass(out, sr, (t) => 4200 + 900 * Math.sin(t * 5.3), 0.8);
  envelope(out, sr, (t) => 0.75 + 0.25 * Math.sin(t * 2.2) * Math.sin(t * 7.1));
  return normalize(makeLoop(out, sr, 0.5), 0.6);
}

/** Rugido de uma horda: vários gemidos sobrepostos ao longe. */
export function hordeRoar(sr: number, r: Rng): Float32Array {
  const len = 3.2;
  const out = buffer(sr, len);
  for (let i = 0; i < 9; i++) {
    const d = range(r, 1.2, 2.4);
    const v = buffer(sr, d);
    const f0 = range(r, 85, 150);
    osc(v, sr, 'saw', (t) => f0 * (1 + 0.15 * Math.sin(t * range(r, 3, 7))), 0.8);
    white(v, r, 0.25);
    formants(v, sr, [{ f: range(r, 450, 700), q: 5, gain: 1 }, { f: range(r, 900, 1300), q: 7, gain: 0.6 }]);
    envelope(v, sr, (t) => Math.sin(Math.min(1, t / d) * Math.PI));
    mixInto(out, v, sr, range(r, 0, len - d), range(r, 0.5, 1));
  }
  lowpass(out, sr, 1600);
  drive(out, 2);
  reverb(out, sr, 0.9, 0.45, 0.35);
  return fadeEdges(normalize(out, 0.85), sr, 0.05, 0.3);
}
