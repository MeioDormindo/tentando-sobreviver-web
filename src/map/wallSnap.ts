import { wallBuyConfig } from '../config/weapons.config';

export interface TileQuery {
  /** Chão livre (onde o jogador fica em pé). */
  isFloor(tx: number, ty: number): boolean;
  /** Parede sólida (não porta nem janela). */
  isWall(tx: number, ty: number): boolean;
}

/** Lado da parede em relação ao tile de chão (a de cima mostra a face; as outras, o topo). */
export type WallSide = 'north' | 'south' | 'west' | 'east';

export interface WallSpot {
  /** Tile de chão em frente à parede. */
  tx: number;
  ty: number;
  side: WallSide;
}

const SIDES: ReadonlyArray<{ side: WallSide; dx: number; dy: number; penalty: number }> = [
  { side: 'north', dx: 0, dy: -1, penalty: 0 },
  { side: 'west', dx: -1, dy: 0, penalty: wallBuyConfig.sidePenalty },
  { side: 'east', dx: 1, dy: 0, penalty: wallBuyConfig.sidePenalty },
  { side: 'south', dx: 0, dy: 1, penalty: wallBuyConfig.sidePenalty },
];

/**
 * Compra na parede (como no CoD Zombies): procura, a partir da posição planejada, o chão mais
 * próximo encostado numa parede contínua (3 tiles, para caber o desenho), de preferência a de cima
 * (face visível). Evita os tiles ocupados (máquinas, outros pontos de compra, portas, props).
 * Devolve null se não houver parede livre por perto.
 */
export function snapToWall(start: { tx: number; ty: number }, q: TileQuery, taken: (tx: number, ty: number) => boolean): WallSpot | null {
  const sx = Math.floor(start.tx);
  const sy = Math.floor(start.ty);
  const sideFits = (tx: number, ty: number, dx: number, dy: number): boolean => {
    // Perpendicular à parede: a parede se estende ±1 tile e há chão dos lados para ficar em pé.
    const px = dy === 0 ? 0 : 1;
    const py = dy === 0 ? 1 : 0;
    for (let k = -1; k <= 1; k++) {
      if (!q.isWall(tx + dx + px * k, ty + dy + py * k)) return false;
      if (k !== 0 && !q.isFloor(tx + px * k, ty + py * k)) return false;
    }
    return true;
  };
  let best = null as (WallSpot & { cost: number }) | null;
  const seen = new Set<number>([sy * 100_000 + sx]);
  let frontier: Array<[number, number]> = [[sx, sy]];
  for (let step = 0; step <= wallBuyConfig.searchRadius && frontier.length > 0; step++) {
    for (const [x, y] of frontier) {
      if (taken(x, y)) continue;
      for (const s of SIDES) {
        if (!sideFits(x, y, s.dx, s.dy)) continue;
        const cost = Math.hypot(x - sx, y - sy) + s.penalty;
        if (!best || cost < best.cost) best = { tx: x, ty: y, side: s.side, cost };
      }
    }
    // Nada mais perto que o melhor achado: para (o custo cresce com a distância).
    if (best && best.cost <= step) break;
    const next: Array<[number, number]> = [];
    for (const [x, y] of frontier) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        const key = ny * 100_000 + nx;
        if (seen.has(key) || !q.isFloor(nx, ny)) continue;
        seen.add(key);
        next.push([nx, ny]);
      }
    }
    frontier = next;
  }
  return best ? { tx: best.tx, ty: best.ty, side: best.side } : null;
}
