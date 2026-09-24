import Phaser from 'phaser';
import { ambientEvents, audioConfig, type SoundCategory } from '../config/audio.config';
import { GameEvents, onGameEvent, type PlayerHpPayload, type WaveStatePayload, type ZombieKilledPayload } from '../game/events';
import { AMBIENCE_AREAS, soundVariants } from './SoundBank';
import { save } from '../save/SaveStore';

export interface PlayOptions {
  volume?: number;
  /** Variação aleatória de afinação (0.05 = ±5%). */
  pitchJitter?: number;
  rate?: number;
  category?: SoundCategory;
  loop?: boolean;
}

export interface SpatialOptions extends PlayOptions {
  /** Até onde o som é ouvido (px). */
  distance?: number;
}

/** Som em loop preso a um ponto do mundo (mova com x/y; pare com stop). */
export interface SpatialLoop {
  x: number;
  y: number;
  stop(fadeMs?: number): void;
}

type VolumeSound = Phaser.Sound.BaseSound & { setVolume(v: number): unknown; setPan?(p: number): unknown };

interface ActiveLoop {
  handle: SpatialLoop;
  sound: VolumeSound;
  /** Volume máximo (já com categoria e master). */
  base: number;
  distance: number;
  fade: number;
}

interface Listener {
  readonly x: number;
  readonly y: number;
}


/**
 * Serviço de áudio do jogo (único): tocar sons com variação, áudio posicional
 * (volume por distância e pan esquerda/direita), limite de vozes por categoria,
 * ambiente por área com transição suave e sons ambientes aleatórios.
 */
export class AudioSystem {
  private scene: Phaser.Scene | null = null;
  private listener: Listener | null = null;
  private surfaceAt: (x: number, y: number) => string = () => 'terminal';
  private readonly voices = new Map<SoundCategory, number>();
  private ambience: { area: string; sound: Phaser.Sound.BaseSound } | null = null;
  private nextAmbientEventAt = 0;
  private heartbeat: Phaser.Sound.BaseSound | null = null;
  private lastHp = -1;
  private muted = save.muted;
  private offs: Array<() => void> = [];
  private loops: ActiveLoop[] = [];

  get isMuted(): boolean {
    return this.muted;
  }

  /** Liga o áudio à cena de jogo (ouvinte = jogador; superfície para passos). */
  bind(scene: Phaser.Scene, listener: Listener, surfaceAt: (x: number, y: number) => string): void {
    this.unbind();
    this.scene = scene;
    this.listener = listener;
    this.surfaceAt = surfaceAt;
    this.voices.clear();
    this.lastHp = -1;
    this.lastWavePhase = '';
    this.nextAmbientEventAt = scene.time.now + 4000;
    scene.sound.mute = this.muted;
    const ev = scene.game.events;
    this.offs = [
      onGameEvent(ev, GameEvents.ZombieKilled, this.onZombieKilled, this),
      onGameEvent(ev, GameEvents.PlayerHpChanged, this.onHp, this),
      onGameEvent(ev, GameEvents.PlayerDied, () => {
        this.play('player_death', { category: 'player', volume: 1 });
        this.stopHeartbeat();
      }),
      onGameEvent(ev, GameEvents.WaveState, this.onWaveState, this),
      onGameEvent(ev, GameEvents.PurchaseDenied, () => this.play('denied', { category: 'ui' })),
      onGameEvent(ev, GameEvents.PowerUpCollected, () => this.play('powerup', { category: 'ui', volume: 0.9 })),
      onGameEvent(ev, GameEvents.BossIncoming, () => this.play('boss_warning', { category: 'ui', volume: 0.9 })),
      onGameEvent(ev, GameEvents.BossDefeated, () => this.play('boss_death', { category: 'world', volume: 1 })),
      onGameEvent(ev, GameEvents.AreaEntered, (a) => this.setArea(a.id)),
    ];
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unbind());
  }

  unbind(): void {
    this.offs.forEach((off) => off());
    this.offs = [];
    this.ambience?.sound.destroy();
    this.ambience = null;
    for (const loop of this.loops) loop.sound.destroy();
    this.loops = [];
    this.stopHeartbeat();
    this.scene = null;
    this.listener = null;
  }

  /** Liga/desliga o som (tela de Configurações). */
  setMuted(muted: boolean, sound?: Phaser.Sound.BaseSoundManager): void {
    this.muted = muted;
    const manager = sound ?? this.scene?.sound;
    if (manager) manager.mute = muted;
    save.muted = muted;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.scene) this.scene.sound.mute = this.muted;
    save.muted = this.muted;
    return this.muted;
  }

  /** Toca um som não posicional (interface, arma do próprio jogador...). */
  play(key: string, opts: PlayOptions = {}): Phaser.Sound.BaseSound | null {
    const scene = this.scene;
    if (!scene) return null;
    const category = opts.category ?? 'world';
    const active = this.voices.get(category) ?? 0;
    if (!opts.loop && active >= audioConfig.maxVoices[category]) return null;
    const variant = this.pickVariant(key);
    if (!variant) return null;
    const jitter = opts.pitchJitter ?? 0.04;
    const sound = scene.sound.add(variant, {
      volume: (opts.volume ?? 1) * audioConfig.categories[category] * audioConfig.master,
      rate: (opts.rate ?? 1) * (1 + (Math.random() * 2 - 1) * jitter),
      loop: opts.loop ?? false,
    });
    if (!opts.loop) {
      this.voices.set(category, active + 1);
      sound.once(Phaser.Sound.Events.COMPLETE, () => {
        this.voices.set(category, Math.max(0, (this.voices.get(category) ?? 1) - 1));
        sound.destroy();
      });
    }
    sound.play();
    return sound;
  }

  /** Toca um som no mundo: volume pela distância ao jogador e pan pela posição horizontal. */
  playAt(key: string, x: number, y: number, opts: SpatialOptions = {}): void {
    const l = this.listener;
    if (!l) return;
    const maxDist = opts.distance ?? audioConfig.hearingDistance;
    const d = Phaser.Math.Distance.Between(l.x, l.y, x, y);
    if (d >= maxDist) return;
    const falloff = Math.pow(1 - d / maxDist, 1.6);
    if (falloff * (opts.volume ?? 1) < 0.02) return;
    const sound = this.play(key, { ...opts, volume: (opts.volume ?? 1) * falloff });
    if (sound && 'setPan' in sound) (sound as Phaser.Sound.WebAudioSound).setPan(Phaser.Math.Clamp((x - l.x) / 480, -0.85, 0.85));
  }

  /** Loop posicional (sirene, gás, trem): o volume acompanha a distância a cada frame. */
  loopAt(key: string, x: number, y: number, opts: SpatialOptions = {}): SpatialLoop | null {
    const category = opts.category ?? 'world';
    const sound = this.play(key, { ...opts, category, loop: true, volume: 0, pitchJitter: 0 }) as VolumeSound | null;
    if (!sound) return null;
    const loop: ActiveLoop = {
      handle: { x, y, stop: (fadeMs = 400) => { loop.fade = fadeMs; } },
      sound,
      base: (opts.volume ?? 1) * audioConfig.categories[category] * audioConfig.master,
      distance: opts.distance ?? audioConfig.hearingDistance,
      fade: -1,
    };
    this.loops.push(loop);
    this.updateLoop(loop, 0);
    return loop.handle;
  }

  private updateLoop(loop: ActiveLoop, delta: number): boolean {
    const l = this.listener;
    if (loop.fade >= 0) {
      loop.base -= (loop.base * delta) / Math.max(1, loop.fade);
      loop.fade -= delta;
      if (loop.fade <= 0) {
        loop.sound.destroy();
        return false;
      }
    }
    if (!l) return true;
    const d = Phaser.Math.Distance.Between(l.x, l.y, loop.handle.x, loop.handle.y);
    const falloff = d >= loop.distance ? 0 : Math.pow(1 - d / loop.distance, 1.6);
    loop.sound.setVolume(loop.base * falloff);
    loop.sound.setPan?.(Phaser.Math.Clamp((loop.handle.x - l.x) / 480, -0.85, 0.85));
    return true;
  }

  /** Passo do jogador conforme o piso sob ele. */
  footstep(x: number, y: number): void {
    this.playAt(`step_${this.surfaceAt(x, y)}`, x, y, { category: 'player', volume: 0.55, pitchJitter: 0.08 });
  }

  /** Ambiente da área com transição suave. */
  setArea(area: string): void {
    const scene = this.scene;
    if (!scene || this.ambience?.area === area || !AMBIENCE_AREAS.includes(area)) return;
    const old = this.ambience;
    const sound = this.play(`amb_${area}`, { category: 'ambience', loop: true, volume: 0, pitchJitter: 0 });
    if (!sound) return;
    const target = audioConfig.categories.ambience * audioConfig.master;
    scene.tweens.add({ targets: sound, volume: target, duration: audioConfig.ambienceCrossfadeMs });
    if (old) {
      scene.tweens.add({ targets: old.sound, volume: 0, duration: audioConfig.ambienceCrossfadeMs, onComplete: () => old.sound.destroy() });
    }
    this.ambience = { area, sound };
  }

  /** Sons ambientes aleatórios em volta do jogador (estrondos, gemidos, gotas, trem distante). */
  update(time: number): void {
    const delta = this.scene?.game.loop.delta ?? 16;
    this.loops = this.loops.filter((loop) => this.updateLoop(loop, delta));
    const l = this.listener;
    if (!l || !this.ambience || time < this.nextAmbientEventAt) return;
    const [min, max] = audioConfig.ambientEventMs;
    this.nextAmbientEventAt = time + Phaser.Math.Between(min, max);
    const options = ambientEvents[this.ambience.area] ?? [];
    const key = Phaser.Utils.Array.GetRandom(options);
    if (!key) return;
    const angle = Math.random() * Math.PI * 2;
    const dist = Phaser.Math.Between(250, 600);
    this.playAt(key, l.x + Math.cos(angle) * dist, l.y + Math.sin(angle) * dist, { category: 'ambience', volume: 0.9, distance: 1200 });
  }

  private pickVariant(key: string): string | null {
    const count = soundVariants.get(key);
    if (!count) return null;
    return `${key}#${Math.floor(Math.random() * count)}`;
  }

  // ───────────────────────── Reações a eventos ─────────────────────────

  private onZombieKilled(kill: ZombieKilledPayload): void {
    this.playAt(`zombie_${kill.type}_death`, kill.x, kill.y, { category: 'zombie', volume: 0.9 });
  }

  private onHp(p: PlayerHpPayload): void {
    if (this.lastHp >= 0 && p.hp < this.lastHp && p.hp > 0) this.play('player_hurt', { category: 'player', volume: 0.9 });
    this.lastHp = p.hp;
    const low = p.hp > 0 && p.hp / p.maxHp < audioConfig.heartbeatBelow;
    if (low && !this.heartbeat) this.heartbeat = this.play('heartbeat', { category: 'player', loop: true, volume: 0.8, pitchJitter: 0 });
    else if (!low) this.stopHeartbeat();
  }

  private stopHeartbeat(): void {
    this.heartbeat?.destroy();
    this.heartbeat = null;
  }

  private lastWavePhase = '';
  private onWaveState(s: WaveStatePayload): void {
    if (s.phase === 'active' && this.lastWavePhase !== 'active') this.play('wave_start', { category: 'ui', volume: 0.9, pitchJitter: 0 });
    if (s.phase === 'intermission' && this.lastWavePhase === 'active') this.play('wave_end', { category: 'ui', pitchJitter: 0 });
    this.lastWavePhase = s.phase;
  }
}

/** Instância única do áudio (serviço global, como o próprio gerenciador de som do Phaser). */
export const audio = new AudioSystem();
