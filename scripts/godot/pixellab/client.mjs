// Cliente fino para o MCP do PixelLab (https://api.pixellab.ai/mcp), chamado por HTTP direto
// (não é uma tool nativa do Claude Code — só o VSCode/outro cliente MCP lê o .vscode/mcp.json).
// O servidor é stateless: cada tools/call é um POST independente, sem handshake prévio.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadConfig() {
  const override = process.env.PIXELLAB_URL && process.env.PIXELLAB_TOKEN;
  if (override) return { url: process.env.PIXELLAB_URL, token: process.env.PIXELLAB_TOKEN };
  const configPath = join(__dirname, '..', '..', '..', '.vscode', 'mcp.json');
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  const server = config.servers?.pixellab;
  if (!server) throw new Error(`Servidor "pixellab" não encontrado em ${configPath}.`);
  const auth = server.headers?.Authorization ?? '';
  const token = auth.replace(/^Bearer\s+/i, '');
  return { url: server.url, token };
}

let nextId = 1;

/** Chama uma tool do MCP e devolve o texto de resposta (content[].text concatenado). */
export async function callTool(name, arguments_ = {}) {
  const { url, token } = loadConfig();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: nextId++, method: 'tools/call', params: { name, arguments: arguments_ } }),
  });
  if (!res.ok) throw new Error(`PixelLab HTTP ${res.status}: ${await res.text()}`);
  const body = await res.text();
  const line = body.split('\n').find((l) => l.startsWith('data:'));
  if (!line) throw new Error(`Resposta inesperada do PixelLab: ${body.slice(0, 500)}`);
  const parsed = JSON.parse(line.slice(5).trim());
  if (parsed.error) throw new Error(`PixelLab RPC error: ${JSON.stringify(parsed.error)}`);
  const content = parsed.result?.content ?? [];
  const text = content.filter((c) => c.type === 'text').map((c) => c.text).join('\n');
  if (parsed.result?.isError) throw new Error(`PixelLab tool "${name}" falhou: ${text}`);
  return { text, raw: parsed.result };
}

/** Tenta ler a resposta como JSON; se não for JSON, devolve null (algumas tools respondem em texto formatado). */
export function tryParseJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

/** Extrai um valor "chave: valor" de uma resposta em texto (fallback quando não vem como JSON). */
export function extractField(text, key) {
  const match = text.match(new RegExp(`${key}["']?\\s*[:=]\\s*["']?([^"'\\n,}]+)`, 'i'));
  return match ? match[1].trim() : null;
}

export async function createCharacter(args) {
  return callTool('create_character', args);
}

export async function getCharacter(characterId, opts = {}) {
  return callTool('get_character', { character_id: characterId, ...opts });
}

export async function animateCharacter(args) {
  return callTool('animate_character', args);
}

export async function getBalance() {
  return callTool('get_balance', {});
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Conta jobs pendentes citados na resposta em texto (ex.: "pending jobs (8):").
 * O campo "status" de get_character é do PERSONAGEM (base), não de um job de animação
 * disparado depois — ele continua "completed" mesmo com animações ainda processando,
 * então a única forma confiável de saber se TUDO terminou é checar essa seção.
 */
function countPendingJobs(text) {
  const m = text.match(/pending jobs \((\d+)\)/i);
  return m ? parseInt(m[1], 10) : 0;
}

/** Chama get_character em loop até não sobrar job pendente (base + animações) ou bater o timeout. */
export async function pollCharacter(characterId, { intervalMs = 8000, timeoutMs = 10 * 60 * 1000, onTick } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const { text } = await getCharacter(characterId);
    const status = (tryParseJson(text)?.status ?? extractField(text, 'status') ?? '').toLowerCase();
    const pending = countPendingJobs(text);
    if (onTick) onTick(pending > 0 ? `${status} (pending jobs: ${pending})` : status, text);
    if (status === 'failed' || status === 'error') throw new Error(`Geração falhou para ${characterId}:\n${text}`);
    if ((status === 'completed' || status === 'done') && pending === 0) return text;
    if (Date.now() > deadline) throw new Error(`Timeout esperando ${characterId} (último status: "${status}", pending: ${pending}).`);
    await sleep(intervalMs);
  }
}
