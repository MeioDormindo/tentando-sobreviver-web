import Phaser from 'phaser';

interface Target {
  readonly x: number;
  readonly y: number;
}

/**
 * Mira assistida (celular): entre os alvos dentro do cone em volta da direção atual,
 * escolhe o mais próximo (penalizando o desvio de ângulo) e com linha de visão.
 * Retorna o ângulo até ele, ou null se não houver alvo válido.
 */
export function assistAngle(
  x: number,
  y: number,
  facing: number,
  targets: Iterable<Target>,
  coneRad: number,
  range: number,
  lineOfSight: (tx: number, ty: number) => boolean,
): number | null {
  let best: number | null = null;
  let bestScore = Infinity;
  for (const t of targets) {
    const d = Phaser.Math.Distance.Between(x, y, t.x, t.y);
    if (d > range || d < 1) continue;
    const ang = Phaser.Math.Angle.Between(x, y, t.x, t.y);
    const off = Math.abs(Phaser.Math.Angle.Wrap(ang - facing));
    if (off > coneRad) continue;
    const score = d * (1 + off * 2.5);
    if (score < bestScore && lineOfSight(t.x, t.y)) {
      best = ang;
      bestScore = score;
    }
  }
  return best;
}
