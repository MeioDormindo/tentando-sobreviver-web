import Phaser from 'phaser';
import { GameEvents, onGameEvent, type MinimapBasePayload, type MinimapStatePayload } from '../game/events';

const TEXTURE = 'ui_minimap_base';
/** Cor de cada código de tile (ver TerminalMap.minimapCells). */
const COLORS: Record<number, [number, number, number, number]> = {
  0: [0, 0, 0, 0],
  1: [120, 124, 112, 235],
  2: [48, 50, 46, 200],
  3: [214, 140, 50, 255],
  4: [70, 86, 102, 235],
  5: [150, 110, 60, 255],
};

/**
 * Minimapa no canto da HUD: mapa inteiro (áreas abertas claras, trancadas escuras, portas
 * em laranja), o jogador (seta amarela), zumbis (pontos vermelhos), boss, Mystery Box e
 * suprimentos. Recebe tudo por eventos da partida.
 */
export class MiniMap {
  private readonly frame: Phaser.GameObjects.Rectangle;
  private readonly image: Phaser.GameObjects.Image;
  private readonly dots: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private base: MinimapBasePayload | null = null;
  private state: MinimapStatePayload | null = null;
  private x = 0;
  private y = 0;
  private scale = 1;

  constructor(private readonly scene: Phaser.Scene) {
    this.frame = scene.add.rectangle(0, 0, 10, 10, 0x000000, 0.55).setOrigin(0).setStrokeStyle(1, 0x6a6d64, 0.9);
    this.image = scene.add.image(0, 0, '__DEFAULT').setOrigin(0).setVisible(false);
    this.dots = scene.add.graphics();
    this.label = scene.add.text(0, 0, 'MAPA', { fontFamily: 'monospace', fontSize: '10px', color: '#8a8d84' });
    const offs = [
      onGameEvent(scene.game.events, GameEvents.MinimapBase, (b) => this.setBase(b)),
      onGameEvent(scene.game.events, GameEvents.MinimapState, (s) => {
        this.state = s;
        this.drawDots();
      }),
    ];
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => offs.forEach((off) => off()));
  }

  /** Canto superior esquerdo (abaixo da wave); o tamanho acompanha a tela. */
  layout(x: number, y: number, maxWidth: number): void {
    this.x = x;
    this.y = y;
    const cols = this.base?.cols ?? 128;
    this.scale = Phaser.Math.Clamp(maxWidth / cols, 0.7, 1.3);
    this.place();
  }

  private place(): void {
    const b = this.base;
    if (!b) return;
    const w = b.cols * this.scale;
    const h = b.rows * this.scale;
    this.frame.setPosition(this.x - 3, this.y - 3).setSize(w + 6, h + 6);
    this.image.setPosition(this.x, this.y).setScale(this.scale);
    this.label.setPosition(this.x, this.y + h + 4);
    this.drawDots();
  }

  private setBase(b: MinimapBasePayload): void {
    this.base = b;
    const tex = this.scene.textures.exists(TEXTURE)
      ? (this.scene.textures.get(TEXTURE) as Phaser.Textures.CanvasTexture)
      : this.scene.textures.createCanvas(TEXTURE, b.cols, b.rows);
    if (!tex) return;
    const ctx = tex.getContext();
    const img = ctx.createImageData(b.cols, b.rows);
    for (let i = 0; i < b.cells.length; i++) {
      const [r, g, bl, a] = COLORS[b.cells[i]] ?? COLORS[0];
      img.data[i * 4] = r;
      img.data[i * 4 + 1] = g;
      img.data[i * 4 + 2] = bl;
      img.data[i * 4 + 3] = a;
    }
    ctx.putImageData(img, 0, 0);
    tex.refresh();
    this.image.setTexture(TEXTURE).setVisible(true);
    this.place();
  }

  private drawDots(): void {
    const g = this.dots;
    g.clear();
    const b = this.base;
    const s = this.state;
    if (!b || !s) return;
    const k = this.scale / b.tileSize;
    const toX = (wx: number) => this.x + wx * k;
    const toY = (wy: number) => this.y + wy * k;
    g.fillStyle(0xe0412f, 0.95);
    for (let i = 0; i < s.zombies.length; i += 2) g.fillRect(toX(s.zombies[i]) - 1, toY(s.zombies[i + 1]) - 1, 2.2, 2.2);
    if (s.supply) g.fillStyle(0x7bd67b, 1).fillRect(toX(s.supply[0]) - 2.5, toY(s.supply[1]) - 2.5, 5, 5);
    if (s.box) {
      g.fillStyle(0xffd27a, 1).fillRect(toX(s.box[0]) - 2.5, toY(s.box[1]) - 2.5, 5, 5);
      g.lineStyle(1, 0x000000, 0.8).strokeRect(toX(s.box[0]) - 2.5, toY(s.box[1]) - 2.5, 5, 5);
    }
    if (s.boss) {
      const pulse = 3.5 + Math.sin(this.scene.time.now / 160) * 1;
      g.fillStyle(0xff2a1a, 1).fillCircle(toX(s.boss[0]), toY(s.boss[1]), pulse);
      g.lineStyle(1, 0xffffff, 0.9).strokeCircle(toX(s.boss[0]), toY(s.boss[1]), pulse + 1);
    }
    // Jogador: seta apontando para a mira
    const [px, py, rot] = s.player;
    const cx = toX(px);
    const cy = toY(py);
    const tip = [cx + Math.cos(rot) * 5, cy + Math.sin(rot) * 5];
    const l = [cx + Math.cos(rot + 2.5) * 3.5, cy + Math.sin(rot + 2.5) * 3.5];
    const r = [cx + Math.cos(rot - 2.5) * 3.5, cy + Math.sin(rot - 2.5) * 3.5];
    g.fillStyle(0xffe66a, 1).fillTriangle(tip[0], tip[1], l[0], l[1], r[0], r[1]);
    g.lineStyle(1, 0x000000, 0.9).strokeTriangle(tip[0], tip[1], l[0], l[1], r[0], r[1]);
  }
}
