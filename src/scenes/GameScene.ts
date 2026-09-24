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
import { PerkMachine, WeaponLab, type MachineDeps } from '../entities/Machines';
import { MapInteractions } from '../entities/MapInteractions';
import { MysteryBox } from '../entities/MysteryBox';
import type { BarricadeTarget, ZombieWorld } from '../entities/Zombie';
import { emitGameEvent, GameEvents, onGameEvent } from '../game/events';
import { TerminalMap } from '../map/TerminalMap';
import { audio } from '../audio/AudioSystem';
import { MusicSystem } from '../audio/MusicSystem';
import { START_AREA } from '../map/terminal/layout';
import { CameraController } from '../systems/CameraController';
import { CombatSystem } from '../systems/CombatSystem';
import { EconomySystem } from '../systems/EconomySystem';
import { EventSystem } from '../systems/EventSystem';
import { ScoreSystem } from '../systems/ScoreSystem';
import { StatsSystem } from '../systems/StatsSystem';
import { ProgressSystem } from '../systems/ProgressSystem';
import { MinimapFeed } from '../systems/MinimapFeed';
import { DEFAULT_MAP, MAPS, type MapId } from '../config/maps.config';
import { InteractionSystem } from '../systems/InteractionSystem';
import { PerkSystem } from '../systems/PerkSystem';
import { PowerUpSystem } from '../systems/PowerUpSystem';
import { BossSystem } from '../systems/BossSystem';
import { SpawnSystem } from '../systems/SpawnSystem';
import { WaveSystem } from '../systems/WaveSystem';
import { WeaponSystem } from '../weapons/WeaponSystem';
import { getZombieConfig } from '../config/zombies.config';
import { getWaveParams, scaleZombie } from '../systems/difficulty';
import { touchInput } from '../input/touchInput';
import { assistAngle } from '../input/aimAssist';
import { touchConfig } from '../config/input.config';

const MAX_PROJECTILES = 220;
const MAX_ZOMBIES = 60;

/** Orquestra a partida: cria mapa, entidades e sistemas, e delega a lógica a eles. */
export class GameScene extends Phaser.Scene {
  private player!: Player;
  private weaponSystem!: WeaponSystem;
  private combat!: CombatSystem;
  private cameraController!: CameraController;
  private lighting!: LightingSystem;
  private waveSystem!: WaveSystem;
  private economy!: EconomySystem;
  private interaction!: InteractionSystem;
  private mapInteractions!: MapInteractions;
  private perks!: PerkSystem;
  private powerUps!: PowerUpSystem;
  private bossSystem!: BossSystem;
  private eventSystem!: EventSystem;
  private effects!: EffectsSystem;
  private music!: MusicSystem;
  private score!: ScoreSystem;
  private minimap!: MinimapFeed;
  private zombies!: Phaser.Physics.Arcade.Group;
  private bossGroup!: Phaser.Physics.Arcade.Group;
  private map!: TerminalMap;
  private currentArea = '';
  /** Velocidade global dos zumbis (eventos como a Lua de Sangue). */
  private zombieSpeed = 1;
  private readonly aimPoint = new Phaser.Math.Vector2();

  /** Mapa desta partida (escolhido no menu). */
  private mapId: MapId = DEFAULT_MAP;

  constructor() {
    super(SCENE_KEYS.game);
  }

  init(data: { map?: MapId }): void {
    // Só o Terminal Central tem conteúdo por enquanto; mapas ainda sem conteúdo caem nele.
    this.mapId = data.map && MAPS[data.map].playable ? data.map : DEFAULT_MAP;
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
    this.effects = effects;
    this.player.onHurt = (x, y) => effects.bloodHit(x, y, Math.random() * Math.PI * 2);
    // Estatísticas, recordes e desbloqueios (ficam no save).
    new StatsSystem(this, this.mapId);
    new ProgressSystem(this, this.mapId);
    this.score = new ScoreSystem(this, this.player, effects);

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
    const bossGroup = this.physics.add.group();
    this.zombies = zombies;
    this.bossGroup = bossGroup;
    const combat = new CombatSystem(this, {
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
      bosses: bossGroup,
      nav: map.nav,
    });
    this.combat = combat;
    this.weaponSystem.setArcCaster(combat);

    this.interaction = new InteractionSystem(this, this.player);

    // Máquinas: Mystery Box, Weapon Lab e perks
    const machineDeps: MachineDeps = {
      player: this.player,
      economy: this.economy,
      weapons: this.weaponSystem,
      perks: this.perks,
      effects,
      lighting: this.lighting,
      solids: map,
    };
    let box: MysteryBox | null = null;
    for (const m of map.machines) {
      if (m.type === 'mystery_box') {
        this.interaction.add(
          (box = new MysteryBox(this, m.x, m.y, machineDeps, {
            spots: map.boxSpots,
            solids: map,
            // O spawner é criado logo abaixo; só é consultado quando a caixa muda de lugar.
            isAreaOpen: (area) => spawner.isUnlocked(area),
            areaName: (area) => map.areas.find((a) => a.id === area)?.name ?? area,
          })),
        );
      } else if (m.type === 'weapon_lab') {
        this.interaction.add(new WeaponLab(this, m.x, m.y, machineDeps));
      } else {
        this.interaction.add(new PerkMachine(this, m.x, m.y, m.perkId, machineDeps));
      }
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
      explode: (x, y, explosive, source, self) => combat.explode(x, y, explosive, source, self),
      speedMultiplier: () => this.zombieSpeed,
    };

    const spawner = new SpawnSystem(this, zombies, map.spawnPoints, this.player, world);
    spawner.unlockArea(START_AREA);
    this.bossSystem = new BossSystem(this, {
      player: this.player,
      world,
      spawner,
      bossSpawns: map.bossSpawns,
      bossGroup,
      effects,
      lighting: this.lighting,
      economy: this.economy,
      powerUps: this.powerUps,
    });
    this.waveSystem = new WaveSystem(this, spawner, this.player, this.bossSystem);
    this.bossSystem.onSummoned = (count) => this.waveSystem.addSummoned(count);
    // Eventos dinâmicos (apagão, trem, horda, suprimentos, gás, alarme).
    this.eventSystem = new EventSystem({
      scene: this,
      player: this.player,
      map,
      lighting: this.lighting,
      effects,
      waves: this.waveSystem,
      zombies,
      interaction: this.interaction,
      weapons: this.weaponSystem,
      economy: this.economy,
      isAreaOpen: (area) => spawner.isUnlocked(area),
      spawnZombie: (type, x, y, overrides) =>
        spawner.spawnAt({ ...scaleZombie(getZombieConfig(type), getWaveParams(Math.max(1, this.waveSystem.currentWave))), ...overrides }, x, y),
      spawnPowerUp: (id, x, y) => this.powerUps.spawnDrop(id, x, y),
      setZombieSpeed: (m) => (this.zombieSpeed = m),
      setRewardMultiplier: (m) => {
        this.economy.eventMultiplier = m;
        this.score.multiplier = m;
      },
      toast: (text) => emitGameEvent(this.game.events, GameEvents.Toast, { text }),
    });
    this.mapInteractions = new MapInteractions(this, this.interaction, {
      economy: this.economy,
      effects,
      lighting: this.lighting,
      solids: map,
      zombies,
      events: this.eventSystem,
    });
    this.minimap = new MinimapFeed(this, {
      map,
      player: this.player,
      zombies,
      bosses: bossGroup,
      isAreaOpen: (area) => spawner.isUnlocked(area),
      box: () => box,
      supply: () => this.eventSystem.supplyDrop,
    });

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
      onGameEvent(this.game.events, GameEvents.GamePaused, () => this.input.setDefaultCursor('default')),
      onGameEvent(this.game.events, GameEvents.GameResumed, () => {
        this.input.setDefaultCursor('none');
        this.weaponSystem.holdTrigger();
      }),
    ];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unsubscribers.forEach((off) => off());
      this.events.off(Phaser.Scenes.Events.POST_UPDATE, this.updateLighting, this);
    });

    audio.bind(this, this.player, (x, y) => map.floorAt(x, y));
    this.music = new MusicSystem(this, () => spawner.aliveCount);
    this.input.keyboard?.on('keydown-N', () => {
      const on = this.music.toggle();
      emitGameEvent(this.game.events, GameEvents.Toast, { text: on ? 'MÚSICA LIGADA  [N]' : 'MÚSICA DESLIGADA  [N]' });
    });
    this.input.keyboard?.on('keydown-M', () => {
      const muted = audio.toggleMute();
      if (!muted) audio.play('ui_beep', { category: 'ui' });
      emitGameEvent(this.game.events, GameEvents.Toast, { text: muted ? 'SOM DESLIGADO  [M]' : 'SOM LIGADO  [M]' });
    });

    this.scene.launch(SCENE_KEYS.ui);
  }

  override update(time: number, delta: number): void {
    this.player.updateMovement();
    this.player.updateRegen(time, delta);
    this.waveSystem.update(delta);
    this.updateAim();
    this.weaponSystem.update(time);
    this.combat.update(time, delta);
    this.interaction.update(time, delta);
    this.powerUps.update(time);
    this.bossSystem.update(time, delta);
    this.eventSystem.update(time, delta);
    this.mapInteractions.update(time);
    this.minimap.update(time);
    audio.update(time);
    this.music.update(time, delta);
    this.cameraController.update();
    this.trackArea();
  }

  /** Mira pelo mouse ou, no celular, pelo analógico direito (sem ele, olha para onde anda). */
  private updateAim(): void {
    const p = this.player;
    if (touchInput.enabled) {
      // Celular: a lanterna é a mira. Analógico direito gira; sem ele, segue o movimento
      // (enquanto não está atirando). Ao atirar, a mira assistida puxa para o zumbi do cone.
      let facing = p.rotation;
      if (touchInput.aiming) facing = Math.atan2(touchInput.aimY, touchInput.aimX);
      else if (touchInput.moving && !touchInput.firing) facing = Math.atan2(touchInput.moveY, touchInput.moveX);
      if (touchInput.firing) {
        const target = assistAngle(
          p.x, p.y, facing, this.aimTargets(),
          Phaser.Math.DegToRad(touchConfig.assistConeDeg), touchConfig.assistRange,
          (tx, ty) => this.map.nav.lineOfSight(p.x, p.y, tx, ty, 0),
        );
        if (target !== null) facing = Phaser.Math.Angle.RotateTo(p.rotation, target, touchConfig.assistTurn);
      }
      p.aimAt(p.x + Math.cos(facing) * 100, p.y + Math.sin(facing) * 100);
      return;
    }
    this.input.activePointer.positionToCamera(this.cameras.main, this.aimPoint);
    p.aimAt(this.aimPoint.x, this.aimPoint.y);
  }

  /** Zumbis e boss vivos (alvos da mira assistida). */
  private *aimTargets(): Generator<{ x: number; y: number }> {
    for (const group of [this.zombies, this.bossGroup]) {
      for (const c of group.getChildren()) {
        const t = c as Phaser.Physics.Arcade.Sprite & { isAlive?: boolean };
        if (t.active && t.isAlive) yield t;
      }
    }
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
    this.bossSystem.syncHud();
    this.eventSystem.syncHud();
    this.score.syncHud();
  }

  private onPlayerDied(): void {
    this.physics.pause();
    // Animação de morte: sangue se espalhando e a câmera se aproximando devagar.
    this.effects.playerDeath(this.player.x, this.player.y, this.player.rotation);
    const cam = this.cameras.main;
    cam.zoomTo(cam.zoom * 1.35, 2600, 'Sine.easeInOut');
    this.input.setDefaultCursor('default');
  }
}
