// Empacotamento (shelf packing) de quadros de tamanho variável numa única imagem: um bloco por
// direção; os quadros entram por altura decrescente e as posições voltam na ordem lógica
// (animação → quadro).

/**
 * sizes: [[w,h], ...] na ordem lógica. maxWidth: teto rígido de largura do bloco.
 * Devolve { width, height, rects: [[x,y], ...] } (rects alinhado 1:1 com `sizes`, na ordem
 * ORIGINAL de entrada — o empacotamento em si processa por altura decrescente internamente,
 * "First-Fit Decreasing Height", bem mais denso que shelf ingênuo na ordem de entrada, já que
 * cada linha só desperdiça até a altura do quadro mais alto QUE ELA MESMA contém).
 */
export function packShelf(sizes, maxWidth) {
  const order = sizes.map((_, i) => i).sort((a, b) => sizes[b][1] - sizes[a][1]);
  const rects = new Array(sizes.length);
  let cursorX = 0, cursorY = 0, shelfH = 0, usedWidth = 0;
  for (const i of order) {
    let [w, h] = sizes[i];
    if (w > maxWidth) throw new Error(`packShelf: quadro ${i} tem largura ${w} > maxWidth ${maxWidth}`);
    if (cursorX > 0 && cursorX + w > maxWidth) {
      cursorY += shelfH;
      cursorX = 0;
      shelfH = 0;
    }
    rects[i] = [cursorX, cursorY, w, h];
    cursorX += w;
    usedWidth = Math.max(usedWidth, cursorX);
    shelfH = Math.max(shelfH, h);
  }
  return { width: usedWidth, height: cursorY + shelfH, rects };
}
