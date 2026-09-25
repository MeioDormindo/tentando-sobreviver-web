// Gera as folhas de sprites em pixel art do jogo (npm run godot:sprites): zumbis, cão,
// bosses, jogador (um por visual) e armas (camada à parte), em 8 direções, na vista 3/4 da
// câmera. As cores vêm dos dados já exportados do jogo web (godot/data), a fonte única.
// Saída: godot/assets/sprites/<nome>.png + <nome>.json.
import { mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { encodePng } from './png.mjs';
import { buildSheet, renderIcon } from './rig.mjs';
import { weaponShape } from './weapons.mjs';
import { rmSync } from 'node:fs';
import { hex } from './raster.mjs';
import {
  zombieModel, zombieAnimations, playerModel, playerAnimations, weaponParts,
  houndModel, houndAnimations, conductorModel, patientZeroModel, bossAnimations,
} from './characters.mjs';

const OUT = 'godot/assets/sprites';
/** Inclinação da câmera do jogo (TopDownCamera.pitch_degrees): o desenho usa a mesma vista. */
const PITCH = 60;
/** Quadro comum do jogador e das armas (as camadas se sobrepõem). */
// (medidas em 32 px/m; o rig converte para a densidade da folha)
const PLAYER_FRAME = { size: [64, 60], pivot: [32, 46] };

mkdirSync(OUT, { recursive: true });

function tresColor(text, key) {
  const m = text.match(new RegExp(`${key} = Color\\(([^)]+)\\)`));
  if (!m) return null;
  const [r, g, b] = m[1].split(',').map((v) => Math.round(parseFloat(v) * 255));
  return [r, g, b];
}

function tresNumber(text, key, fallback) {
  const m = text.match(new RegExp(`${key} = ([0-9.]+)`));
  return m ? parseFloat(m[1]) : fallback;
}

function write(name, result) {
  for (const [layer, sheet] of Object.entries(result.sheets)) {
    const file = layer === 'body' || layer === 'weapon' ? name : `${name}_${layer}`;
    writeFileSync(join(OUT, `${file}.png`), encodePng(sheet.width, sheet.height, sheet.data));
  }
  writeFileSync(join(OUT, `${name}.json`), JSON.stringify(result.meta, null, 1) + '\n');
  console.log(`  ${name}: quadro ${result.meta.frame.join('×')}, ${result.meta.columns} quadros × 8 direções`);
}

const GLOWS = { exploder: hex(0xffa23a), spitter: hex(0xa8ff4a) };

// Zumbis (os tipos exportados do jogo web).
for (const file of readdirSync('godot/data/zombies')) {
  if (!file.endsWith('.tres')) continue;
  const id = file.replace('.tres', '');
  const text = readFileSync(join('godot/data/zombies', file), 'utf8');
  const look = {
    shirt: tresColor(text, 'shirt_color'), skin: tresColor(text, 'skin_color'),
    scale: tresNumber(text, 'model_scale', 1), armored: /\narmor = \{/.test(text), glow: GLOWS[id],
  };
  if (id === 'hound') {
    write('hound', buildSheet(houndModel(look), houndAnimations(), { pitch: PITCH }));
  } else {
    write(`zombie_${id}`, buildSheet(zombieModel(look), zombieAnimations(), { pitch: PITCH, workSize: 240 }));
    // Blindado sem a armadura (depois do headshot ou de dano suficiente).
    if (look.armored) write(`zombie_${id}_bare`, buildSheet(zombieModel({ ...look, armored: false }), zombieAnimations(), { pitch: PITCH, workSize: 240 }));
  }
}

// Bosses.
write('boss_conductor', buildSheet(conductorModel(), bossAnimations(), { pitch: PITCH, workSize: 320 }));
write('boss_patient_zero', buildSheet(patientZeroModel(), bossAnimations(), { pitch: PITCH, workSize: 320 }));

// Jogador: um por visual (cores do skins.tres), sem arma.
const skins = readFileSync('godot/data/configs/skins.tres', 'utf8');
for (const line of skins.split('\n')) {
  const id = line.match(/"id": "([a-z_]+)"/);
  if (!id) continue;
  const color = (key) => {
    const m = line.match(new RegExp(`"${key}": Color\\(([^)]+)\\)`));
    return m[1].split(',').slice(0, 3).map((v) => Math.round(parseFloat(v) * 255));
  };
  const model = playerModel({ jacket: color('jacket'), pack: color('pack'), hair: color('hair') });
  write(`player_${id[1]}`, buildSheet(model, playerAnimations(), { pitch: PITCH, fixedFrame: PLAYER_FRAME, layers: { body: null } }));
}

// Armas: uma folha por arma e por nível do Weapon Lab (weapon_<id>, _mk2, _mk3), na mesma
// pose e quadro do jogador (e se ela fica atrás do corpo), e o ícone de perfil de cada uma.
for (const file of readdirSync(OUT)) if (file.startsWith('weapon_')) rmSync(join(OUT, file));
mkdirSync(join(OUT, 'icons'), { recursive: true });
const base = playerModel({ jacket: [0, 0, 0], pack: [0, 0, 0], hair: [0, 0, 0] });
const weaponIds = readdirSync('godot/data/weapons')
  .filter((f) => f.endsWith('.tres') && !['catalog.tres', 'knife.tres'].includes(f))
  .map((f) => f.replace('.tres', ''));
for (const id of weaponIds) {
  for (const level of [0, 1, 2]) {
    const model = { ...base, parts: [...base.parts, ...weaponParts(id, level)] };
    write(`weapon_${id}${level ? `_mk${level + 1}` : ''}`, buildSheet(model, playerAnimations(), {
      pitch: PITCH, fixedFrame: PLAYER_FRAME,
      layers: { weapon: (p) => p.layer === 'weapon' },
    }));
    const icon = renderIcon(weaponShape(id, level));
    writeFileSync(join(OUT, 'icons', `weapon_${id}${level ? `_mk${level + 1}` : ''}.png`), encodePng(icon.width, icon.height, icon.data));
  }
}

// Efeitos em pixel (clarão, faísca, explosão, fumaça, sangue, projéteis, chama, vento).
import('./fx.mjs').then(({ buildFx }) => {
  const dir = join(OUT, 'fx');
  mkdirSync(dir, { recursive: true });
  for (const [name, fx] of Object.entries(buildFx())) {
    const frames = fx.sheet.width / fx.sheet.height;
    writeFileSync(join(dir, `${name}.png`), encodePng(fx.sheet.width, fx.sheet.height, fx.sheet.data));
    writeFileSync(join(dir, `${name}.json`), JSON.stringify({ frame: [fx.sheet.height, fx.sheet.height], frames, fps: fx.fps, loop: fx.loop, pixels_per_meter: 48 }) + '\n');
  }
  console.log('  efeitos:', Object.keys(buildFx()).join(', '));
});
