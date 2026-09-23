import Phaser from 'phaser';
import { FX_KEYS } from '../config/assets.config';
import { lightingConfig } from '../config/visual.config';

type Ctx = CanvasRenderingContext2D;

function canvasTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: Ctx) => void): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  draw(tex.getContext());
  tex.refresh();
}

function radialDot(ctx: Ctx, size: number, stops: Array<[number, string]>): void {
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
}

/** Texturas de luz e partículas desenhadas em canvas (gradientes suaves). */
export function createFxTextures(scene: Phaser.Scene): void {
  // Luz pontual: branca no centro, some suavemente.
  canvasTexture(scene, FX_KEYS.lightRadial, 256, 256, (ctx) =>
    radialDot(ctx, 256, [
      [0, 'rgba(255,255,255,1)'],
      [0.3, 'rgba(255,255,255,0.8)'],
      [0.65, 'rgba(255,255,255,0.3)'],
      [1, 'rgba(255,255,255,0)'],
    ]),
  );

  // Cone da lanterna: ápice em (0, h/2), apontando para +X. Bordas suaves em camadas.
  const coneW = 512;
  const coneH = 512;
  canvasTexture(scene, FX_KEYS.lightCone, coneW, coneH, (ctx) => {
    const half = Phaser.Math.DegToRad(lightingConfig.flashlight.angle / 2);
    const layers = 10;
    for (let i = 0; i < layers; i++) {
      const a = half * (1.25 - (i / layers) * 0.65);
      const g = ctx.createRadialGradient(0, coneH / 2, 0, 0, coneH / 2, coneW);
      g.addColorStop(0, 'rgba(255,255,255,0.3)');
      g.addColorStop(0.6, 'rgba(255,255,255,0.2)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, coneH / 2);
      ctx.arc(0, coneH / 2, coneW, -a, a);
      ctx.closePath();
      ctx.fill();
    }
  });

  canvasTexture(scene, FX_KEYS.blood, 12, 12, (ctx) =>
    radialDot(ctx, 12, [[0, 'rgba(120,14,10,1)'], [0.6, 'rgba(90,8,6,0.9)'], [1, 'rgba(60,4,3,0)']]),
  );
  canvasTexture(scene, FX_KEYS.spark, 8, 8, (ctx) =>
    radialDot(ctx, 8, [[0, 'rgba(255,250,220,1)'], [0.5, 'rgba(255,190,90,0.8)'], [1, 'rgba(255,140,40,0)']]),
  );
  canvasTexture(scene, FX_KEYS.smoke, 32, 32, (ctx) =>
    radialDot(ctx, 32, [[0, 'rgba(160,160,150,0.5)'], [1, 'rgba(160,160,150,0)']]),
  );
  canvasTexture(scene, FX_KEYS.shell, 4, 2, (ctx) => {
    ctx.fillStyle = '#8f7433';
    ctx.fillRect(0, 0, 4, 2);
    ctx.fillStyle = '#c9a85a';
    ctx.fillRect(0, 0, 4, 1);
  });

  // Traçante: cauda transparente → ponta brilhante (aponta para +X).
  canvasTexture(scene, FX_KEYS.tracer, 48, 6, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 48, 0);
    g.addColorStop(0, 'rgba(255,200,120,0)');
    g.addColorStop(0.7, 'rgba(255,220,150,0.55)');
    g.addColorStop(1, 'rgba(255,250,230,1)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 3);
    ctx.lineTo(44, 1);
    ctx.quadraticCurveTo(48, 3, 44, 5);
    ctx.closePath();
    ctx.fill();
  });

  // Clarão do disparo: ápice em (0, h/2).
  canvasTexture(scene, FX_KEYS.muzzle, 40, 32, (ctx) => {
    const g = ctx.createRadialGradient(6, 16, 0, 6, 16, 30);
    g.addColorStop(0, 'rgba(255,255,235,1)');
    g.addColorStop(0.35, 'rgba(255,210,120,0.9)');
    g.addColorStop(1, 'rgba(255,140,40,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 16);
    ctx.lineTo(14, 6);
    ctx.lineTo(38, 16);
    ctx.lineTo(14, 26);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(8, 16, 7, 0, Math.PI * 2);
    ctx.fill();
  });
}
