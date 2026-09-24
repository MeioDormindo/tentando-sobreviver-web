/** Conquistas (salvas no save e na nuvem). O ícone é uma textura já carregada pelo jogo. */

export type AchievementId =
  | 'first_blood'
  | 'survivor'
  | 'veteran'
  | 'power_on'
  | 'conductor'
  | 'patient_zero'
  | 'serum'
  | 'dog_trainer'
  | 'train_wreck'
  | 'collector'
  | 'tornado'
  | 'fire_sale'
  | 'butcher'
  | 'knife_master'
  | 'golden_aim'
  | 'teddies'
  | 'konami';

/** Totais acumulados entre partidas usados pelas conquistas de progresso. */
export type TotalKey = 'kills' | 'knifeKills' | 'headshots';

export interface AchievementDef {
  id: AchievementId;
  name: string;
  description: string;
  icon: string;
  /** Progresso acumulado (ex.: 640/1000); ausente = conquista de um momento. */
  total?: { key: TotalKey; target: number };
  /** Segredo: a descrição só aparece depois de liberada. */
  secret?: boolean;
}

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 'first_blood', name: 'Primeiro Sangue', description: 'Abata o primeiro zumbi', icon: 'gun_pistol' },
  { id: 'survivor', name: 'Sobrevivente', description: 'Chegue à wave 10', icon: 'powerup_full_heal' },
  { id: 'veteran', name: 'Veterano', description: 'Chegue à wave 20', icon: 'powerup_armor' },
  { id: 'power_on', name: 'Energia!', description: 'Ligue o disjuntor principal', icon: 'powerup_speed_boost' },
  { id: 'conductor', name: 'Maquinista', description: 'Derrote o boss The Conductor', icon: 'powerup_nuke' },
  { id: 'patient_zero', name: 'Paciente Curado', description: 'Derrote o Paciente Zero', icon: 'powerup_insta_kill' },
  { id: 'serum', name: 'O Soro', description: 'Complete a missão do Dr. Almeida', icon: 'prop_serum_vial' },
  { id: 'dog_trainer', name: 'Adestrador', description: 'Vença uma rodada de cães sem levar dano', icon: 'powerup_carpenter' },
  { id: 'train_wreck', name: 'Atropelador', description: 'Atropele 10 zumbis com uma passagem do trem', icon: 'powerup_max_ammo' },
  { id: 'collector', name: 'Colecionador', description: 'Tenha todos os perks na mesma partida', icon: 'powerup_golden' },
  { id: 'tornado', name: 'Olho do Furacão', description: 'Transforme o Canhão de Vento no Tornado', icon: 'gun_wind' },
  { id: 'fire_sale', name: 'Liquidação', description: 'Use a Mystery Box durante um Fire Sale', icon: 'powerup_fire_sale' },
  { id: 'butcher', name: 'Açougueiro', description: 'Abata 1.000 zumbis', icon: 'powerup_double_cash', total: { key: 'kills', target: 1000 } },
  { id: 'knife_master', name: 'Faca na Caveira', description: 'Abata 50 zumbis na faca', icon: 'powerup_insta_kill', total: { key: 'knifeKills', target: 50 } },
  { id: 'golden_aim', name: 'Mira de Ouro', description: 'Acerte 100 headshots fatais', icon: 'gun_sniper', total: { key: 'headshots', target: 100 } },
  { id: 'teddies', name: 'Ursinhos', description: 'Encontre todos os ursinhos escondidos', icon: 'powerup_golden', secret: true },
  { id: 'konami', name: 'Cabeção', description: 'Descubra o código secreto do menu', icon: 'gun_akimbo', secret: true },
];

export const achievementById = (id: string): AchievementDef | undefined => ACHIEVEMENTS.find((a) => a.id === id);

export const achievementConfig = {
  /** Wave para Sobrevivente e Veterano. */
  survivorWave: 10,
  veteranWave: 20,
  /** Atropelados numa só passagem do trem. */
  trainKills: 10,
};
