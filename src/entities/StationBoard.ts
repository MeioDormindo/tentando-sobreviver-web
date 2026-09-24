import Phaser from 'phaser';
import { ASSET_KEYS, FX_KEYS } from '../config/assets.config';
import { stationConfig } from '../config/events.config';
import { TILE_SIZE } from '../config/game.config';
import { ART_SCALE, DEPTH } from '../config/visual.config';
import type { LightingSystem } from '../effects/LightingSystem';
import type { StationLayout } from '../map/types';

type Light = { x: number; y: number; radius: number; intensity: number; color?: number };
export type TrainStatus = { state: 'none' | 'scheduled' | 'warning' | 'passing'; inMs: number };

const RED = 0xff3322;
const GREEN = 0x3cff6a;
const AMBER = '#ffb030';
const BLINK_MS = 260;
/** Bocas de túnel: acima do trem e do jogador, abaixo da escuridão. */
const TUNNEL_DEPTH = DEPTH.darkness - 1000;
/** Largura da boca de túnel (tiles). */
const TUNNEL_TILES = 3;

interface Signal {
  red: Phaser.GameObjects.Image;
  green: Phaser.GameObjects.Image;
  light: Light;
  x: number;
  y: number;
}

/**
 * Detalhes vivos da estação: bocas de túnel nas pontas dos trilhos, semáforos
 * (verde / vermelho piscando no aviso) e o painel de horários com a contagem do próximo trem.
 */
export class StationBoard {
  private readonly signals: Signal[] = [];
  private readonly text: Phaser.GameObjects.Text;
  private lastText = '';

  constructor(
    scene: Phaser.Scene,
    lighting: LightingSystem,
    station: StationLayout,
    private readonly status: () => TrainStatus,
  ) {
    const tunnelW = TUNNEL_TILES * TILE_SIZE;
    for (const t of station.tunnels) {
      const y = t.y * TILE_SIZE;
      const h = t.h * TILE_SIZE;
      scene.add.image(station.span.from * TILE_SIZE - 64, y, ASSET_KEYS.tunnelMouth).setOrigin(0).setDisplaySize(tunnelW, h).setDepth(TUNNEL_DEPTH);
      scene.add
        .image(station.span.to * TILE_SIZE + 64 - tunnelW, y, ASSET_KEYS.tunnelMouth)
        .setOrigin(0)
        .setDisplaySize(tunnelW, h)
        .setFlipX(true)
        .setDepth(TUNNEL_DEPTH);
    }
    for (const s of station.signals) {
      const x = s.tx * TILE_SIZE;
      const y = s.ty * TILE_SIZE;
      scene.add.image(x, y, ASSET_KEYS.railSignal).setScale(ART_SCALE).setDepth(y + 8);
      const lens = (dy: number, color: number) =>
        scene.add.image(x, y + dy, FX_KEYS.lightRadial).setTint(color).setBlendMode(Phaser.BlendModes.ADD).setScale(0.07).setDepth(DEPTH.glow);
      this.signals.push({
        red: lens(-5.5, RED),
        green: lens(3.5, GREEN),
        light: lighting.addDynamicLight({ x, y, radius: 70, intensity: 0.5, color: GREEN }),
        x,
        y,
      });
    }
    const b = station.board;
    const bx = b.tx * TILE_SIZE;
    const by = b.ty * TILE_SIZE;
    scene.add.image(bx, by, ASSET_KEYS.departureBoard).setScale(ART_SCALE).setDepth(by + 18);
    lighting.addDynamicLight({ x: bx, y: by + 6, radius: 60, intensity: 0.35, color: 0xffa030 });
    this.text = scene.add
      .text(bx, by + 1, '', { fontFamily: 'monospace', fontSize: '9px', fontStyle: 'bold', color: AMBER })
      .setOrigin(0.5)
      .setResolution(4)
      .setDepth(DEPTH.glow);
  }

  update(time: number): void {
    const st = this.status();
    const blink = Math.floor(time / BLINK_MS) % 2 === 0;
    const red = st.state === 'passing' || (st.state === 'warning' && blink);
    for (const s of this.signals) {
      s.red.setVisible(red);
      s.green.setVisible(st.state === 'none' || st.state === 'scheduled');
      s.light.color = red || st.state === 'warning' ? RED : GREEN;
      s.light.intensity = st.state === 'warning' && !blink ? 0.15 : 0.5;
    }
    this.setText(this.boardText(st, blink));
  }

  private boardText(st: TrainStatus, blink: boolean): string {
    switch (st.state) {
      case 'passing':
        return 'TREM PASSANDO';
      case 'warning':
        return blink ? '⚠ TREM CHEGANDO' : '';
      case 'scheduled':
        return st.inMs <= stationConfig.countdownFromMs ? `PRÓXIMO TREM ${Math.ceil(st.inMs / 1000)}s` : 'PRÓXIMO TREM EM BREVE';
      default:
        return 'SEM PREVISÃO';
    }
  }

  private setText(text: string): void {
    if (text === this.lastText) return;
    this.lastText = text;
    this.text.setText(text);
  }
}
