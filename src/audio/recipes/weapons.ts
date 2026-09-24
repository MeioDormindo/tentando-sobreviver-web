import {
  adExp, bandpass, brown, buffer, drive, envelope, fadeEdges, highpass, lowpass, mixInto, normalize, osc, pink, range,
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
  // Hospital
  magnum: { body: 560, bodyQ: 0.8, tau: 0.05, thump: 52, thumpGain: 1.4, tail: 0.3, bright: 0.9, crack: 1.2, drive: 4 },
  barrett: { body: 420, bodyQ: 0.7, tau: 0.07, thump: 40, thumpGain: 1.6, tail: 0.45, bright: 1.2, crack: 1.6, drive: 4.5 },
  uzi_dual: { body: 1900, bodyQ: 1.4, tau: 0.013, thump: 110, thumpGain: 0.35, tail: 0.05, bright: 1.4, crack: 0.8, drive: 2 },
  minigun: { body: 1200, bodyQ: 1, tau: 0.018, thump: 80, thumpGain: 0.6, tail: 0.08, bright: 1.3, crack: 0.9, drive: 3 },
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
    if (id in SPECIAL_SHOTS) return SPECIAL_SHOTS[id](sr, r);
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

/** Canhão de Vento: sopro grave que "suga" e explode num rugido de ar. */
function windBlast(sr: number, r: Rng): Float32Array {
  const out = buffer(sr, 1.3);
  const suck = buffer(sr, 0.3);
  white(suck, r, 1);
  bandpass(suck, sr, (t) => 300 + t * 3000, 1.2);
  envelope(suck, sr, (t) => t / 0.3);
  mixInto(out, suck, sr, 0, 0.5);
  const blast = buffer(sr, 1);
  pink(blast, r);
  lowpass(blast, sr, (t) => 3000 * Math.exp(-t * 2.5) + 200);
  envelope(blast, sr, adExp(0.004, 0.25));
  mixInto(out, blast, sr, 0.28, 1.4);
  const boom = buffer(sr, 0.5);
  osc(boom, sr, 'sine', (t) => 50 * (1 + 2 * Math.exp(-t / 0.03)));
  envelope(boom, sr, adExp(0.002, 0.12));
  mixInto(out, boom, sr, 0.28, 1);
  reverb(out, sr, 0.7, 0.3, 0.4);
  return fadeEdges(normalize(out, 0.95), sr);
}

/** Minigun girando o cano antes de atirar (zumbido que acelera). */
export function minigunSpin(sr: number, r: Rng): Float32Array {
  const dur = 0.75;
  const out = buffer(sr, dur);
  osc(out, sr, 'saw', (t) => 40 + 260 * (t / dur), 0.5);
  lowpass(out, sr, 1400);
  const whir = buffer(sr, dur);
  white(whir, r, 0.4);
  bandpass(whir, sr, (t) => 600 + 2400 * (t / dur), 2);
  mixInto(out, whir, sr, 0, 0.6);
  envelope(out, sr, (t) => Math.min(1, t / 0.1));
  return fadeEdges(normalize(out, 0.6), sr);
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

// ───────────────────────── Armas especiais ─────────────────────────

/** Lança-granadas: "thunk" oco e grave, com o tubo ressoando. */
function grenadeThunk(sr: number, r: Rng): Float32Array {
  const out = buffer(sr, 0.7);
  const thump = buffer(sr, 0.3);
  osc(thump, sr, 'sine', (t) => 95 * (1 + 1.5 * Math.exp(-t / 0.015)));
  envelope(thump, sr, adExp(0.001, 0.06));
  mixInto(out, thump, sr, 0, 1.4);
  const tube = buffer(sr, 0.3);
  white(tube, r);
  envelope(tube, sr, adExp(0.001, 0.035));
  bandpass(tube, sr, 380, 4);
  mixInto(out, tube, sr, 0, 3);
  mixInto(out, resonantHit(sr, r, [{ f: 820, q: 10, gain: 1 }, { f: 1650, q: 12, gain: 0.5 }], 0.3, 0.003), sr, 0.005, 0.5);
  drive(out, 1.8);
  reverb(out, sr, 0.5, 0.2, 0.5);
  return fadeEdges(normalize(out, 0.9), sr);
}

/** Lança-chamas: rajada de ar/combustível queimando (chiado grave + crepitar). */
function flameWhoosh(sr: number, r: Rng): Float32Array {
  const dur = 0.32;
  const out = buffer(sr, dur);
  const roar = buffer(sr, dur);
  brown(roar, r);
  envelope(roar, sr, (t) => Math.sin(Math.min(1, t / dur) * Math.PI));
  lowpass(roar, sr, 700);
  mixInto(out, roar, sr, 0, 2.2);
  const hiss = buffer(sr, dur);
  white(hiss, r, 0.5);
  envelope(hiss, sr, (t) => Math.sin(Math.min(1, t / dur) * Math.PI));
  bandpass(hiss, sr, 2400, 0.7);
  mixInto(out, hiss, sr, 0, 0.6);
  const crackle = buffer(sr, dur);
  for (let i = 0; i < crackle.length; i++) if (r() < 0.004) crackle[i] = r() * 2 - 1;
  highpass(crackle, sr, 1500);
  mixInto(out, crackle, sr, 0, 1.2);
  return fadeEdges(normalize(out, 0.8), sr, 0.02, 0.06);
}

/** Arc Gun: estalo elétrico com zumbido modulado. */
function arcZap(sr: number, r: Rng): Float32Array {
  const out = buffer(sr, 0.45);
  const buzz = buffer(sr, 0.3);
  osc(buzz, sr, 'square', (t) => 110 + 40 * Math.sin(t * 380), 0.5);
  osc(buzz, sr, 'saw', (t) => 2600 * Math.exp(-t * 14) + 400, 0.4);
  envelope(buzz, sr, adExp(0.001, 0.07));
  bandpass(buzz, sr, 1800, 0.8);
  mixInto(out, buzz, sr, 0, 1.2);
  const crackle = buffer(sr, 0.25);
  for (let i = 0; i < crackle.length; i++) if (r() < 0.03) crackle[i] = r() * 2 - 1;
  envelope(crackle, sr, adExp(0.001, 0.06));
  highpass(crackle, sr, 2500);
  mixInto(out, crackle, sr, 0, 2.2);
  reverb(out, sr, 0.4, 0.2, 0.4);
  return fadeEdges(normalize(out, 0.85), sr);
}

/** Energy Cannon: carga ascendente curta seguida de disparo profundo. */
function plasmaShot(sr: number, r: Rng): Float32Array {
  const out = buffer(sr, 1.2);
  const charge = buffer(sr, 0.12);
  osc(charge, sr, 'saw', (t) => 300 + t * 9000, 0.4);
  envelope(charge, sr, (t) => t / 0.12);
  lowpass(charge, sr, 4000);
  mixInto(out, charge, sr, 0, 0.5);
  const blast = buffer(sr, 0.8);
  osc(blast, sr, 'sine', (t) => 70 * (1 + 4 * Math.exp(-t / 0.03)));
  osc(blast, sr, 'triangle', (t) => 900 * Math.exp(-t * 5) + 120, 0.5);
  envelope(blast, sr, adExp(0.002, 0.18));
  mixInto(out, blast, sr, 0.11, 1.4);
  const fizz = buffer(sr, 0.5);
  white(fizz, r, 0.5);
  envelope(fizz, sr, adExp(0.002, 0.1));
  bandpass(fizz, sr, 5200, 1.5);
  mixInto(out, fizz, sr, 0.11, 0.8);
  drive(out, 1.6);
  reverb(out, sr, 0.8, 0.3, 0.3);
  return fadeEdges(normalize(out, 0.95), sr);
}

const SPECIAL_SHOTS: Record<string, (sr: number, r: Rng) => Float32Array> = {
  wind_cannon: windBlast,
  grenade_launcher: grenadeThunk,
  flamethrower: flameWhoosh,
  arc_gun: arcZap,
  energy_cannon: plasmaShot,
};

/** Explosão de plasma: descarga elétrica com estrondo (Energy Cannon). */
export function plasmaBurst(sr: number, r: Rng): Float32Array {
  const out = buffer(sr, 1.4);
  const boom = buffer(sr, 0.9);
  osc(boom, sr, 'sine', (t) => 48 * (1 + 3 * Math.exp(-t / 0.04)));
  envelope(boom, sr, adExp(0.002, 0.25));
  mixInto(out, boom, sr, 0, 1.5);
  const crackle = buffer(sr, 0.7);
  for (let i = 0; i < crackle.length; i++) if (r() < 0.035) crackle[i] = r() * 2 - 1;
  envelope(crackle, sr, adExp(0.001, 0.18));
  highpass(crackle, sr, 2000);
  mixInto(out, crackle, sr, 0, 2);
  const sweep = buffer(sr, 0.5);
  osc(sweep, sr, 'saw', (t) => 2400 * Math.exp(-t * 6) + 80, 0.5);
  envelope(sweep, sr, adExp(0.001, 0.12));
  lowpass(sweep, sr, 5000);
  mixInto(out, sweep, sr, 0, 0.7);
  drive(out, 2);
  reverb(out, sr, 0.85, 0.35, 0.3);
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
    const heavy = ['rifle', 'ak', 'launcher', 'flamer', 'energy', 'sniper', 'lmg', 'wind'].includes(kind);
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

/** Faca cortando o ar: chiado que sobe rápido de tom. */
export function knifeSwing(sr: number, r: Rng): Float32Array {
  const dur = 0.2;
  const out = white(buffer(sr, dur), r, 1);
  bandpass(out, sr, (t: number) => 900 + 5200 * (t / dur), 1.4);
  envelope(out, sr, (t) => Math.sin(Math.min(1, t / dur) * Math.PI) ** 1.5);
  return fadeEdges(normalize(out, 0.5), sr);
}
