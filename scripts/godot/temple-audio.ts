/**
 * Sons que só existem no Godot: o ambiente do Templo dos Mortos (Mapa 3), sintetizados com a
 * mesma caixa de ferramentas do jogo web (src/audio/dsp). Gravados pelo export-audio.ts.
 */
import {
  bandpass, brown, buffer, echo, envelope, highpass, lowpass, makeLoop, mixInto, normalize, osc, pink, reverb, white, type Rng,
} from '../../src/audio/dsp';

const LOOP = 14;
const XFADE = 1.5;
const total = LOOP + XFADE;
const LO = 22050;

function finish(out: Float32Array, sr: number, peak: number, verb = 0.3): Float32Array {
  reverb(out, sr, 0.85, verb, 0.5);
  normalize(out, peak);
  return makeLoop(out, sr, XFADE);
}

function wind(out: Float32Array, sr: number, r: Rng, gain: number, center: number): void {
  const w = buffer(sr, total);
  pink(w, r);
  const p = r() * 6;
  bandpass(w, sr, (t) => center * (1 + 0.55 * Math.sin(t * 0.4 + p) + 0.2 * Math.sin(t * 1.1)), 0.8);
  envelope(w, sr, (t) => 0.55 + 0.45 * Math.sin(t * 0.27 + p));
  mixInto(out, w, sr, 0, gain);
}

function rumble(out: Float32Array, sr: number, r: Rng, gain: number, cutoff: number): void {
  const b = buffer(sr, total);
  brown(b, r);
  lowpass(b, sr, cutoff);
  mixInto(out, b, sr, 0, gain);
}

/** Pingos esparsos com eco (catacumbas). */
function drips(out: Float32Array, sr: number, r: Rng, count: number, gain: number): void {
  for (let i = 0; i < count; i++) {
    const at = r() * LOOP, f = 900 + r() * 1400;
    const d = buffer(sr, 0.12);
    osc(d, sr, 'sine', (t) => f * (1 + 2.5 * Math.exp(-t * 40)), 1);
    envelope(d, sr, (t) => Math.exp(-t * 45));
    mixInto(out, d, sr, at, gain * (0.5 + r() * 0.5));
  }
}

/** Grilos (floresta): pulsos agudos em rajadas. */
function crickets(out: Float32Array, sr: number, r: Rng, gain: number): void {
  const c = buffer(sr, total);
  const f = 4200 + r() * 600;
  osc(c, sr, 'sine', () => f, 1);
  envelope(c, sr, (t) => ((t * 18) % 1 < 0.35 ? 1 : 0) * ((t * 0.7) % 1 < 0.6 ? 1 : 0.1));
  mixInto(out, c, sr, 0, gain);
}

/** Coruja distante: dois "hu" graves. */
function owl(out: Float32Array, sr: number, at: number, gain: number): void {
  for (const [dt, f] of [[0, 420], [0.45, 380]] as const) {
    const h = buffer(sr, 0.4);
    osc(h, sr, 'sine', (t) => f - t * 60, 1);
    envelope(h, sr, (t) => Math.sin(Math.min(1, t / 0.35) * Math.PI));
    mixInto(out, h, sr, at + dt, gain);
  }
}

/** Sussurros: ruído em formantes que sobem e descem (almas). */
function whispers(out: Float32Array, sr: number, r: Rng, gain: number): void {
  const w = buffer(sr, total);
  white(w, r);
  highpass(w, sr, 1200);
  bandpass(w, sr, (t) => 2200 + 900 * Math.sin(t * 2.3) * Math.sin(t * 0.7), 3);
  envelope(w, sr, (t) => Math.max(0, Math.sin(t * 0.9) * Math.sin(t * 0.23)) ** 2);
  mixInto(out, w, sr, 0, gain);
}

/** Fogo crepitando (lava, braseiros). */
function fire(out: Float32Array, sr: number, r: Rng, gain: number): void {
  const f = buffer(sr, total);
  brown(f, r);
  lowpass(f, sr, 400);
  mixInto(out, f, sr, 0, gain * 0.7);
  for (let i = 0; i < 90; i++) {
    const c = buffer(sr, 0.02);
    white(c, r);
    envelope(c, sr, (t) => Math.exp(-t * 300));
    highpass(c, sr, 1500);
    mixInto(out, c, sr, r() * LOOP, gain * (0.2 + r() * 0.5));
  }
}

export const TEMPLE_AMBIENCE: Record<string, (sr: number, r: Rng) => Float32Array> = {
  // Ruínas: vento aberto entre as colunas e um ronco longe.
  ruins: (sr, r) => {
    const out = buffer(sr, total);
    wind(out, sr, r, 0.7, 380);
    wind(out, sr, r, 0.3, 900);
    rumble(out, sr, r, 0.4, 60);
    return finish(out, sr, 0.5, 0.2);
  },
  // Necrópole: catacumba fechada, pingos com eco e sussurros.
  necropolis: (sr, r) => {
    const out = buffer(sr, total);
    rumble(out, sr, r, 0.7, 55);
    const d = buffer(sr, total);
    drips(d, sr, r, 10, 0.5);
    echo(d, sr, 0.26, 0.55, 0.7);
    mixInto(out, d, sr, 0, 1);
    whispers(out, sr, r, 0.12);
    return finish(out, sr, 0.5, 0.5);
  },
  // Floresta: grilos, vento nas folhas e uma coruja.
  forest: (sr, r) => {
    const out = buffer(sr, total);
    wind(out, sr, r, 0.35, 1600);
    crickets(out, sr, r, 0.08);
    owl(out, sr, 4 + r() * 3, 0.25);
    return finish(out, sr, 0.45, 0.25);
  },
  // Submundo e Arena: fogo, lava borbulhando e um grave que pulsa.
  underworld: (sr, r) => {
    const out = buffer(sr, total);
    rumble(out, sr, r, 1.0, 50);
    osc(out, sr, 'sine', (t) => 36 + Math.sin(t * 0.3) * 3, 0.12);
    fire(out, sr, r, 0.35);
    whispers(out, sr, r, 0.08);
    return finish(out, sr, 0.55, 0.35);
  },
};

/** Áreas do Templo que usam o ambiente de outra. */
export const TEMPLE_AMBIENCE_ALIAS: Record<string, string> = {
  labyrinth: 'necropolis', gorgon_temple: 'ruins', arena: 'underworld', sanctuary: 'ruins',
};

/** Eventos soltos de ambiente por área (sons que já existem). */
export const TEMPLE_AMBIENT_EVENTS: Record<string, string[]> = {
  ruins: ['amb_creak', 'amb_moan', 'amb_bang'],
  necropolis: ['amb_drip', 'amb_moan', 'amb_creak'],
  labyrinth: ['amb_drip', 'amb_moan', 'amb_bang'],
  forest: ['amb_creak', 'amb_moan'],
  gorgon_temple: ['amb_creak', 'amb_moan'],
  underworld: ['amb_steam', 'amb_moan', 'amb_bang'],
  arena: ['amb_steam', 'amb_bang'],
  sanctuary: ['amb_creak'],
};

/** Passos nos pisos do Templo (sons de piso que já existem). */
export const TEMPLE_STEP_ALIAS: Record<string, string> = {
  mosaic: 'terminal', stone: 'concrete', marble: 'terminal', catacomb: 'tunnel', grass: 'tunnel', volcanic: 'concrete',
};

export const TEMPLE_SOUNDS = Object.entries(TEMPLE_AMBIENCE).map(([area, make]) => ({ key: `amb_${area}`, variants: 1, sr: LO, make }));
