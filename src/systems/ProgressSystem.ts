import Phaser from 'phaser';
import { MAP_IDS, MAPS, type MapId } from '../config/maps.config';
import { emitGameEvent, GameEvents, onGameEvent } from '../game/events';
import { save } from '../save/SaveStore';

/**
 * Progresso permanente: derrotar o boss de uma wave num mapa libera o mapa seguinte
 * (ex.: o boss da wave 10 do Terminal Central libera o Mapa 2). Fica salvo.
 */
export class ProgressSystem {
  private wave = 0;

  constructor(private readonly scene: Phaser.Scene, private readonly mapId: MapId) {
    const ev = scene.game.events;
    const offs = [
      onGameEvent(ev, GameEvents.WaveState, (s) => { this.wave = s.wave; }),
      onGameEvent(ev, GameEvents.BossDefeated, this.onBossDefeated, this),
    ];
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => offs.forEach((off) => off()));
  }

  private onBossDefeated(): void {
    for (const id of MAP_IDS) {
      const rule = MAPS[id].unlock;
      if (!rule || rule.onMap !== this.mapId || this.wave < rule.bossWave) continue;
      if (save.unlock(id)) emitGameEvent(this.scene.game.events, GameEvents.MapUnlocked, { id, name: MAPS[id].name });
    }
  }
}
