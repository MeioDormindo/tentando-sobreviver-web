// Ícones temáticos dos power-ups no Templo dos Mortos (só visual): moedas gregas com o
// símbolo do deus — Insta-kill com o elmo de Ares, Double Points com as asas de Hermes, Max Ammo
// com o martelo de Hefesto e Nuke com o raio de Zeus. 40 × 40 px, como os do jogo web.
import { Pixels } from './raster.mjs';
import { hex, mix } from './paint.mjs';
import { GOD_SYMBOLS } from './temple_props.mjs';

const ICONS = {
  insta_kill: { symbol: 'ares', rim: hex(0xc4281f), ink: hex(0xffd0c0) },
  double_cash: { symbol: 'hermes', rim: hex(0xd8a24a), ink: hex(0xfff2c0) },
  max_ammo: { symbol: 'hephaestus', rim: hex(0xb07a32), ink: hex(0xffe0a0) },
  nuke: { symbol: 'zeus', rim: hex(0x4a8ad8), ink: hex(0xe8f6ff) },
};

export function build(outDir, save) {
  for (const [id, icon] of Object.entries(ICONS)) {
    const S = 40, c = 19.5;
    const p = new Pixels(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const d = Math.hypot(x - c, y - c);
      if (d > 18.5) continue;
      if (d > 16.5) p.set(x, y, mix(icon.rim, hex(0x1a1612), 0.35));
      else if (d > 14.5) p.set(x, y, icon.rim);
      else p.set(x, y, mix(hex(0x1e1a1c), icon.rim, 0.18 + 0.1 * ((x + y) % 2)));
    }
    // Meandro grego pontilhado na borda.
    for (let a = 0; a < 24; a++) {
      const t = (a / 24) * Math.PI * 2;
      p.set(Math.round(c + Math.cos(t) * 15.5), Math.round(c + Math.sin(t) * 15.5), icon.ink);
    }
    const rows = GOD_SYMBOLS[icon.symbol];
    const s = 3, ox = Math.round(c - 13.5), oy = Math.round(c - 13.5);
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch !== '#') return;
      for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) p.set(ox + x * s + i, oy + y * s + j, icon.ink);
    }));
    save(`${id}_temple`, p);
  }
  console.log(`  power-ups do Templo: ${Object.keys(ICONS).length}`);
}
