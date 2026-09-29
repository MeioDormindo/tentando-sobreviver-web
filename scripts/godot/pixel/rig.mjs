// Esqueleto simples de peças rígidas, poses por quadros-chave e montagem das folhas de
// sprites em 8 direções (a mesma vista 3/4 da câmera do jogo).
import { Pixels, drawBoxes, projector, ident, mul, translate, scale, rotX, rotY, rotZ, apply } from './raster.mjs';
import { renderSdf } from './sdf.mjs';
import { packShelf } from './pack.mjs';

/** Ângulo de cada direção: 0 = olhando para a câmera (sul, +Z do Godot), 90° = leste (+X). */
export const DIRECTIONS = 8;

// A compressão de GPU (VRAM Compressed: BC7/S3TC) codifica blocos de 4×4 texels. Cada quadro
// ocupa um espaço de múltiplos de 4 na folha, então nenhum bloco mistura dois quadros — senão a
// borda de um quadro vizinho vaza pra dentro deste (lasquinhas finas ao lado do personagem).
const BLOCK = 4;
const toBlock = (v) => Math.ceil(v / BLOCK) * BLOCK;

/**
 * Rotação local de um osso a partir da pose semântica:
 * - swing: membro que aponta para baixo (braço, perna) vai para a frente (+);
 * - lean: tronco/cabeça (apontam para cima) inclina para a frente (+);
 * - spread: abre para o lado de fora (+); side: +1 lado direito (+x), -1 esquerdo;
 * - twist: gira em torno do eixo vertical.
 */
function boneRotation(bone, p) {
  let r = ident();
  if (p.twist) r = mul(r, rotZ(p.twist));
  if (p.spread) r = mul(r, rotY(-p.spread * (bone.side || 1)));
  if (p.swing) r = mul(r, rotX(p.swing));
  if (p.lean) r = mul(r, rotX(-p.lean));
  return r;
}

/** Matrizes de cada osso (espaço do modelo) para uma pose. */
export function solve(bones, pose) {
  const out = {};
  for (const bone of bones) {
    const p = pose[bone.name] || {};
    const parent = bone.parent ? out[bone.parent] : ident();
    const loc = p.loc || [0, 0, 0];
    const [px, py, pz] = bone.pivot;
    out[bone.name] = mul(parent, mul(translate(loc[0], loc[1], loc[2]),
      mul(translate(px, py, pz), mul(boneRotation(bone, p), translate(-px, -py, -pz)))));
  }
  return out;
}

/** Interpola as poses dos quadros-chave (listas de [tempo 0..1, pose]). */
export function sample(keys, t) {
  let a = keys[0], b = keys[keys.length - 1];
  for (let i = 0; i < keys.length - 1; i++) {
    if (t >= keys[i][0] && t <= keys[i + 1][0]) {
      a = keys[i];
      b = keys[i + 1];
      break;
    }
  }
  const span = b[0] - a[0];
  const k = span > 0 ? (t - a[0]) / span : 0;
  const pose = {};
  const names = new Set([...Object.keys(a[1]), ...Object.keys(b[1])]);
  for (const name of names) {
    const pa = a[1][name] || {}, pb = b[1][name] || {};
    const q = {};
    for (const key of ['swing', 'lean', 'spread', 'twist']) {
      const va = pa[key] || 0, vb = pb[key] || 0;
      if (va || vb) q[key] = va + (vb - va) * k;
    }
    if (pa.loc || pb.loc) {
      const la = pa.loc || [0, 0, 0], lb = pb.loc || [0, 0, 0];
      q.loc = la.map((v, i) => v + (lb[i] - v) * k);
    }
    pose[name] = q;
  }
  return pose;
}

/** Matriz do modelo para o mundo do desenho, olhando para a direção `index`. */
export function facing(index) {
  const a = (index * 2 * Math.PI) / DIRECTIONS;
  const ca = Math.cos(a), sa = Math.sin(a);
  // x (direita do personagem) → (-cos, sen); y (frente) → (sen, cos); z → z.
  return [-ca, sa, 0, 0, sa, ca, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

/** Caixas de um personagem numa pose e direção (mundo do desenho). */
export function posedBoxes(model, pose, dirIndex, only = null) {
  // Deslocamentos da pose acompanham a escala do modelo (tanque, bosses).
  const k = model.scale || 1;
  const scaled = {};
  for (const [name, q] of Object.entries(pose)) scaled[name] = q.loc ? { ...q, loc: q.loc.map((v) => v * k) } : q;
  const bones = solve(model.bones, scaled);
  const f = facing(dirIndex);
  const boxes = [];
  for (const part of model.parts) {
    if (only && !only(part)) continue;
    let m;
    if (part.attach) {
      m = part.attach(bones);
    } else {
      m = bones[part.bone] || ident();
    }
    const rot = part.rot || [0, 0, 0];
    const local = mul(translate(...part.at), mul(rotZ(rot[2]), mul(rotY(rot[1]), mul(rotX(rot[0]), scale(...part.size)))));
    boxes.push({ m: mul(f, mul(m, local)), color: part.color, flat: part.flat, layer: part.layer || 'body', shape: part.shape, round: part.round });
  }
  return boxes;
}

/**
 * Monta a folha: 8 blocos verticais (um por direção), cada um com os quadros de todas as
 * animações empacotados lado a lado (shelf packing), cada quadro recortado no seu próprio
 * bounding-box — não num tamanho de célula único pra folha inteira (isso desperdiçava 80%+
 * de cada célula em pixel transparente). `meta.cells[i]` guarda, por quadro, onde ele foi
 * parar na folha empacotada (`region`) e o deslocamento dele dentro do quadro lógico global
 * (`margin`, usado pelo `AtlasTexture` no Godot pra manter pivot/alinhamento sem recalcular).
 * animations: [{ name, frames, fps, loop, keys }]. layers: {nome: filtro de peças}.
 * Devolve { sheets: {camada: Pixels}, meta }.
 */
export function buildSheet(model, animations, { pitch, layers = { body: null }, workSize = 200, fixedFrame = null, ppm = 48, renderer = 'sdf', occlude = false, maxSheetWidth = 4096 }) {
  // Tamanhos pensados em 32 px/m; com outra densidade, a área de trabalho acompanha.
  workSize = Math.round((workSize * ppm) / 32);
  if (fixedFrame) fixedFrame = { size: fixedFrame.size.map((v) => Math.round((v * ppm) / 32)), pivot: fixedFrame.pivot.map((v) => Math.round((v * ppm) / 32)) };
  const proj = projector(pitch, ppm);
  const originX = workSize / 2, originY = workSize * 0.7;
  const frames = []; // [dir][frame] = {layer: Pixels}
  const animMeta = {};
  let column = 0;
  for (const anim of animations) {
    animMeta[anim.name] = { start: column, count: anim.frames, fps: anim.fps, loop: anim.loop };
    column += anim.frames;
  }
  let union = null;
  const behind = [];
  for (let dir = 0; dir < DIRECTIONS; dir++) {
    frames[dir] = [];
    for (const anim of animations) {
      for (let i = 0; i < anim.frames; i++) {
        const t = anim.loop ? i / anim.frames : (anim.frames > 1 ? i / (anim.frames - 1) : 0);
        const pose = sample(anim.keys, t);
        const out = { bounds: {} };
        for (const [layer, filter] of Object.entries(layers)) {
          const canvas = new Pixels(workSize, workSize);
          // occlude: a camada é desenhada com o modelo todo e guarda só o que fica na frente.
          const boxes = posedBoxes(model, pose, dir, occlude ? null : filter);
          if (renderer === 'sdf') renderSdf(canvas, boxes, pitch, ppm, originX, originY, occlude ? filter : null);
          else drawBoxes(canvas, boxes, proj, originX, originY);
          canvas.outline();
          out[layer] = canvas;
          const b = canvas.bounds();
          out.bounds[layer] = b;
          if (b) union = union ? {
            minX: Math.min(union.minX, b.minX), minY: Math.min(union.minY, b.minY),
            maxX: Math.max(union.maxX, b.maxX), maxY: Math.max(union.maxY, b.maxY),
          } : b;
        }
        frames[dir].push(out);
      }
    }
    // Camada da arma atrás do corpo quando o personagem olha para longe da câmera.
    if (layers.weapon && !occlude) {
      const pose = sample(animations[0].keys, 0);
      const all = posedBoxes(model, pose, dir);
      const depthOf = (list) => list.reduce((s, b) => s + proj.depth(apply(b.m, [0, 0, 0])), 0) / Math.max(1, list.length);
      behind.push(depthOf(all.filter((b) => b.layer === 'weapon')) < depthOf(all.filter((b) => b.layer === 'body')));
    }
  }
  // Quadro comum a todas as poses (+1 px de folga), pés no pivô. Com fixedFrame, o quadro é
  // dado (folhas que se sobrepõem, como corpo e arma, precisam do mesmo quadro).
  const pad = 1;
  let minX, minY, w, h;
  if (fixedFrame) {
    [w, h] = fixedFrame.size;
    minX = originX - fixedFrame.pivot[0];
    minY = originY - fixedFrame.pivot[1];
  } else {
    minX = Math.max(0, union.minX - pad);
    minY = Math.max(0, union.minY - pad);
    w = union.maxX + pad - minX + 1;
    h = union.maxY + pad - minY + 1;
  }
  const sheets = {};
  let cells = null;
  let sheetDims = null;
  for (const layer of Object.keys(layers)) {
    // Recorte individual de cada quadro (seu próprio bounding-box, não o `w×h` global).
    const trims = frames.map((dirFrames) => dirFrames.map((out) => {
      const b = out.bounds[layer];
      if (!b) return [minX, minY, 1, 1]; // quadro totalmente vazio (ex.: arma 100% atrás do corpo)
      const fMinX = Math.max(0, b.minX - pad);
      const fMinY = Math.max(0, b.minY - pad);
      const fMaxX = Math.min(workSize - 1, b.maxX + pad);
      const fMaxY = Math.min(workSize - 1, b.maxY + pad);
      const fw = fMaxX - fMinX + 1, fh = fMaxY - fMinY + 1;
      // occlude: fragmento minúsculo (só a ponta da arma visível, o resto atrás do braço) fica
      // "flutuando" solto do resto do corpo — melhor sumir (como já faz quando 100% oculta)
      // do que mostrar um pedaço desconexo.
      if (occlude && fw * fh < 100) return [minX, minY, 1, 1];
      return [fMinX, fMinY, fw, fh];
    }));
    // Um bloco de shelf-packing por direção, empilhados verticalmente. Largura-alvo pela raiz
    // da área total (pacote ~quadrado, quebrando linha de verdade) em vez de uma única fileira
    // larguíssima — senão cada linha só ganha na largura e continua desperdiçando altura. Se a
    // altura total ainda estourar o teto (personagem com poses muito assimétricas entre
    // direções), tenta de novo mais largo até caber ou até o teto de largura também.
    const totalArea = trims.reduce((s, dirTrims) => s + dirTrims.reduce((s2, [, , fw, fh]) => s2 + toBlock(fw) * toBlock(fh), 0), 0);
    // O palpite inicial precisa caber pelo menos o quadro individual mais largo — senão
    // packShelf recusa de cara (poucas peças grandes têm área total pequena mas um quadro
    // sozinho pode passar do "quadrado" estimado por área).
    const widestItem = Math.max(...trims.flat().map(([, , fw]) => toBlock(fw)));
    let targetWidth = Math.min(maxSheetWidth, Math.max(64, widestItem, Math.ceil(Math.sqrt(totalArea / DIRECTIONS))));
    let blocks, sheetWidth, blockY, sheetHeight;
    for (;;) {
      blocks = trims.map((dirTrims) => packShelf(dirTrims.map(([, , fw, fh]) => [toBlock(fw), toBlock(fh)]), targetWidth));
      sheetWidth = Math.max(...blocks.map((b) => b.width));
      let cursorY = 0;
      blockY = blocks.map((b) => { const y = cursorY; cursorY += b.height; return y; });
      sheetHeight = cursorY;
      if (sheetHeight <= maxSheetWidth || targetWidth >= maxSheetWidth) break;
      targetWidth = Math.min(maxSheetWidth, Math.ceil(targetWidth * 1.5));
    }
    if (sheetHeight > maxSheetWidth) {
      throw new Error(`buildSheet: altura total ${sheetHeight}px (camada "${layer}") passa do teto ${maxSheetWidth}px mesmo na largura máxima.`);
    }
    const sheet = new Pixels(sheetWidth, sheetHeight);
    const layerCells = [];
    for (let dir = 0; dir < DIRECTIONS; dir++) {
      frames[dir].forEach((out, i) => {
        const src = out[layer];
        const [fMinX, fMinY, fw, fh] = trims[dir][i];
        const crop = new Pixels(fw, fh);
        for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
          const a = src.alpha(fMinX + x, fMinY + y);
          if (a > 0) crop.set(x, y, src.rgb(fMinX + x, fMinY + y), a);
        }
        const [rx, ry] = blocks[dir].rects[i];
        sheet.blit(crop, rx, blockY[dir] + ry);
        layerCells.push([rx, blockY[dir] + ry, fw, fh, fMinX - minX, fMinY - minY]);
      });
    }
    sheets[layer] = sheet;
    cells = layerCells; // uma camada por chamada na prática (corpo e arma são chamadas separadas)
    sheetDims = [sheetWidth, sheetHeight];
  }
  const meta = {
    format_version: 2,
    frame: [w, h],
    pivot: [originX - minX, originY - minY],
    frames_per_direction: column,
    directions: DIRECTIONS,
    direction_angle: 'dir = round(atan2(facing.x, facing.z) / 45°) mod 8; 0 = olhando para a câmera (+Z), 2 = leste (+X)',
    pitch,
    pixels_per_meter: ppm,
    sheet: sheetDims,
    animations: animMeta,
    cells,
  };
  if (behind.length) meta.weapon_behind = behind;
  return { sheets, meta, union: union && { minX: union.minX - originX, minY: union.minY - originY, maxX: union.maxX - originX, maxY: union.maxY - originY } };
}

/**
 * Ícone de peças soltas (arma de perfil): desenha na direção `dir` e recorta justo.
 * parts: [{ at, size, color, flat?, shape?, round?, rot? }].
 */
export function renderIcon(parts, { pitch = 8, ppm = 96, dir = 2, size = 256 } = {}) {
  const f = facing(dir);
  const boxes = parts.map((part) => {
    const rot = part.rot || [0, 0, 0];
    const local = mul(translate(...part.at), mul(rotZ(rot[2]), mul(rotY(rot[1]), mul(rotX(rot[0]), scale(...part.size)))));
    return { m: mul(f, local), color: part.color, flat: part.flat, shape: part.shape, round: part.round };
  });
  const canvas = new Pixels(size, size);
  renderSdf(canvas, boxes, pitch, ppm, size / 2, size / 2);
  canvas.outline();
  const b = canvas.bounds();
  const crop = new Pixels(b.maxX - b.minX + 3, b.maxY - b.minY + 3);
  for (let y = b.minY; y <= b.maxY; y++) for (let x = b.minX; x <= b.maxX; x++) {
    const a = canvas.alpha(x, y);
    if (a > 0) crop.set(x - b.minX + 1, y - b.minY + 1, canvas.rgb(x, y), a);
  }
  return crop;
}
