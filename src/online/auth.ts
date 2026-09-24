import { accountConfig, isOnlineConfigured } from '../config/online.config';
import { supaFetch } from './http';

/**
 * Conta do jogador (Supabase Auth). A senha só é enviada ao servidor no login/cadastro (HTTPS) e é
 * guardada lá apenas como hash bcrypt — nem o jogo nem o banco conseguem lê-la de volta.
 * No aparelho fica só a sessão (tokens), nunca a senha.
 */

interface Session {
  accessToken: string;
  refreshToken: string;
  /** Quando o token de acesso expira (ms desde 1970). */
  expiresAt: number;
  username: string;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
}

const NO_SESSION = 'sem sessão';

let session: Session | null = loadSession();

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(accountConfig.sessionKey);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<Session>;
    if (typeof s.accessToken !== 'string' || typeof s.refreshToken !== 'string' || typeof s.username !== 'string' || typeof s.expiresAt !== 'number') return null;
    return { accessToken: s.accessToken, refreshToken: s.refreshToken, expiresAt: s.expiresAt, username: s.username };
  } catch {
    return null;
  }
}

function storeSession(s: Session | null): void {
  session = s;
  try {
    if (s) localStorage.setItem(accountConfig.sessionKey, JSON.stringify(s));
    else localStorage.removeItem(accountConfig.sessionKey);
  } catch {
    /* sem armazenamento: a sessão vale só enquanto a página estiver aberta */
  }
}

/** Normaliza o nome digitado (minúsculas, sem espaços nas pontas). */
export const normalizeUsername = (raw: string): string => raw.trim().toLowerCase();

/** Valida o nome de usuário; devolve a mensagem de erro ou null. */
export function usernameError(username: string): string | null {
  return accountConfig.usernamePattern.test(username) ? null : 'Usuário: 3 a 16 letras minúsculas, números ou _';
}

export function passwordError(password: string): string | null {
  if (password.length < accountConfig.passwordMin) return `Senha: mínimo de ${accountConfig.passwordMin} caracteres`;
  if (password.length > accountConfig.passwordMax) return `Senha: máximo de ${accountConfig.passwordMax} caracteres`;
  return null;
}

const emailOf = (username: string): string => `${username}@${accountConfig.emailDomain}`;

/** Nome do usuário logado, ou null. */
export const currentUser = (): string | null => session?.username ?? null;

function translate(status: number, message: string): string {
  if (status === 0) return 'Sem conexão com o servidor';
  if (status === 429 || /rate limit|too many/i.test(message)) return 'Muitas tentativas — aguarde um pouco';
  if (/already registered|already exists/i.test(message)) return 'Esse usuário já existe';
  if (/invalid login credentials/i.test(message)) return 'Usuário ou senha incorretos';
  if (/weak/i.test(message)) return 'Senha fraca demais';
  if (/inválido|invalid/i.test(message) || status === 403) return 'Usuário inválido';
  return 'Não foi possível concluir — tente de novo';
}

function accept(username: string, t: TokenResponse): boolean {
  if (!t.access_token || !t.refresh_token) return false;
  storeSession({ accessToken: t.access_token, refreshToken: t.refresh_token, expiresAt: Date.now() + (t.expires_in ?? 3600) * 1000, username });
  return true;
}

async function credentials(path: string, rawUser: string, password: string): Promise<string | null> {
  if (!isOnlineConfigured()) return 'Contas online indisponíveis';
  const username = normalizeUsername(rawUser);
  const invalid = usernameError(username) ?? passwordError(password);
  if (invalid) return invalid;
  const res = await supaFetch<TokenResponse>(path, { method: 'POST', body: JSON.stringify({ email: emailOf(username), password }) });
  if (!res.ok) return translate(res.status, res.message);
  return accept(username, res.data) ? null : NO_SESSION;
}

/** Cria a conta e já entra. Devolve a mensagem de erro, ou null se deu certo. */
export async function signUp(username: string, password: string): Promise<string | null> {
  const err = await credentials('/auth/v1/signup', username, password);
  // Se o servidor criou a conta sem devolver sessão, entra em seguida.
  return err === NO_SESSION ? signIn(username, password) : err;
}

export async function signIn(username: string, password: string): Promise<string | null> {
  const err = await credentials('/auth/v1/token?grant_type=password', username, password);
  return err === NO_SESSION ? 'Não foi possível entrar — tente de novo' : err;
}

export async function signOut(): Promise<void> {
  const s = session;
  storeSession(null);
  if (s) await supaFetch<null>('/auth/v1/logout', { method: 'POST', token: s.accessToken });
}

/** Token de acesso válido (renova se estiver para expirar); null se não estiver logado ou falhar. */
export async function accessToken(): Promise<string | null> {
  const s = session;
  if (!s) return null;
  if (s.expiresAt - Date.now() > accountConfig.refreshMarginMs) return s.accessToken;
  const res = await supaFetch<TokenResponse>('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: s.refreshToken }) });
  if (res.ok && accept(s.username, res.data)) return session?.accessToken ?? null;
  // Sessão revogada/expirada: sai (sem conexão, mantém para tentar depois).
  if (!res.ok && (res.status === 400 || res.status === 401)) storeSession(null);
  return null;
}
