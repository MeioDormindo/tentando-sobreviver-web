// Textos do jogo para tradução (npm run godot:i18n). O jogo é escrito em português e os textos
// em português são as chaves (msgid) do catálogo gettext em godot/locale:
//   - messages.pot: todos os textos encontrados (com onde aparecem);
//   - <idioma>.po: um por idioma; as entradas novas entram vazias e as traduções já feitas ficam.
//     O pt_BR.po é a identidade (msgstr = msgid): o fallback do Godot é o inglês, então sem ele
//     quem joga em português veria inglês.
// De onde saem os textos:
//   - literais dos scripts .gd com cara de texto de tela (heurística abaixo; o que não é texto e
//     escapar vai para ignore.txt);
//   - campos de texto dos .tres (nomes, descrições, dicas...) e do glossário/mapas (JSON).
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = 'godot';
const LOCALE_DIR = `${ROOT}/locale`;
export const LANGS = ['en', 'pt_BR', 'es', 'fr', 'de', 'it', 'ru', 'uk', 'pl', 'tr', 'id', 'zh_CN', 'zh_TW', 'ja', 'ko'];
const SOURCE_LANG = 'pt_BR';

/** Campos de texto nos dados (.tres e JSON). */
const DATA_KEYS = new Set(['display_name', 'description', 'upgrade_name', 'taunt_subtitle', 'credits', 'title', 'subtitle', 'text',
  'hint', 'name', 'lore', 'loreMessages', 'objective', 'label', 'detail', 'toast']);
/** Chamadas cujo argumento literal não é texto de tela (nós, ações, sons, chaves...). */
const NOT_TEXT_BEFORE = /(get_node(_or_null)?|find_child(ren)?|has_node|get|has|erase|play|play_at|loop_at|set_setting|get_setting|is_action_pressed|is_action_just_pressed|is_action|has_method|call|call_deferred|set|get_meta|set_meta|has_meta|create_from_string|load|exists|file_exists|get_slice|begins_with|ends_with|contains|find|findn|replace|split|trim_prefix|trim_suffix|has_signal|emit_signal|connect|add_to_group|is_in_group|get_nodes_in_group|get_first_node_in_group|remove_from_group|discover|unlock|has_achievement|get_file_as_string|open|push_warning|push_error|print|printerr|prints|print_debug|assert|request|rpc|rpc_id|eval|sheet|exists_sheet|icon_path|set_shader_parameter|get_shader_parameter|tween_property|tween_method|create|PixelFx\.\w+|spawn|attach_loop|decal|make|data_path|StringName|NodePath)\s*\(\s*$/;
const LINE_SKIP = /^\s*(#|@export|@onready var \w+\s*:?=\s*\$|const \w+ := "res:|signal )/;

function walk(dir, ext, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (name.startsWith('.')) continue;
    const st = statSync(path);
    if (st.isDirectory()) walk(path, ext, out);
    else if (name.endsWith(ext)) out.push(path);
  }
  return out;
}

/** Literais "..." de uma linha de GDScript, com o texto antes de cada um (desfaz os escapes). */
function literals(line) {
  const found = [];
  let i = 0;
  while (i < line.length) {
    const c = line[i];
    if (c === '#') break; // comentário
    if (c === '"' || c === "'") {
      const quote = c;
      let j = i + 1;
      let text = '';
      while (j < line.length && line[j] !== quote) {
        if (line[j] === '\\' && j + 1 < line.length) {
          const n = line[j + 1];
          text += n === 'n' ? '\n' : n === 't' ? '\t' : n;
          j += 2;
        } else {
          text += line[j];
          j += 1;
        }
      }
      const prefix = line.slice(0, i);
      const after = line.slice(j + 1);
      found.push({ text, prefix, after, stringName: prefix.endsWith('&') || prefix.endsWith('^') });
      i = j + 1;
    } else {
      i += 1;
    }
  }
  return found;
}

/** Tem cara de texto de tela (e não de id, caminho, nome de nó ou formato puro)? */
export function looksLikeText(text) {
  if (text.length < 2) return false;
  if (!/\p{L}/u.test(text)) return false;
  if (/^(res|user|uid|https?):\/\//.test(text)) return false;
  if (/^[a-z0-9_./:%-]+$/.test(text)) return false;          // id, caminho, chave
  if (/^[A-Z][a-z0-9]+([A-Z][a-z0-9]*)*\d*$/.test(text)) return false; // NomeDeNó
  if (/^[A-Za-z0-9_]+\.(png|tres|tscn|gd|json|ogg|wav|svg|ttf|fnt)$/.test(text)) return false;
  if (/^\w+=/.test(text)) return false;                      // argumento de linha de comando
  if (/^[%\d\s.:,+\-×x/·()$]+$/.test(text.replace(/%[sd]|%\.\d+f|%0?\d*d/g, ''))) return false; // só formato
  // Texto: tem espaço, acento, ou é uma palavra em maiúsculas (botão: "JOGAR", "RANKING").
  return /\s/.test(text.trim()) || /[À-ÿ]/.test(text) || /^[A-ZÀ-Ú][A-ZÀ-Ú!?.:]+$/.test(text);
}

function fromScripts(add, ignore) {
  for (const file of walk(`${ROOT}/scripts`, '.gd')) {
    const lines = readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
      if (LINE_SKIP.test(line)) return;
      for (const lit of literals(line)) {
        if (lit.stringName || !looksLikeText(lit.text) || ignore.has(lit.text)) continue;
        const before = lit.prefix.replace(/\s+$/, '');
        if (NOT_TEXT_BEFORE.test(before)) continue;
        if (/^\s*:/.test(lit.after) && /[{,]\s*$/.test(before)) continue; // chave de dicionário
        if (/(\.name|\bname)\s*=\s*$/.test(before) && !/^[A-ZÀ-Ú ]+$/.test(lit.text)) continue;
        add(lit.text, `${relative(ROOT, file).replace(/\\/g, '/')}:${index + 1}`);
      }
    });
  }
}

function fromTres(add, ignore) {
  for (const file of walk(`${ROOT}/data`, '.tres')) {
    const src = readFileSync(file, 'utf8');
    const ref = relative(ROOT, file).replace(/\\/g, '/');
    for (const m of src.matchAll(/^(\w+) = "((?:[^"\\]|\\.)*)"/gm)) {
      if (DATA_KEYS.has(m[1])) addData(add, ignore, unescape(m[2]), ref);
    }
    for (const m of src.matchAll(/"(\w+)": "((?:[^"\\]|\\.)*)"/g)) {
      if (DATA_KEYS.has(m[1])) addData(add, ignore, unescape(m[2]), ref);
    }
  }
}

function fromJson(add, ignore) {
  const files = [`${ROOT}/data/configs/glossary.json`, ...walk(`${ROOT}/data/maps`, '.json')];
  for (const file of files) {
    if (!existsSync(file)) continue;
    const ref = relative(ROOT, file).replace(/\\/g, '/');
    (function visit(node) {
      if (Array.isArray(node)) node.forEach(visit);
      else if (node && typeof node === 'object') {
        for (const [key, value] of Object.entries(node)) {
          if (typeof value === 'string' && DATA_KEYS.has(key)) addData(add, ignore, value, ref);
          else if (Array.isArray(value) && DATA_KEYS.has(key)) value.filter((v) => typeof v === 'string').forEach((v) => addData(add, ignore, v, ref));
          else visit(value);
        }
      }
    })(JSON.parse(readFileSync(file, 'utf8')));
  }
}

function addData(add, ignore, text, ref) {
  if (text.trim() === '' || ignore.has(text) || !/\p{L}/u.test(text)) return;
  if (/^[a-z0-9_./-]+$/.test(text)) return;
  add(text, ref);
}

function unescape(s) {
  return s.replace(/\\(.)/g, (_, c) => (c === 'n' ? '\n' : c === 't' ? '\t' : c));
}

// ───────────────────────── PO ─────────────────────────

export function poEscape(s) {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\t/g, '\\t');
}

function poUnescape(s) {
  return s.replace(/\\(.)/g, (_, c) => (c === 'n' ? '\n' : c === 't' ? '\t' : c));
}

/** msgid → msgstr de um .po (só entradas simples, sem plural/contexto). */
export function readPo(path) {
  const map = new Map();
  if (!existsSync(path)) return map;
  const text = readFileSync(path, 'utf8');
  let key = null;
  let field = null;
  let id = '';
  let str = '';
  const flush = () => {
    if (key !== null && id !== '') map.set(id, str);
    key = null; id = ''; str = '';
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('msgid ')) {
      flush();
      key = true; field = 'id';
      id = poUnescape(line.slice(7, -1));
    } else if (line.startsWith('msgstr ')) {
      field = 'str';
      str = poUnescape(line.slice(8, -1));
    } else if (line.startsWith('"') && field) {
      const piece = poUnescape(line.slice(1, -1));
      if (field === 'id') id += piece; else str += piece;
    }
  }
  flush();
  return map;
}

function header(lang) {
  return [
    'msgid ""',
    'msgstr ""',
    '"Project-Id-Version: Tentando Sobreviver\\n"',
    '"MIME-Version: 1.0\\n"',
    '"Content-Type: text/plain; charset=UTF-8\\n"',
    '"Content-Transfer-Encoding: 8bit\\n"',
    ...(lang ? [`"Language: ${lang}\\n"`] : []),
    '',
  ];
}

function entry(id, str, refs) {
  const lines = [];
  if (refs) lines.push(`#: ${refs.slice(0, 3).join(' ')}`);
  lines.push(`msgid "${poEscape(id)}"`, `msgstr "${poEscape(str)}"`, '');
  return lines;
}

export function extract() {
  const ignoreFile = 'scripts/godot/i18n/ignore.txt';
  const listed = existsSync(ignoreFile) ? readFileSync(ignoreFile, 'utf8').split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#')) : [];
  // Compara sem os espaços das pontas (o editor pode tirar o espaço do fim da linha).
  const trimmed = new Set(listed.map((l) => l.trim()));
  const ignore = { has: (text) => trimmed.has(text.trim()) };
  const found = new Map();
  const add = (text, ref) => {
    if (!found.has(text)) found.set(text, []);
    found.get(text).push(ref);
  };
  fromScripts(add, ignore);
  fromTres(add, ignore);
  fromJson(add, ignore);
  return found;
}

if (process.argv[1] && process.argv[1].endsWith('extract.mjs')) {
  const found = extract();
  mkdirSync(LOCALE_DIR, { recursive: true });
  const ids = [...found.keys()];
  writeFileSync(`${LOCALE_DIR}/messages.pot`, [...header(null), ...ids.flatMap((id) => entry(id, '', found.get(id)))].join('\n'));
  for (const lang of LANGS) {
    const path = `${LOCALE_DIR}/${lang}.po`;
    const old = readPo(path);
    const body = ids.flatMap((id) => entry(id, lang === SOURCE_LANG ? id : (old.get(id) ?? ''), null));
    writeFileSync(path, [...header(lang), ...body].join('\n'));
  }
  const missing = Object.fromEntries(LANGS.filter((l) => l !== SOURCE_LANG).map((l) => [l, ids.filter((id) => !(readPo(`${LOCALE_DIR}/${l}.po`).get(id))).length]));
  console.log(`  ${ids.length} textos em godot/locale/messages.pot; sem tradução por idioma:`, missing);
}
