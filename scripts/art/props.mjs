// Props extras do terminal (GDD §52): extintor, carrinho, palete, placa, mesa com computador,
// cadeira, armários, barreira, cabos, tubulação e vitrine. Vista de cima, escala 2x.
import { blobPath, line, linear, radial, rng, svgDoc } from './lib.mjs';

const SHADOW = `<filter id="ps" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.5"/></filter>`;
const shadowRect = (x, y, w, h, rx = 4) => `<rect x="${x + 5}" y="${y + 7}" width="${w}" height="${h}" rx="${rx}" fill="#000" opacity=".5" filter="url(#ps)"/>`;

/** Extintor de parede (48x64 → 24x32). */
export function extinguisher() {
  const defs = SHADOW + radial('ex', [[0, '#e0503c'], [0.7, '#a82a1c'], [1, '#6a150c']], '38%', '35%');
  let s = `<circle cx="27" cy="36" r="15" fill="#000" opacity=".5" filter="url(#ps)"/>`;
  s += `<circle cx="24" cy="32" r="14" fill="url(#ex)" stroke="#3a0b06" stroke-width="2"/>`;
  s += `<rect x="18" y="14" width="12" height="8" rx="2" fill="#2a2a2a"/>`;
  s += `<path d="M30 18 Q42 16 40 30" fill="none" stroke="#1b1b1b" stroke-width="3"/>`;
  s += `<rect x="16" y="30" width="16" height="6" fill="#e8e2c8" opacity=".85"/>`;
  return svgDoc(48, 64, defs, s);
}

/** Carrinho de bagagem com malas (128x80 → 64x40). */
export function luggageCart() {
  const defs = SHADOW + linear('lc', [[0, '#8a8f94'], [1, '#5b6166']]);
  let s = shadowRect(8, 10, 112, 60);
  s += `<rect x="8" y="10" width="112" height="60" rx="4" fill="#2a2d30" stroke="#15171a" stroke-width="2"/>`;
  for (let x = 16; x < 116; x += 12) s += line([x, 14], [x, 66], '#3c4146', 2);
  s += `<rect x="4" y="6" width="8" height="68" rx="3" fill="url(#lc)"/>`;
  s += `<rect x="108" y="30" width="16" height="20" rx="3" fill="url(#lc)" stroke="#2a2d30" stroke-width="1.5"/>`;
  // Malas
  const bags = [[20, 18, 40, 26, '#5b2f2a'], [62, 16, 36, 22, '#2f4a5b'], [24, 44, 34, 20, '#4a4a2a'], [62, 40, 40, 24, '#3b1d19']];
  for (const [x, y, w, h, c] of bags) {
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${c}" stroke="#111" stroke-width="1.5"/>`;
    s += `<rect x="${x}" y="${y}" width="${w}" height="3" fill="#fff" opacity=".12"/>`;
    s += `<rect x="${x + w / 2 - 5}" y="${y - 2}" width="10" height="4" rx="1.5" fill="none" stroke="#1b1b1b" stroke-width="1.5"/>`;
  }
  return svgDoc(128, 80, defs, s);
}

/** Palete de madeira com sacos (96x96 → 48x48). */
export function pallet() {
  const r = rng(301);
  const defs = SHADOW + linear('pw', [[0, '#8b6d45'], [1, '#634a2c']]);
  let s = shadowRect(8, 8, 80, 80, 2);
  for (let i = 0; i < 6; i++) s += `<rect x="8" y="${8 + i * 13.5}" width="80" height="10" fill="url(#pw)" stroke="#3a2a16" stroke-width="1"/>`;
  for (const x of [8, 43, 78]) s += `<rect x="${x}" y="8" width="10" height="80" fill="#4a3620" opacity=".85"/>`;
  // Sacos empilhados
  for (const [cx, cy] of [[30, 32], [64, 30], [34, 64], [62, 62]]) {
    s += `<path d="${blobPath(cx, cy, 15, 0.18, 10, r)}" fill="#b8a98a" stroke="#6e6250" stroke-width="1.5"/>`;
    s += line([cx - 8, cy - 2], [cx + 8, cy + 1], '#8a7c62', 1.2);
  }
  return svgDoc(96, 96, defs, s);
}

/** Placa de sinalização em pé, com pictograma de saída (96x48 → 48x24). */
export function signStand() {
  const defs = SHADOW;
  let s = shadowRect(8, 10, 80, 28, 3);
  s += `<rect x="6" y="18" width="84" height="12" rx="2" fill="#2a2d30"/>`;
  s += `<rect x="10" y="10" width="76" height="28" rx="3" fill="#1d6b3a" stroke="#0d3a1e" stroke-width="2"/>`;
  s += `<rect x="14" y="14" width="68" height="20" rx="2" fill="#2a8a4c"/>`;
  // Pictograma: seta + pessoa correndo
  s += `<path d="M22 24 L34 24 L34 20 L42 26 L34 32 L34 28 L22 28 Z" fill="#e8f5e0"/>`;
  s += `<circle cx="58" cy="19" r="3" fill="#e8f5e0"/>` + line([58, 22], [56, 29], '#e8f5e0', 3) + line([56, 29], [62, 33], '#e8f5e0', 2.5) + line([56, 29], [51, 32], '#e8f5e0', 2.5) + line([57, 24], [63, 25], '#e8f5e0', 2.5);
  s += `<rect x="66" y="18" width="12" height="12" fill="none" stroke="#e8f5e0" stroke-width="2"/>`;
  return svgDoc(96, 48, defs, s);
}

/** Mesa com computador, teclado e papéis (128x80 → 64x40). */
export function deskComputer() {
  const defs = SHADOW + linear('dk', [[0, '#6e5a44'], [1, '#4d3e2e']]) + linear('scr', [[0, '#6fc0e8'], [1, '#2a6f99']]);
  let s = shadowRect(6, 8, 116, 64);
  s += `<rect x="6" y="8" width="116" height="64" rx="3" fill="url(#dk)" stroke="#2a2016" stroke-width="2"/>`;
  s += `<rect x="6" y="8" width="116" height="4" fill="#9a8468" opacity=".4"/>`;
  // Monitor (visto de cima: base + tela inclinada)
  s += `<rect x="40" y="14" width="48" height="10" rx="2" fill="#1b1d20"/>`;
  s += `<rect x="42" y="16" width="44" height="6" fill="url(#scr)"/>`;
  s += `<rect x="58" y="24" width="12" height="8" fill="#2a2d30"/>`;
  s += `<rect x="38" y="42" width="52" height="14" rx="2" fill="#2a2d30"/>`;
  for (let i = 0; i < 12; i++) s += `<rect x="${41 + i * 4}" y="45" width="3" height="3" fill="#4a4f55"/>`;
  s += `<rect x="41" y="50" width="46" height="3" fill="#4a4f55"/>`;
  s += `<rect x="96" y="44" width="8" height="12" rx="4" fill="#2a2d30"/>`;
  // Papéis e caneca
  s += `<rect x="12" y="20" width="20" height="26" fill="#d8d2c0" transform="rotate(-8 22 33)"/><rect x="14" y="40" width="18" height="22" fill="#cfc8b4" transform="rotate(6 23 51)"/>`;
  s += `<circle cx="108" cy="22" r="6" fill="#8a2a1c" stroke="#3a0b06" stroke-width="1.5"/><circle cx="108" cy="22" r="3.5" fill="#2a1408"/>`;
  return svgDoc(128, 80, defs, s);
}

/** Cadeira de escritório (48x48 → 24x24). */
export function chair() {
  const defs = SHADOW + radial('ch', [[0, '#3c4046'], [1, '#1f2226']], '40%', '35%');
  let s = `<circle cx="27" cy="28" r="17" fill="#000" opacity=".45" filter="url(#ps)"/>`;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    s += line([24, 24], [24 + Math.cos(a) * 19, 24 + Math.sin(a) * 19], '#15171a', 3);
  }
  s += `<rect x="11" y="10" width="26" height="24" rx="8" fill="url(#ch)" stroke="#0e0f11" stroke-width="1.5"/>`;
  s += `<rect x="12" y="6" width="24" height="8" rx="4" fill="#2a2d33" stroke="#0e0f11" stroke-width="1.5"/>`;
  return svgDoc(48, 48, defs, s);
}

/** Fileira de armários de metal (112x56 → 56x28). */
export function locker() {
  const r = rng(404);
  const defs = SHADOW + linear('lk', [[0, '#6a7a86'], [1, '#48545d']], 0, 0, 1, 0);
  let s = shadowRect(6, 6, 100, 44, 2);
  s += `<rect x="6" y="6" width="100" height="44" rx="2" fill="#2e363c" stroke="#161b1f" stroke-width="2"/>`;
  for (let i = 0; i < 4; i++) {
    const x = 8 + i * 24.5;
    s += `<rect x="${x}" y="8" width="23" height="40" fill="url(#lk)"/>`;
    for (let j = 0; j < 3; j++) s += `<rect x="${x + 5}" y="${12 + j * 4}" width="13" height="2" fill="#2e363c"/>`;
    s += `<rect x="${x + 17}" y="30" width="3" height="8" rx="1" fill="#1b1f22"/>`;
  }
  s += `<path d="${blobPath(34, 36, 7, 0.6, 8, r)}" fill="#6b3d1c" opacity=".4"/>`;
  s += `<rect x="6" y="6" width="100" height="3" fill="#a0aab2" opacity=".35"/>`;
  return svgDoc(112, 56, defs, s);
}

/** Barreira de concreto com faixas (128x40 → 64x20). */
export function barrier() {
  const defs = SHADOW + linear('br', [[0, '#9a9890'], [1, '#6c6a63']]);
  let s = shadowRect(6, 6, 116, 28, 4);
  s += `<rect x="6" y="6" width="116" height="28" rx="4" fill="url(#br)" stroke="#3a3935" stroke-width="2"/>`;
  s += `<rect x="12" y="14" width="104" height="12" fill="#c9a227"/>`;
  for (let x = 4; x < 116; x += 16) s += `<path d="M${12 + x} 26 L${20 + x} 14 L${28 + x} 14 L${20 + x} 26 Z" fill="#1b1b1b"/>`;
  s += `<rect x="6" y="6" width="116" height="4" rx="2" fill="#c8c6be" opacity=".5"/>`;
  s += `<rect x="6" y="14" width="6" height="12" fill="url(#br)"/><rect x="116" y="14" width="6" height="12" fill="url(#br)"/>`;
  return svgDoc(128, 40, defs, s);
}

/** Cabos soltos no chão (decal, 192x96). */
export function cables() {
  const r = rng(505);
  let s = '';
  const colors = ['#141414', '#1d1d1a', '#3a1a12', '#1a2430'];
  for (let i = 0; i < 4; i++) {
    let d = `M ${r.range(0, 20).toFixed(1)} ${r.range(36, 60).toFixed(1)}`;
    for (let x = 40; x <= 200; x += 40) d += ` Q ${(x - 20).toFixed(1)} ${r.range(30, 66).toFixed(1)} ${x.toFixed(1)} ${r.range(36, 60).toFixed(1)}`;
    s += `<path d="${d}" fill="none" stroke="#000" stroke-width="7" opacity=".35"/>`;
    s += `<path d="${d}" fill="none" stroke="${colors[i]}" stroke-width="4.5" stroke-linecap="round"/>`;
  }
  return svgDoc(192, 96, '', s);
}

/** Tubulação no chão junto à parede (192x40 → 96x20). */
export function floorPipe() {
  const defs = SHADOW + linear('fp', [[0, '#8f9aa2'], [0.45, '#5c666d'], [1, '#353c41']]);
  let s = shadowRect(0, 8, 192, 24, 10);
  s += `<rect x="0" y="8" width="192" height="24" rx="4" fill="url(#fp)"/>`;
  for (const x of [30, 96, 162]) s += `<rect x="${x - 6}" y="4" width="12" height="32" rx="2" fill="#4a5359" stroke="#23282c" stroke-width="1.5"/>`;
  s += `<rect x="0" y="10" width="192" height="3" fill="#c8d0d6" opacity=".35"/>`;
  s += `<circle cx="130" cy="20" r="6" fill="#b33a3a" stroke="#3a0b06" stroke-width="1.5"/>`;
  return svgDoc(192, 40, defs, s);
}

/** Vitrine de loja com produtos (128x72 → 64x36). */
export function vitrine() {
  const r = rng(606);
  const defs = SHADOW + linear('vg', [[0, '#bfe0ee', 0.35], [1, '#6fa0b8', 0.15]], 0, 0, 1, 1);
  let s = shadowRect(6, 6, 116, 60, 3);
  s += `<rect x="6" y="6" width="116" height="60" rx="3" fill="#3a3530" stroke="#161412" stroke-width="2"/>`;
  s += `<rect x="12" y="12" width="104" height="48" fill="#2a2622"/>`;
  // Produtos
  const cols = ['#c9a227', '#8a2a1c', '#2f6a8a', '#4a7a3a', '#d8d2c0', '#6a3a7a'];
  for (let i = 0; i < 9; i++) {
    const x = 18 + (i % 5) * 20 + r.range(-2, 2);
    const y = 18 + Math.floor(i / 5) * 22 + r.range(-2, 2);
    s += `<rect x="${x}" y="${y}" width="${r.range(9, 14).toFixed(1)}" height="${r.range(8, 14).toFixed(1)}" rx="2" fill="${r.pick(cols)}"/>`;
  }
  // Vidro (com rachadura)
  s += `<rect x="12" y="12" width="104" height="48" fill="url(#vg)" stroke="#a8c8d8" stroke-width="1" stroke-opacity=".5"/>`;
  s += `<path d="M84 14 L78 28 L88 34 L80 50" fill="none" stroke="#e8f4fa" stroke-width="1.2" opacity=".6"/>`;
  s += line([16, 16], [40, 16], '#fff', 2, 'opacity=".35"');
  return svgDoc(128, 72, defs, s);
}

// ───────────── Interações do mapa e easter eggs ─────────────

/** Painel de controle na parede (64x48 → 32x24): caixa metálica, alavanca e luz da cor do painel. */
export function controlPanel(accent) {
  const defs = SHADOW + linear('cp', [[0, '#6b737a'], [1, '#3e454b']], 0, 0, 1, 1);
  let s = shadowRect(6, 6, 52, 36, 3);
  s += `<rect x="6" y="6" width="52" height="36" rx="3" fill="url(#cp)" stroke="#15181b" stroke-width="2"/>`;
  s += `<rect x="10" y="10" width="44" height="6" rx="2" fill="${accent}" opacity=".9"/>`;
  s += `<rect x="12" y="20" width="16" height="16" rx="2" fill="#1c2024"/>`;
  s += `<rect x="18" y="22" width="4" height="12" rx="1" fill="#c9c3b0"/><circle cx="20" cy="22" r="3.4" fill="${accent}" stroke="#1b1b1b" stroke-width="1"/>`;
  s += `<circle cx="40" cy="28" r="7" fill="#1c2024"/><circle cx="40" cy="28" r="4.5" fill="${accent}"/><circle cx="38.5" cy="26.5" r="1.4" fill="#fff" opacity=".6"/>`;
  s += `<rect x="50" y="20" width="4" height="16" fill="#2a2f33"/>`;
  return svgDoc(64, 48, defs, s);
}

/** Grade elétrica no chão da armadilha (128x64 → 64x32, repete). */
export function trapGrate() {
  let s = `<rect width="128" height="64" fill="#23272a" opacity=".85"/>`;
  for (let x = 4; x < 128; x += 10) s += `<rect x="${x}" y="4" width="5" height="56" rx="1.5" fill="#3a4045"/>`;
  s += `<rect x="0" y="0" width="128" height="4" fill="#c9a227"/><rect x="0" y="60" width="128" height="4" fill="#c9a227"/>`;
  for (let x = -8; x < 128; x += 16) s += `<path d="M${x} 4 L${x + 8} 0 L${x + 16} 0 L${x + 8} 4 Z" fill="#1b1b1b"/><path d="M${x} 64 L${x + 8} 60 L${x + 16} 60 L${x + 8} 64 Z" fill="#1b1b1b"/>`;
  return svgDoc(128, 64, '', s);
}

/** Ursinho de pelúcia sujo (48x48 → 24x24): easter egg escondido. */
export function teddyBear() {
  const defs = SHADOW + radial('tb', [[0, '#b0865a'], [1, '#6e4a2a']], '40%', '35%');
  let s = `<circle cx="26" cy="28" r="14" fill="#000" opacity=".4" filter="url(#ps)"/>`;
  for (const [x, y] of [[13, 13], [35, 13]]) s += `<circle cx="${x}" cy="${y}" r="6" fill="url(#tb)" stroke="#3a2412" stroke-width="1.2"/><circle cx="${x}" cy="${y}" r="3" fill="#d9b88f"/>`;
  s += `<circle cx="24" cy="24" r="13" fill="url(#tb)" stroke="#3a2412" stroke-width="1.5"/>`;
  s += `<ellipse cx="24" cy="29" rx="6" ry="4.5" fill="#d9b88f"/><circle cx="24" cy="27" r="1.8" fill="#1b1310"/>`;
  s += `<circle cx="19" cy="21" r="1.7" fill="#1b1310"/><path d="M27 19.5 l3 3 m0 -3 l-3 3" stroke="#1b1310" stroke-width="1.3"/>`;
  s += `<path d="M30 30 q4 2 6 -1" stroke="#7a1a14" stroke-width="1.4" fill="none"/>`;
  return svgDoc(48, 48, defs, s);
}

/** Rádio antigo (64x48 → 32x24): mensagem escondida. */
export function radio() {
  const defs = SHADOW + linear('rd', [[0, '#6e5a3a'], [1, '#43351f']]);
  let s = shadowRect(6, 10, 52, 30, 4);
  s += `<rect x="6" y="10" width="52" height="30" rx="4" fill="url(#rd)" stroke="#1d160c" stroke-width="2"/>`;
  s += `<rect x="10" y="14" width="26" height="22" rx="2" fill="#2a2418"/>`;
  for (let y = 16; y < 35; y += 3) s += `<rect x="12" y="${y}" width="22" height="1.4" fill="#4a3f2a"/>`;
  s += `<rect x="40" y="15" width="14" height="8" rx="1" fill="#d8c88a" opacity=".85"/><path d="M44 15 v8" stroke="#8a2a1c" stroke-width="1.2"/>`;
  s += `<circle cx="43" cy="31" r="3.5" fill="#1b160c"/><circle cx="51" cy="31" r="3.5" fill="#1b160c"/>`;
  s += line([46, 10], [56, 2], '#9a9a90', 1.6);
  return svgDoc(64, 48, defs, s);
}
