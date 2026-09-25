// Rasterizador de pixel art: um "boneco" de peças-caixa, preso a ossos, projetado na
// mesma vista 3/4 da câmera do jogo e pintado em pixels (faces planas, poucos tons,
// contorno escuro). Sem suavização: cada pixel é uma cor da paleta.

export const PX_PER_M = 32;

// ───────────────────────── Matrizes 4×4 (colunas: x, y, z, translação) ─────────────────────────

export const ident = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

export function mul(a, b) {
  const r = new Array(16).fill(0);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) r[i * 4 + j] += a[i * 4 + k] * b[k * 4 + j];
  return r;
}

export const translate = (x, y, z) => [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z, 0, 0, 0, 1];
export const scale = (x, y, z) => [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1];

export function rotX(a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0, 0, 0, 0, 1];
}
export function rotY(a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, 0, 0, 0, 1];
}
export function rotZ(a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

export const apply = (m, p) => [
  m[0] * p[0] + m[1] * p[1] + m[2] * p[2] + m[3],
  m[4] * p[0] + m[5] * p[1] + m[6] * p[2] + m[7],
  m[8] * p[0] + m[9] * p[1] + m[10] * p[2] + m[11],
];

// ───────────────────────── Cores ─────────────────────────

export function hex(value) {
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** Tom de luz (0..1) em poucos degraus, com sombra puxando para o frio (azulado). */
const LEVELS = [0.5, 0.66, 0.82, 1.0];
export function shade(color, light) {
  let level = LEVELS[0];
  for (const l of LEVELS) if (light >= l - 0.08) level = l;
  const cool = (1 - level) * 0.35;
  return [
    Math.round(color[0] * level * (1 - cool * 0.3)),
    Math.round(color[1] * level * (1 - cool * 0.1)),
    Math.round(Math.min(255, color[2] * level * (1 + cool * 0.25))),
  ];
}

// ───────────────────────── Tela de pixels ─────────────────────────

export class Pixels {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
  }

  set(x, y, rgb, alpha = 255) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 4;
    this.data[i] = rgb[0];
    this.data[i + 1] = rgb[1];
    this.data[i + 2] = rgb[2];
    this.data[i + 3] = alpha;
  }

  alpha(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return 0;
    return this.data[(y * this.width + x) * 4 + 3];
  }

  rgb(x, y) {
    const i = (y * this.width + x) * 4;
    return [this.data[i], this.data[i + 1], this.data[i + 2]];
  }

  /** Polígono convexo (pontos em pixels): pinta os pixels cujo centro está dentro. */
  fillConvex(points, rgb) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of points) {
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
    // Área sinalizada decide o sentido das arestas.
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const [x0, y0] = points[i];
      const [x1, y1] = points[(i + 1) % points.length];
      area += x0 * y1 - x1 * y0;
    }
    if (Math.abs(area) < 1e-6) return;
    const sign = area > 0 ? 1 : -1;
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      for (let x = Math.floor(minX); x <= Math.ceil(maxX); x++) {
        const px = x + 0.5, py = y + 0.5;
        let inside = true;
        for (let i = 0; i < points.length && inside; i++) {
          const [x0, y0] = points[i];
          const [x1, y1] = points[(i + 1) % points.length];
          if (((x1 - x0) * (py - y0) - (y1 - y0) * (px - x0)) * sign < -0.01) inside = false;
        }
        if (inside) this.set(x, y, rgb);
      }
    }
  }

  /** Contorno de 1 px por fora da silhueta, com a cor vizinha bem escurecida. */
  outline(factor = 0.28) {
    const marks = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.alpha(x, y) > 0) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (this.alpha(x + dx, y + dy) > 0) {
            const c = this.rgb(x + dx, y + dy);
            marks.push([x, y, [c[0] * factor, c[1] * factor, c[2] * factor].map(Math.round)]);
            break;
          }
        }
      }
    }
    for (const [x, y, c] of marks) this.set(x, y, c);
  }

  /** Copia outro Pixels para (ox, oy), espelhando na horizontal se pedir. */
  blit(src, ox, oy) {
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        const a = src.alpha(x, y);
        if (a > 0) this.set(ox + x, oy + y, src.rgb(x, y), a);
      }
    }
  }

  bounds() {
    let minX = this.width, minY = this.height, maxX = -1, maxY = -1;
    for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) {
      if (this.alpha(x, y) > 0) {
        minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      }
    }
    return maxX < 0 ? null : { minX, minY, maxX, maxY };
  }
}

// ───────────────────────── Projeção 3/4 ─────────────────────────

/**
 * Mundo do desenho: X para a direita da tela, D na direção da câmera (o "sul" da tela,
 * +Z do Godot), Z para cima. A câmera olha de cima com inclinação `pitch` (a mesma do jogo).
 */
export function projector(pitchDegrees) {
  const p = (pitchDegrees * Math.PI) / 180;
  const sp = Math.sin(p), cp = Math.cos(p);
  return {
    // Tela (pixels, y para baixo) relativa ao pé do personagem.
    screen: ([x, d, z]) => [x * PX_PER_M, (d * sp - z * cp) * PX_PER_M],
    // Profundidade: maior = mais perto da câmera (desenhado por último).
    depth: ([, d, z]) => d * cp + z * sp,
    toCamera: [0, cp, sp],
  };
}

/** Luz de cima, da esquerda e da frente (em X, D, Z). */
const LIGHT = (() => {
  const v = [-0.45, 0.55, 0.9];
  const n = Math.hypot(...v);
  return v.map((c) => c / n);
})();

const CUBE = [
  [-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5],
  [-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5],
];
const FACES = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [1, 2, 6, 5], [3, 0, 4, 7]];

/**
 * Desenha caixas já em coordenadas do mundo do desenho.
 * boxes: [{ m: matriz 4×4 (caixa unitária → mundo), color: [r,g,b] }]
 */
export function drawBoxes(canvas, boxes, proj, originX, originY) {
  const faces = [];
  for (const box of boxes) {
    const pts = CUBE.map((c) => apply(box.m, c));
    const center = apply(box.m, [0, 0, 0]);
    for (const face of FACES) {
      const a = pts[face[0]], b = pts[face[1]], c = pts[face[2]];
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const len = Math.hypot(...n) || 1;
      n = n.map((x) => x / len);
      // Garante a normal para fora da caixa.
      const fc = face.map((i) => pts[i]).reduce((s, p) => [s[0] + p[0] / 4, s[1] + p[1] / 4, s[2] + p[2] / 4], [0, 0, 0]);
      if ((fc[0] - center[0]) * n[0] + (fc[1] - center[1]) * n[1] + (fc[2] - center[2]) * n[2] < 0) n = n.map((x) => -x);
      if (n[0] * proj.toCamera[0] + n[1] * proj.toCamera[1] + n[2] * proj.toCamera[2] <= 0.02) continue;
      const light = 0.42 + 0.58 * Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
      faces.push({
        depth: proj.depth(fc),
        points: face.map((i) => {
          const [sx, sy] = proj.screen(pts[i]);
          return [originX + sx, originY + sy];
        }),
        rgb: box.flat ? box.color : shade(box.color, light),
      });
    }
  }
  faces.sort((a, b) => a.depth - b.depth);
  for (const f of faces) canvas.fillConvex(f.points, f.rgb);
}
