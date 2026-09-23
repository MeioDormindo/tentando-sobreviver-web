/** Custos da grade de navegação (0 = bloqueado). */
export const NavCost = {
  Blocked: 0,
  Floor: 1,
  /** Janela com barricada: passável só para zumbis, e mais cara (evitam se houver outro caminho). */
  Window: 6,
} as const;

export interface PathPoint {
  x: number;
  y: number;
}

const SQRT2 = Math.SQRT2;
const DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];
/** Limite de nós expandidos por busca (protege o frame contra buscas impossíveis). */
const MAX_EXPANSIONS = 20_000;

/**
 * Grade de navegação dos zumbis + A* (GDD §22). Buffers tipados reutilizados entre buscas,
 * com "carimbo" de geração para não precisar limpar os arrays a cada chamada.
 */
export class NavGrid {
  readonly width: number;
  readonly height: number;
  readonly tileSize: number;
  private readonly cost: Uint8Array;

  private readonly g: Float32Array;
  private readonly f: Float32Array;
  private readonly parent: Int32Array;
  private readonly stamp: Uint32Array;
  private readonly closed: Uint32Array;
  private generation = 0;
  private readonly heap: Int32Array;
  private heapSize = 0;

  constructor(width: number, height: number, tileSize: number) {
    this.width = width;
    this.height = height;
    this.tileSize = tileSize;
    const n = width * height;
    this.cost = new Uint8Array(n);
    this.g = new Float32Array(n);
    this.f = new Float32Array(n);
    this.parent = new Int32Array(n);
    this.stamp = new Uint32Array(n);
    this.closed = new Uint32Array(n);
    // Um nó pode entrar mais de uma vez no heap (reabertura com custo menor).
    this.heap = new Int32Array(n * 8);
  }

  setCost(tx: number, ty: number, cost: number): void {
    if (this.inBounds(tx, ty)) this.cost[ty * this.width + tx] = cost;
  }

  getCost(tx: number, ty: number): number {
    return this.inBounds(tx, ty) ? this.cost[ty * this.width + tx] : NavCost.Blocked;
  }

  inBounds(tx: number, ty: number): boolean {
    return tx >= 0 && ty >= 0 && tx < this.width && ty < this.height;
  }

  toTile(v: number): number {
    return Math.floor(v / this.tileSize);
  }

  /** Livre para visão/movimento direto: só chão comum (janelas e sólidos bloqueiam). */
  private isClearAt(x: number, y: number): boolean {
    return this.getCost(this.toTile(x), this.toTile(y)) === NavCost.Floor;
  }

  /**
   * Linha de visão "com largura": amostra o segmento central e dois paralelos
   * afastados `radius`, para o zumbi não tentar passar raspando em quinas.
   */
  lineOfSight(ax: number, ay: number, bx: number, by: number, radius: number): boolean {
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    if (len < 1) return true;
    const nx = (-dy / len) * radius;
    const ny = (dx / len) * radius;
    const steps = Math.ceil(len / (this.tileSize / 4));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = ax + dx * t;
      const y = ay + dy * t;
      if (!this.isClearAt(x, y) || !this.isClearAt(x + nx, y + ny) || !this.isClearAt(x - nx, y - ny)) return false;
    }
    return true;
  }

  /** Caminho em coordenadas do mundo (centros dos tiles), ou null se não houver. */
  findPath(sx: number, sy: number, tx: number, ty: number): PathPoint[] | null {
    const w = this.width;
    let startX = this.toTile(sx);
    let startY = this.toTile(sy);
    const goalX = this.toTile(tx);
    const goalY = this.toTile(ty);
    if (this.getCost(goalX, goalY) === NavCost.Blocked) return null;
    // Se o zumbi foi empurrado para um tile sólido, parte do vizinho livre mais próximo.
    if (this.getCost(startX, startY) === NavCost.Blocked) {
      const free = this.nearestFree(startX, startY);
      if (!free) return null;
      [startX, startY] = free;
    }

    const gen = ++this.generation;
    const start = startY * w + startX;
    const goal = goalY * w + goalX;
    this.heapSize = 0;
    this.stamp[start] = gen;
    this.g[start] = 0;
    this.f[start] = this.heuristic(startX, startY, goalX, goalY);
    this.parent[start] = -1;
    this.push(start);

    let expansions = 0;
    while (this.heapSize > 0) {
      const current = this.pop();
      if (current === goal) return this.buildPath(goal);
      if (this.closed[current] === gen) continue;
      this.closed[current] = gen;
      if (++expansions > MAX_EXPANSIONS) return null;

      const cx = current % w;
      const cy = (current - cx) / w;
      for (const [dx, dy] of DIRS) {
        const nx = cx + dx;
        const ny = cy + dy;
        const c = this.getCost(nx, ny);
        if (c === NavCost.Blocked) continue;
        const diagonal = dx !== 0 && dy !== 0;
        // Sem cortar quinas: as duas casas ortogonais precisam estar livres.
        if (diagonal && (this.getCost(cx + dx, cy) === NavCost.Blocked || this.getCost(cx, cy + dy) === NavCost.Blocked)) continue;
        const next = ny * w + nx;
        if (this.closed[next] === gen) continue;
        const tentative = this.g[current] + c * (diagonal ? SQRT2 : 1);
        if (this.stamp[next] !== gen || tentative < this.g[next]) {
          this.stamp[next] = gen;
          this.g[next] = tentative;
          this.f[next] = tentative + this.heuristic(nx, ny, goalX, goalY);
          this.parent[next] = current;
          this.push(next);
        }
      }
    }
    return null;
  }

  private nearestFree(tx: number, ty: number): [number, number] | null {
    for (let r = 1; r <= 2; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (this.getCost(tx + dx, ty + dy) !== NavCost.Blocked) return [tx + dx, ty + dy];
        }
      }
    }
    return null;
  }

  private heuristic(ax: number, ay: number, bx: number, by: number): number {
    const dx = Math.abs(ax - bx);
    const dy = Math.abs(ay - by);
    return dx + dy + (SQRT2 - 2) * Math.min(dx, dy);
  }

  private buildPath(goal: number): PathPoint[] {
    const w = this.width;
    const half = this.tileSize / 2;
    const path: PathPoint[] = [];
    for (let i = goal; i !== -1; i = this.parent[i]) {
      const x = i % w;
      path.push({ x: x * this.tileSize + half, y: ((i - x) / w) * this.tileSize + half });
    }
    return path.reverse();
  }

  // Heap binária mínima por f (duplicatas são descartadas via `closed`).
  private push(node: number): void {
    const heap = this.heap;
    if (this.heapSize >= heap.length) return;
    let i = this.heapSize++;
    heap[i] = node;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.f[heap[p]] <= this.f[heap[i]]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  }

  private pop(): number {
    const heap = this.heap;
    const top = heap[0];
    heap[0] = heap[--this.heapSize];
    let i = 0;
    for (;;) {
      const l = i * 2 + 1;
      const r = l + 1;
      let m = i;
      if (l < this.heapSize && this.f[heap[l]] < this.f[heap[m]]) m = l;
      if (r < this.heapSize && this.f[heap[r]] < this.f[heap[m]]) m = r;
      if (m === i) break;
      [heap[m], heap[i]] = [heap[i], heap[m]];
      i = m;
    }
    return top;
  }
}
