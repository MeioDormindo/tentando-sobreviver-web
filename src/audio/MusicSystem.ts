import Phaser from 'phaser';
import { audioConfig, musicConfig, type MusicLayer, type MusicState } from '../config/audio.config';
import { GameEvents, onGameEvent, type WavePhase } from '../game/events';
import { audio } from './AudioSystem';
import { save } from '../save/SaveStore';

type VolumeSound = Phaser.Sound.BaseSound & { setVolume(v: number): unknown };

const LAYERS: MusicLayer[] = ['pad', 'pulse', 'drive', 'boss'];
/** Intervalo mínimo entre vinhetas (fim de wave logo depois de derrotar o boss). */
const STING_GAP_MS = 5000;

/**
 * Música adaptativa (GDD §58): Exploration → Normal Wave → High Intensity → Boss,
 * com vinhetas de Victory e Game Over. As quatro camadas tocam juntas em loop e
 * sincronizadas; aqui só se ajusta o volume de cada uma conforme o estado do jogo.
 */
export class MusicSystem {
  private readonly layers = new Map<MusicLayer, VolumeSound>();
  private readonly levels: Record<MusicLayer, number> = { pad: 0, pulse: 0, drive: 0, boss: 0 };
  private phase: WavePhase = 'waiting';
  private bossActive = false;
  private dead = false;
  private hpRatio = 1;
  private eventId: string | null = null;
  private duckUntil = 0;
  private lastStingAt = -Infinity;
  private enabled = save.musicOn;

  constructor(private readonly scene: Phaser.Scene, private readonly aliveZombies: () => number) {
    for (const layer of LAYERS) {
      const sound = audio.play(`mus_${layer}`, { category: 'music', loop: true, volume: 0, pitchJitter: 0 }) as VolumeSound | null;
      if (sound) this.layers.set(layer, sound);
    }
    const ev = scene.game.events;
    const offs = [
      onGameEvent(ev, GameEvents.WaveState, (s) => {
        if (this.phase === 'active' && s.phase === 'intermission' && !this.dead) this.sting('mus_victory', 0.8);
        this.phase = s.phase;
      }),
      onGameEvent(ev, GameEvents.BossState, (b) => { this.bossActive = b.active; }),
      onGameEvent(ev, GameEvents.BossDefeated, () => {
        this.bossActive = false;
        this.sting('mus_victory', 1);
      }),
      onGameEvent(ev, GameEvents.WorldEventState, (e) => { this.eventId = e?.id ?? null; }),
      onGameEvent(ev, GameEvents.PlayerHpChanged, (p) => { this.hpRatio = p.maxHp > 0 ? p.hp / p.maxHp : 1; }),
      onGameEvent(ev, GameEvents.PlayerDied, () => {
        this.dead = true;
        this.lastStingAt = -Infinity;
        this.sting('mus_gameover', 1);
      }),
    ];
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offs.forEach((off) => off());
      for (const sound of this.layers.values()) sound.destroy();
      this.layers.clear();
    });
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  /** Configuração mudou no menu de pausa. */
  syncSetting(): void {
    this.enabled = save.musicOn;
  }

  /** Liga/desliga só a música (os efeitos continuam). */
  toggle(): boolean {
    this.enabled = !this.enabled;
    save.musicOn = this.enabled;
    return this.enabled;
  }

  /** Estado atual (também usado em testes). */
  get state(): MusicState {
    if (this.dead) return 'silent';
    if (this.bossActive) return 'boss';
    if (this.phase !== 'active') return 'exploration';
    const high =
      this.aliveZombies() >= musicConfig.highAlive ||
      this.hpRatio < musicConfig.highHp ||
      (this.eventId !== null && musicConfig.highEvents.includes(this.eventId));
    return high ? 'high' : 'normal';
  }

  update(time: number, delta: number): void {
    const target = musicConfig.mix[this.state];
    const step = musicConfig.fadePerSecond * (delta / 1000);
    const duck = time < this.duckUntil ? musicConfig.stingDuck : 1;
    const base = audioConfig.categories.music * audioConfig.master * (this.enabled ? 1 : 0) * duck;
    for (const layer of LAYERS) {
      const current = this.levels[layer];
      const goal = target[layer];
      this.levels[layer] = current < goal ? Math.min(goal, current + step) : Math.max(goal, current - step);
      this.layers.get(layer)?.setVolume(this.levels[layer] * base);
    }
  }

  private sting(key: string, volume: number): void {
    const now = this.scene.time.now;
    if (!this.enabled || now - this.lastStingAt < STING_GAP_MS) return;
    this.lastStingAt = now;
    this.duckUntil = now + musicConfig.stingDuckMs;
    audio.play(key, { category: 'music', volume, pitchJitter: 0 });
  }
}
