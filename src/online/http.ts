import { onlineConfig } from '../config/online.config';

export type HttpResult<T> = { ok: true; data: T } | { ok: false; status: number; message: string };

/**
 * Requisição à API do Supabase com tempo limite. Nunca lança: erros de rede viram `ok: false`.
 * Os filtros vão na URL já codificados (encodeURIComponent) — nada de SQL montado no cliente.
 */
export async function supaFetch<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<HttpResult<T>> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), onlineConfig.timeoutMs);
  const headers: Record<string, string> = { apikey: onlineConfig.publishableKey, 'Content-Type': 'application/json' };
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  try {
    const res = await fetch(`${onlineConfig.url}${path}`, { ...init, headers: { ...headers, ...(init.headers as Record<string, string> | undefined) }, signal: ctrl.signal });
    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? (JSON.parse(text) as unknown) : null;
    } catch {
      body = text;
    }
    if (!res.ok) return { ok: false, status: res.status, message: errorMessage(body) };
    return { ok: true, data: body as T };
  } catch {
    return { ok: false, status: 0, message: 'sem conexão' };
  } finally {
    clearTimeout(timer);
  }
}

function errorMessage(body: unknown): string {
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    for (const k of ['message', 'msg', 'error_description', 'error']) if (typeof b[k] === 'string') return b[k] as string;
  }
  return typeof body === 'string' ? body : 'erro';
}
