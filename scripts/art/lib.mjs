// Utilitários compartilhados pelo gerador de arte SVG.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/** Gerador pseudoaleatório determinístico (mulberry32) — a arte é reproduzível. */
export function rng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min, max) => min + next() * (max - min),
    int: (min, max) => Math.floor(min + next() * (max - min + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
  };
}

export const f = (n) => (Math.round(n * 100) / 100).toString();

export function svgDoc(width, height, defs, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<defs>${defs}</defs>${body}</svg>\n`;
}

/** Monta uma spritesheet horizontal: cada frame é deslocado em X. */
export function sheet(frameW, frameH, defs, frames) {
  const body = frames
    .map((content, i) => `<g transform="translate(${i * frameW} 0)">${content}</g>`)
    .join('');
  return svgDoc(frameW * frames.length, frameH, defs, body);
}

export function write(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf8');
  console.log('  ', path, `(${(content.length / 1024).toFixed(1)} KB)`);
}

/**
 * Cinemática inversa de dois segmentos (ombro → cotovelo → mão).
 * bend = -1 dobra o cotovelo para um lado, +1 para o outro.
 */
export function ik(shoulder, hand, upper, fore, bend) {
  const [sx, sy] = shoulder;
  let dx = hand[0] - sx;
  let dy = hand[1] - sy;
  let d = Math.hypot(dx, dy);
  const max = upper + fore - 0.5;
  const min = Math.abs(upper - fore) + 0.5;
  const ang = Math.atan2(dy, dx);
  d = Math.min(max, Math.max(min, d));
  const cosA = (upper * upper + d * d - fore * fore) / (2 * upper * d);
  const A = Math.acos(Math.max(-1, Math.min(1, cosA)));
  const ea = ang + bend * A;
  const elbow = [sx + Math.cos(ea) * upper, sy + Math.sin(ea) * upper];
  const reach = [sx + Math.cos(ang) * d, sy + Math.sin(ang) * d];
  return { elbow, hand: reach };
}

export function line(a, b, color, width, extra = '') {
  return `<path d="M${f(a[0])} ${f(a[1])} L${f(b[0])} ${f(b[1])}" stroke="${color}" stroke-width="${width}" stroke-linecap="round" fill="none" ${extra}/>`;
}

export function polyline(points, color, width, extra = '') {
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${f(p[0])} ${f(p[1])}`).join(' ');
  return `<path d="${d}" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" fill="none" ${extra}/>`;
}

/** Contorno irregular e suave (manchas de sangue, poças, rasgos). */
export function blobPath(cx, cy, radius, jitter, points, r) {
  const pts = [];
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2;
    const rad = radius * (1 - jitter / 2 + r.next() * jitter);
    pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
  }
  let d = '';
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const n = pts[(i + 1) % pts.length];
    const mid = [(p[0] + n[0]) / 2, (p[1] + n[1]) / 2];
    d += i === 0 ? `M${f(mid[0])} ${f(mid[1])}` : '';
    d += ` Q${f(n[0])} ${f(n[1])} ${f((n[0] + pts[(i + 2) % pts.length][0]) / 2)} ${f((n[1] + pts[(i + 2) % pts.length][1]) / 2)}`;
  }
  return d + ' Z';
}

/** Contorno de elipse com bordas rasgadas (roupas danificadas). */
export function raggedEllipse(cx, cy, rx, ry, jitter, points, r) {
  const d = [];
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2;
    const k = 1 - r.next() * jitter;
    d.push(`${i ? 'L' : 'M'}${f(cx + Math.cos(a) * rx * k)} ${f(cy + Math.sin(a) * ry * k)}`);
  }
  return d.join(' ') + ' Z';
}

export function radial(id, stops, cx = '35%', cy = '30%', r = '75%') {
  const s = stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('');
  return `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${s}</radialGradient>`;
}

export function linear(id, stops, x1 = 0, y1 = 0, x2 = 0, y2 = 1) {
  const s = stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('');
  return `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${s}</linearGradient>`;
}
