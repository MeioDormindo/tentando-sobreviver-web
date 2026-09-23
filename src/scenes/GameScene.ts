import Phaser from 'phaser';
import { SCENE_KEYS } from '../config/game.config';
import { playerConfig } from '../config/player.config';
import { getWeaponConfig } from '../config/weapons.config';
import { Player } from '../entities/Player';
import { Projectile } from '../entities/Projectile';
import { Zombie } from '../entities/Zombie';
import { EffectsSystem } from '../effects/EffectsSystem';
import { LightingSystem } from '../effects/LightingSystem';
import { AmmoStation, WeaponCase } from '../entities/BuyStations';
import { GameEvents, onGameEvent } from '../game/events';
import { TestMap } from '../map/TestMap';
import { CameraController } from '../systems/CameraController';
import { CombatSystem } from '../systems/CombatSystem';
import { EconomySystem } from '../systems/EconomySystem';
import { InteractionSystem } from '../systems/InteractionSystem';
import { SpawnSystem } from '../systems/SpawnSystem';
import { WaveSystem } from '../systems/WaveSystem';
import { WeaponSystem } from '../weapons/WeaponSystem';

const MAX_PROJECTILES = 160;
const MAX_ZOMBIES = 60;

/** Orquestra a partida: cria mapa, entidades e sistemas, e delega a lógica a eles. */
export class GameScene extends Phaser.Scene {
  private player!: Player;
  private weaponSystem!: WeaponSystem;
  private cameraController!: CameraController;
  private lighting!: LightingSystem;
  private waveSystem!: WaveSystem;
  private economy!: EconomySystem;
  private interaction!: InteractionSystem;
  private readonly aimPoint = new Phaser.Math.Vector2();

  constructor() {
    super(SCENE_KEYS.game);
  }

  create(): void {
    const map = new TestMap(this);
    this.physics.world.setBounds(0, 0, map.widthPx, map.heightPx);

    this.player = new Player(this, map.playerSpawn.x, map.playerSpawn.y, playerConfig);
    this.lighting = new LightingSystem(this, this.player, map.lamps);
    const effects = new EffectsSystem(this, map.widthPx, map.heightPx, this.lighting);
    map.scatterDecals(effects.stampDecal);

    const projectiles = this.physics.add.group({
      classType: Projectile,
      maxSize: MAX_PROJECTILES,
      runChildUpdate: true,
    });
    const zombies = this.physics.add.group({
      classType: Zombie,
      maxSize: MAX_ZOMBIES,
      runChildUpdate: true,
    });

    this.weaponSystem = new WeaponSystem(
      this,
      this.player,
      projectiles,
      getWeaponConfig(playerConfig.startingWeapon),
      effects,
    );
    new CombatSystem(this, {
      player: this.player,
      zombies,
      projectiles,
      walls: map.wallLayer,
      obstacles: map.obstacles,
      bulletBlockers: map.bulletBlockers,
      effects,
    });
    const spawner = new SpawnSystem(this, zombies, map.spawnPoints, this.player);
    this.waveSystem = new WaveSystem(this, spawner, this.player);

    this.economy = new EconomySystem(this, effects);
    this.interaction = new InteractionSystem(this, this.player);
    const stationDeps = { economy: this.economy, weapons: this.weaponSystem, obstacles: map.obstacles };
    for (const s of map.stations) {
      this.interaction.add(
        s.type === 'weapon' ? new WeaponCase(this, s.x, s.y, s.weaponId, stationDeps) : new AmmoStation(this, s.x, s.y, stationDeps),
      );
    }

    this.cameraController = new CameraController(this, this.player, map.widthPx, map.heightPx);
    // A luz é desenhada depois da física, com as posições finais do frame.
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, this.updateLighting, this);

    this.input.setDefaultCursor('none');

    const unsubscribers = [
      onGameEvent(this.game.events, GameEvents.PlayerDied, this.onPlayerDied, this),
      onGameEvent(this.game.events, GameEvents.HudRequest, this.syncHud, this),
    ];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unsubscribers.forEach((off) => off());
      this.events.off(Phaser.Scenes.Events.POST_UPDATE, this.updateLighting, this);
    });

    this.scene.launch(SCENE_KEYS.ui);
  }

  override update(time: number, delta: number): void {
    this.player.updateMovement();
    this.player.updateRegen(time, delta);
    this.waveSystem.update(delta);
    this.input.activePointer.positionToCamera(this.cameras.main, this.aimPoint);
    this.player.aimAt(this.aimPoint.x, this.aimPoint.y);
    this.weaponSystem.update(time);
    this.interaction.update();
    this.cameraController.update();
  }

  private updateLighting(): void {
    this.lighting.update(this.time.now);
  }

  private syncHud(): void {
    this.player.emitHp();
    this.weaponSystem.syncHud();
    this.waveSystem.syncHud();
    this.economy.syncHud();
    this.interaction.syncHud();
  }

  private onPlayerDied(): void {
    this.physics.pause();
    this.input.setDefaultCursor('default');
  }
}
