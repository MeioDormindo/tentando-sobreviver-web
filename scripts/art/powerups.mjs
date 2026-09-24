// Ícones dos power-ups (GDD §41–43): moeda/medalha com símbolo, 96x96.
import { line, radial, svgDoc } from './lib.mjs';

export const POWERUPS = {
  max_ammo: { color: '#4caf50', dark: '#1d4d20' },
  double_cash: { color: '#e6b422', dark: '#6b4f06' },
  insta_kill: { color: '#d64541', dark: '#5c1412' },
  nuke: { color: '#f08a24', dark: '#6b3606' },
  full_heal: { color: '#e9e4d8', dark: '#6d6a60' },
  armor: { color: '#3d8fd6', dark: '#123d63' },
  speed_boost: { color: '#35c7c0', dark: '#0f5552' },
  carpenter: { color: '#c8873a', dark: '#5a3510' },
  golden: { color: '#ffd35a', dark: '#8a5a00' },
};

const INK = '#141414';

function symbol(id) {
  switch (id) {
    case 'max_ammo': {
      let s = '';
      for (const x of [34, 48, 62]) {
        s += `<rect x="${x - 5}" y="36" width="10" height="28" rx="1.5" fill="${INK}"/>`;
        s += `<path d="M${x - 5} 36 Q${x} 22 ${x + 5} 36 Z" fill="${INK}"/>`;
      }
      return s;
    }
    case 'double_cash':
      return `<text x="48" y="60" font-family="Impact, Arial Black, sans-serif" font-size="30" fill="${INK}" text-anchor="middle">$x2</text>`;
    case 'insta_kill':
      return `<path d="M48 24 C33 24 28 34 28 44 C28 52 33 56 36 58 L36 66 L60 66 L60 58 C63 56 68 52 68 44 C68 34 63 24 48 24 Z" fill="${INK}"/>` +
        `<circle cx="40" cy="45" r="5.5" fill="#f4efe2"/><circle cx="56" cy="45" r="5.5" fill="#f4efe2"/>` +
        `<path d="M48 51 L45 57 L51 57 Z" fill="#f4efe2"/>` + line([41, 62], [41, 66], '#f4efe2', 2) + line([48, 62], [48, 66], '#f4efe2', 2) + line([55, 62], [55, 66], '#f4efe2', 2);
    case 'nuke': {
      let s = `<circle cx="48" cy="48" r="5" fill="${INK}"/>`;
      for (const a of [-90, 30, 150]) {
        s += `<path d="M48 48 L${48 + 20 * Math.cos(((a - 30) * Math.PI) / 180)} ${48 + 20 * Math.sin(((a - 30) * Math.PI) / 180)} A20 20 0 0 1 ${48 + 20 * Math.cos(((a + 30) * Math.PI) / 180)} ${48 + 20 * Math.sin(((a + 30) * Math.PI) / 180)} Z" fill="${INK}"/>`;
      }
      return s + `<circle cx="48" cy="48" r="8" fill="none" stroke="#f08a24" stroke-width="3"/>`;
    }
    case 'full_heal':
      return `<rect x="41" y="26" width="14" height="44" rx="2" fill="#c0392b"/><rect x="26" y="41" width="44" height="14" rx="2" fill="#c0392b"/>`;
    case 'armor':
      return `<path d="M48 24 L68 31 L66 52 Q62 64 48 72 Q34 64 30 52 L28 31 Z" fill="${INK}"/>` +
        `<path d="M48 31 L61 36 L60 51 Q57 59 48 64 Z" fill="#3d8fd6" opacity=".6"/>`;
    case 'speed_boost':
      return `<path d="M30 30 L46 48 L30 66 L38 66 L54 48 L38 30 Z" fill="${INK}"/><path d="M46 30 L62 48 L46 66 L54 66 L70 48 L54 30 Z" fill="${INK}"/>`;
    case 'carpenter':
      // Martelo: cabo inclinado e cabeça com unha.
      return `<g transform="rotate(-40 48 48)"><rect x="44" y="38" width="8" height="36" rx="2" fill="${INK}"/>` +
        `<path d="M30 26 L62 26 Q68 26 68 32 L68 38 L30 38 Q26 38 26 34 L26 30 Q26 26 30 26 Z" fill="${INK}"/>` +
        `<path d="M66 28 Q76 24 78 18 L74 30 Z" fill="${INK}"/></g>`;
    case 'golden':
      return `<path d="M48 22 L55 40 L74 41 L59 53 L64 72 L48 61 L32 72 L37 53 L22 41 L41 40 Z" fill="#fff4c2" stroke="${INK}" stroke-width="2.5"/>`;
    default:
      return '';
  }
}

export function powerUpIcon(id) {
  const p = POWERUPS[id];
  const defs = radial('pu', [[0, '#ffffff'], [0.25, p.color], [1, p.dark]], '38%', '32%', '75%');
  const s =
    `<circle cx="48" cy="48" r="42" fill="url(#pu)" stroke="#0b0b0b" stroke-width="3.5"/>` +
    `<circle cx="48" cy="48" r="36" fill="none" stroke="#ffffff" stroke-width="2" opacity=".35"/>` +
    symbol(id);
  return svgDoc(96, 96, defs, s);
}
