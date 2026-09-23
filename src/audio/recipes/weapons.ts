import {
  adExp, bandpass, buffer, drive, envelope, fadeEdges, highpass, lowpass, mixInto, normalize, osc, pink, range,
  resonantHit, reverb, white, type Rng,
} from '../dsp';

/** Timbre de cada disparo. */
interface ShotSpec {
  /** Frequência do "corpo" do tiro (Hz): grave = mais pesado. */
  body: number;
  bodyQ: number;
  /** Decaimento do corpo (s). */
  tau: number;
  /** Batida grave (Hz) e seu volume. */
  thump: number;
  thumpGain: number;
  /** Cauda/eco (s). */
  tail: number;
  bright: number;
  crack: number;
  drive: number;
}

export const SHOT_SPECS: Record<string, ShotSpec> = {
  m1911: { body: 900, bodyQ: 1.2, tau: 0.03, thump: 70, thumpGain: 0.9, tail: 0.12, bright: 1, crack: 0.6, drive: 2.5 },
  glock: { body: 1400, bodyQ: 1.4, tau: 0.022, thump: 90, thumpGain: 0.6, tail: 0.09, bright: 1.3, crack: 0.8, drive: 2 },
  mp5: { body: 1600, bodyQ: 1.3, tau: 0.018, thump: 95, thumpGain: 0.5, tail: 0.07, bright: 1.2, crack: 0.7, drive: 2.2 },
  vector: { body: 2100, bodyQ: 1.5, tau: 0.014, thump: 115, thumpGain: 0.4, tail: 0.06, bright: 1.5, crack: 0.9, drive: 2 },
  m4: { body: 1300, bodyQ: 1, tau: 0.025, thump: 75, thumpGain: 0.7, tail: 0.15, bright: 1.7, crack: 1.3, drive: 3 },
  ak: { body: 720, bodyQ: 0.9, tau: 0.036, thump: 58, thumpGain: 1, tail: 0.19, bright: 1, crack: 0.9, drive: 3.5 },
  pump: { body: 480, bodyQ: 0.7, tau: 0.065, thump: 48, thumpGain: 1.3, tail: 0.32, bright: 0.8, crack: 0.7, drive: 3 },
  combat_shotgun: { body: 580, bodyQ: 0.8, tau: 0.05, thump: 54, thumpGain: 1.1, tail: 0.24, bright: 0.9, crack: 0.8, drive: 3 },
  rpk: { body: 680, bodyQ: 0.9, tau: 0.04, thump: 55, thumpGain: 1.1, tail: 0.21, bright: 1.1, crack: 1, drive: 3.5 },
};

function gunshot(sr: number, r: Rng, spec: ShotSpec): Float32Array {
  const jitter = (v: number) => v * range(r, 0.92, 1.08);
  const body = jitter(spec.body);
  const tau = jitter(spec.tau);
  const out = buffer(sr, 0.12 + spec.tail * 4 + 0.35);

  // Estalo inicial (onda de choque)
  const crack = buffer(sr, 0.02);
  white(crack, r);
  envelope(crack, sr, adExp(0.0002, 0.0025));
  highpass(crack, sr, 2500);
  mixInto(out, crack, sr, 0, spec.crack * 1.5);

  // Corpo ressonante do disparo
  const bodyBuf = buffer(sr, tau * 7);
  white(bodyBuf, r);
  envelope(bodyBuf, sr, adExp(0.0006, tau));
  bandpass(bodyBuf, sr, (t) => body * (1 - Math.min(0.5, t * 4)), spec.bodyQ);
  mixInto(out, bodyBuf, sr, 0, 3);

  // Batida grave (pressão)
  const thump = buffer(sr, 0.25);
  osc(thump, sr, 'sine', (t) => spec.thump * (1 + 2.5 * Math.exp(-t / 0.012)));
  envelope(thump, sr, adExp(0.001, 0.05));
  mixInto(out, thump, sr, 0, spec.thumpGain);

  // Cauda (ar deslocado + ambiente)
  const tail = buffer(sr, spec.tail * 5);
  pink(tail, r);
  envelope(tail, sr, adExp(0.004, spec.tail));
  lowpass(tail, sr, 1600 * spec.bright);
  mixInto(out, tail, sr, 0.004, 1.2);

  drive(out, spec.drive);
  reverb(out, sr, 0.55, 0.2, 0.45);
  return fadeEdges(normalize(out, 0.95), sr, 0.0005, 0.05);
}

/** Pump: mecanismo "chk-chk" logo após o tiro. */
function pumpAction(sr: number, r: Rng): Float32Array {
  const out = buffer(sr, 0.45);
  const back = resonantHit(sr, r, [{ f: 1800, q: 6, gain: 1 }, { f: 3400, q: 8, gain: 0.6 }, { f: 700, q: 3, gain: 0.8 }], 0.12, 0.008);
  const fwd = resonantHit(sr, r, [{ f: 1500, q: 6, gain: 1 }, { f: 2900, q: 8, gain: 0.7 }, { f: 600, q: 3, gain: 0.9 }], 0.12, 0.006);
  const slide = buffer(sr, 0.08);
  white(slide, r, 0.4);
  envelope(slide, sr, (t) => Math.sin((t / 0.08) * Math.PI));
  bandpass(slide, sr, 2400, 1.5);
  mixInto(out, back, sr, 0, 1);
  mixInto(out, slide, sr, 0.03, 1);
  mixInto(out, fwd, sr, 0.16, 1);
  return out;
}

export function shot(id: string) {
  return (sr: number, r: Rng): Float32Array => {
    if (id === 'rail') return railShot(sr, r);
    const out = gunshot(sr, r, SHOT_SPECS[id] ?? SHOT_SPECS.m1911);
    if (id === 'pump') {
      const withPump = buffer(sr, Math.max(out.length / sr, 0.8));
      mixInto(withPump, out, sr, 0, 1);
      mixInto(withPump, pumpAction(sr, r), sr, 0.34, 0.5);
      return withPump;
    }
    return out;
  };
}

/** Rail Weapon: descarga elétrica — varredura aguda, estalos e estrondo grave. */
function railShot(sr: number, r: Rng): Float32Array {
  const out = buffer(sr, 1.1);
  const zap = buffer(sr, 0.4);
  osc(zap, sr, 'saw', (t) => 3200 * Math.exp(-t * 9) + 180);
  osc(zap, sr, 'square', (t) => 1600 * Math.exp(-t * 7) + 90, 0.4);
  envelope(zap, sr, adExp(0.001, 0.09));
  lowpass(zap, sr, 6000);
  mixInto(out, zap, sr, 0, 0.8);
  const crackle = buffer(sr, 0.3);
  for (let i = 0; i < crackle.length; i++) if (r() < 0.02) crackle[i] = r() * 2 - 1;
  envelope(crackle, sr, adExp(0.001, 0.08));
  highpass(crackle, sr, 3000);
  mixInto(out, crackle, sr, 0, 2);
  const boom = buffer(sr, 0.5);
  osc(boom, sr, 'sine', (t) => 55 * (1 + 3 * Math.exp(-t / 0.02)));
  envelope(boom, sr, adExp(0.002, 0.12));
  mixInto(out, boom, sr, 0, 1.2);
  drive(out, 2);
  reverb(out, sr, 0.8, 0.3, 0.3);
  return fadeEdges(normalize(out, 0.95), sr);
}

/** Camada extra das armas Mk II: brilho elétrico roxo. */
export function mk2Layer(sr: number, r: Rng): Float32Array {
  const out = buffer(sr, 0.3);
  osc(out, sr, 'saw', (t) => 900 + 1400 * Math.exp(-t * 18), 0.6);
  osc(out, sr, 'sine', (t) => 2400 - 1200 * t, 0.4);
  envelope(out, sr, adExp(0.001, 0.05));
  bandpass(out, sr, 1800, 1.2);
  const fizz = buffer(sr, 0.3);
  white(fizz, r, 0.5);
  envelope(fizz, sr, adExp(0.001, 0.04));
  highpass(fizz, sr, 5000);
  mixInto(out, fizz, sr, 0, 1);
  return fadeEdges(normalize(out, 0.7), sr);
}

// ───────────────────────── Recarga, troca, tiro seco ─────────────────────────

const click = (sr: number, r: Rng, pitch: number, dur = 0.08) =>
  resonantHit(sr, r, [{ f: pitch, q: 7, gain: 1 }, { f: pitch * 1.9, q: 9, gain: 0.6 }, { f: pitch * 0.45, q: 3, gain: 0.7 }], dur, 0.004);

export function reload(kind: string) {
  return (sr: number, r: Rng): Float32Array => {
    const out = buffer(sr, 1.2);
    if (kind === 'shotgun') {
      // Cartuchos entrando um a um
      for (let i = 0; i < 3; i++) mixInto(out, click(sr, r, range(r, 900, 1100), 0.1), sr, 0.1 + i * 0.28, 1);
      mixInto(out, pumpAction(sr, r), sr, 0.95, 0.9);
      return fadeEdges(normalize(out, 0.7), sr);
    }
    const heavy = kind === 'rifle' || kind === 'ak';
    // Solta o carregador, encaixa o novo, puxa o ferrolho
    mixInto(out, click(sr, r, heavy ? 1400 : 2200), sr, 0.05, 1);
    const cloth = buffer(sr, 0.25);
    white(cloth, r, 0.25);
    envelope(cloth, sr, (t) => Math.sin((t / 0.25) * Math.PI));
    bandpass(cloth, sr, 900, 0.8);
    mixInto(out, cloth, sr, 0.2, 1);
    mixInto(out, click(sr, r, heavy ? 900 : 1300, 0.12), sr, 0.48, 1.2);
    mixInto(out, click(sr, r, heavy ? 1700 : 2600), sr, 0.78, 0.9);
    mixInto(out, click(sr, r, heavy ? 1200 : 1900), sr, 0.86, 1);
    return fadeEdges(normalize(out, 0.7), sr);
  };
}

export function dryFire(sr: number, r: Rng): Float32Array {
  return fadeEdges(normalize(click(sr, r, 2800, 0.06), 0.5), sr);
}

export function weaponSwitch(sr: number, r: Rng): Float32Array {
  const out = buffer(sr, 0.35);
  const cloth = buffer(sr, 0.25);
  white(cloth, r, 0.4);
  envelope(cloth, sr, (t) => Math.sin((t / 0.25) * Math.PI));
  bandpass(cloth, sr, 700, 0.7);
  mixInto(out, cloth, sr, 0, 1);
  mixInto(out, click(sr, r, 1600), sr, 0.22, 1);
  return fadeEdges(normalize(out, 0.55), sr);
}

/** Cápsula caindo no chão (tilintar). */
export function shellCasing(sr: number, r: Rng): Float32Array {
  const out = buffer(sr, 0.35);
  const base = range(r, 3800, 4800);
  for (let i = 0; i < 3; i++) {
    const hit = resonantHit(sr, r, [{ f: base * range(r, 0.97, 1.03), q: 30, gain: 1 }, { f: base * 1.6, q: 30, gain: 0.5 }], 0.15, 0.001);
    mixInto(out, hit, sr, i * range(r, 0.05, 0.09), 1 / (i + 1));
  }
  return fadeEdges(normalize(out, 0.35), sr);
}
