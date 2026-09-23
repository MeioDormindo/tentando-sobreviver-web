/** Eventos dinâmicos (GDD §48–49). Valores iniciais — balancear na Fase 12. */

export type WorldEventId = 'blackout' | 'emergency_alarm' | 'train' | 'horde' | 'supply_drop' | 'gas_leak';

export interface WorldEventInfo {
  /** Nome exibido na HUD. */
  name: string;
  /** Instrução curta para o jogador. */
  hint: string;
  color: number;
  /** Peso no sorteio. */
  weight: number;
  /** Primeira wave em que pode acontecer. */
  minWave: number;
  /** Waves de espera antes de se repetir. */
  cooldownWaves: number;
}

/** Agendamento: no máximo um evento por vez, sorteado quando uma wave começa. */
export const eventScheduleConfig = {
  firstWave: 2,
  /** Chance de uma wave ter evento. */
  chancePerWave: 0.6,
  /** Atraso entre o início da wave e o evento (ms), exceto a Horda (começa junto). */
  startDelayMs: [5000, 16000] as [number, number],
  /** GDD §31: wave 15 tem evento especial garantido (e depois a cada 10 waves). */
  forced: { firstWave: 15, every: 10, id: 'horde' as WorldEventId },
};

export const worldEvents: Record<WorldEventId, WorldEventInfo> = {
  blackout: { name: 'APAGÃO', hint: 'As luzes caíram — use a lanterna', color: 0x8fa3b8, weight: 20, minWave: 3, cooldownWaves: 3 },
  emergency_alarm: { name: 'ALARME DE EMERGÊNCIA', hint: 'O barulho atrai mais zumbis', color: 0xff4433, weight: 18, minWave: 6, cooldownWaves: 3 },
  train: { name: 'TREM PASSANDO', hint: 'Saia dos trilhos da plataforma!', color: 0xffc04a, weight: 18, minWave: 2, cooldownWaves: 2 },
  horde: { name: 'HORDA', hint: 'Muito mais zumbis nesta wave', color: 0xb33a3a, weight: 14, minWave: 5, cooldownWaves: 4 },
  supply_drop: { name: 'SUPRIMENTOS', hint: 'Uma caixa caiu no terminal — pegue-a', color: 0x7bd67b, weight: 22, minWave: 2, cooldownWaves: 2 },
  gas_leak: { name: 'VAZAMENTO DE GÁS', hint: 'Fique longe da nuvem verde', color: 0x9acd32, weight: 16, minWave: 4, cooldownWaves: 3 },
};

export const blackoutConfig = {
  durationMs: 25_000,
  /** Escuridão extra durante o apagão. */
  extraDarkness: 0.2,
  /** Luzes de emergência (máquinas e pontos de compra) ficam nesta fração. */
  emergencyLightFactor: 0.35,
  /** Tempo piscando antes de apagar/acender (ms). */
  flickerMs: 1400,
};

export const alarmConfig = {
  durationMs: 20_000,
  spawnIntervalMultiplier: 0.45,
  maxAliveBonus: 6,
};

export const hordeConfig = {
  /** Zumbis extras em relação ao total da wave. */
  extraEnemiesRatio: 0.6,
  spawnIntervalMultiplier: 0.55,
  maxAliveBonus: 8,
};

export const trainConfig = {
  /** Aviso (buzina, luzes) antes de o trem passar (ms). */
  warningMs: 4500,
  speed: 1500,
  /** Locomotiva + vagões + locomotiva traseira. */
  cars: 5,
  carLength: 320,
  /** Dano ao jogador atropelado (uma vez por passagem). */
  playerDamage: 70,
  /** Faixa livre dos trilhos por onde o trem passa (tiles). */
  lane: { y: 4, h: 3 },
  /** Área necessária aberta. */
  area: 'platform',
};

export const supplyDropConfig = {
  /** Tempo para pegar antes de sumir (ms). */
  lifetimeMs: 60_000,
  fallMs: 2200,
  money: 750,
  /** Distância ao jogador onde a caixa cai (px). */
  distance: [220, 650] as [number, number],
};

export const gasLeakConfig = {
  durationMs: 22_000,
  /** O gás começa fraco e só fere depois disso (ms). */
  warningMs: 2500,
  radius: 120,
  tickMs: 400,
  playerDamagePerTick: 5,
  zombieDamagePerTick: 12,
  distance: [170, 380] as [number, number],
};
