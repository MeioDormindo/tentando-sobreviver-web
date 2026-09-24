/**
 * Serviços online (Supabase). A chave publicável é pública por natureza: o que protege os dados
 * são as regras (RLS) e as travas no banco (supabase/*.sql). Deixe `url` vazio para jogar offline.
 */
export const onlineConfig = {
  url: 'https://aurhaotqpbxpiwieabna.supabase.co',
  publishableKey: 'sb_publishable_zqlTrvzS-zvH564fC2VK-w_UYll3-hk',
  /** Duração de uma temporada do ranking global (15 dias, em segundos — igual ao servidor). */
  seasonSeconds: 1_296_000,
  /** Tempo máximo de espera de uma requisição (ms). */
  timeoutMs: 8000,
  /** Quantas linhas a aba GLOBAL mostra. */
  globalRankSize: 10,
};

export const isOnlineConfigured = (): boolean => onlineConfig.url !== '' && onlineConfig.publishableKey !== '';
