/** A arte é desenhada em 2x; sprites são exibidos com esta escala. */
export const ART_SCALE = 0.5;

/** Camadas de profundidade. Entidades, paredes e props usam a própria coordenada Y (ordenação 3/4). */
export const DEPTH = {
  floor: -1000,
  decals: -900,
  corpses: -850,
  wallShadow: -800,
  shadows: -700,
  darkness: 100_000,
  /** Acima da escuridão: brilham mesmo no escuro. */
  glow: 100_001,
  tracers: 100_002,
  muzzle: 100_003,
} as const;

export const cameraConfig = {
  /** Altura do mundo visível (px). O zoom se adapta à altura da janela. */
  viewHeight: 390,
  minZoom: 1,
  maxZoom: 3,
  followLerp: 0.09,
  /** Quanto a câmera se adianta na direção da mira (fração da distância do cursor ao centro). */
  lookAhead: 0.28,
  maxLookAhead: 130,
  lookAheadLerp: 0.08,
  vignetteRadius: 0.75,
  vignetteStrength: 0.4,
  saturation: -0.28,
  contrast: 0.08,
};

export interface LampConfig {
  /** Posição em tiles. */
  tx: number;
  ty: number;
  radius: number;
  intensity: number;
  /** 0 = estável, 1 = pisca muito. */
  flicker: number;
}

export const lightingConfig = {
  enabled: true,
  darknessColor: 0x05070a,
  /** Opacidade da escuridão fora das luzes (0 = sem escuridão). */
  ambientDarkness: 0.66,
  flashlight: {
    range: 430,
    /** Abertura total do cone (graus) — definida na textura gerada. */
    angle: 46,
    intensity: 0.95,
    /** Luz fraca em volta do jogador. */
    aura: 120,
    auraIntensity: 0.6,
    warmGlow: 0.09,
  },
  muzzleFlash: { radius: 190, intensity: 0.9, durationMs: 70 },
  lampGlowColor: 0xffc27a,
  lampGlowAlpha: 0.1,
  /** Margem extra da camada de escuridão além da tela (px do mundo). */
  margin: 96,
};

export const effectsConfig = {
  maxCorpses: 40,
  corpseLifetimeMs: 45_000,
  bloodPoolGrowMs: 2200,
  bloodParticlesPerHit: 10,
  bloodParticlesOnDeath: 22,
  decalSplatChance: 0.6,
};
