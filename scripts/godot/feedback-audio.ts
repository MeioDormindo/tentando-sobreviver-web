/**
 * Sons que só existem no Godot: o feedback de acerto (só quem acertou ouve). Sintetizados com a
 * mesma caixa de ferramentas do jogo web (src/audio/dsp). Gravados pelo export-audio.ts.
 *
 * - hit_tick: estalo curto e seco a cada acerto (a arma automática toca vários seguidos);
 * - hit_head: "tim" metálico do headshot;
 * - hit_kill: baque grave com estalo, a confirmação do abate;
 * - hit_blocked: clanque surdo quando a armadura ou o escudo seguram o tiro.
 */
import { adExp, buffer, envelope, fadeEdges, highpass, lowpass, mixInto, normalize, osc, resonantHit, white, type Rng } from '../../src/audio/dsp';

const MID = 32000;

function tick(sr: number, r: Rng): Float32Array {
  const out = buffer(sr, 0.05);
  const click = buffer(sr, 0.05);
  white(click, r);
  highpass(click, sr, 2600 + r() * 600, 0.8);
  envelope(click, sr, adExp(0.0004, 0.006));
  mixInto(out, click, sr, 0, 0.8);
  const body = buffer(sr, 0.05);
  const f = 1700 + r() * 250;
  osc(body, sr, 'triangle', () => f, 0.5);
  envelope(body, sr, adExp(0.0005, 0.012));
  mixInto(out, body, sr, 0, 1);
  fadeEdges(out, sr, 0.0005, 0.01);
  return normalize(out, 0.8);
}

function head(sr: number, r: Rng): Float32Array {
  const out = buffer(sr, 0.32);
  const ring = resonantHit(sr, r, [
    { f: 2480, q: 60, gain: 1 },
    { f: 3720, q: 50, gain: 0.55 },
    { f: 5310, q: 40, gain: 0.3 },
  ], 0.32, 0.003);
  envelope(ring, sr, adExp(0.0005, 0.09));
  mixInto(out, ring, sr, 0, 1);
  const ping = buffer(sr, 0.32);
  osc(ping, sr, 'sine', (t) => 2480 * (1 + 0.02 * Math.exp(-t * 40)), 0.6);
  envelope(ping, sr, adExp(0.001, 0.07));
  mixInto(out, ping, sr, 0, 1);
  mixInto(out, tick(sr, r), sr, 0, 0.5);
  fadeEdges(out, sr, 0.0005, 0.03);
  return normalize(out, 0.85);
}

function kill(sr: number, r: Rng): Float32Array {
  const out = buffer(sr, 0.22);
  const thump = buffer(sr, 0.22);
  osc(thump, sr, 'sine', (t) => 150 * Math.exp(-t * 9) + 55, 1);
  envelope(thump, sr, adExp(0.001, 0.05));
  mixInto(out, thump, sr, 0, 1);
  const crack = buffer(sr, 0.22);
  white(crack, r);
  lowpass(crack, sr, 3800, 0.7);
  highpass(crack, sr, 700, 0.7);
  envelope(crack, sr, adExp(0.0006, 0.02));
  mixInto(out, crack, sr, 0, 0.55);
  mixInto(out, tick(sr, r), sr, 0.004, 0.6);
  fadeEdges(out, sr, 0.0005, 0.03);
  return normalize(out, 0.9);
}

function blocked(sr: number, r: Rng): Float32Array {
  const out = buffer(sr, 0.18);
  const clank = resonantHit(sr, r, [
    { f: 640 + r() * 60, q: 18, gain: 1 },
    { f: 1130, q: 14, gain: 0.6 },
    { f: 1720, q: 10, gain: 0.35 },
  ], 0.18, 0.006);
  envelope(clank, sr, adExp(0.0005, 0.04));
  lowpass(clank, sr, 2600, 0.7);
  mixInto(out, clank, sr, 0, 1);
  fadeEdges(out, sr, 0.0005, 0.02);
  return normalize(out, 0.75);
}

export const FEEDBACK_SOUNDS = [
  { key: 'hit_tick', variants: 3, sr: MID, make: tick },
  { key: 'hit_head', variants: 2, sr: MID, make: head },
  { key: 'hit_kill', variants: 2, sr: MID, make: kill },
  { key: 'hit_blocked', variants: 2, sr: MID, make: blocked },
];
