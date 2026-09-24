import Phaser from 'phaser';
import { perkIconKey, powerUpKey } from '../config/assets.config';
import { audio } from '../audio/AudioSystem';
import { DamageOverlay } from '../ui/DamageOverlay';
import { EventHud } from '../ui/EventHud';
import { TouchControls } from '../ui/TouchControls';
import { MiniMap } from '../ui/MiniMap';
import { save } from '../save/SaveStore';
import { useTouchControls } from '../input/device';
import { touchInput } from '../input/touchInput';
import { createGameOverOverlay } from '../ui/GameOverOverlay';
import { COLORS, SCENE_KEYS } from '../config/game.config';
import {
  emitGameEvent,
  GameEvents,
  onGameEvent,
  type AmmoPayload,
  type BossStatePayload,
  type GameOverStats,
  type InteractionPromptPayload,
  type MoneyPayload,
  type PlayerHpPayload,
  type PowerUpTimer,
  type WaveStatePayload,
} from '../game/events';

const MARGIN = 24;
const HP_BAR_WIDTH = 220;
const HP_BAR_HEIGHT = 14;
const FONT = 'monospace';
const TITLE_FONT = 'Impact, "Arial Black", sans-serif';
const WAVE_COLOR = '#b33a3a';
const MONEY_COLOR = '#e3c77a';
/** Espera a animação de queda do jogador antes da tela de Game Over (ms). */
const GAME_OVER_DELAY_MS = 1400;
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
  private powerUpTitle!: Phaser.GameObjects.Text;
  private powerUpDetail!: Phaser.GameObjects.Text;
  private timerViews: Phaser.GameObjects.GameObject[] = [];
  private bossBar!: Phaser.GameObjects.Graphics;
  private bossName!: Phaser.GameObjects.Text;
  private bossState: BossStatePayload | null = null;
  private warning!: Phaser.GameObjects.Container;
  private statusText!: Phaser.GameObjects.Text;
  private killsText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private crosshair!: Phaser.GameObjects.Graphics;
  private waveText!: Phaser.GameObjects.Text;
  private waveSubText!: Phaser.GameObjects.Text;
  private bannerTitle!: Phaser.GameObjects.Text;
  private bannerSub!: Phaser.GameObjects.Text;
  private deathOverlay: Phaser.GameObjects.Container | null = null;
  private pauseOverlay: Phaser.GameObjects.Container | null = null;
  private eventHud!: EventHud;
  private touch: TouchControls | null = null;
  private miniMap: MiniMap | null = null;
  private damageOverlay!: DamageOverlay;
  private gameOverStats: GameOverStats | null = null;
  private playerDead = false;

  private hp: PlayerHpPayload = { hp: 0, maxHp: 1, armor: 0, maxArmor: 100 };
  private kills = 0;
  private waveState: WaveStatePayload | null = null;
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
    this.timerViews = [];
    this.bossState = null;
    this.pauseOverlay = null;
    this.gameOverStats = null;
    this.playerDead = false;

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
    this.scoreText = this.add
      .text(0, 0, 'SCORE 0', { fontFamily: TITLE_FONT, fontSize: '20px', color: '#e8e2c8', stroke: '#000', strokeThickness: 3 })
      .setOrigin(1, 0);
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
    this.powerUpTitle = this.add
      .text(0, 0, '', { fontFamily: TITLE_FONT, fontSize: '40px', color: COLORS.text, stroke: '#000', strokeThickness: 5 })
      .setOrigin(0.5)
      .setAlpha(0);
    this.powerUpDetail = this.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: '17px', color: COLORS.text, stroke: '#000', strokeThickness: 3 })
      .setOrigin(0.5)
      .setAlpha(0);
    this.bossBar = this.add.graphics();
    this.bossName = this.add
      .text(0, 0, '', { fontFamily: TITLE_FONT, fontSize: '20px', color: '#e8d8c8', stroke: '#000', strokeThickness: 4 })
      .setOrigin(0.5, 1);
    this.warning = this.createWarning();
    this.eventHud = new EventHud(this);
    this.damageOverlay = new DamageOverlay(this);
    this.miniMap = save.setting('minimap') ? new MiniMap(this) : null;
    this.crosshair = this.add.graphics().setDepth(100);
    this.drawCrosshair();
    this.touch = useTouchControls(save.setting('touchMode')) ? new TouchControls(this) : null;
    if (!this.touch) {
      touchInput.enabled = false;
      // Modo automático: se o primeiro toque vier de um dedo (celular não detectado),
      // liga os controles de toque na hora e some com a mira do mouse.
      if (save.setting('touchMode') === 'auto') this.input.on(Phaser.Input.Events.POINTER_DOWN, this.detectTouch, this);
    }
    if (this.touch) this.crosshair.setVisible(false);
    this.updateKills();

    const unsubscribers = [
      onGameEvent(this.game.events, GameEvents.PlayerHpChanged, this.onHpChanged, this),
      onGameEvent(this.game.events, GameEvents.AmmoChanged, this.onAmmoChanged, this),
      onGameEvent(this.game.events, GameEvents.ZombieKilled, this.onZombieKilled, this),
      onGameEvent(this.game.events, GameEvents.PlayerDied, this.onPlayerDied, this),
      onGameEvent(this.game.events, GameEvents.GameOver, this.onGameOver, this),
      onGameEvent(this.game.events, GameEvents.MapUnlocked, (m) => this.showBanner(`${m.name.toUpperCase()} DESBLOQUEADO!`, 'disponível na escolha de mapa', COLORS.accent), this),
      onGameEvent(this.game.events, GameEvents.ScoreChanged, (s) => {
        this.scoreText.setText(`SCORE ${s.score.toLocaleString('pt-BR')}`);
        if (s.delta > 0) this.tweens.add({ targets: this.scoreText, scale: { from: 1.08, to: 1 }, duration: 160 });
      }, this),
      onGameEvent(this.game.events, GameEvents.WaveState, this.onWaveState, this),
      onGameEvent(this.game.events, GameEvents.MoneyChanged, this.onMoneyChanged, this),
      onGameEvent(this.game.events, GameEvents.InteractionPrompt, this.onPrompt, this),
      onGameEvent(this.game.events, GameEvents.PurchaseDenied, this.onPurchaseDenied, this),
      onGameEvent(this.game.events, GameEvents.PerksChanged, this.onPerksChanged, this),
      onGameEvent(this.game.events, GameEvents.Toast, (t) => this.showAreaText(t.text, COLORS.textDim), this),
      onGameEvent(this.game.events, GameEvents.PowerUpCollected, this.onPowerUpCollected, this),
      onGameEvent(this.game.events, GameEvents.PowerUpTimers, this.onPowerUpTimers, this),
      onGameEvent(this.game.events, GameEvents.BossIncoming, this.onBossIncoming, this),
      onGameEvent(this.game.events, GameEvents.BossState, this.onBossState, this),
      onGameEvent(this.game.events, GameEvents.BossPhase, this.onBossPhase, this),
      onGameEvent(this.game.events, GameEvents.BossDefeated, this.onBossDefeated, this),
      onGameEvent(this.game.events, GameEvents.AreaEntered, (a) => this.showAreaText(a.name.toUpperCase(), COLORS.text), this),
      onGameEvent(this.game.events, GameEvents.AreaUnlocked, (a) => this.showAreaText(`ÁREA LIBERADA — ${a.name.toUpperCase()}`, COLORS.accent), this),
    ];
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    // Pausa: ESC ou P; pausa sozinho se a janela perde o foco.
    const kb = this.input.keyboard;
    kb?.on('keydown-ESC', this.togglePause, this);
    kb?.on('keydown-P', this.togglePause, this);
    touchInput.events.on('pause', this.togglePause, this);
    this.game.events.on(Phaser.Core.Events.BLUR, this.pauseOnBlur, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unsubscribers.forEach((off) => off());
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
      this.game.events.off(Phaser.Core.Events.BLUR, this.pauseOnBlur, this);
      touchInput.events.off('pause', this.togglePause, this);
    });

    this.layout();
    emitGameEvent(this.game.events, GameEvents.HudRequest, undefined);
  }

  override update(time: number, delta: number): void {
    this.damageOverlay.update(time, delta);
    const pointer = this.input.activePointer;
    this.crosshair.setPosition(pointer.x, pointer.y);
  }

  private detectTouch(p: Phaser.Input.Pointer): void {
    if (!p.wasTouch || this.touch) return;
    this.input.off(Phaser.Input.Events.POINTER_DOWN, this.detectTouch, this);
    this.touch = new TouchControls(this);
    this.crosshair.setVisible(false);
    this.layout();
  }

  private layout(): void {
    const { width, height } = this.scale;
    this.hpText.setPosition(MARGIN, height - MARGIN - HP_BAR_HEIGHT - 22);
    // No celular o canto inferior direito é dos botões: arma e munição sobem para o topo.
    const ammoY = this.touch ? MARGIN + 196 : height - MARGIN;
    this.weaponText.setPosition(width - MARGIN, ammoY - 40);
    this.ammoText.setPosition(width - MARGIN, ammoY);
    this.secondaryText.setPosition(width - MARGIN, ammoY - 64);
    this.moneyText.setPosition(width - MARGIN, MARGIN - 4);
    this.moneyDeltaText.setPosition(width - MARGIN, MARGIN + 34);
    this.promptText.setPosition(width / 2, height * 0.72);
    this.areaText.setPosition(width / 2, MARGIN + 18);
    this.layoutPerks();
    this.powerUpTitle.setPosition(width / 2, height * 0.4);
    this.powerUpDetail.setPosition(width / 2, height * 0.4 + 34);
    this.layoutTimers();
    this.drawBossBar();
    this.warning.setPosition(width / 2, height * 0.3);
    this.eventHud.layout(width, height, MARGIN);
    this.touch?.layout(width, height);
    this.miniMap?.layout(MARGIN, MARGIN + 74, Math.min(150, width * 0.17, height * 0.28));
    this.damageOverlay.layout(width, height);
    this.statusText.setPosition(width / 2, height * 0.62);
    this.scoreText.setPosition(width - MARGIN, MARGIN + 54);
    this.killsText.setPosition(width - MARGIN, MARGIN + 82);
    this.waveText.setPosition(MARGIN, MARGIN - 6);
    this.waveSubText.setPosition(MARGIN + 2, MARGIN + 44);
    this.bannerTitle.setPosition(width / 2, height * 0.28);
    this.bannerSub.setPosition(width / 2, height * 0.28 + 52);
    this.drawHpBar();
    this.deathOverlay?.destroy();
    if (this.deathOverlay) this.showDeathOverlay();
    if (this.pauseOverlay) this.showPauseOverlay();
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
    // Armadura: barra azul fina logo acima da vida (GDD §59).
    if (this.hp.armor > 0) {
      const armorRatio = Phaser.Math.Clamp(this.hp.armor / this.hp.maxArmor, 0, 1);
      this.hpBar.fillStyle(0x16283a, 0.9).fillRect(x, y - 7, HP_BAR_WIDTH, 5);
      this.hpBar.fillStyle(0x3d8fd6, 1).fillRect(x, y - 7, HP_BAR_WIDTH * armorRatio, 5);
    }
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
    const armor = payload.armor > 0 ? `   ARMOR ${Math.ceil(payload.armor)}` : '';
    this.hpText.setText(`HP ${Math.ceil(payload.hp)} / ${payload.maxHp}${armor}`);
    this.drawHpBar();
  }

  private onAmmoChanged(payload: AmmoPayload): void {
    const el = payload.element;
    this.weaponText.setText(el ? `${payload.weaponName.toUpperCase()}  ${el.icon} ${el.name}` : payload.weaponName.toUpperCase());
    this.weaponText.setColor(el ? `#${el.color.toString(16).padStart(6, '0')}` : COLORS.text);
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

  // ───────────────────────── Pausa ─────────────────────────

  private get isPaused(): boolean {
    return this.pauseOverlay !== null;
  }

  private pauseOnBlur(): void {
    if (!this.isPaused) this.togglePause();
  }

  /** Pausa/retoma a partida: física, tempo, animações e som param juntos. */
  private togglePause(): void {
    if (this.playerDead) return;
    if (this.isPaused) {
      this.resumeGame();
      return;
    }
    if (!this.scene.isActive(SCENE_KEYS.game)) return;
    this.scene.pause(SCENE_KEYS.game);
    this.sound.pauseAll();
    emitGameEvent(this.game.events, GameEvents.GamePaused, undefined);
    this.crosshair.setVisible(false);
    this.touch?.setVisible(false);
    this.showPauseOverlay();
  }

  private resumeGame(): void {
    this.pauseOverlay?.destroy();
    this.pauseOverlay = null;
    this.crosshair.setVisible(!this.touch);
    this.touch?.setVisible(true);
    this.sound.resumeAll();
    this.scene.resume(SCENE_KEYS.game);
    emitGameEvent(this.game.events, GameEvents.GameResumed, undefined);
  }

  private showPauseOverlay(): void {
    const { width, height } = this.scale;
    this.pauseOverlay?.destroy();
    const bg = this.add.rectangle(0, 0, width, height, 0x000000, 0.72).setOrigin(0).setInteractive();
    const title = this.add
      .text(width / 2, height * 0.3, 'PAUSADO', { fontFamily: TITLE_FONT, fontSize: '64px', color: COLORS.text })
      .setOrigin(0.5);
    const soundLabel = () => (this.sound.mute ? '[ SOM: DESLIGADO ]' : '[ SOM: LIGADO ]');
    const y0 = height * 0.46;
    const resume = this.makeButton(width / 2, y0, '[ CONTINUAR ]', () => this.resumeGame(), false);
    const restart = this.makeButton(width / 2, y0 + 48, '[ REINICIAR ]', () => {
      this.sound.resumeAll();
      this.scene.start(SCENE_KEYS.game);
    });
    const sound = this.makeButton(width / 2, y0 + 96, soundLabel(), () => {
      audio.toggleMute();
      sound.setText(soundLabel());
    }, false);
    const menu = this.makeButton(width / 2, y0 + 144, '[ MENU ]', () => {
      this.sound.resumeAll();
      this.scene.stop(SCENE_KEYS.game);
      this.scene.start(SCENE_KEYS.menu);
    });
    const hint = this.add
      .text(width / 2, height - 40, 'ESC para continuar', { fontFamily: FONT, fontSize: '14px', color: COLORS.textDim })
      .setOrigin(0.5);
    this.pauseOverlay = this.add.container(0, 0, [bg, title, resume, restart, sound, menu, hint]).setDepth(300);
  }

  // ───────────────────────── Boss ─────────────────────────

  /** Aviso "WARNING / BOSS INCOMING" com faixas de alerta (GDD §61). */
  private createWarning(): Phaser.GameObjects.Container {
    const stripe = (y: number) => this.add.rectangle(0, y, 560, 6, 0xb33a3a).setOrigin(0.5);
    const title = this.add
      .text(0, -22, 'WARNING', { fontFamily: TITLE_FONT, fontSize: '54px', color: '#e0412f', stroke: '#000', strokeThickness: 5 })
      .setOrigin(0.5);
    const sub = this.add
      .text(0, 30, 'BOSS INCOMING', { fontFamily: TITLE_FONT, fontSize: '30px', color: '#f0e0d0', stroke: '#000', strokeThickness: 4 })
      .setOrigin(0.5);
    return this.add.container(0, 0, [stripe(-66), stripe(66), title, sub]).setAlpha(0).setDepth(150);
  }

  private onBossIncoming(): void {
    // O aviso do boss substitui a faixa "WAVE N".
    this.tweens.killTweensOf([this.bannerTitle, this.bannerSub]);
    this.bannerTitle.setAlpha(0);
    this.bannerSub.setAlpha(0);
    this.tweens.killTweensOf(this.warning);
    this.warning.setAlpha(0);
    // Pisca três vezes e some.
    this.tweens.add({ targets: this.warning, alpha: 1, duration: 260, yoyo: true, hold: 280, repeat: 2, onComplete: () => this.warning.setAlpha(0) });
  }

  private onBossState(state: BossStatePayload): void {
    this.bossState = state.active ? state : null;
    this.drawBossBar();
  }

  private onBossPhase(p: { phase: number }): void {
    const text = p.phase >= 4 ? 'RAGE MODE' : `FASE ${p.phase}`;
    this.showBanner(text, p.phase >= 4 ? 'a arena está mudando' : 'ele está mais rápido', '#e0412f');
  }

  private onBossDefeated(p: { name: string; reward: number }): void {
    this.showBanner(`${p.name.toUpperCase()} DERROTADO`, `+$${p.reward.toLocaleString('pt-BR')}`, COLORS.accent);
  }

  /** Barra do boss no topo (GDD §61), com marcas nas trocas de fase. */
  private drawBossBar(): void {
    const g = this.bossBar;
    g.clear();
    const state = this.bossState;
    if (!state) {
      this.bossName.setText('');
      return;
    }
    const { width } = this.scale;
    const w = Math.min(520, width * 0.5);
    const h = 12;
    const x = width / 2 - w / 2;
    const y = MARGIN + 62;
    const ratio = Phaser.Math.Clamp(state.hp / state.maxHp, 0, 1);
    g.fillStyle(0x1a0c0a, 0.85).fillRect(x - 2, y - 2, w + 4, h + 4);
    g.fillStyle(state.phase >= 4 ? 0xe0412f : 0xa8322a, 1).fillRect(x, y, w * ratio, h);
    g.fillStyle(0xffffff, 0.15).fillRect(x, y, w * ratio, 3);
    g.lineStyle(1, 0x000000, 0.9).strokeRect(x - 2, y - 2, w + 4, h + 4);
    for (const t of state.thresholds) g.fillStyle(0xf0e0d0, 0.8).fillRect(x + w * t - 1, y - 3, 2, h + 6);
    this.bossName.setText(state.name.toUpperCase()).setPosition(width / 2, y - 4);
  }

  private onPowerUpCollected(p: { name: string; color: number; detail?: string }): void {
    const color = `#${p.color.toString(16).padStart(6, '0')}`;
    const targets = [this.powerUpTitle, this.powerUpDetail];
    this.tweens.killTweensOf(targets);
    this.powerUpTitle.setText(p.name.toUpperCase() + '!').setColor(color).setAlpha(1).setScale(1.3);
    this.powerUpDetail.setText(p.detail ?? '').setAlpha(p.detail ? 1 : 0);
    this.tweens.add({ targets: this.powerUpTitle, scale: 1, duration: 300, ease: 'Back.easeOut' });
    this.tweens.add({ targets, alpha: 0, delay: 1600, duration: 600 });
  }

  /** Efeitos temporários ativos: ícone + segundos restantes, no centro inferior. */
  private onPowerUpTimers(p: { timers: PowerUpTimer[] }): void {
    this.timerViews.forEach((v) => v.destroy());
    this.timerViews = [];
    for (const t of p.timers) {
      const iconId = t.id === 'fury' ? 'golden' : t.id;
      const icon = this.add.image(0, 0, powerUpKey(iconId)).setDisplaySize(34, 34);
      const secs = Math.ceil(t.remainingMs / 1000);
      const label = this.add
        .text(0, 0, `${secs}s`, { fontFamily: FONT, fontSize: '14px', color: secs <= 5 ? '#e05a4a' : COLORS.text })
        .setOrigin(0.5, 0);
      if (secs <= 5) icon.setAlpha(secs % 2 === 0 ? 0.5 : 1);
      this.timerViews.push(icon, label);
    }
    this.layoutTimers();
  }

  private layoutTimers(): void {
    const { width, height } = this.scale;
    const count = this.timerViews.length / 2;
    const spacing = 48;
    const startX = width / 2 - ((count - 1) * spacing) / 2;
    for (let i = 0; i < count; i++) {
      const icon = this.timerViews[i * 2] as Phaser.GameObjects.Image;
      const label = this.timerViews[i * 2 + 1] as Phaser.GameObjects.Text;
      icon.setPosition(startX + i * spacing, height - MARGIN - 40);
      label.setPosition(startX + i * spacing, height - MARGIN - 20);
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
    // No celular não há tecla E: o botão USAR faz a ação.
    const text = this.touch ? prompt.text.replace(/^\[E\]\s*/, 'USAR ▸ ').replace('SEGURE E', 'SEGURE USAR') : prompt.text;
    this.promptText
      .setText(text)
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
    this.playerDead = true;
    this.statusText.setText('');
    this.promptText.setVisible(false);
    this.crosshair.setVisible(false);
    this.touch?.setVisible(false);
  }

  /** Resumo da partida: mostrado depois da animação de morte. */
  private onGameOver(stats: GameOverStats): void {
    this.gameOverStats = stats;
    this.time.delayedCall(GAME_OVER_DELAY_MS, () => this.showDeathOverlay());
  }

  private showDeathOverlay(): void {
    const stats = this.gameOverStats;
    if (!stats) return;
    this.deathOverlay?.destroy();
    this.deathOverlay = createGameOverOverlay(this, stats, {
      retry: () => this.scene.start(SCENE_KEYS.game, { map: stats.mapId }),
      ranking: () => {
        this.scene.stop(SCENE_KEYS.game);
        this.scene.start(SCENE_KEYS.ranking, { map: stats.mapId });
      },
      menu: () => {
        this.scene.stop(SCENE_KEYS.game);
        this.scene.start(SCENE_KEYS.menu);
      },
      makeButton: (x, y, label, onClick) => this.makeButton(x, y, label, onClick),
    });
  }

  private makeButton(x: number, y: number, label: string, onClick: () => void, once = true): Phaser.GameObjects.Text {
    const text = this.add
      .text(x, y, label, { fontFamily: FONT, fontSize: '24px', color: COLORS.text })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    text.on('pointerover', () => text.setColor(COLORS.accent));
    text.on('pointerout', () => text.setColor(COLORS.text));
    if (once) text.once('pointerdown', onClick);
    else text.on('pointerdown', onClick);
    return text;
  }
}
