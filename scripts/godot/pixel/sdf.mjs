// Renderizador "Pixar em pixel": cada pixel lança um raio da câmera (a mesma vista 3/4 do
// jogo) contra as peças do personagem como formas arredondadas (caixas de canto arredondado e
// elipsoides, juntas fundidas suavemente). A cor sai de uma rampa de 6 tons por material
// (sombra fria, luz quente), com luz de borda, oclusão nos cantos, contorno por fora e linhas
// internas onde a profundidade salta. Sem suavização entre pixels: cada pixel é um tom.

/** Converte a matriz da peça (cubo unitário → mundo) em centro, eixos e meias medidas. */
function frameOf(part) {
  const m = part.m;
  const cols = [[m[0], m[4], m[8]], [m[1], m[5], m[9]], [m[2], m[6], m[10]]];
  const half = cols.map((c) => Math.hypot(c[0], c[1], c[2]) * 0.5);
  const axes = cols.map((c, i) => c.map((v) => v / (half[i] * 2 || 1)));
  const smallest = Math.min(half[0], half[1], half[2]);
  return {
    cx: m[3], cy: m[7], cz: m[11],
    ax: axes[0], ay: axes[1], az: axes[2],
    hx: half[0], hy: half[1], hz: half[2],
    radius: Math.hypot(half[0], half[1], half[2]),
    round: part.shape === 'ellipsoid' ? 0 : Math.min(smallest * 0.95, part.round ?? smallest * 0.55),
    ellipsoid: part.shape === 'ellipsoid',
    color: part.color,
    flat: part.flat,
    layer: part.layer,
  };
}

function partDistance(f, px, py, pz) {
  const dx = px - f.cx, dy = py - f.cy, dz = pz - f.cz;
  const qx = dx * f.ax[0] + dy * f.ax[1] + dz * f.ax[2];
  const qy = dx * f.ay[0] + dy * f.ay[1] + dz * f.ay[2];
  const qz = dx * f.az[0] + dy * f.az[1] + dz * f.az[2];
  if (f.ellipsoid) {
    const k0 = Math.hypot(qx / f.hx, qy / f.hy, qz / f.hz);
    const k1 = Math.hypot(qx / (f.hx * f.hx), qy / (f.hy * f.hy), qz / (f.hz * f.hz));
    return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(f.hx, f.hy, f.hz);
  }
  const r = f.round;
  const ex = Math.abs(qx) - (f.hx - r), ey = Math.abs(qy) - (f.hy - r), ez = Math.abs(qz) - (f.hz - r);
  const ox = Math.max(ex, 0), oy = Math.max(ey, 0), oz = Math.max(ez, 0);
  return Math.hypot(ox, oy, oz) + Math.min(Math.max(ex, Math.max(ey, ez)), 0) - r;
}

/** União suave (k em metros): junta as peças como uma forma só nas emendas. */
function smin(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

const SMOOTH = 0.02;

function sceneDistance(list, px, py, pz) {
  let d = Infinity;
  for (let i = 0; i < list.length; i++) {
    const di = partDistance(list[i], px, py, pz);
    d = d === Infinity ? di : smin(d, di, SMOOTH);
  }
  return d;
}

function nearestPart(list, px, py, pz) {
  let best = null, bd = Infinity;
  for (const f of list) {
    const d = partDistance(f, px, py, pz);
    if (d < bd) {
      bd = d;
      best = f;
    }
  }
  return best;
}

// Luzes (mundo do desenho: X direita, D para a câmera, Z cima).
const norm = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
const KEY = norm([-0.55, 0.45, 0.8]);
const FILL = norm([0.7, 0.3, 0.2]);

/** Rampa de 6 tons: sombra puxando para o frio (azul/roxo), luz para o quente. */
const LEVELS = [0.34, 0.48, 0.63, 0.78, 0.91, 1.04];
function toneColor(base, light) {
  let index = 0;
  for (let i = 0; i < LEVELS.length; i++) if (light >= LEVELS[i] - 0.07) index = i;
  const level = LEVELS[index];
  const cold = Math.max(0, 0.7 - level) * 0.55;
  const warm = Math.max(0, level - 0.85) * 0.9;
  return [
    Math.round(Math.min(255, base[0] * level * (1 - cold * 0.35) * (1 + warm * 0.25) + warm * 22)),
    Math.round(Math.min(255, base[1] * level * (1 - cold * 0.15) * (1 + warm * 0.12) + warm * 14)),
    Math.round(Math.min(255, base[2] * level * (1 + cold * 0.45) * (1 - warm * 0.1))),
  ];
}

/**
 * Desenha as peças na tela.
 * parts: [{ m, color, flat, shape, round }]; proj: { pitch em graus, ppm }.
 */
/** keep(peça): só pinta os pixels em que a peça da frente passa no filtro (as outras só tampam). */
export function renderSdf(canvas, parts, pitchDegrees, ppm, originX, originY, keep = null) {
  const p = (pitchDegrees * Math.PI) / 180;
  const sp = Math.sin(p), cp = Math.cos(p);
  const vx = 0, vy = cp, vz = sp; // para a câmera
  const ux = 0, uy = -sp, uz = cp; // "para cima" na tela
  const frames = parts.map(frameOf);
  // Caixa da tela que as peças ocupam.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const f of frames) {
    const sx = f.cx * ppm, sy = (f.cy * sp - f.cz * cp) * ppm, r = f.radius * ppm + 2;
    minX = Math.min(minX, sx - r); maxX = Math.max(maxX, sx + r);
    minY = Math.min(minY, sy - r); maxY = Math.max(maxY, sy + r);
  }
  const x0 = Math.max(0, Math.floor(originX + minX)), x1 = Math.min(canvas.width - 1, Math.ceil(originX + maxX));
  const y0 = Math.max(0, Math.floor(originY + minY)), y1 = Math.min(canvas.height - 1, Math.ceil(originY + maxY));
  const depth = new Float32Array(canvas.width * canvas.height).fill(-Infinity);
  const candidates = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      // Ponto do raio no plano da tela que passa pela origem.
      const sx = (x + 0.5 - originX) / ppm, sy = (y + 0.5 - originY) / ppm;
      const bx = sx, by = -sy * uy, bz = -sy * uz;
      // Peças que o raio atravessa (esfera envolvente) e o trecho do raio a percorrer.
      candidates.length = 0;
      let tStart = -Infinity, tEnd = Infinity;
      for (const f of frames) {
        const ox = f.cx - bx, oy = f.cy - by, oz = f.cz - bz;
        const along = ox * vx + oy * vy + oz * vz;
        const px = ox - along * vx, py = oy - along * vy, pz = oz - along * vz;
        const miss = f.radius * f.radius - (px * px + py * py + pz * pz);
        if (miss < 0) continue;
        const half = Math.sqrt(miss);
        candidates.push(f);
        tStart = Math.max(tStart, along + half);
        tEnd = Math.min(tEnd, along - half);
      }
      if (!candidates.length) continue;
      let low = Infinity;
      for (const f of candidates) {
        const ox = f.cx - bx, oy = f.cy - by, oz = f.cz - bz;
        low = Math.min(low, ox * vx + oy * vy + oz * vz - f.radius);
      }
      // Marcha do lado da câmera para longe.
      let t = tStart, hit = false;
      for (let step = 0; step < 48 && t > low; step++) {
        const d = sceneDistance(candidates, bx + vx * t, by + vy * t, bz + vz * t);
        if (d < 0.0015) { hit = true; break; }
        t -= Math.max(d, 0.002);
      }
      if (!hit) continue;
      const hx = bx + vx * t, hy = by + vy * t, hz = bz + vz * t;
      const part = nearestPart(candidates, hx, hy, hz);
      if (keep && !keep(part)) continue;
      let color;
      if (part.flat) {
        color = part.color;
      } else {
        // Normal pelo gradiente (4 amostras).
        const e = 0.004;
        const d1 = sceneDistance(candidates, hx + e, hy - e, hz - e);
        const d2 = sceneDistance(candidates, hx - e, hy - e, hz + e);
        const d3 = sceneDistance(candidates, hx - e, hy + e, hz - e);
        const d4 = sceneDistance(candidates, hx + e, hy + e, hz + e);
        const n = norm([d1 - d2 - d3 + d4, -d1 - d2 + d3 + d4, -d1 + d2 - d3 + d4]);
        const key = n[0] * KEY[0] + n[1] * KEY[1] + n[2] * KEY[2];
        const fill = Math.max(0, n[0] * FILL[0] + n[1] * FILL[1] + n[2] * FILL[2]);
        const facing = Math.max(0, n[0] * vx + n[1] * vy + n[2] * vz);
        const rim = Math.pow(1 - facing, 3) * 0.35;
        // Oclusão: o quanto há corpo logo à frente da normal.
        const ao = Math.min(1, Math.max(0, sceneDistance(candidates, hx + n[0] * 0.05, hy + n[1] * 0.05, hz + n[2] * 0.05) / 0.05));
        const light = (0.3 + 0.62 * Math.max(0, key * 0.8 + 0.2) + 0.14 * fill + rim) * (0.72 + 0.28 * ao);
        color = toneColor(part.color, light);
      }
      canvas.set(x, y, color);
      depth[y * canvas.width + x] = t;
    }
  }
  // Linhas internas: onde a profundidade salta, o pixel de trás escurece (lê a silhueta
  // de braços e pernas na frente do corpo).
  const marks = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = depth[y * canvas.width + x];
      if (d === -Infinity) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= canvas.width || ny >= canvas.height) continue;
        const nd = depth[ny * canvas.width + nx];
        if (nd !== -Infinity && nd - d > 0.09) {
          marks.push([x, y]);
          break;
        }
      }
    }
  }
  for (const [x, y] of marks) {
    const c = canvas.rgb(x, y);
    canvas.set(x, y, [Math.round(c[0] * 0.55), Math.round(c[1] * 0.55), Math.round(c[2] * 0.62)]);
  }
}
