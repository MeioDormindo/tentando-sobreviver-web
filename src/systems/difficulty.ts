import { waveConfig } from '../config/waves.config';
import type { ZombieConfig } from '../config/zombies.config';

export interface WaveParams {
  wave: number;
  totalEnemies: number;
  healthMultiplier: number;
  damageMultiplier: number;
  speedMultiplier: number;
  spawnInterval: number;
  maxAlive: number;
}

/** Parâmetros de uma wave a partir das fórmulas do GDD §32 (função pura). */
export function getWaveParams(wave: number, cfg = waveConfig): WaveParams {
  const w = Math.max(1, Math.floor(wave));
  return {
    wave: w,
    totalEnemies: cfg.baseEnemies + w * cfg.enemiesPerWave,
    healthMultiplier: 1 + (w - 1) * cfg.healthMultiplier + Math.max(0, w - cfg.lateFromWave) * cfg.lateHealthMultiplier,
    damageMultiplier: 1 + (w - 1) * cfg.damageMultiplier,
    speedMultiplier: 1 + (w - 1) * cfg.speedMultiplier,
    spawnInterval: Math.max(cfg.spawnIntervalMin, cfg.spawnIntervalBase + (w - 1) * cfg.spawnIntervalPerWave),
    maxAlive: Math.min(cfg.maxAliveCap, cfg.maxAliveBase + (w - 1) * cfg.maxAlivePerWave),
  };
}

/** Aplica os multiplicadores da wave sobre a configuração base do zumbi. */
export function scaleZombie(base: ZombieConfig, params: WaveParams): ZombieConfig {
  return {
    ...base,
    health: Math.round(base.health * params.healthMultiplier),
    damage: Math.round(base.damage * params.damageMultiplier),
    speed: base.speed * params.speedMultiplier,
  };
}
