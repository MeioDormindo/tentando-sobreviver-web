// Arte dos eventos (GDD §48): trem que atravessa a plataforma, suprimentos e vazamento de gás.
import { blobPath, line, linear, radial, rng, svgDoc } from './lib.mjs';

const SHADOW = `<filter id="es" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.5"/></filter>`;

/** Teto de um vagão de carga/expresso visto de cima (640x192 → 320x96 no mundo). */
function carRoof(r, withLights) {
  let s = `<rect x="4" y="18" width="632" height="156" rx="10" fill="url(#roof)" stroke="#0e1114" stroke-width="3"/>`;
  // Faixas longitudinais do teto
  s += `<rect x="4" y="18" width="632" height="10" rx="5" fill="#9aa3a8" opacity=".25"/>`;
  s += `<rect x="4" y="164" width="632" height="10" rx="5" fill="#000" opacity=".35"/>`;
  for (let x = 40; x < 620; x += 60) s += line([x, 30], [x, 162], '#1c2226', 2, 'opacity=".55"');
  // Unidades de ar e respiros
  for (const x of [120, 400]) {
    s += `<rect x="${x}" y="58" width="120" height="76" rx="6" fill="#2d353b" stroke="#12171a" stroke-width="2"/>`;
    for (let i = 0; i < 8; i++) s += `<rect x="${x + 10 + i * 13}" y="68" width="7" height="56" rx="2" fill="#1c2327"/>`;
  }
  s += `<rect x="286" y="80" width="60" height="32" rx="4" fill="#1d2428"/>`;
  // Faixa de segurança vermelha nas bordas (visível sob a luz)
  s += `<rect x="4" y="30" width="632" height="6" fill="#8e2a22" opacity=".85"/>`;
  s += `<rect x="4" y="156" width="632" height="6" fill="#8e2a22" opacity=".85"/>`;
  // Sujeira/ferrugem
  for (let i = 0; i < 5; i++) {
    s += `<path d="${blobPath(r.range(40, 600), r.range(40, 150), r.range(10, 22), 0.6, 8, r)}" fill="#6b3d1c" opacity=".3"/>`;
  }
  if (withLights) s += `<circle cx="20" cy="40" r="5" fill="#ffecb0"/><circle cx="20" cy="152" r="5" fill="#ffecb0"/>`;
  return s;
}

const ROOF_DEFS = linear('roof', [[0, '#5b666e'], [0.5, '#4a545b'], [1, '#353d43']], 0, 0, 0, 1);

/** Vagão intermediário. */
export function trainCar() {
  const r = rng(77);
  let s = `<rect x="10" y="26" width="632" height="160" rx="10" fill="#000" opacity=".5" filter="url(#es)"/>`;
  s += carRoof(r, false);
  // Engates
  s += `<rect x="0" y="86" width="8" height="20" fill="#16191b"/><rect x="632" y="86" width="8" height="20" fill="#16191b"/>`;
  return svgDoc(640, 192, SHADOW + ROOF_DEFS, s);
}

/** Locomotiva (a frente aponta para +X): cabine com para-brisa e faróis. */
export function trainHead() {
  const r = rng(78);
  let s = `<rect x="10" y="26" width="632" height="160" rx="10" fill="#000" opacity=".5" filter="url(#es)"/>`;
  s += carRoof(r, false);
  // Nariz afunilado
  s += `<path d="M560 18 L612 18 Q640 40 640 96 Q640 152 612 174 L560 174 Z" fill="#8e2a22" stroke="#0e1114" stroke-width="3"/>`;
  s += `<path d="M578 34 L604 34 Q622 60 622 96 Q622 132 604 158 L578 158 Z" fill="#1a2328"/>`;
  s += `<path d="M584 40 L600 40 Q612 64 612 80" fill="none" stroke="#8fb4c8" stroke-width="3" opacity=".45"/>`;
  s += `<circle cx="628" cy="46" r="6" fill="#fff6d0"/><circle cx="628" cy="146" r="6" fill="#fff6d0"/>`;
  // Pantógrafo
  s += line([300, 60], [340, 132], '#15191c', 4) + line([340, 60], [300, 132], '#15191c', 4);
  return svgDoc(640, 192, SHADOW + ROOF_DEFS, s);
}

/** Caixote militar de suprimentos (96x96 → 48x48 no mundo). */
export function supplyCrate() {
  const defs = SHADOW + linear('sc', [[0, '#56613a'], [1, '#3a4326']], 0, 0, 1, 1);
  let s = `<rect x="14" y="16" width="74" height="74" rx="4" fill="#000" opacity=".55" filter="url(#es)"/>`;
  s += `<rect x="8" y="8" width="74" height="74" rx="4" fill="url(#sc)" stroke="#1c2112" stroke-width="2.5"/>`;
  s += `<rect x="8" y="8" width="74" height="74" rx="4" fill="none" stroke="#2b3219" stroke-width="8"/>`;
  // Cintas
  s += `<rect x="38" y="8" width="14" height="74" fill="#2a2a22"/><rect x="8" y="38" width="74" height="14" fill="#2a2a22"/>`;
  s += `<rect x="36" y="36" width="18" height="18" rx="2" fill="#8a8a7a"/>`;
  // Marca branca
  s += `<rect x="16" y="16" width="16" height="4" fill="#e8e2c8" opacity=".85"/><rect x="22" y="12" width="4" height="12" fill="#e8e2c8" opacity=".85"/>`;
  s += `<rect x="60" y="64" width="14" height="4" fill="#e8e2c8" opacity=".6"/>`;
  return svgDoc(96, 96, defs, s);
}

/** Paraquedas visto de cima (192x192): gomos alternados laranja e branco. */
export function parachute() {
  let s = '';
  const n = 10;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = ((i + 1) / n) * Math.PI * 2;
    const p = (a, rr) => `${(96 + Math.cos(a) * rr).toFixed(1)} ${(96 + Math.sin(a) * rr).toFixed(1)}`;
    s += `<path d="M96 96 L${p(a0, 88)} Q${p((a0 + a1) / 2, 100)} ${p(a1, 88)} Z" fill="${i % 2 ? '#e8e2c8' : '#d2692a'}" stroke="#5a2a10" stroke-width="1.5"/>`;
  }
  s += `<circle cx="96" cy="96" r="10" fill="#3a2a1a"/>`;
  return svgDoc(192, 192, radial('pc', [[0, '#fff'], [1, '#000']]), s);
}

/** Cano rompido no chão, origem do vazamento de gás (112x64 → 56x32). */
export function gasPipe() {
  const defs = SHADOW + linear('gp', [[0, '#8a7a3a'], [0.5, '#6a5c28'], [1, '#4a4018']], 0, 0, 0, 1);
  let s = `<rect x="10" y="22" width="96" height="32" rx="8" fill="#000" opacity=".5" filter="url(#es)"/>`;
  s += `<rect x="4" y="18" width="84" height="26" rx="6" fill="url(#gp)" stroke="#221c08" stroke-width="2"/>`;
  s += `<rect x="20" y="14" width="10" height="34" rx="2" fill="#3a3a36" stroke="#161614" stroke-width="1.5"/>`;
  // Ponta rasgada
  s += `<path d="M88 18 L98 22 L92 28 L102 32 L94 38 L100 44 L88 44 Z" fill="#4a4018" stroke="#221c08" stroke-width="1.5"/>`;
  s += `<rect x="40" y="22" width="30" height="5" fill="#c9a227" opacity=".7"/>`;
  s += `<path d="M48 30 L52 26 L56 30 L52 34 Z" fill="#1b1b1b" opacity=".7"/>`;
  return svgDoc(112, 64, defs, s);
}
