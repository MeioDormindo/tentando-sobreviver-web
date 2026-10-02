// Fontes de reserva do chinês, japonês e coreano (npm run godot:i18n:fonts). A fonte pixel do jogo
// (font.mjs) cobre o alfabeto latino e o cirílico; ideogramas, kana e hangul vêm da Fusion Pixel
// Font 12px (TakWolf, licença SIL OFL 1.1), uma variante por idioma (os ideogramas têm formas
// diferentes em cada um). Recorta só os caracteres usados nas traduções (godot/locale/<idioma>.po),
// então cada arquivo fica pequeno. Rodar de novo depois de mudar as traduções.
// O zip original fica em cache fora do git (scripts/godot/i18n/.cache).
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import subsetFont from 'subset-font';
import { readPo } from './extract.mjs';

const VERSION = '2026.09.25';
const ZIP = `fusion-pixel-font-12px-proportional-ttf-v${VERSION}.zip`;
const URL = `https://github.com/TakWolf/fusion-pixel-font/releases/download/${VERSION}/${ZIP}`;
const CACHE = 'scripts/godot/i18n/.cache';
const OUT = 'godot/assets/fonts';
/** Idioma do jogo → variante da Fusion Pixel. */
const VARIANTS = { zh_CN: 'zh_hans', zh_TW: 'zh_tw', ja: 'ja', ko: 'ko' };
/** Entre uma licença e outra no arquivo de licenças. */
const SEPARATOR = `\n\n${'='.repeat(72)}\n\n`;
/** Sempre junto: pontuação de largura cheia e símbolos comuns nesses idiomas. */
const ALWAYS = '、。，．：；！？「」『』（）【】〈〉《》〜～ー・…—‐％＋－／＝０１２３４５６７８９';
/** Os nomes dos idiomas fora do alfabeto latino e do cirílico, como aparecem nas Configurações (Loc.LANGUAGES). */
export const NAMES = [...new Set('简体中文繁體中文日本語한국어')].join('');

async function download() {
  mkdirSync(CACHE, { recursive: true });
  const zip = join(CACHE, ZIP);
  if (!existsSync(zip)) {
    console.log(`  baixando ${URL}`);
    const response = await fetch(URL);
    if (!response.ok) throw new Error(`download falhou: ${response.status}`);
    writeFileSync(zip, Buffer.from(await response.arrayBuffer()));
  }
  const dir = join(CACHE, `fusion-${VERSION}`);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    // unzip (Linux, Git Bash) ou o tar do Windows, que abre zip.
    try {
      execFileSync('unzip', ['-q', '-o', zip, '-d', dir]);
    } catch {
      execFileSync('C:/Windows/System32/tar.exe', ['-xf', zip, '-C', dir]);
    }
  }
  return dir;
}

function find(dir, test) {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, name.name);
    if (name.isDirectory()) {
      const hit = find(path, test);
      if (hit) return hit;
    } else if (test(name.name)) {
      return path;
    }
  }
  return null;
}

/** Caracteres fora do ASCII usados nas traduções de um idioma. */
export function usedChars(lang) {
  const chars = new Set(ALWAYS);
  for (const text of readPo(`godot/locale/${lang}.po`).values()) {
    for (const ch of text) {
      if (ch.codePointAt(0) > 0x7e) chars.add(ch);
    }
  }
  return [...chars].sort().join('');
}

if (process.argv[1] && process.argv[1].endsWith('cjk-fonts.mjs')) {
  const dir = await download();
  for (const [lang, variant] of Object.entries(VARIANTS)) {
    const source = find(dir, (n) => n.endsWith(`-${variant}.ttf`));
    if (!source) throw new Error(`variante ${variant} não achada em ${dir}`);
    const chars = usedChars(lang);
    // ASCII junto (números e pontuação em frases misturadas) e os caracteres do idioma.
    let ascii = '';
    for (let c = 0x20; c <= 0x7e; c++) ascii += String.fromCharCode(c);
    const subset = await subsetFont(readFileSync(source), ascii + chars, { targetFormat: 'truetype' });
    writeFileSync(`${OUT}/cjk_${lang}.ttf`, subset);
    writeFileSync(`${OUT}/cjk_${lang}.chars.txt`, chars);
    console.log(`  ${OUT}/cjk_${lang}.ttf: ${[...chars].length} caracteres, ${(subset.length / 1024).toFixed(0)} KB`);
  }
  // Os nomes nativos na lista de idiomas das Configurações aparecem em qualquer idioma: uma fonte
  // mínima com só esses caracteres fica sempre como reserva (Loc).
  const names = find(dir, (n) => n.endsWith('-zh_hans.ttf'));
  const nameSubset = await subsetFont(readFileSync(names), NAMES, { targetFormat: 'truetype' });
  writeFileSync(`${OUT}/cjk_names.ttf`, nameSubset);
  writeFileSync(`${OUT}/cjk_names.chars.txt`, NAMES);
  console.log(`  ${OUT}/cjk_names.ttf: ${[...NAMES].length} caracteres, ${(nameSubset.length / 1024).toFixed(1)} KB`);
  // Licenças (OFL) da Fusion Pixel e das fontes que ela junta, num arquivo só ao lado das fontes.
  const licenses = [join(dir, 'OFL.txt'), join(dir, 'LICENSES/ark-pixel/OFL.txt'), join(dir, 'LICENSES/cubic-11/OFL.txt'), join(dir, 'LICENSES/galmuri/LICENSE.txt')].filter(existsSync);
  writeFileSync(`${OUT}/fusion-pixel-font-LICENSES.txt`, licenses.map((f) => readFileSync(f, 'utf8')).join(SEPARATOR));
}
