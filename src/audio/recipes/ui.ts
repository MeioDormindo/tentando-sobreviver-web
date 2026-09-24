import {
  adExp, biquad, buffer, envelope, fadeEdges, lowpass, mixInto, normalize, osc, range, resonantHit, reverb, white, type Rng,
} from '../dsp';

/** Nota de sino/caixinha de música (parciais inarmônicas). */
function bell(sr: number, freq: number, dur: number, bright = 1): Float32Array {
  const out = buffer(sr, dur);
  const partials: Array<[number, number, number]> = [[1, 1, 0.6], [2.76, 0.5 * bright, 0.3], [5.4, 0.25 * bright, 0.15], [8.93, 0.12 * bright, 0.08]];
  for (const [ratio, gain, tau] of partials) {
    const p = buffer(sr, dur);
    osc(p, sr, 'sine', () => freq * ratio);
    envelope(p, sr, adExp(0.002, tau * dur * 2));
    mixInto(out, p, sr, 0, gain);
  }
  return out;
}

const note = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

/** Compra: sino de caixa registradora + moedas. */
export function purchase(sr: number, r: Rng): Float32Array {
  const out = buffer(sr, 0.8);
  mixInto(out, bell(sr, 1760, 0.7), sr, 0, 0.8);
  mixInto(out, bell(sr, 2349, 0.6), sr, 0.07, 0.6);
  for (let i = 0; i < 5; i++) {
    const coin = resonantHit(sr, r, [{ f: range(r, 3500, 5200), q: 25, gain: 1 }], 0.12, 0.001);
    mixInto(out, coin, sr, 0.12 + i * range(r, 0.03, 0.06), 0.4);
  }
  return fadeEdges(normalize(out, 0.6), sr);
}

/** Sem dinheiro: zumbido grave curto. */
export function denied(sr: number, _r: Rng): Float32Array {
  const out = buffer(sr, 0.3);
  osc(out, sr, 'square', () => 110, 0.5);
  osc(out, sr, 'square', () => 116, 0.5);
  lowpass(out, sr, 1400);
  envelope(out, sr, (t) => (t < 0.26 ? 1 : 0) * (Math.floor(t / 0.13) % 2 === 0 ? 1 : 0.4));
  return fadeEdges(normalize(out, 0.45), sr);
}

/** Mystery Box: melodia de caixinha de música em tom menor (≈3 s). */
export function boxMusic(sr: number, _r: Rng): Float32Array {
  const melody = [69, 72, 76, 74, 72, 71, 72, 69, 64, 69, 71, 72, 74, 72];
  const step = 0.2;
  const out = buffer(sr, melody.length * step + 1);
  melody.forEach((m, i) => mixInto(out, bell(sr, note(m + 12), 0.9, 0.8), sr, i * step, 0.5));
  reverb(out, sr, 0.8, 0.3);
  return fadeEdges(normalize(out, 0.55), sr);
}

/** Revelação da arma: acorde brilhante. */
export function boxReveal(sr: number, _r: Rng): Float32Array {
  const out = buffer(sr, 1.4);
  [69, 73, 76, 81].forEach((m, i) => mixInto(out, bell(sr, note(m + 12), 1.3), sr, i * 0.04, 0.5));
  reverb(out, sr, 0.8, 0.35);
  return fadeEdges(normalize(out, 0.6), sr);
}

/** Mystery Box indo embora: caixinha de música descendo, desafinando, e um sopro. */
export function boxMove(sr: number, r: Rng): Float32Array {
  const out = buffer(sr, 2.4);
  [81, 78, 74, 69, 66, 62].forEach((m, i) => mixInto(out, bell(sr, note(m) * (1 - i * 0.012), 0.9), sr, i * 0.18, 0.45));
  const whoosh = buffer(sr, 1.2);
  white(whoosh, r, 0.6);
  lowpass(whoosh, sr, (t) => 300 + 2400 * Math.sin(Math.min(1, t / 1.2) * Math.PI));
  envelope(whoosh, sr, (t) => Math.sin(Math.min(1, t / 1.2) * Math.PI));
  mixInto(out, whoosh, sr, 0.9, 0.7);
  reverb(out, sr, 0.85, 0.35);
  return fadeEdges(normalize(out, 0.65), sr);
}

/** Weapon Lab: zumbido elétrico subindo + descarga. */
export function labUpgrade(sr: number, r: Rng): Float32Array {
  const dur = 1.6;
  const out = buffer(sr, dur);
  osc(out, sr, 'saw', (t) => 60 + t * t * 500, 0.6);
  osc(out, sr, 'square', (t) => 120 + t * t * 900, 0.3);
  lowpass(out, sr, (t) => 400 + t * 3000);
  envelope(out, sr, (t) => Math.min(1, t / 1.2) * (t < 1.35 ? 1 : Math.max(0, (dur - t) / 0.25)));
  const zap = buffer(sr, 0.3);
  white(zap, r);
  envelope(zap, sr, adExp(0.001, 0.06));
  mixInto(out, zap, sr, 1.3, 1);
  mixInto(out, bell(sr, note(88), 0.5), sr, 1.32, 0.4);
  reverb(out, sr, 0.7, 0.25);
  return fadeEdges(normalize(out, 0.75), sr);
}

/** Perk comprado: jingle curto ascendente. */
export function perkJingle(sr: number, _r: Rng): Float32Array {
  const notes = [60, 64, 67, 72];
  const out = buffer(sr, 1.2);
  notes.forEach((m, i) => {
    const n = buffer(sr, 0.35);
    osc(n, sr, 'triangle', () => note(m + 12), 0.7);
    osc(n, sr, 'square', () => note(m + 12) * 1.005, 0.12);
    envelope(n, sr, adExp(0.005, 0.12));
    mixInto(out, n, sr, i * 0.09, 0.6);
  });
  reverb(out, sr, 0.6, 0.25);
  return fadeEdges(normalize(out, 0.6), sr);
}

/** Power-up coletado: arpejo cintilante. */
export function powerUp(sr: number, _r: Rng): Float32Array {
  const out = buffer(sr, 1.1);
  [72, 76, 79, 84, 88].forEach((m, i) => mixInto(out, bell(sr, note(m), 0.6, 1.2), sr, i * 0.05, 0.5));
  reverb(out, sr, 0.7, 0.3);
  return fadeEdges(normalize(out, 0.65), sr);
}

/** Início da wave: sino grave com eco longo. */
export function waveStart(sr: number, _r: Rng): Float32Array {
  const out = buffer(sr, 4);
  mixInto(out, bell(sr, 98, 3.5, 0.9), sr, 0, 1);
  mixInto(out, bell(sr, 98 * 1.5, 3, 0.5), sr, 0, 0.25);
  reverb(out, sr, 0.95, 0.45, 0.3);
  return fadeEdges(normalize(out, 0.7), sr);
}

/** Fim da wave: onda suave subindo + sino. */
export function waveEnd(sr: number, r: Rng): Float32Array {
  const dur = 2.4;
  const out = buffer(sr, dur);
  white(out, r, 0.3);
  lowpass(out, sr, (t) => 200 + t * 1400);
  envelope(out, sr, (t) => (t < 1 ? t : Math.max(0, 1 - (t - 1) / 1.2)) * 0.5);
  mixInto(out, bell(sr, note(64), 1.3), sr, 0.9, 0.5);
  mixInto(out, bell(sr, note(71), 1.3), sr, 0.95, 0.35);
  reverb(out, sr, 0.8, 0.35);
  return fadeEdges(normalize(out, 0.55), sr);
}

/** Alarme de boss: sirene de dois tons. */
export function bossWarning(sr: number, _r: Rng): Float32Array {
  const dur = 3;
  const out = buffer(sr, dur);
  osc(out, sr, 'saw', (t) => (Math.floor(t / 0.45) % 2 === 0 ? 620 : 470), 0.5);
  osc(out, sr, 'square', (t) => (Math.floor(t / 0.45) % 2 === 0 ? 310 : 235), 0.2);
  lowpass(out, sr, 2200);
  envelope(out, sr, (t) => Math.min(1, t / 0.05) * Math.min(1, (dur - t) / 0.4));
  reverb(out, sr, 0.9, 0.35);
  return fadeEdges(normalize(out, 0.6), sr);
}

/** Bipe curto (liga/desliga som). */
export function uiBeep(sr: number, _r: Rng): Float32Array {
  const out = buffer(sr, 0.12);
  osc(out, sr, 'sine', () => 880, 0.6);
  envelope(out, sr, adExp(0.003, 0.03));
  return fadeEdges(normalize(out, 0.4), sr);
}

/** Easter egg dos ursinhos: canção de ninar de caixinha de música, meio desafinada. */
export function secretSong(sr: number, r: Rng): Float32Array {
  // Brilha, brilha, estrelinha (Dó maior), notas em semínimas
  const melody = [60, 60, 67, 67, 69, 69, 67, -1, 65, 65, 64, 64, 62, 62, 60];
  const beat = 0.32;
  const out = buffer(sr, melody.length * beat + 1.6);
  melody.forEach((m, i) => {
    if (m < 0) return;
    const detune = 1 + range(r, -0.012, 0.012);
    mixInto(out, bell(sr, note(m + 12) * detune, 1.2, 0.8), sr, i * beat, 0.7);
  });
  return fadeEdges(normalize(reverb(out, sr, 0.7, 0.35), 0.6), sr);
}

/** Rádio: estática com chiado sintonizando. */
export function radioStatic(sr: number, r: Rng): Float32Array {
  const out = white(buffer(sr, 1.4), r, 1);
  biquad(out, sr, 'bandpass', (t) => 1400 + 900 * Math.sin(t * 9), 1.2);
  envelope(out, sr, (t) => (t < 0.05 ? t / 0.05 : 1) * (0.55 + 0.45 * Math.abs(Math.sin(t * 23))) * (t > 1.2 ? (1.4 - t) / 0.2 : 1));
  const tone = buffer(sr, 1.4);
  osc(tone, sr, 'sine', (t) => 900 + 300 * Math.sin(t * 5), 0.15);
  mixInto(out, tone, sr, 0, 1);
  return fadeEdges(normalize(out, 0.45), sr);
}
