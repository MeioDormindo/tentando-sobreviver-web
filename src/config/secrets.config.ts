/** Easter eggs do Terminal (posições em tiles). */
export const secretsConfig = {
  /** Ursinhos escondidos em cantos escuros. */
  teddies: [
    { tx: 115, ty: 58 }, // Lojas
    { tx: 12, ty: 77 }, // Bilheteria
    { tx: 111, ty: 106 }, // Túneis
  ],
  /** Rádio velho na Manutenção. */
  radio: { tx: 37.4, ty: 110.2, holdMs: 900 },
  /** Placa perto da entrada da Plataforma (créditos). */
  creditsSign: { tx: 57.5, ty: 30.5 },
  loreMessages: [
    '"...controle da Estação Central. O trem das 23h40 NÃO deve parar. Repito: não parem o trem..."',
    '"...o maquinista não responde. Alguém viu o Condutor? Ele desceu nos túneis e voltou... diferente."',
    '"...quarentena decretada. Portas lacradas. Quem ficou lá dentro está por conta própria."',
    '"...se alguém ouvir isto: tentem sobreviver. O resgate chega ao amanhecer. Talvez."',
  ],
  credits: 'TENTANDO SOBREVIVER — feito com TypeScript + Phaser. Arte e sons 100% gerados por código.',
  /** Código Konami no menu: ↑↑↓↓←→←→BA. */
  konami: ['UP', 'UP', 'DOWN', 'DOWN', 'LEFT', 'RIGHT', 'LEFT', 'RIGHT', 'B', 'A'],
} as const;
