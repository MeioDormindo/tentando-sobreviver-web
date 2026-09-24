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

/** Contas na nuvem (Supabase Auth com e-mail sintético — o jogador só vê o nome de usuário). */
export const accountConfig = {
  /** Domínio reservado (.invalid nunca recebe e-mail): usuario@<domínio>. */
  emailDomain: 'jogador.tentandosobreviver.invalid',
  usernamePattern: /^[a-z0-9_]{3,16}$/,
  passwordMin: 6,
  passwordMax: 72,
  /** Renova o token de acesso quando faltar menos que isto para expirar (ms). */
  refreshMarginMs: 60_000,
  /** Espera depois da última alteração do save antes de enviar à nuvem (ms). */
  syncDebounceMs: 4000,
  sessionKey: 'ts-session-v1',
};
