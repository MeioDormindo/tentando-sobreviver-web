import Phaser from 'phaser';
import { SCENE_KEYS } from '../config/game.config';
import { playerConfig } from '../config/player.config';
import { getWeaponConfig } from '../config/weapons.config';
import { Player } from '../entities/Player';
import { Projectile } from '../entities/Projectile';
import { Zombie } from '../entities/Zombie';
import { EffectsSystem } from '../effects/EffectsSystem';
import { LightingSystem } from '../effects/LightingSystem';
import { Barricade } from '../entities/Barricade';
import { AmmoStation, WeaponCase } from '../entities/BuyStations';
import { Door } from '../entities/Door';
import { MysteryBox, PerkMachine, WeaponLab, type MachineDeps } from '../entities/Machines';
import type { BarricadeTarget, ZombieWorld } from '../entities/Zombie';
import { emitGameEvent, GameEvents, onGameEvent } from '../game/events';
import { TerminalMap } from '../map/TerminalMap';
import { START_AREA } from '../map/terminal/layout';
import { CameraController } from '../systems/CameraController';
import { CombatSystem } from '../systems/CombatSystem';
import { EconomySystem } from '../systems/EconomySystem';
import { InteractionSystem } from '../systems/InteractionSystem';
import { PerkSystem } from '../systems/PerkSystem';
import { PowerUpSystem } from '../systems/PowerUpSystem';
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
  private perks!: PerkSystem;
  private powerUps!: PowerUpSystem;
  private map!: TerminalMap;
  private currentArea = '';
  private readonly aimPoint = new Phaser.Math.Vector2();

  constructor() {
    super(SCENE_KEYS.game);
  }

  create(): void {
    const map = new TerminalMap(this);
    this.map = map;
    this.currentArea = '';
    this.physics.world.setBounds(0, 0, map.widthPx, map.heightPx);

    this.player = new Player(this, map.playerSpawn.x, map.playerSpawn.y, playerConfig);
    this.lighting = new LightingSystem(this, this.player, map.lamps, map.darknessAt);
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
    // Perks: um único objeto de modificadores lido pelo jogador, armas e combate.
    this.perks = new PerkSystem(this);
    this.player.setModifiers(this.perks.modifiers);
    this.weaponSystem.setModifiers(this.perks.modifiers);
    this.perks.onChange(() => this.player.onPerksChanged());

    this.economy = new EconomySystem(this, effects);
    this.powerUps = new PowerUpSystem(this, {
      player: this.player,
      economy: this.economy,
      weapons: this.weaponSystem,
      perks: this.perks,
      effects,
      lighting: this.lighting,
      zombies,
    });

    const barricadeBodies = this.physics.add.staticGroup();
    new CombatSystem(this, {
      player: this.player,
      zombies,
      projectiles,
      walls: map.wallLayer,
      obstacles: map.obstacles,
      bulletBlockers: map.bulletBlockers,
      barricades: barricadeBodies,
      effects,
      modifiers: this.perks.modifiers,
      buffs: this.powerUps.buffs,
    });

    this.interaction = new InteractionSystem(this, this.player);

    // Máquinas: Mystery Box, Weapon Lab e perks
    const machineDeps: MachineDeps = {
      economy: this.economy,
      weapons: this.weaponSystem,
      perks: this.perks,
      effects,
      lighting: this.lighting,
      solids: map,
    };
    for (const m of map.machines) {
      if (m.type === 'mystery_box') this.interaction.add(new MysteryBox(this, m.x, m.y, machineDeps));
      else if (m.type === 'weapon_lab') this.interaction.add(new WeaponLab(this, m.x, m.y, machineDeps));
      else this.interaction.add(new PerkMachine(this, m.x, m.y, m.perkId, machineDeps));
    }

    // Barricadas nas janelas (acessíveis aos zumbis pelo tile da janela)
    const barricadeByTile = new Map<number, BarricadeTarget>();
    for (const def of map.windows) {
      const barricade = new Barricade(this, def, { economy: this.economy, player: this.player, bodies: barricadeBodies });
      this.interaction.add(barricade);
      for (let y = def.rect.y; y < def.rect.y + def.rect.h; y++) {
        for (let x = def.rect.x; x < def.rect.x + def.rect.w; x++) barricadeByTile.set(y * map.nav.width + x, barricade);
      }
    }
    const world: ZombieWorld = {
      nav: map.nav,
      barricadeAt: (tx, ty) => barricadeByTile.get(ty * map.nav.width + tx) ?? null,
    };

    const spawner = new SpawnSystem(this, zombies, map.spawnPoints, this.player, world);
    spawner.unlockArea(START_AREA);
    this.waveSystem = new WaveSystem(this, spawner, this.player);

    // Portas pagas: abrir libera os spawns e a exploração da área seguinte.
    for (const def of map.doors) {
      this.interaction.add(
        new Door(this, def, {
          economy: this.economy,
          map,
          isUnlocked: (area) => spawner.isUnlocked(area),
          onOpened: (door) => {
            for (const area of door.def.areas) {
              if (spawner.isUnlocked(area)) continue;
              spawner.unlockArea(area);
              const name = map.areas.find((a) => a.id === area)?.name ?? area;
              emitGameEvent(this.game.events, GameEvents.AreaUnlocked, { id: area, name });
            }
          },
        }),
      );
    }
    const stationDeps = { economy: this.economy, weapons: this.weaponSystem, solids: map };
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
    this.interaction.update(time, delta);
    this.powerUps.update(time);
    this.cameraController.update();
    this.trackArea();
  }

  /** Avisa a HUD quando o jogador entra em outra área. */
  private trackArea(): void {
    const area = this.map.areaAt(this.player.x, this.player.y);
    if (!area || area.id === this.currentArea) return;
    this.currentArea = area.id;
    emitGameEvent(this.game.events, GameEvents.AreaEntered, { id: area.id, name: area.name });
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
    this.perks.syncHud();
    this.powerUps.syncHud();
  }

  private onPlayerDied(): void {
    this.physics.pause();
    this.input.setDefaultCursor('default');
  }
}
