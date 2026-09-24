import Phaser from 'phaser';
import { achievementById, achievementConfig, ACHIEVEMENTS, type AchievementId, type TotalKey } from '../config/achievements.config';
import { perks } from '../config/machines.config';
import { emitGameEvent, GameEvents, onGameEvent } from '../game/events';
import { save } from '../save/SaveStore';

/**
 * Conquistas da partida: escuta os eventos do jogo e libera as conquistas (salvas na hora).
 * As de progresso somam o total salvo com o desta partida. Partida invalidada pelo
 * anti-trapaça não libera nada.
 */
export class AchievementSystem {
  private flagged = false;
  private readonly run: Record<TotalKey, number> = { kills: 0, knifeKills: 0, headshots: 0 };
  private houndWave = false;
  private hurtThisWave = false;
  private lastHp = Infinity;

  constructor(private readonly scene: Phaser.Scene) {
    const ev = scene.game.events;
    const offs = [
      onGameEvent(ev, GameEvents.CheatDetected, () => { this.flagged = true; }),
      onGameEvent(ev, GameEvents.ZombieKilled, (k) => {
        this.run.kills++;
        if (k.source === 'melee') this.run.knifeKills++;
        if (k.headshot && k.source === 'weapon') this.run.headshots++;
        this.unlock('first_blood');
        this.checkTotals();
      }),
      onGameEvent(ev, GameEvents.WaveState, (s) => {
        if (s.wave >= achievementConfig.survivorWave) this.unlock('survivor');
        if (s.wave >= achievementConfig.veteranWave) this.unlock('veteran');
        if (s.phase === 'active' && s.remaining === s.total) {
          this.houndWave = s.hounds === true;
          this.hurtThisWave = false;
        } else if (s.phase === 'intermission' && this.houndWave) {
          if (!this.hurtThisWave) this.unlock('dog_trainer');
          this.houndWave = false;
        }
      }),
      onGameEvent(ev, GameEvents.PlayerHpChanged, (hp) => {
        if (hp.hp + hp.armor < this.lastHp) this.hurtThisWave = true;
        this.lastHp = hp.hp + hp.armor;
      }),
      onGameEvent(ev, GameEvents.PowerChanged, (p) => p.on && this.unlock('power_on')),
      onGameEvent(ev, GameEvents.BossDefeated, (b) => {
        if (b.id === 'conductor') this.unlock('conductor');
        if (b.id === 'patient_zero') this.unlock('patient_zero');
      }),
      onGameEvent(ev, GameEvents.QuestComplete, () => this.unlock('serum')),
      onGameEvent(ev, GameEvents.TrainRunOver, (t) => t.count >= achievementConfig.trainKills && this.unlock('train_wreck')),
      onGameEvent(ev, GameEvents.PerksChanged, (p) => {
        const owned = new Set(p.perks.filter((x) => x.level > 0).map((x) => x.id));
        if (Object.keys(perks).every((id) => owned.has(id))) this.unlock('collector');
      }),
      onGameEvent(ev, GameEvents.AmmoChanged, (a) => a.weaponName === 'Tornado' && this.unlock('tornado')),
      onGameEvent(ev, GameEvents.MysteryBoxRolled, (r) => r.fireSale && this.unlock('fire_sale')),
    ];
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => offs.forEach((off) => off()));
  }

  /** Conquistas de progresso: total salvo + o desta partida. */
  private checkTotals(): void {
    for (const def of ACHIEVEMENTS) {
      if (def.total && save.total(def.total.key) + this.run[def.total.key] >= def.total.target) this.unlock(def.id);
    }
  }

  private unlock(id: AchievementId): void {
    if (this.flagged || save.hasAchievement(id)) return;
    const def = achievementById(id);
    if (!def || !save.unlockAchievement(id)) return;
    emitGameEvent(this.scene.game.events, GameEvents.AchievementUnlocked, { id, name: def.name, description: def.description, icon: def.icon });
  }
}
