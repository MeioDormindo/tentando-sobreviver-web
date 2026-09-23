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
    music: 0.42,
  },
  /** Vozes simultâneas máximas por categoria (evita cacofonia com hordas grandes). */
  maxVoices: {
    weapon: 24,
    zombie: 6,
    world: 16,
    player: 4,
    ui: 6,
    ambience: 4,
    music: 8,
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

/** Música adaptativa (GDD §58). */
export const musicConfig = {
  bpm: 100,
  /** Compassos de cada loop (todas as camadas têm a mesma duração). */
  bars: 8,
  /** Velocidade das transições de volume entre camadas (fração por segundo). */
  fadePerSecond: 0.6,
  /** Alta intensidade: zumbis vivos a partir disto... */
  highAlive: 12,
  /** ...ou vida do jogador abaixo desta fração, ou Horda/Alarme ativos. */
  highHp: 0.35,
  highEvents: ['horde', 'emergency_alarm'] as string[],
  /** Volume de cada camada por estado. */
  mix: {
    exploration: { pad: 1, pulse: 0, drive: 0, boss: 0 },
    normal: { pad: 0.7, pulse: 1, drive: 0, boss: 0 },
    high: { pad: 0.5, pulse: 1, drive: 1, boss: 0 },
    boss: { pad: 0, pulse: 0, drive: 0, boss: 1 },
    silent: { pad: 0, pulse: 0, drive: 0, boss: 0 },
  },
  /** Quanto as camadas abaixam enquanto uma vinheta toca. */
  stingDuck: 0.35,
  stingDuckMs: 3500,
};

export type MusicState = keyof typeof musicConfig.mix;
export type MusicLayer = keyof typeof musicConfig.mix.exploration;

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
