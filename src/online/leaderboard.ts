import type { MapId } from '../config/maps.config';
import { isOnlineConfigured, onlineConfig } from '../config/online.config';
import { supaFetch } from './http';

export interface GlobalEntry {
  name: string;
  score: number;
  wave: number;
  kills: number;
}

export interface ScoreSubmission extends GlobalEntry {
  map: MapId;
}

/** Temporada atual (a mesma conta do servidor: blocos de 15 dias desde 1970). */
export const currentSeason = (): number => Math.floor(Date.now() / 1000 / onlineConfig.seasonSeconds);

/** Dias (arredondados para cima) até a temporada virar. */
export function seasonDaysLeft(): number {
  const endMs = (currentSeason() + 1) * onlineConfig.seasonSeconds * 1000;
  return Math.max(1, Math.ceil((endMs - Date.now()) / 86_400_000));
}

/** Envia uma pontuação ao ranking global. Retorna null se deu certo, ou a mensagem do erro. */
export async function submitScore(entry: ScoreSubmission): Promise<string | null> {
  if (!isOnlineConfigured()) return 'ranking global indisponível';
  const res = await supaFetch<null>('/rest/v1/scores', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ map: entry.map, name: entry.name, score: Math.round(entry.score), wave: entry.wave, kills: entry.kills }),
  });
  if (res.ok) return null;
  if (res.status === 0) return 'sem conexão';
  if (/check constraint|row-level security/i.test(res.message)) return 'pontuação recusada';
  return res.message;
}

/** Top da temporada atual no mapa (melhor pontuação de cada nome), ou null se falhou. */
export async function fetchTop(map: MapId): Promise<GlobalEntry[] | null> {
  if (!isOnlineConfigured()) return null;
  const q = new URLSearchParams({
    select: 'name,score,wave,kills',
    season: `eq.${currentSeason()}`,
    map: `eq.${map}`,
    order: 'score.desc',
    limit: String(onlineConfig.globalRankSize),
  });
  const res = await supaFetch<GlobalEntry[]>(`/rest/v1/leaderboard?${q.toString()}`);
  return res.ok && Array.isArray(res.data) ? res.data : null;
}
