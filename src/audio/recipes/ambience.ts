import {
  adExp, bandpass, brown, buffer, echo, envelope, highpass, lowpass, makeLoop, mixInto, normalize, osc, pink, range,
  resonantHit, reverb, white, type Rng,
} from '../dsp';

/** Duração dos loops (s) + sobreposição usada para emendar o fim ao começo. */
const LOOP = 14;
const XFADE = 1.5;
const total = LOOP + XFADE;

/** Zumbido elétrico: fundamental da rede + harmônicos, com leve oscilação. */
function hum(out: Float32Array, sr: number, base: number, gain: number, flicker = 0): void {
  const h = buffer(sr, total);
  for (const [k, g] of [[1, 1], [2, 0.5], [3, 0.35], [4, 0.2], [6, 0.12]] as const) osc(h, sr, 'sine', () => base * k, g);
  if (flicker > 0) envelope(h, sr, (t) => 1 - flicker * (0.5 + 0.5 * Math.sin(t * 3.1) * Math.sin(t * 7.3)));
  mixInto(out, h, sr, 0, gain);
}

/** Vento em túnel: ruído rosa em faixa que "respira" devagar. */
function wind(out: Float32Array, sr: number, r: Rng, gain: number, center = 500): void {
  const w = buffer(sr, total);
  pink(w, r);
  const p1 = r() * 6;
  bandpass(w, sr, (t) => center * (1 + 0.5 * Math.sin(t * 0.45 + p1) + 0.2 * Math.sin(t * 1.3)), 0.9);
  envelope(w, sr, (t) => 0.6 + 0.4 * Math.sin(t * 0.3 + p1));
  mixInto(out, w, sr, 0, gain);
}

/** Ronco grave distante. */
function rumble(out: Float32Array, sr: number, r: Rng, gain: number, cutoff = 90): void {
  const b = buffer(sr, total);
  brown(b, r);
  lowpass(b, sr, cutoff);
  mixInto(out, b, sr, 0, gain);
}

/** Gotas espalhadas com eco. */
function drips(out: Float32Array, sr: number, r: Rng, count: number, gain: number): void {
  for (let i = 0; i < count; i++) {
    const d = buffer(sr, 0.06);
    const f0 = range(r, 900, 1700);
    osc(d, sr, 'sine', (t) => f0 * (1 + t * 14));
    envelope(d, sr, adExp(0.001, 0.012));
    mixInto(out, d, sr, range(r, 0, LOOP), gain * range(r, 0.4, 1));
  }
}

/** Estalos de estática de rádio. */
function staticCrackle(out: Float32Array, sr: number, r: Rng, density: number, gain: number): void {
  const s = buffer(sr, total);
  let burst = 0;
  for (let i = 0; i < s.length; i++) {
    if (r() < density) burst = Math.floor(range(r, 20, 400));
    if (burst > 0) {
      s[i] = r() * 2 - 1;
      burst--;
    }
  }
  bandpass(s, sr, 2200, 0.8);
  mixInto(out, s, sr, 0, gain);
}

function finish(out: Float32Array, sr: number, peak: number, room = 0): Float32Array {
  if (room > 0) reverb(out, sr, 0.9, room, 0.4);
  return normalize(makeLoop(out, sr, XFADE), peak);
}

/** Loops de ambiente por área (GDD §58: estação, vento, metal, geradores, água, tubos). */
export const ambience: Record<string, (sr: number, r: Rng) => Float32Array> = {
  // Hall: tom de sala grande, lâmpadas fluorescentes zumbindo, gotas distantes
  hall: (sr, r) => {
    const out = buffer(sr, total);
    rumble(out, sr, r, 0.5, 120);
    hum(out, sr, 120, 0.05, 0.6);
    wind(out, sr, r, 0.12, 350);
    drips(out, sr, r, 5, 0.25);
    return finish(out, sr, 0.5, 0.3);
  },
  // Plataforma: vento no túnel dos trilhos e ronco distante
  platform: (sr, r) => {
    const out = buffer(sr, total);
    wind(out, sr, r, 0.6, 450);
    wind(out, sr, r, 0.3, 1100);
    rumble(out, sr, r, 0.7, 70);
    return finish(out, sr, 0.55, 0.2);
  },
  // Bilheteria: zumbido elétrico e rádio chiando
  ticket: (sr, r) => {
    const out = buffer(sr, total);
    rumble(out, sr, r, 0.35, 110);
    hum(out, sr, 60, 0.1, 0.2);
    staticCrackle(out, sr, r, 0.00012, 0.08);
    return finish(out, sr, 0.45, 0.25);
  },
  // Lojas: sistema de som quebrado tocando um acorde distorcido + estática
  shops: (sr, r) => {
    const out = buffer(sr, total);
    rumble(out, sr, r, 0.3, 110);
    const pa = buffer(sr, total);
    for (const f of [196, 246.9, 293.7]) osc(pa, sr, 'triangle', (t) => f * (1 + 0.006 * Math.sin(t * 0.7)), 0.3);
    envelope(pa, sr, (t) => 0.3 + 0.7 * Math.max(0, Math.sin(t * 0.5)) * (Math.sin(t * 23) > -0.3 ? 1 : 0.2));
    bandpass(pa, sr, 900, 0.7);
    mixInto(out, pa, sr, 0, 0.12);
    staticCrackle(out, sr, r, 0.0002, 0.1);
    return finish(out, sr, 0.45, 0.3);
  },
  // Área técnica: gerador pulsando e chiado de tubulação
  tech: (sr, r) => {
    const out = buffer(sr, total);
    const gen = buffer(sr, total);
    for (const [k, g] of [[1, 1], [2, 0.6], [3, 0.4], [5, 0.2]] as const) osc(gen, sr, 'saw', () => 50 * k, g);
    lowpass(gen, sr, 400);
    envelope(gen, sr, (t) => 0.75 + 0.25 * Math.sin(t * 2 * Math.PI * 7.5));
    mixInto(out, gen, sr, 0, 0.25);
    const pipes = buffer(sr, total);
    white(pipes, r);
    highpass(pipes, sr, 4000);
    envelope(pipes, sr, (t) => 0.4 + 0.6 * Math.max(0, Math.sin(t * 0.8)));
    mixInto(out, pipes, sr, 0, 0.05);
    rumble(out, sr, r, 0.4, 90);
    return finish(out, sr, 0.5, 0.15);
  },
  // Túneis: drone grave, gotas com eco, vento fraco
  tunnels: (sr, r) => {
    const out = buffer(sr, total);
    rumble(out, sr, r, 0.8, 60);
    osc(out, sr, 'sine', (t) => 41 + Math.sin(t * 0.2) * 2, 0.08);
    wind(out, sr, r, 0.2, 300);
    const d = buffer(sr, total);
    drips(d, sr, r, 9, 0.5);
    echo(d, sr, 0.23, 0.5, 0.7);
    mixInto(out, d, sr, 0, 1);
    return finish(out, sr, 0.55, 0.45);
  },
  // Manutenção: máquinas batendo em ritmo, vapor e zumbido
  maintenance: (sr, r) => {
    const out = buffer(sr, total);
    rumble(out, sr, r, 0.4, 100);
    hum(out, sr, 55, 0.08, 0.1);
    for (let t = 0.3; t < LOOP; t += 1.4) {
      const clank = resonantHit(sr, r, [{ f: 180, q: 5, gain: 1 }, { f: 620, q: 9, gain: 0.5 }, { f: 1500, q: 14, gain: 0.25 }], 0.5, 0.006);
      mixInto(out, clank, sr, t, 0.25);
      mixInto(out, clank, sr, t + 0.35, 0.15);
    }
    const steam = buffer(sr, total);
    white(steam, r);
    highpass(steam, sr, 3500);
    envelope(steam, sr, (t) => Math.pow(Math.max(0, Math.sin(t * 0.9)), 6));
    mixInto(out, steam, sr, 0, 0.12);
    return finish(out, sr, 0.5, 0.25);
  },

  // ── Hospital Santa Luzia ──
  // Recepção: fluorescentes zumbindo, sistema de chamada com "bip-bip" distante
  reception: (sr, r) => {
    const out = buffer(sr, total);
    rumble(out, sr, r, 0.35, 120);
    hum(out, sr, 120, 0.07, 0.8);
    for (let t = 2; t < LOOP; t += 6) {
      for (const [dt, f0] of [[0, 880], [0.35, 660]] as const) {
        const b = buffer(sr, 0.3);
        osc(b, sr, 'sine', () => f0, 1);
        envelope(b, sr, adExp(0.005, 0.12));
        bandpass(b, sr, 1200, 0.8);
        mixInto(out, b, sr, t + dt, 0.1);
      }
    }
    drips(out, sr, r, 3, 0.15);
    return finish(out, sr, 0.45, 0.35);
  },
  // Enfermaria/UTI: monitor cardíaco bipando (às vezes some) e respirador
  ward: (sr, r) => {
    const out = buffer(sr, total);
    rumble(out, sr, r, 0.3, 110);
    hum(out, sr, 60, 0.05, 0.2);
    for (let t = 0.5; t < LOOP - 3; t += 0.9) {
      const b = buffer(sr, 0.12);
      osc(b, sr, 'sine', () => 1050, 1);
      envelope(b, sr, adExp(0.002, 0.04));
      mixInto(out, b, sr, t, 0.12);
    }
    const flat = buffer(sr, 2.4);
    osc(flat, sr, 'sine', () => 1050, 1);
    envelope(flat, sr, (t) => (t < 2.2 ? 1 : (2.4 - t) / 0.2));
    mixInto(out, flat, sr, LOOP - 2.6, 0.06);
    const vent = buffer(sr, total);
    pink(vent, r);
    bandpass(vent, sr, 700, 1);
    envelope(vent, sr, (t) => Math.pow(Math.max(0, Math.sin(t * 1.1)), 3));
    mixInto(out, vent, sr, 0, 0.1);
    return finish(out, sr, 0.45, 0.25);
  },
  // Necrotério: compressor das geladeiras, gotas e silêncio pesado
  morgue: (sr, r) => {
    const out = buffer(sr, total);
    rumble(out, sr, r, 0.5, 80);
    const comp = buffer(sr, total);
    for (const [k, g] of [[1, 1], [2, 0.5], [3, 0.2]] as const) osc(comp, sr, 'saw', () => 47 * k, g);
    lowpass(comp, sr, 300);
    envelope(comp, sr, (t) => (t % 7 < 4.5 ? 1 : 0.15));
    mixInto(out, comp, sr, 0, 0.18);
    const d = buffer(sr, total);
    drips(d, sr, r, 6, 0.4);
    echo(d, sr, 0.18, 0.45, 0.6);
    mixInto(out, d, sr, 0, 1);
    return finish(out, sr, 0.5, 0.4);
  },
  // Laboratório: líquido borbulhando nas câmaras, zumbido elétrico e alarme fraco
  lab: (sr, r) => {
    const out = buffer(sr, total);
    rumble(out, sr, r, 0.4, 90);
    hum(out, sr, 100, 0.07, 0.3);
    for (let i = 0; i < 60; i++) {
      const b = buffer(sr, 0.08);
      const f0 = range(r, 300, 700);
      osc(b, sr, 'sine', (t) => f0 * (1 + t * 8), 1);
      envelope(b, sr, adExp(0.002, 0.02));
      mixInto(out, b, sr, range(r, 0, LOOP), range(r, 0.05, 0.14));
    }
    const alarm = buffer(sr, total);
    osc(alarm, sr, 'triangle', (t) => 520 + 120 * Math.sin(t * 2.5), 1);
    envelope(alarm, sr, (t) => 0.5 + 0.5 * Math.sin(t * 2.5));
    lowpass(alarm, sr, 1400);
    mixInto(out, alarm, sr, 0, 0.025);
    return finish(out, sr, 0.5, 0.35);
  },
};
