import Phaser from 'phaser';
import { uiView } from '../ui/uiScale';
import { ANIMS, IMAGES, SHEETS } from '../config/assets.config';
import { COLORS, SCENE_KEYS, TEXTURE_KEYS, TILE_SIZE } from '../config/game.config';
import { createFxTextures } from '../effects/fxTextures';
import { generateSounds } from '../audio/SoundBank';
import { save } from '../save/SaveStore';
import { SKINS, skinUrl } from '../config/skins.config';

/** Carrega a arte (SVG), fatia as spritesheets, cria animações e texturas de efeitos. */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.preload);
  }

  preload(): void {
    this.createLoadingBar();
    // Só o visual escolhido do personagem é baixado.
    // Visual trancado (ex.: save de outro aparelho) volta ao padrão.
    const chosen = SKINS.find((s) => s.id === save.setting('skin'));
    const skin = chosen && (chosen.unlock === null || save.hasAchievement(chosen.unlock)) ? chosen.id : 'default';
    for (const sheet of SHEETS) this.load.svg(sheet.key, skinUrl(sheet.url, skin));
    for (const image of IMAGES) this.load.svg(image.key, image.url);
  }

  create(): void {
    // Volume e mudo salvos valem para o jogo todo (o gerenciador de som é global).
    this.sound.volume = save.setting('volume');
    this.sound.mute = save.muted;
    this.sliceSheets();
    this.createAnimations();
    createFxTextures(this);
    this.createCollisionTileset();
    // Todos os sons são sintetizados aqui (sem arquivos de áudio).
    this.loadingLabel?.setText('GERANDO SONS');
    void generateSounds(this, (p) => this.loadingBar?.setSize(this.loadingWidth * p, 6)).then(() => this.scene.start(SCENE_KEYS.menu));
  }

  private loadingLabel?: Phaser.GameObjects.Text;
  private loadingBar?: Phaser.GameObjects.Rectangle;
  private loadingWidth = 0;

  private createLoadingBar(): void {
    const { width, height } = uiView(this);
    const barW = Math.min(420, width * 0.6);
    const bg = this.add.rectangle(width / 2, height / 2, barW, 6, 0x222420).setOrigin(0.5);
    const bar = this.add.rectangle(bg.x - barW / 2, height / 2, 0, 6, 0xc9a45c).setOrigin(0, 0.5);
    this.loadingBar = bar;
    this.loadingWidth = barW;
    this.loadingLabel = this.add
      .text(width / 2, height / 2 - 24, 'CARREGANDO', { fontFamily: 'monospace', fontSize: '14px', color: COLORS.textDim })
      .setOrigin(0.5);
    this.load.on(Phaser.Loader.Events.PROGRESS, (p: number) => {
      bar.width = barW * p;
    });
  }

  /** SVGs de spritesheet entram como uma imagem única; aqui viram frames numerados. */
  private sliceSheets(): void {
    for (const sheet of SHEETS) {
      const texture = this.textures.get(sheet.key);
      const columns = sheet.columns ?? sheet.frames;
      for (let i = 0; i < sheet.frames; i++) {
        const col = i % columns;
        const row = Math.floor(i / columns);
        texture.add(i, 0, col * sheet.frameWidth, row * sheet.frameHeight, sheet.frameWidth, sheet.frameHeight);
      }
    }
  }

  private createAnimations(): void {
    for (const anim of ANIMS) {
      if (this.anims.exists(anim.key)) continue;
      this.anims.create({
        key: anim.key,
        frames: anim.frames.map((frame) => ({ key: anim.sheet, frame })),
        frameRate: anim.frameRate,
        repeat: anim.repeat,
      });
    }
  }

  /** Tileset invisível usado só para a colisão das paredes (e, no futuro, navegação). */
  private createCollisionTileset(): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x000000, 0).fillRect(0, 0, TILE_SIZE * 3, TILE_SIZE);
    g.generateTexture(TEXTURE_KEYS.tiles, TILE_SIZE * 3, TILE_SIZE);
    g.destroy();
  }
}
