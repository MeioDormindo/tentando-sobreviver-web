// Confere as traduções (npm run godot:i18n:check): cada godot/locale/<idioma>.po tem todos os textos
// do messages.pot traduzidos, com os mesmos marcadores (%s, %d, %.1f...) do original, e todo
// caractere usado existe na fonte pixel (godot/assets/fonts/pixel.fnt) ou, no chinês, japonês e
// coreano, na fonte de reserva do idioma (cjk_<idioma>.chars.txt, gerado por godot:i18n:fonts).
// Sai com erro (código 1) se algo faltar.
import { readFileSync, existsSync } from 'node:fs';
import { LANGS, readPo } from './extract.mjs';

const LOCALE_DIR = 'godot/locale';
const CJK = new Set(['zh_CN', 'zh_TW', 'ja', 'ko']);

/** Os marcadores de formato de um texto, em ordem (o %% não conta). */
export function placeholders(text) {
  // Sem o espaço como flag: "12% dos" é texto, não o marcador "% d".
  return text.replace(/%%/g, '').match(/%[-+0#]*\d*(\.\d+)?[sdfxXc]/g) ?? [];
}

function fontChars() {
  const set = new Set();
  for (const m of readFileSync('godot/assets/fonts/pixel.fnt', 'utf8').matchAll(/^char id=(\d+)/gm)) set.add(String.fromCodePoint(Number(m[1])));
  return set;
}

if (process.argv[1] && process.argv[1].endsWith('check.mjs')) {
  const potIds = [...readPo(`${LOCALE_DIR}/messages.pot`).keys()];
  const pixel = fontChars();
  let problems = 0;
  const report = (lang, text) => {
    problems += 1;
    if (problems <= 60) console.log(`  [${lang}] ${text}`);
  };
  for (const lang of LANGS) {
    const po = readPo(`${LOCALE_DIR}/${lang}.po`);
    const extra = CJK.has(lang) && existsSync(`godot/assets/fonts/cjk_${lang}.chars.txt`) ? new Set(readFileSync(`godot/assets/fonts/cjk_${lang}.chars.txt`, 'utf8')) : new Set();
    let missing = 0;
    const unknown = new Set();
    for (const id of potIds) {
      const str = po.get(id);
      if (!str) {
        missing += 1;
        continue;
      }
      if (placeholders(str).join(' ') !== placeholders(id).join(' ')) report(lang, `marcadores diferentes: "${id}" → "${str}"`);
      for (const ch of str) {
        if (ch === '\n' || pixel.has(ch) || extra.has(ch)) continue;
        unknown.add(ch);
      }
    }
    if (missing) report(lang, `${missing} textos sem tradução`);
    if (unknown.size) report(lang, `${unknown.size} caracteres fora da fonte: ${[...unknown].slice(0, 40).join('')}`);
  }
  console.log(problems ? `  ${problems} problemas` : `  ${potIds.length} textos × ${LANGS.length} idiomas: tudo traduzido e na fonte`);
  process.exit(problems ? 1 : 0);
}
