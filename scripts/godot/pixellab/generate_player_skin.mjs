// Gera (via PixelLab) a arte de uma skin de jogador e a empacota no contrato do jogo.
// Uso: node scripts/godot/pixellab/generate_player_skin.mjs <comando> <skinId> [args]
//   create <skinId>              cria o personagem base (8 direções), 1 geração
//   animate <skinId> <template>  anima um template (ex: breathing-idle), 8 gerações
//   inspect <skinId>             mostra o que já está em cache pra essa skin
//   pack <skinId>                baixa as imagens em cache e monta o PNG/JSON final
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as pixellab from './client.mjs';
import { buildSheet, buildMetaJson } from './pack_sheet.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..', '..');
const CACHE_DIR = join(__dirname, '.cache');
const SKINS_TRES = join(ROOT, 'godot', 'data', 'configs', 'skins.tres');
const SPRITES_DIR = join(ROOT, 'godot', 'assets', 'sprites');

const TEMPLATES = {
  Idle: 'breathing-idle',
  Walk: 'walking-8-frames',
  Run: 'running-6-frames',
};
const ANIM_ORDER = ['Idle', 'Walk', 'Run'];
const FPS = { Idle: 3, Walk: 8, Run: 12 };
const CELL = { frame: [96, 90], pivot: [48, 69], pixelsPerMeter: 48, pitch: 60 };
const DIRECTION_NAMES = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'];

function statePath(skinId) {
  return join(CACHE_DIR, `${skinId}.state.json`);
}

function loadState(skinId) {
  const path = statePath(skinId);
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : { skinId, animations: {} };
}

function saveState(skinId, state) {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(statePath(skinId), JSON.stringify(state, null, 1));
}

function readSkin(skinId) {
  const text = readFileSync(SKINS_TRES, 'utf8');
  const entryMatch = text.match(new RegExp(`\\{[^}]*"id":\\s*"${skinId}"[^}]*\\}`));
  if (!entryMatch) throw new Error(`Skin "${skinId}" não encontrada em ${SKINS_TRES}`);
  const entry = entryMatch[0];
  const field = (name) => entry.match(new RegExp(`"${name}":\\s*"([^"]*)"`))?.[1] ?? '';
  const color = (name) => {
    const m = entry.match(new RegExp(`"${name}":\\s*Color\\(([^)]+)\\)`));
    if (!m) return null;
    const [r, g, b] = m[1].split(',').map((n) => Math.round(parseFloat(n) * 255));
    return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
  };
  return {
    id: field('id'), name: field('name'), map: field('map'), model: field('model'), style: field('style'),
    jacket: color('jacket'), pack: color('pack'), hair: color('hair'),
  };
}

function buildDescription(skin) {
  const styleHint = skin.style ? `, wearing ${skin.style} style clothing` : ', wearing a plain civilian jacket';
  return `${skin.model} character${styleHint}, jacket color ${skin.jacket}, backpack color ${skin.pack}, hair color ${skin.hair}, low top-down RPG game character, full body, standing`;
}

async function cmdCreate(skinId) {
  const skin = readSkin(skinId);
  const description = buildDescription(skin);
  console.log(`Descrição: ${description}`);
  const { text } = await pixellab.createCharacter({
    description,
    name: skin.name,
    mode: 'standard',
    n_directions: 8,
    size: 96,
    view: 'low top-down',
  });
  console.log('--- resposta create_character ---\n' + text);
  const characterId = pixellab.tryParseJson(text)?.character_id ?? pixellab.extractField(text, 'character_id');
  if (!characterId) throw new Error('Não achei character_id na resposta acima — inspecionar manualmente.');
  const state = loadState(skinId);
  state.characterId = characterId;
  saveState(skinId, state);
  console.log(`\ncharacter_id = ${characterId} (salvo em ${statePath(skinId)})`);
  console.log('Aguardando conclusão (pode levar alguns minutos)...');
  const finalText = await pixellab.pollCharacter(characterId, { onTick: (s) => console.log(`  status: ${s}`) });
  state.baseResponse = finalText;
  saveState(skinId, state);
  console.log('\n--- get_character (completo) ---\n' + finalText);
}

async function cmdAnimate(skinId, animName) {
  const template = TEMPLATES[animName];
  if (!template) throw new Error(`Animação "${animName}" não mapeada. Use: ${ANIM_ORDER.join(', ')}`);
  const state = loadState(skinId);
  if (!state.characterId) throw new Error(`Sem characterId em cache pra "${skinId}" — rode "create" primeiro.`);
  console.log(`Animando ${animName} (template ${template}) para ${state.characterId}...`);
  const { text } = await pixellab.animateCharacter({
    character_id: state.characterId,
    template_animation_id: template,
    animation_name: animName,
  });
  console.log('--- resposta animate_character ---\n' + text);
  console.log('Aguardando conclusão...');
  const finalText = await pixellab.pollCharacter(state.characterId, { onTick: (s) => console.log(`  status: ${s}`) });
  state.animations[animName] = finalText;
  saveState(skinId, state);
  console.log(`\n--- get_character após ${animName} ---\n` + finalText);
}

async function cmdInspect(skinId) {
  const state = loadState(skinId);
  console.log(JSON.stringify(state, null, 1));
}

// Só espera (sem chamar animate_character de novo) — pra retomar um poll que caiu/voltou cedo demais.
async function cmdWait(skinId, animName) {
  const state = loadState(skinId);
  if (!state.characterId) throw new Error(`Sem characterId em cache pra "${skinId}".`);
  const finalText = await pixellab.pollCharacter(state.characterId, { onTick: (s) => console.log(`  status: ${s}`) });
  if (animName) state.animations[animName] = finalText;
  else state.baseResponse = finalText;
  saveState(skinId, state);
  console.log('\n--- get_character ---\n' + finalText);
}

async function downloadPng(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao baixar ${url}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Extrai { [animName]: { [direction]: [urls ordenadas por número de quadro] } } do texto
 * de get_character (formato: "  Nome — 8 dir (...), Nf ... [type=...] [group: ...]" seguido
 * de linhas "    direção: url0, url1, ...").
 */
function parseAnimations(text) {
  const groupHeader = /^  (\w+) — /;
  const directionLine = /^ {4}([a-z-]+): (.+)$/;
  const result = {};
  let current = null;
  for (const line of text.split('\n')) {
    const header = line.match(groupHeader);
    if (header) { current = header[1]; result[current] ??= {}; continue; }
    const dirMatch = current && line.match(directionLine);
    if (dirMatch) {
      const urls = dirMatch[2].split(',').map((u) => u.trim());
      urls.sort((a, b) => Number(a.match(/\/(\d+)\.png/)?.[1] ?? 0) - Number(b.match(/\/(\d+)\.png/)?.[1] ?? 0));
      result[current][dirMatch[1]] = urls;
    }
  }
  return result;
}

async function mapWithLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

async function cmdPack(skinId) {
  const state = loadState(skinId);
  const text = state.animations.Run ?? state.animations.Walk ?? state.animations.Idle ?? state.baseResponse;
  if (!text) throw new Error('Nada em cache pra empacotar — rode "create"/"animate" primeiro.');
  const parsed = parseAnimations(text);

  const columns = ANIM_ORDER.reduce((sum, name) => {
    const perDir = parsed[name]?.[DIRECTION_NAMES[0]];
    if (!perDir) throw new Error(`Animação "${name}" não encontrada na resposta em cache. Rode "animate ${skinId} ${name}" primeiro.`);
    return sum + perDir.length;
  }, 0);

  // Monta a lista de (url, cellIndex) na ordem row-major esperada por buildSheet.
  const jobs = [];
  let animStart = 0;
  const animations = {};
  for (const name of ANIM_ORDER) {
    const frameCount = parsed[name][DIRECTION_NAMES[0]].length;
    animations[name] = { start: animStart, count: frameCount, fps: FPS[name], loop: true };
    DIRECTION_NAMES.forEach((dirName, dirIndex) => {
      const urls = parsed[name][dirName];
      if (!urls || urls.length !== frameCount) throw new Error(`Direção "${dirName}" com contagem de quadro diferente em "${name}".`);
      urls.forEach((url, frameIndex) => {
        const cellIndex = dirIndex * columns + animStart + frameIndex;
        jobs.push({ url, cellIndex });
      });
    });
    animStart += frameCount;
  }

  console.log(`Baixando ${jobs.length} imagens...`);
  const cells = new Array(DIRECTION_NAMES.length * columns).fill(null);
  await mapWithLimit(jobs, 8, async ({ url, cellIndex }) => {
    cells[cellIndex] = await downloadPng(url);
  });

  console.log('Montando a sheet...');
  const sheetPng = buildSheet({ cells, columns, directions: DIRECTION_NAMES.length, cellW: CELL.frame[0], cellH: CELL.frame[1], pivot: CELL.pivot });
  const metaJson = buildMetaJson({ frame: CELL.frame, pivot: CELL.pivot, columns, directions: DIRECTION_NAMES.length, pixelsPerMeter: CELL.pixelsPerMeter, pitch: CELL.pitch, animations });

  const pngPath = join(SPRITES_DIR, `player_${skinId}.png`);
  const jsonPath = join(SPRITES_DIR, `player_${skinId}.json`);
  writeFileSync(pngPath, sheetPng);
  writeFileSync(jsonPath, metaJson);
  console.log(`Escrito:\n  ${pngPath}\n  ${jsonPath}`);
}

const [, , command, skinId, extra] = process.argv;
const commands = { create: cmdCreate, animate: cmdAnimate, inspect: cmdInspect, wait: cmdWait, pack: cmdPack };
if (!command || !commands[command] || !skinId) {
  console.error('Uso: node generate_player_skin.mjs <create|animate|inspect|pack> <skinId> [animName]');
  process.exit(1);
}
await commands[command](skinId, extra);
