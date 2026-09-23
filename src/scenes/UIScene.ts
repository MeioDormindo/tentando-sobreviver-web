import Phaser from 'phaser';
import { perkIconKey } from '../config/assets.config';
import { COLORS, SCENE_KEYS } from '../config/game.config';
import {
  emitGameEvent,
  GameEvents,
  onGameEvent,
  type AmmoPayload,
  type InteractionPromptPayload,
  type MoneyPayload,
  type PlayerHpPayload,
  type WaveStatePayload,
} from '../game/events';

const MARGIN = 24;
const HP_BAR_WIDTH = 220;
const HP_BAR_HEIGHT = 14;
const FONT = 'monospace';
const TITLE_FONT = 'Impact, "Arial Black", sans-serif';
const WAVE_COLOR = '#b33a3a';
const MONEY_COLOR = '#e3c77a';
const formatMoney = (n: number): string => `$ ${n.toLocaleString('pt-BR')}`;

/** HUD sobreposta à GameScene. Apenas escuta eventos; não contém regra de jogo. */
export class UIScene extends Phaser.Scene {
  private hpBar!: Phaser.GameObjects.Graphics;
  private hpText!: Phaser.GameObjects.Text;
  private weaponText!: Phaser.GameObjects.Text;
  private ammoText!: Phaser.GameObjects.Text;
  private secondaryText!: Phaser.GameObjects.Text;
  private moneyText!: Phaser.GameObjects.Text;
  private moneyDeltaText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private areaText!: Phaser.GameObjects.Text;
  private perkIcons: Phaser.GameObjects.Image[] = [];
  private statusText!: Phaser.GameObjects.Text;
  private killsText!: Phaser.GameObjects.Text;
  private crosshair!: Phaser.GameObjects.Graphics;
  private waveText!: Phaser.GameObjects.Text;
  private waveSubText!: Phaser.GameObjects.Text;
  private bannerTitle!: Phaser.GameObjects.Text;
  private bannerSub!: Phaser.GameObjects.Text;
  private deathOverlay: Phaser.GameObjects.Container | null = null;

  private hp: PlayerHpPayload = { hp: 0, maxHp: 1 };
  private kills = 0;
  private waveState: WaveStatePayload | null = null;
  private money: MoneyPayload = { money: 0, delta: 0, earned: 0 };
  private prompt: InteractionPromptPayload | null = null;

  constructor() {
    super(SCENE_KEYS.ui);
  }

  create(): void {
    this.kills = 0;
    this.deathOverlay = null;
    this.waveState = null;
    this.prompt = null;
    this.perkIcons = [];

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
    this.waveText = this.add.text(0, 0, '', { fontFamily: TITLE_FONT, fontSize: '44px', color: WAVE_COLOR });
    this.waveSubText = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '15px', color: COLORS.text });
    this.bannerTitle = this.add
      .text(0, 0, '', { fontFamily: TITLE_FONT, fontSize: '72px', color: WAVE_COLOR })
      .setOrigin(0.5)
      .setAlpha(0);
    this.bannerSub = this.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: '18px', color: COLORS.text })
      .setOrigin(0.5)
      .setAlpha(0);
    this.secondaryText = this.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: '13px', color: COLORS.textDim })
      .setOrigin(1, 1);
    this.moneyText = this.add
      .text(0, 0, '', { fontFamily: TITLE_FONT, fontSize: '30px', color: MONEY_COLOR })
      .setOrigin(1, 0);
    this.moneyDeltaText = this.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: '15px', color: MONEY_COLOR })
      .setOrigin(1, 0)
      .setAlpha(0);
    this.promptText = this.add
      .text(0, 0, '', {
        fontFamily: FONT,
        fontSize: '17px',
        color: COLORS.text,
        backgroundColor: 'rgba(0,0,0,0.55)',
        padding: { x: 12, y: 6 },
      })
      .setOrigin(0.5)
      .setVisible(false);
    this.areaText = this.add
      .text(0, 0, '', { fontFamily: TITLE_FONT, fontSize: '26px', color: COLORS.text, stroke: '#000', strokeThickness: 4 })
      .setOrigin(0.5)
      .setAlpha(0);
    this.crosshair = this.add.graphics().setDepth(100);
    this.drawCrosshair();
    this.updateKills();

    const unsubscribers = [
      onGameEvent(this.game.events, GameEvents.PlayerHpChanged, this.onHpChanged, this),
      onGameEvent(this.game.events, GameEvents.AmmoChanged, this.onAmmoChanged, this),
      onGameEvent(this.game.events, GameEvents.ZombieKilled, this.onZombieKilled, this),
      onGameEvent(this.game.events, GameEvents.PlayerDied, this.onPlayerDied, this),
      onGameEvent(this.game.events, GameEvents.WaveState, this.onWaveState, this),
      onGameEvent(this.game.events, GameEvents.MoneyChanged, this.onMoneyChanged, this),
      onGameEvent(this.game.events, GameEvents.InteractionPrompt, this.onPrompt, this),
      onGameEvent(this.game.events, GameEvents.PurchaseDenied, this.onPurchaseDenied, this),
      onGameEvent(this.game.events, GameEvents.PerksChanged, this.onPerksChanged, this),
      onGameEvent(this.game.events, GameEvents.AreaEntered, (a) => this.showAreaText(a.name.toUpperCase(), COLORS.text), this),
      onGameEvent(this.game.events, GameEvents.AreaUnlocked, (a) => this.showAreaText(`ÁREA LIBERADA — ${a.name.toUpperCase()}`, COLORS.accent), this),
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
    this.secondaryText.setPosition(width - MARGIN, height - MARGIN - 64);
    this.moneyText.setPosition(width - MARGIN, MARGIN - 4);
    this.moneyDeltaText.setPosition(width - MARGIN, MARGIN + 34);
    this.promptText.setPosition(width / 2, height * 0.72);
    this.areaText.setPosition(width / 2, MARGIN + 18);
    this.layoutPerks();
    this.statusText.setPosition(width / 2, height * 0.62);
    this.killsText.setPosition(width - MARGIN, MARGIN + 56);
    this.waveText.setPosition(MARGIN, MARGIN - 6);
    this.waveSubText.setPosition(MARGIN + 2, MARGIN + 44);
    this.bannerTitle.setPosition(width / 2, height * 0.28);
    this.bannerSub.setPosition(width / 2, height * 0.28 + 52);
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
    this.weaponText.setText(payload.weaponName.toUpperCase());
    this.secondaryText.setText(payload.secondary ? `[Q] ${payload.secondary.toUpperCase()}` : '');
    this.ammoText.setText(`${payload.current} / ${payload.reserve}`);
    this.ammoText.setColor(payload.current === 0 ? '#c05050' : COLORS.text);

    if (payload.reloading) this.statusText.setText('RECARREGANDO...');
    else if (payload.current === 0 && payload.reserve === 0) this.statusText.setText('SEM MUNIÇÃO');
    else this.statusText.setText('');
  }

  private onWaveState(state: WaveStatePayload): void {
    const prev = this.waveState;
    this.waveState = state;

    this.waveText.setText(state.wave > 0 ? `WAVE ${state.wave}` : '');
    const seconds = Math.ceil(state.nextWaveInMs / 1000);
    if (state.phase === 'active') this.waveSubText.setText(`ZUMBIS RESTANTES  ${state.remaining}`);
    else if (state.phase === 'waiting') this.waveSubText.setText(`PREPARE-SE  ${seconds}s`);
    else this.waveSubText.setText(`PRÓXIMA WAVE EM  ${seconds}s`);

    // Banners só nas transições (não na sincronização inicial da HUD).
    if (!prev) return;
    if (state.phase === 'active' && (prev.phase !== 'active' || prev.wave !== state.wave)) {
      this.showBanner(`WAVE ${state.wave}`, `${state.total} zumbis`, WAVE_COLOR);
    } else if (state.phase === 'intermission' && prev.phase === 'active') {
      this.showBanner(`WAVE ${state.wave} SOBREVIVIDA`, 'hora de gastar', COLORS.accent);
    }
  }

  private onMoneyChanged(payload: MoneyPayload): void {
    this.money = payload;
    this.moneyText.setText(formatMoney(payload.money));
    if (payload.delta === 0) return;
    const gain = payload.delta > 0;
    this.moneyDeltaText
      .setText(`${gain ? '+' : '-'}${Math.abs(payload.delta).toLocaleString('pt-BR')}`)
      .setColor(gain ? MONEY_COLOR : '#d06a5a')
      .setAlpha(1);
    this.tweens.killTweensOf(this.moneyDeltaText);
    this.tweens.add({ targets: this.moneyDeltaText, alpha: 0, delay: 700, duration: 500 });
    this.tweens.add({ targets: this.moneyText, scale: { from: gain ? 1.12 : 0.92, to: 1 }, duration: 220 });
  }

  /** Ícones dos perks adquiridos, acima da barra de vida. */
  private onPerksChanged(payload: { perks: Array<{ id: string; level: number }> }): void {
    const had = this.perkIcons.length;
    this.perkIcons.forEach((icon) => icon.destroy());
    this.perkIcons = payload.perks.map(({ id }) => this.add.image(0, 0, perkIconKey(id)).setDisplaySize(28, 28));
    this.layoutPerks();
    const newest = this.perkIcons[this.perkIcons.length - 1];
    if (newest && this.perkIcons.length > had) {
      this.tweens.add({ targets: newest, displayWidth: { from: 56, to: 28 }, displayHeight: { from: 56, to: 28 }, duration: 350, ease: 'Back.easeOut' });
    }
  }

  private layoutPerks(): void {
    const y = this.scale.height - MARGIN - HP_BAR_HEIGHT - 58;
    this.perkIcons.forEach((icon, i) => icon.setPosition(MARGIN + 14 + i * 32, y));
  }

  /** Nome da área ao entrar / aviso de área liberada, no topo da tela. */
  private showAreaText(text: string, color: string): void {
    this.tweens.killTweensOf(this.areaText);
    this.areaText.setText(text).setColor(color).setAlpha(0);
    this.tweens.add({ targets: this.areaText, alpha: 1, duration: 300 });
    this.tweens.add({ targets: this.areaText, alpha: 0, delay: 2200, duration: 800 });
  }

  private onPrompt(prompt: InteractionPromptPayload | null): void {
    this.prompt = prompt;
    if (!prompt) {
      this.promptText.setVisible(false);
      return;
    }
    this.promptText
      .setText(prompt.text)
      .setColor(prompt.affordable ? COLORS.text : '#9a8f86')
      .setVisible(true);
  }

  /** Sem dinheiro: o prompt e o saldo "tremem" em vermelho. */
  private onPurchaseDenied(): void {
    const cx = this.scale.width / 2;
    this.tweens.killTweensOf(this.promptText);
    this.promptText.setColor('#e05a4a');
    this.tweens.add({
      targets: this.promptText,
      x: { from: cx - 8, to: cx },
      duration: 240,
      ease: 'Elastic.easeOut',
      onComplete: () => this.onPrompt(this.prompt),
    });
    this.moneyText.setColor('#e05a4a');
    this.tweens.add({ targets: this.moneyText, scale: { from: 1.15, to: 1 }, duration: 260 });
    this.time.delayedCall(300, () => this.moneyText.setColor(MONEY_COLOR));
  }

  private showBanner(title: string, subtitle: string, color: string): void {
    const targets = [this.bannerTitle, this.bannerSub];
    this.tweens.killTweensOf(targets);
    this.bannerTitle.setText(title).setColor(color).setScale(1.25);
    this.bannerSub.setText(subtitle);
    targets.forEach((t) => t.setAlpha(0));
    this.tweens.add({ targets, alpha: 1, duration: 350 });
    this.tweens.add({ targets: this.bannerTitle, scale: 1, duration: 500, ease: 'Back.easeOut' });
    this.tweens.add({ targets, alpha: 0, delay: 2200, duration: 700 });
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
    this.promptText.setVisible(false);
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
    const statsText =
      `WAVE ALCANÇADA: ${this.waveState?.wave ?? 0}\n` +
      `ZUMBIS ABATIDOS: ${this.kills}\n` +
      `DINHEIRO GANHO: ${formatMoney(this.money.earned)}`;
    const stats = this.add
      .text(width / 2, height * 0.47, statsText, {
        fontFamily: FONT,
        fontSize: '20px',
        color: COLORS.text,
        align: 'center',
        lineSpacing: 6,
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
