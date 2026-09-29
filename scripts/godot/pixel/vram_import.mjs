// Liga VRAM Compressed (compress/mode=2, ETC2/ASTC no mobile via
// textures/vram_compression/import_etc2_astc=true do projeto, S3TC/BPTC no desktop) nos
// .png.import de godot/assets/sprites/*.png. Editado só como texto (é INI/ConfigFile, não
// JSON) porque não existe preset de import por pasta no Godot 4. Depois de rodar, reimportar:
// godot --headless --path godot --import
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'godot/assets/sprites';
let changed = 0;
for (const file of readdirSync(DIR)) {
  if (!file.endsWith('.png.import')) continue; // só o nível raiz: os personagens/armas, não icons/fx/ui/...
  const path = join(DIR, file);
  const text = readFileSync(path, 'utf8');
  let next = text.replace(/^compress\/mode=\d+$/m, 'compress/mode=2');
  next = next.replace(/^compress\/high_quality=false$/m, 'compress/high_quality=true');
  if (next !== text) {
    writeFileSync(path, next);
    changed++;
  }
}
console.log(`${changed} sprites marcados para VRAM Compressed (compress/mode=2).`);
