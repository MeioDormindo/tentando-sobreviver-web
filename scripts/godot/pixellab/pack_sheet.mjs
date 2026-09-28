// Empacota imagens do PixelLab (uma por direção/quadro) no contrato de sprite sheet que o
// jogo espera (ver godot/scripts/characters/character_sprite.gd): grade direções x colunas,
// cada célula frame[0] x frame[1] px, personagem alinhado pelos pés no pivot.
import { decodePng, encodePng } from '../pixel/png.mjs';

/** Bounding box dos pixels não-transparentes (alpha > 0). Null se a imagem for toda vazia. */
function opaqueBounds(rgba, width, height) {
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rgba[(y * width + x) * 4 + 3] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return maxX < 0 ? null : { minX, minY, maxX, maxY };
}

/**
 * Recorta uma imagem PixelLab (PNG decodificado) e a posiciona numa célula cellW x cellH,
 * alinhando o centro-da-base da silhueta (os "pés") ao pivot [pivotX, pivotY] da célula.
 */
export function placeInCell({ width, height, rgba }, cellW, cellH, pivotX, pivotY) {
  const cell = new Uint8ClampedArray(cellW * cellH * 4);
  const bounds = opaqueBounds(rgba, width, height);
  if (!bounds) return cell;
  const feetX = (bounds.minX + bounds.maxX) / 2;
  const feetY = bounds.maxY;
  const offsetX = Math.round(pivotX - feetX);
  const offsetY = Math.round(pivotY - feetY);
  for (let y = 0; y < height; y++) {
    const dy = y + offsetY;
    if (dy < 0 || dy >= cellH) continue;
    for (let x = 0; x < width; x++) {
      const dx = x + offsetX;
      if (dx < 0 || dx >= cellW) continue;
      const src = (y * width + x) * 4;
      if (rgba[src + 3] === 0) continue;
      const dst = (dy * cellW + dx) * 4;
      cell[dst] = rgba[src]; cell[dst + 1] = rgba[src + 1]; cell[dst + 2] = rgba[src + 2]; cell[dst + 3] = rgba[src + 3];
    }
  }
  return cell;
}

/**
 * Monta a sheet final: `cells` é um array (length = directions * columns, row-major:
 * index = direction * columns + column) de Buffers PNG (ou null para célula vazia).
 * Devolve o Buffer PNG pronto para salvar.
 */
export function buildSheet({ cells, columns, directions, cellW, cellH, pivot }) {
  const sheetW = columns * cellW;
  const sheetH = directions * cellH;
  const sheet = new Uint8ClampedArray(sheetW * sheetH * 4);
  for (let dir = 0; dir < directions; dir++) {
    for (let col = 0; col < columns; col++) {
      const buf = cells[dir * columns + col];
      if (!buf) continue;
      const decoded = decodePng(buf);
      const placed = placeInCell(decoded, cellW, cellH, pivot[0], pivot[1]);
      const originX = col * cellW;
      const originY = dir * cellH;
      for (let y = 0; y < cellH; y++) {
        const srcRow = y * cellW * 4;
        const dstRow = ((originY + y) * sheetW + originX) * 4;
        sheet.set(placed.subarray(srcRow, srcRow + cellW * 4), dstRow);
      }
    }
  }
  return encodePng(sheetW, sheetH, sheet);
}

export function buildMetaJson({ frame, pivot, columns, directions, pixelsPerMeter, pitch, animations }) {
  return JSON.stringify({
    frame,
    pivot,
    columns,
    directions,
    direction_angle: 'dir = round(atan2(facing.x, facing.z) / 45°) mod 8; 0 = olhando para a câmera (+Z), 2 = leste (+X)',
    pitch,
    pixels_per_meter: pixelsPerMeter,
    animations,
  }, null, 1);
}
