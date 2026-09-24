/** Easter eggs globais (os de cada mapa ficam no layout, em `secrets`). */
export const secretsConfig = {
  credits: 'TENTANDO SOBREVIVER — feito com TypeScript + Phaser. Arte e sons 100% gerados por código.',
  /** Código Konami no menu: ↑↑↓↓←→←→BA. */
  konami: ['UP', 'UP', 'DOWN', 'DOWN', 'LEFT', 'RIGHT', 'LEFT', 'RIGHT', 'B', 'A'],
} as const;
