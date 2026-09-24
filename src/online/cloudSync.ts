import { accountConfig } from '../config/online.config';
import { save } from '../save/SaveStore';
import { accessToken, currentUser } from './auth';
import { supaFetch } from './http';

/**
 * Save na nuvem: uma linha por conta (tabela cloud_saves, protegida por RLS). Ao entrar, o save da
 * nuvem é mesclado com o do aparelho (nada se perde) e o resultado volta para a nuvem. Depois,
 * cada alteração do save é enviada alguns segundos depois.
 */

export interface SyncStatus {
  busy: boolean;
  /** Última sincronização concluída (ms desde 1970), ou 0. */
  lastSyncAt: number;
  error: string | null;
}

const status: SyncStatus = { busy: false, lastSyncAt: 0, error: null };
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;
let started = false;

export const syncStatus = (): Readonly<SyncStatus> => status;

/** Avisa quando o status muda (tela CONTA). Retorna a função para parar de ouvir. */
export function onSyncStatus(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function update(patch: Partial<SyncStatus>): void {
  Object.assign(status, patch);
  listeners.forEach((cb) => cb());
}

async function push(token: string): Promise<boolean> {
  const res = await supaFetch<null>('/rest/v1/cloud_saves', {
    method: 'POST',
    token,
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ data: save.exportData() }),
  });
  if (!res.ok) update({ error: res.status === 0 ? 'Sem conexão' : 'Falha ao salvar na nuvem' });
  return res.ok;
}

/**
 * Baixa o save da nuvem, mescla com o local e envia o resultado.
 * `takeSettings`: ao entrar numa conta, as configurações da nuvem valem.
 */
export async function syncNow(takeSettings = false): Promise<boolean> {
  if (status.busy) return false;
  update({ busy: true, error: null });
  try {
    const token = await accessToken();
    if (!token) {
      update({ error: currentUser() ? 'Sem conexão' : 'Sessão expirada — entre de novo' });
      return false;
    }
    const res = await supaFetch<Array<{ data: unknown }>>('/rest/v1/cloud_saves?select=data', { token });
    if (!res.ok) {
      update({ error: res.status === 0 ? 'Sem conexão' : 'Falha ao ler da nuvem' });
      return false;
    }
    const remote = Array.isArray(res.data) ? res.data[0]?.data : undefined;
    if (remote !== undefined) save.mergeFrom(remote, takeSettings);
    const ok = await push(token);
    if (ok) update({ lastSyncAt: Date.now() });
    return ok;
  } finally {
    update({ busy: false });
  }
}

/** Liga o envio automático (uma vez, no início do jogo) e sincroniza se já houver sessão. */
export function startCloudSync(): void {
  if (started) return;
  started = true;
  save.onChange(() => {
    if (!currentUser()) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (status.busy) return;
      void accessToken().then(async (token) => {
        if (token && (await push(token))) update({ lastSyncAt: Date.now(), error: null });
      });
    }, accountConfig.syncDebounceMs);
  });
  if (currentUser()) void syncNow();
}
