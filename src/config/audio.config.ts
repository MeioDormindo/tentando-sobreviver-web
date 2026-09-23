/** Mixagem e comportamento do áudio. */
export const audioConfig = {
  master: 0.8,
  /** Volume por categoria. */
  categories: {
    weapon: 0.75,
    zombie: 0.8,
    world: 0.8,
    player: 0.8,
    ui: 0.7,
    ambience: 0.55,
  },
  /** Vozes simultâneas máximas por categoria (evita cacofonia com hordas grandes). */
  maxVoices: {
    weapon: 24,
    zombie: 6,
    world: 16,
    player: 4,
    ui: 6,
    ambience: 4,
  },
  /** Distância em que um som posicional deixa de ser ouvido (px). */
  hearingDistance: 900,
  /** Distância que o jogador anda entre um passo e outro (px). */
  stepDistance: 44,
  /** Intervalo entre sons ambientes pontuais (ms). */
  ambientEventMs: [6000, 14000] as [number, number],
  /** Tempo de transição entre ambientes de áreas diferentes (ms). */
  ambienceCrossfadeMs: 2500,
  /** Batimento cardíaco abaixo desta fração de vida. */
  heartbeatBelow: 0.3,
};

export type SoundCategory = keyof typeof audioConfig.categories;

/** Sons pontuais que podem tocar em cada área. */
export const ambientEvents: Record<string, string[]> = {
  hall: ['amb_drip', 'amb_bang', 'amb_moan'],
  platform: ['amb_horn', 'amb_creak', 'amb_bang', 'amb_moan'],
  ticket: ['amb_creak', 'amb_bang', 'amb_moan'],
  shops: ['amb_bang', 'amb_moan', 'amb_creak'],
  tech: ['amb_steam', 'amb_bang', 'amb_creak'],
  tunnels: ['amb_drip', 'amb_drip', 'amb_moan', 'amb_bang'],
  maintenance: ['amb_steam', 'amb_steam', 'amb_bang'],
};
