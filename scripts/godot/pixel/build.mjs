// Gera as folhas de sprites em pixel art do jogo (npm run godot:sprites): zumbis, cão,
// bosses, jogador (um por visual) e armas (camada à parte), em 8 direções, na vista 3/4 da
// câmera. As cores vêm dos dados já exportados do jogo web (godot/data), a fonte única.
// Saída: godot/assets/sprites/<nome>.png + <nome>.json.
import { mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { encodePng } from './png.mjs';
import { buildSheet, renderIcon, solve, sample } from './rig.mjs';
import { apply } from './raster.mjs';
import { weaponShape } from './weapons.mjs';
import { rmSync } from 'node:fs';
import { hex } from './raster.mjs';
import {
  zombieModel, zombieAnimations, playerModel, playerAnimations, weaponParts,
  houndModel, houndAnimations, PISTOLS, conductorModel, patientZeroModel, bossAnimations,
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

// Zumbi dourado (evento): o runner inteiro em ouro, olhos amarelos e coroa.
{
  const runner = readFileSync(join('godot/data/zombies', 'runner.tres'), 'utf8');
  const gold = { shirt: hex(0xd9a520), skin: hex(0xf0c85a), pants: hex(0xa8741a), shoes: hex(0x7a5210), eyes: hex(0xfff2a0), crown: hex(0xffd84a), scale: tresNumber(runner, 'model_scale', 1) };
  write('zombie_golden', buildSheet(zombieModel(gold), zombieAnimations(), { pitch: PITCH, workSize: 240 }));
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
  .filter((f) => f.endsWith('.tres') && f !== 'catalog.tres')
  .map((f) => f.replace('.tres', ''));
for (const id of weaponIds) {
  // A faca não tem melhorias do Weapon Lab.
  for (const level of id === 'knife' ? [0] : [0, 1, 2]) {
    const model = { ...base, parts: [...base.parts, ...weaponParts(id, level)] };
    // Desenhada com o corpo na frente: só os pixels da arma que aparecem (a mão cobre o cabo),
    // e a camada vai sempre por cima do corpo.
    const sheet = buildSheet(model, playerAnimations(), {
      pitch: PITCH, fixedFrame: PLAYER_FRAME, occlude: true,
      layers: { weapon: (p) => p.layer === 'weapon' },
    });
    // Postura do corpo com essa arma (animações com sufixo _pistol ou as normais).
    sheet.meta.stance = id === 'knife' ? 'knife' : PISTOLS.includes(id) ? 'pistol' : 'rifle';
    sheet.meta.muzzle = muzzleOf(id, level, sheet.meta.stance);
    write(`weapon_${id}${level ? `_mk${level + 1}` : ''}`, sheet);
    const icon = renderIcon(weaponShape(id, level));
    writeFileSync(join(OUT, 'icons', `weapon_${id}${level ? `_mk${level + 1}` : ''}.png`), encodePng(icon.width, icon.height, icon.data));
  }
}

/**
 * Ponta do cano na pose de mira parada, no espaço do Pivot do jogador no Godot (x direita,
 * y cima, -z frente): de onde sai o tiro e o clarão.
 */
function muzzleOf(id, level, stance) {
  const parts = weaponParts(id, level);
  const tipY = Math.max(...parts.map((q) => q.at[1] + q.size[1] / 2));
  const barrel = parts.reduce((best, q) => (q.at[1] + q.size[1] / 2 >= tipY - 0.001 ? q : best), parts[0]);
  const idle = playerAnimations().find((a) => a.name === (stance === 'pistol' ? 'Idle_pistol' : 'Idle'));
  const bones = solve(base.bones, sample(idle.keys, 0));
  const [x, y, z] = apply(parts[0].attach(bones), [0, tipY, barrel.at[2]]);
  return [x, z, -y].map((v) => Math.round(v * 1000) / 1000);
}

// Desenhos de giz das compras na parede (armas que não são só da caixa) e o quadro-negro.
import('./chalk.mjs').then(({ buildChalk }) => buildChalk(join(OUT, 'chalk'), weaponIds.filter((id) => id !== 'knife')));

// Ursinho (segredo): sentado, visto pela câmera do jogo.
{
  const fur = hex(0x8a5a36), light = hex(0xc89a6a), dark = hex(0x2a1a12);
  const e = (at, size, color, extra = {}) => ({ at, size, color, shape: 'ellipsoid', ...extra });
  const teddy = [
    e([0, 0, 0.17], [0.3, 0.26, 0.3], fur),  // corpo
    e([0, 0.09, 0.15], [0.17, 0.08, 0.19], light),  // barriga
    e([0, 0.02, 0.43], [0.27, 0.24, 0.24], fur),  // cabeça
    e([0, 0.12, 0.41], [0.1, 0.08, 0.08], light),  // focinho
    e([0, 0.165, 0.43], [0.04, 0.02, 0.03], dark, { flat: true }),  // nariz
    e([0.06, 0.13, 0.48], [0.03, 0.02, 0.03], dark, { flat: true }), e([-0.06, 0.13, 0.48], [0.03, 0.02, 0.03], dark, { flat: true }),
    e([0.11, 0, 0.55], [0.09, 0.06, 0.09], fur), e([-0.11, 0, 0.55], [0.09, 0.06, 0.09], fur),  // orelhas
    e([0.17, 0.04, 0.2], [0.09, 0.09, 0.18], fur, { rot: [0.5, 0, 0] }), e([-0.17, 0.04, 0.2], [0.09, 0.09, 0.18], fur, { rot: [0.5, 0, 0] }),
    e([0.09, 0.14, 0.05], [0.1, 0.18, 0.09], fur), e([-0.09, 0.14, 0.05], [0.1, 0.18, 0.09], fur),  // pernas
    e([0.09, 0.23, 0.05], [0.08, 0.02, 0.07], light, { flat: true }), e([-0.09, 0.23, 0.05], [0.08, 0.02, 0.07], light, { flat: true }),
  ];
  const icon = renderIcon(teddy, { pitch: PITCH, ppm: 48, dir: 0, size: 96 });
  writeFileSync(join(OUT, 'icons', 'teddy.png'), encodePng(icon.width, icon.height, icon.data));
}

// Manivela do sinal (missão do Terminal): cabo de madeira, braço de ferro e eixo.
{
  const iron = hex(0x5a5f63), wood = hex(0x7a4a28);
  const crank = [
    { at: [0, 0, 0], size: [0.05, 0.36, 0.05], color: iron },
    { at: [0, 0.2, 0.08], size: [0.05, 0.05, 0.2], color: iron },
    { at: [0, 0.2, 0.2], size: [0.07, 0.14, 0.07], color: wood, shape: 'ellipsoid' },
    { at: [0, -0.2, 0], size: [0.09, 0.08, 0.09], color: hex(0x3a3d40) },
  ];
  const icon = renderIcon(crank, { pitch: 20, ppm: 70, dir: 2, size: 96 });
  writeFileSync(join(OUT, 'icons', 'crank.png'), encodePng(icon.width, icon.height, icon.data));
}

// Efeitos em pixel (clarão, faísca, explosão, fumaça, sangue, projéteis, chama, vento).
import('./fx.mjs').then(({ buildFx }) => {
  const dir = join(OUT, 'fx');
  mkdirSync(dir, { recursive: true });
  for (const [name, fx] of Object.entries(buildFx())) {
    const frame = fx.frame || [fx.sheet.height, fx.sheet.height];
    const frames = fx.sheet.width / frame[0];
    writeFileSync(join(dir, `${name}.png`), encodePng(fx.sheet.width, fx.sheet.height, fx.sheet.data));
    writeFileSync(join(dir, `${name}.json`), JSON.stringify({ frame,  frames, fps: fx.fps, loop: fx.loop, pixels_per_meter: 48 }) + '\n');
  }
  console.log('  efeitos:', Object.keys(buildFx()).join(', '));
});
