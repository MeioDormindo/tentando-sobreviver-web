import Phaser from 'phaser';
import { COLORS, SCENE_KEYS } from '../config/game.config';
import {
  emitGameEvent,
  GameEvents,
  onGameEvent,
  type AmmoPayload,
  type PlayerHpPayload,
} from '../game/events';

const MARGIN = 24;
const HP_BAR_WIDTH = 220;
const HP_BAR_HEIGHT = 14;
const FONT = 'monospace';

/** HUD sobreposta à GameScene. Apenas escuta eventos; não contém regra de jogo. */
export class UIScene extends Phaser.Scene {
  private hpBar!: Phaser.GameObjects.Graphics;
  private hpText!: Phaser.GameObjects.Text;
  private weaponText!: Phaser.GameObjects.Text;
  private ammoText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private killsText!: Phaser.GameObjects.Text;
  private crosshair!: Phaser.GameObjects.Graphics;
  private deathOverlay: Phaser.GameObjects.Container | null = null;

  private hp: PlayerHpPayload = { hp: 0, maxHp: 1 };
  private kills = 0;

  constructor() {
    super(SCENE_KEYS.ui);
  }

  create(): void {
    this.kills = 0;
    this.deathOverlay = null;

    this.hpBar = this.add.graphics();
    this.hpText = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '14px', color: COLORS.text });
    this.weaponText = this.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: '18px', color: COLORS.text })
      .setOrigin(1, 1);
    this.ammoText = this.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: '32px', color: COLORS.text })
      .setOrigin(1, 1);
    this.statusText = this.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: '16px', color: COLORS.accent })
      .setOrigin(0.5);
    this.killsText = this.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: '16px', color: COLORS.textDim })
      .setOrigin(1, 0);
    this.crosshair = this.add.graphics().setDepth(100);
    this.drawCrosshair();
    this.updateKills();

    const unsubscribers = [
      onGameEvent(this.game.events, GameEvents.PlayerHpChanged, this.onHpChanged, this),
      onGameEvent(this.game.events, GameEvents.AmmoChanged, this.onAmmoChanged, this),
      onGameEvent(this.game.events, GameEvents.ZombieKilled, this.onZombieKilled, this),
      onGameEvent(this.game.events, GameEvents.PlayerDied, this.onPlayerDied, this),
    ];
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unsubscribers.forEach((off) => off());
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    });

    this.layout();
    emitGameEvent(this.game.events, GameEvents.HudRequest, undefined);
  }

  override update(): void {
    const pointer = this.input.activePointer;
    this.crosshair.setPosition(pointer.x, pointer.y);
  }

  private layout(): void {
    const { width, height } = this.scale;
    this.hpText.setPosition(MARGIN, height - MARGIN - HP_BAR_HEIGHT - 22);
    this.weaponText.setPosition(width - MARGIN, height - MARGIN - 40);
    this.ammoText.setPosition(width - MARGIN, height - MARGIN);
    this.statusText.setPosition(width / 2, height * 0.62);
    this.killsText.setPosition(width - MARGIN, MARGIN);
    this.drawHpBar();
    this.deathOverlay?.destroy();
    if (this.deathOverlay) this.showDeathOverlay();
  }

  private drawHpBar(): void {
    const { height } = this.scale;
    const x = MARGIN;
    const y = height - MARGIN - HP_BAR_HEIGHT;
    const ratio = Phaser.Math.Clamp(this.hp.hp / this.hp.maxHp, 0, 1);
    this.hpBar.clear();
    this.hpBar.fillStyle(COLORS.hpBarBg, 0.9).fillRect(x, y, HP_BAR_WIDTH, HP_BAR_HEIGHT);
    this.hpBar.fillStyle(COLORS.hpBar, 1).fillRect(x, y, HP_BAR_WIDTH * ratio, HP_BAR_HEIGHT);
    this.hpBar.lineStyle(1, 0x000000, 0.8).strokeRect(x, y, HP_BAR_WIDTH, HP_BAR_HEIGHT);
  }

  private drawCrosshair(): void {
    const g = this.crosshair;
    g.lineStyle(2, 0xe8e2c8, 0.9);
    g.lineBetween(-10, 0, -4, 0).lineBetween(4, 0, 10, 0);
    g.lineBetween(0, -10, 0, -4).lineBetween(0, 4, 0, 10);
    g.fillStyle(0xe8e2c8, 0.9).fillCircle(0, 0, 1.5);
  }

  private onHpChanged(payload: PlayerHpPayload): void {
    this.hp = payload;
    this.hpText.setText(`HP ${Math.ceil(payload.hp)} / ${payload.maxHp}`);
    this.drawHpBar();
  }

  private onAmmoChanged(payload: AmmoPayload): void {
    this.weaponText.setText(payload.weaponName);
    this.ammoText.setText(`${payload.current} / ${payload.reserve}`);
    this.ammoText.setColor(payload.current === 0 ? '#c05050' : COLORS.text);

    if (payload.reloading) this.statusText.setText('RECARREGANDO...');
    else if (payload.current === 0 && payload.reserve === 0) this.statusText.setText('SEM MUNIÇÃO');
    else this.statusText.setText('');
  }

  private onZombieKilled(): void {
    this.kills++;
    this.updateKills();
  }

  private updateKills(): void {
    this.killsText.setText(`ABATES ${this.kills}`);
  }

  private onPlayerDied(): void {
    this.statusText.setText('');
    this.crosshair.setVisible(false);
    this.showDeathOverlay();
  }

  private showDeathOverlay(): void {
    const { width, height } = this.scale;
    const overlay = this.add.container(0, 0).setDepth(200);

    const bg = this.add.rectangle(0, 0, width, height, 0x000000, 0.7).setOrigin(0);
    const title = this.add
      .text(width / 2, height * 0.35, 'VOCÊ MORREU', {
        fontFamily: 'Impact, "Arial Black", sans-serif',
        fontSize: '64px',
        color: '#b33a3a',
      })
      .setOrigin(0.5);
    const stats = this.add
      .text(width / 2, height * 0.47, `ZUMBIS ABATIDOS: ${this.kills}`, {
        fontFamily: FONT,
        fontSize: '20px',
        color: COLORS.text,
      })
      .setOrigin(0.5);

    const retry = this.makeButton(width / 2, height * 0.6, '[ JOGAR NOVAMENTE ]', () => {
      this.scene.start(SCENE_KEYS.game);
    });
    const menu = this.makeButton(width / 2, height * 0.6 + 48, '[ MENU ]', () => {
      this.scene.stop(SCENE_KEYS.game);
      this.scene.start(SCENE_KEYS.menu);
    });

    overlay.add([bg, title, stats, retry, menu]);
    this.deathOverlay = overlay;
  }

  private makeButton(x: number, y: number, label: string, onClick: () => void): Phaser.GameObjects.Text {
    const text = this.add
      .text(x, y, label, { fontFamily: FONT, fontSize: '24px', color: COLORS.text })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    text.on('pointerover', () => text.setColor(COLORS.accent));
    text.on('pointerout', () => text.setColor(COLORS.text));
    text.once('pointerdown', onClick);
    return text;
  }
}
