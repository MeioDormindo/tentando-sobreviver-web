import type { AchievementId } from './achievements.config';

/** Visuais do jogador (a arte fica em scripts/art/characters.mjs → PLAYER_SKINS). */
export type SkinId = 'default' | 'nurse' | 'conductor' | 'agent';

export interface SkinDef {
  id: SkinId;
  name: string;
  /** Conquista que libera o visual (null = sempre disponível). */
  unlock: AchievementId | null;
}

export const SKINS: readonly SkinDef[] = [
  { id: 'default', name: 'Sobrevivente', unlock: null },
  { id: 'nurse', name: 'Enfermeiro', unlock: 'serum' },
  { id: 'conductor', name: 'Maquinista', unlock: 'conductor' },
  { id: 'agent', name: 'Agente', unlock: 'veteran' },
];

export const isSkinId = (v: unknown): v is SkinId => typeof v === 'string' && SKINS.some((s) => s.id === v);

/** URL do torso no visual escolhido (o padrão usa o arquivo original). */
export function skinUrl(url: string, skin: SkinId): string {
  if (skin === 'default' || !url.includes('/player_torso_')) return url;
  return url.replace(/\.svg$/, `_${skin}.svg`);
}
