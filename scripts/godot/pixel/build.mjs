// Gera as folhas de sprites em pixel art do jogo (npm run godot:sprites): zumbis, cão,
// bosses, jogador (um por visual) e armas (camada à parte), em 8 direções, na vista 3/4 da
// câmera. As cores vêm dos dados já exportados do jogo web (godot/data), a fonte única.
// Saída: godot/assets/sprites/<nome>.png + <nome>.json.
import { mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { encodePng } from './png.mjs';
import { buildSheet } from './rig.mjs';
import { hex } from './raster.mjs';
import {
  zombieModel, zombieAnimations, playerModel, playerAnimations, weaponParts, WEAPON_KINDS,
  houndModel, houndAnimations, conductorModel, patientZeroModel, bossAnimations,
} from './characters.mjs';

const OUT = 'godot/assets/sprites';
/** Inclinação da câmera do jogo (TopDownCamera.pitch_degrees): o desenho usa a mesma vista. */
const PITCH = 55;
/** Quadro comum do jogador e das armas (as camadas se sobrepõem). */
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

// Armas: mesma pose e quadro do jogador, só a arma (e se ela fica atrás do corpo).
const base = playerModel({ jacket: [0, 0, 0], pack: [0, 0, 0], hair: [0, 0, 0] });
for (const kind of WEAPON_KINDS) {
  const model = { ...base, parts: [...base.parts, ...weaponParts(kind)] };
  write(`weapon_${kind}`, buildSheet(model, playerAnimations(), {
    pitch: PITCH, fixedFrame: PLAYER_FRAME,
    layers: { weapon: (p) => p.layer === 'weapon' },
  }));
}
