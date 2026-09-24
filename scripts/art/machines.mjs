// Máquinas (GDD §37–40): Mystery Box, Weapon Lab, máquinas de perk e ícones.
import { blobPath, f, line, linear, radial, rng, svgDoc } from './lib.mjs';
import { drawGun } from './weapons.mjs';

const SHADOW = `<filter id="ms" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.5"/></filter>`;
const GLOW = `<filter id="mg" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.5"/></filter>`;

/** Perks: cor e símbolo (desenhado em 64x64, centro 32,32). */
export const PERKS = {
  fortify: { color: '#c0392b', dark: '#5e1a13', symbol: 'heart' },
  quick_hands: { color: '#2e86c1', dark: '#123e5c', symbol: 'hand' },
  sprint: { color: '#27ae60', dark: '#10502b', symbol: 'boot' },
  deadeye: { color: '#d4ac0d', dark: '#5f4d05', symbol: 'crosshair' },
  adrenaline: { color: '#e67e22', dark: '#6b3a0e', symbol: 'syringe' },
  overload: { color: '#8e44ad', dark: '#3f1d4d', symbol: 'bolt' },
  quick_revive: { color: '#5dade2', dark: '#1b4f72', symbol: 'revive' },
};

function symbol(kind, color = '#f4efe2') {
  switch (kind) {
    case 'heart':
      return `<path d="M32 46 C14 34 16 20 25 20 C29 20 31 23 32 25 C33 23 35 20 39 20 C48 20 50 34 32 46 Z" fill="${color}"/>`;
    case 'hand':
      return `<path d="M22 44 L22 28 Q22 25 25 25 Q27 25 27 28 L27 22 Q27 19 30 19 Q32 19 32 22 L32 21 Q32 18 35 18 Q37 18 37 21 L37 24 Q37 22 40 22 Q42 22 42 25 L42 38 Q42 46 34 46 L28 46 Q24 46 22 44 Z" fill="${color}"/>`;
    case 'boot':
      return `<path d="M24 16 L34 16 L34 32 L46 38 Q48 40 46 44 L20 44 Q18 44 18 41 L22 34 Z" fill="${color}"/>` + line([28, 22], [32, 22], '#0000', 0);
    case 'crosshair':
      return `<circle cx="32" cy="32" r="11" fill="none" stroke="${color}" stroke-width="3.5"/>` +
        line([32, 14], [32, 24], color, 3.5) + line([32, 40], [32, 50], color, 3.5) +
        line([14, 32], [24, 32], color, 3.5) + line([40, 32], [50, 32], color, 3.5) +
        `<circle cx="32" cy="32" r="2.5" fill="${color}"/>`;
    case 'syringe':
      return `<g transform="rotate(-45 32 32)"><rect x="26" y="18" width="12" height="24" rx="2" fill="${color}"/>` +
        `<rect x="24" y="15" width="16" height="4" rx="1" fill="${color}"/><rect x="30" y="8" width="4" height="8" fill="${color}"/>` +
        `<rect x="31" y="42" width="2" height="12" fill="${color}"/><rect x="28" y="26" width="8" height="10" fill="#0003"/></g>`;
    case 'bolt':
      return `<path d="M36 12 L20 36 L30 36 L26 52 L44 26 L34 26 Z" fill="${color}"/>`;
    case 'revive':
      // Cruz com linha de batimento cardíaco.
      return `<rect x="27" y="14" width="10" height="36" rx="2" fill="${color}"/><rect x="14" y="27" width="36" height="10" rx="2" fill="${color}"/>` +
        `<path d="M8 50 L22 50 L26 42 L31 56 L35 46 L40 50 L56 50" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round"/>`;
    default:
      return '';
  }
}

/** Ícone de perk para a HUD (64x64). */
export function perkIcon(id) {
  const p = PERKS[id];
  const defs = radial('pi', [[0, p.color], [1, p.dark]], '40%', '35%', '70%');
  const s = `<circle cx="32" cy="32" r="29" fill="url(#pi)" stroke="#0b0b0b" stroke-width="3"/>` +
    `<circle cx="32" cy="32" r="25" fill="none" stroke="#ffffff" stroke-width="1.5" opacity=".3"/>` +
    `<g transform="translate(6.4 6.4) scale(0.8)">${symbol(p.symbol)}</g>`;
  return svgDoc(64, 64, defs, s);
}

/** Máquina de perk vista de cima (96x80 → 48x40 no mundo): gabinete colorido com painel iluminado. */
export function perkMachine(id) {
  const p = PERKS[id];
  const defs = SHADOW + GLOW + linear('pm', [[0, p.color], [1, p.dark]], 0, 0, 1, 1);
  let s = `<rect x="14" y="16" width="76" height="60" rx="5" fill="#000" opacity=".55" filter="url(#ms)"/>`;
  s += `<rect x="8" y="8" width="76" height="60" rx="5" fill="url(#pm)" stroke="#0e0e0e" stroke-width="2.5"/>`;
  s += `<rect x="8" y="8" width="76" height="6" rx="3" fill="#ffffff" opacity=".18"/>`;
  // painel frontal (lado de baixo, vista 3/4)
  s += `<rect x="14" y="52" width="64" height="12" rx="2" fill="#141414"/>`;
  s += `<rect x="18" y="55" width="38" height="6" rx="1" fill="${p.color}" opacity=".85" filter="url(#mg)"/>`;
  s += `<circle cx="68" cy="58" r="3" fill="#f4efe2" opacity=".8"/>`;
  // ícone no topo
  s += `<circle cx="46" cy="31" r="17" fill="#0e0e0e" opacity=".55"/>`;
  s += `<g transform="translate(29 14) scale(0.53)">${symbol(p.symbol)}</g>`;
  return svgDoc(96, 80, defs, s);
}

/** Mystery Box: caixote de madeira com pontos de interrogação luminosos. 144x88 → 72x44. */
export function mysteryBox() {
  const r = rng(51);
  const defs = SHADOW + GLOW + linear('mb', [[0, '#6e4a2a'], [1, '#43291a']], 0, 0, 0, 1);
  let s = `<rect x="14" y="16" width="124" height="68" rx="4" fill="#000" opacity=".55" filter="url(#ms)"/>`;
  s += `<rect x="8" y="8" width="124" height="68" rx="3" fill="url(#mb)" stroke="#1c120a" stroke-width="2.5"/>`;
  for (let i = 1; i < 5; i++) s += line([8, 8 + i * 13.6], [132, 8 + i * 13.6], '#2e1d10', 1.2, 'opacity=".7"');
  s += `<rect x="8" y="8" width="124" height="68" rx="3" fill="none" stroke="#54371f" stroke-width="8" opacity=".9"/>`;
  s += `<rect x="12" y="38" width="116" height="6" fill="#d9b25a" opacity=".55" filter="url(#mg)"/>`;
  for (const [x, rot] of [[38, -12], [70, 6], [102, -4]]) {
    s += `<text x="${x}" y="54" font-family="Impact, Arial Black, sans-serif" font-size="30" fill="#f2d27a" text-anchor="middle" transform="rotate(${rot} ${x} 44)" opacity=".92">?</text>`;
  }
  for (const [x, y] of [[12, 12], [128, 12], [12, 72], [128, 72]]) s += `<rect x="${x - 4}" y="${y - 4}" width="8" height="8" fill="#2a2a2a"/>`;
  s += `<path d="${blobPath(30, 22, 6, 0.6, 7, r)}" fill="#000" opacity=".25"/>`;
  return svgDoc(144, 88, defs, s);
}

/** Weapon Lab: bancada industrial com câmara brilhante. 160x104 → 80x52. */
export function weaponLab() {
  const defs = SHADOW + GLOW +
    linear('wl', [[0, '#4a4f58'], [1, '#2b2f36']], 0, 0, 1, 1) +
    radial('core', [[0, '#e3c2ff'], [0.5, '#9b59d0'], [1, '#3b1d52']], '50%', '50%', '60%');
  let s = `<rect x="14" y="16" width="140" height="84" rx="6" fill="#000" opacity=".55" filter="url(#ms)"/>`;
  s += `<rect x="8" y="8" width="140" height="84" rx="6" fill="url(#wl)" stroke="#111" stroke-width="3"/>`;
  s += `<rect x="8" y="8" width="140" height="6" rx="3" fill="#8b919c" opacity=".35"/>`;
  s += `<rect x="46" y="22" width="64" height="44" rx="8" fill="#16181c" stroke="#0a0a0a" stroke-width="2"/>`;
  s += `<rect x="52" y="28" width="52" height="32" rx="6" fill="url(#core)" filter="url(#mg)"/>`;
  s += `<g transform="translate(58 44) scale(0.8)" opacity=".85">${drawGun('rifle', 0, 0, 0)}</g>`;
  for (let i = 0; i < 4; i++) s += `<rect x="${16 + i * 7}" y="24" width="4" height="40" rx="1.5" fill="#1b1e23"/>`;
  s += `<circle cx="128" cy="32" r="8" fill="#1b1e23" stroke="#555" stroke-width="2"/><circle cx="128" cy="32" r="3" fill="#b33a3a"/>`;
  s += `<rect x="118" y="48" width="22" height="6" rx="2" fill="#c9a227"/>`;
  s += `<rect x="16" y="74" width="124" height="10" rx="2" fill="#141414"/>`;
  s += `<rect x="20" y="77" width="60" height="4" fill="#9b59d0" opacity=".9" filter="url(#mg)"/>`;
  return svgDoc(160, 104, defs, s);
}

/** Silhueta clara da arma para a animação da Mystery Box (160x40). */
export function gunIcon(kind) {
  const defs = `<filter id="gi" x="-10%" y="-40%" width="120%" height="180%"><feDropShadow dx="0" dy="0" stdDeviation="2" flood-color="#ffe9a8" flood-opacity=".9"/></filter>`;
  const small = kind === 'pistol' || kind === 'revolver' || kind === 'akimbo';
  const x = small ? 60 : kind === 'smg' ? 56 : kind === 'sniper' ? 38 : 48;
  const scale = small ? 1.7 : kind === 'sniper' ? 1.25 : 1.5;
  const guns = kind === 'akimbo' ? drawGun(kind, -4, -5, 0) + drawGun(kind, 4, 5, 0) : drawGun(kind, 0, 0, 0);
  return svgDoc(160, 40, defs, `<g filter="url(#gi)" transform="translate(${x} 20) scale(${scale})">${guns}</g>`);
}

export { f };
