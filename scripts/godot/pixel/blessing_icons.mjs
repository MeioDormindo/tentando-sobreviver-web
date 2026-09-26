// Ícones das Bênçãos dos Deuses (Templo dos Mortos): moeda com o símbolo do deus, mesma
// receita das moedas de power-up (powerup_icons.mjs). Cores iguais às de
// godot/scripts/player/blessing_system.gd:GODS — mudar um lado sem o outro desalinha a cor
// do selo na HUD da cor do texto "BÊNÇÃO DE...".
import { Pixels } from './raster.mjs';
import { hex, mix } from './paint.mjs';
import { GOD_SYMBOLS } from './temple_props.mjs';

const ICONS = {
  zeus: { symbol: 'zeus', rim: hex(0x99d9ff), ink: hex(0x16202c) },
  ares: { symbol: 'ares', rim: hex(0xff594d), ink: hex(0x2a0e0a) },
  athena: { symbol: 'athena', rim: hex(0xd9cc8c), ink: hex(0x2a2418) },
  hermes: { symbol: 'hermes', rim: hex(0xffd959), ink: hex(0x2a2210) },
  poseidon: { symbol: 'poseidon', rim: hex(0x59bfff), ink: hex(0x0e2230) },
  hades: { symbol: 'hades', rim: hex(0xb373ff), ink: hex(0xf0e6ff) },
};

export function build(save) {
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
    save(`blessing_${id}`, p);
  }
  console.log(`  bênçãos: ${Object.keys(ICONS).length}`);
}
