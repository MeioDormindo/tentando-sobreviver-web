import Phaser from 'phaser';
import { SCENE_KEYS, TILE_SIZE } from '../config/game.config';
import { playerConfig } from '../config/player.config';
import { getWeaponConfig } from '../config/weapons.config';
import { Player } from '../entities/Player';
import { Projectile } from '../entities/Projectile';
import { Zombie } from '../entities/Zombie';
import { save } from '../save/SaveStore';
import { EffectsSystem } from '../effects/EffectsSystem';
import { LightingSystem } from '../effects/LightingSystem';
import { Barricade } from '../entities/Barricade';
import { AmmoStation, WeaponCase } from '../entities/BuyStations';
import { Door } from '../entities/Door';
import { PerkMachine, WeaponLab, type MachineDeps } from '../entities/Machines';
import { MapInteractions } from '../entities/MapInteractions';
import { StationBoard } from '../entities/StationBoard';
import { perks, quickReviveConfig, type PerkId } from '../config/machines.config';
import { createSerumQuest } from '../quests/serumQuest';
import type { QuestSystem } from '../quests/QuestSystem';
import { mapSkins, type ZombieConfig } from '../config/zombies.config';
import { houndRounds } from '../config/waves.config';
import { liveZombies } from '../events/WorldEvent';
import { Knife } from '../weapons/Knife';
import { WeaponDrop } from '../entities/WeaponDrop';
import { HazardSystem } from '../systems/HazardSystem';
import { PowerSystem } from '../systems/PowerSystem';
import { EasterEggs } from '../systems/EasterEggs';
import { MysteryBox } from '../entities/MysteryBox';
import type { BarricadeTarget, ZombieWorld } from '../entities/Zombie';
import { emitGameEvent, GameEvents, onGameEvent } from '../game/events';
import { GameMap } from '../map/GameMap';
import { audio } from '../audio/AudioSystem';
import { MusicSystem } from '../audio/MusicSystem';
import { layoutFor } from '../map/registry';
import { CameraController } from '../systems/CameraController';
import { CombatSystem } from '../systems/CombatSystem';
import { EconomySystem } from '../systems/EconomySystem';
import { EventSystem } from '../systems/EventSystem';
import { ScoreSystem } from '../systems/ScoreSystem';
import { StatsSystem } from '../systems/StatsSystem';
import { AntiCheat } from '../systems/AntiCheat';
import { ProgressSystem } from '../systems/ProgressSystem';
import { MinimapFeed } from '../systems/MinimapFeed';
import { DEFAULT_MAP, MAPS, type MapId } from '../config/maps.config';
import { InteractionSystem } from '../systems/InteractionSystem';
import { PerkSystem } from '../systems/PerkSystem';
import { PowerUpSystem } from '../systems/PowerUpSystem';
import { BossSystem } from '../systems/BossSystem';
import { SpawnSystem } from '../systems/SpawnSystem';
import { NavCost } from '../systems/pathfinding/NavGrid';
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
  private station: StationBoard | null = null;
  private hazards!: HazardSystem;
  /** Energia do mapa (também usada pela missão principal). */
  power!: PowerSystem;
  /** Missão principal do mapa (só no Hospital). */
  quest: QuestSystem | null = null;
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
  private map!: GameMap;
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
    const map = new GameMap(this, layoutFor(this.mapId));
    Zombie.bigHeads = save.secret('konami') && save.setting('bigHeads');
    Zombie.skinOverrides = mapSkins[this.mapId] ?? {};
    this.map = map;
    this.currentArea = '';
    this.physics.world.setBounds(0, 0, map.widthPx, map.heightPx);

    this.player = new Player(this, map.playerSpawn.x, map.playerSpawn.y, playerConfig);
    this.lighting = new LightingSystem(this, this.player, map.lamps, map.darknessAt);
    const effects = new EffectsSystem(this, map.widthPx, map.heightPx, this.lighting);
    map.scatterDecals(effects.stampDecal);
    this.effects = effects;
    // Energia: começa desligada; o disjuntor do mapa liga.
    const power = new PowerSystem(this, this.lighting);
    this.power = power;
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
    // Quick Revive: ao cair, fica alguns segundos no chão e levanta empurrando os zumbis.
    this.player.reviveHandler = () => {
      if (this.perks.level('quick_revive') === 0) return null;
      emitGameEvent(this.game.events, GameEvents.Toast, { text: 'QUICK REVIVE — AGUENTE!' });
      return quickReviveConfig.downMs;
    };
    this.player.onRevived = () => this.onQuickRevive(effects);

    this.economy = new EconomySystem(this, effects);
    new AntiCheat(this, [this.economy, this.score]);
    this.powerUps = new PowerUpSystem(this, {
      player: this.player,
      economy: this.economy,
      weapons: this.weaponSystem,
      perks: this.perks,
      effects,
      lighting: this.lighting,
      zombies,
      repairBarricades: () => barricades.reduce((n, b) => n + b.repairFully(), 0),
    });
    const barricades: Barricade[] = [];

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
    // Arma trocada cai no chão (pode ser pega de volta por 60s).
    this.weaponSystem.onDropped = (weapon) => {
      const p = this.player;
      new WeaponDrop(this, p.x - Math.cos(p.rotation) * 26, p.y - Math.sin(p.rotation) * 26, weapon, {
        interaction: this.interaction,
        currentName: () => this.weaponSystem.current.config.name,
        takeBack: (w) => this.weaponSystem.takeBack(w),
      });
    };
    new Knife(this, {
      player: this.player,
      weapons: this.weaponSystem,
      melee: (x, y, angle) => combat.melee(x, y, angle),
      targets: () => this.aimTargets(),
      lineOfSight: (ax, ay, bx, by) => map.nav.lineOfSight(ax, ay, bx, by, 0),
    });
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
      power,
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
            mapId: this.mapId,
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
      barricades.push(barricade);
      for (let y = def.rect.y; y < def.rect.y + def.rect.h; y++) {
        for (let x = def.rect.x; x < def.rect.x + def.rect.w; x++) barricadeByTile.set(y * map.nav.width + x, barricade);
      }
    }
    // Poças de ácido, nuvens de gás e cuspes dos inimigos do Hospital.
    const hazards = new HazardSystem(this, { player: this.player, effects });
    this.hazards = hazards;
    const world: ZombieWorld = {
      nav: map.nav,
      barricadeAt: (tx, ty) => barricadeByTile.get(ty * map.nav.width + tx) ?? null,
      explode: (x, y, explosive, source, self) => combat.explode(x, y, explosive, source, self),
      speedMultiplier: () => this.zombieSpeed,
      spit: (x, y, tx, ty, ranged) => hazards.spit(x, y, tx, ty, ranged.projectileSpeed, ranged.pool),
      deathCloud: (x, y, cloud) => {
        hazards.addPool('gas', x, y, cloud);
        audio.playAt('crawler_gas', x, y, { category: 'zombie', volume: 0.9 });
      },
      armorBroken: (x, y) => {
        effects.dustBurst(x, y, 14);
        effects.shockwave(x, y, 44, 0xc8d0d8, 260);
        audio.playAt('armor_break', x, y, { category: 'zombie', volume: 1 });
      },
      burnAway: (x, y) => {
        for (let i = 0; i < 10; i++) effects.burnPuff(x, y);
        this.lighting.addFlash(x, y, 90, 0.6, 400);
        audio.playAt('hound_burn', x, y, { category: 'zombie', volume: 0.9 });
      },
    };

    const spawner = new SpawnSystem(this, zombies, map.spawnPoints, this.player, world);
    spawner.unlockArea(map.startArea);
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
      hazards,
      mapId: this.mapId,
    });
    this.waveSystem = new WaveSystem(this, spawner, this.player, this.bossSystem, this.mapId);
    this.waveSystem.hounds = {
      spawnHound: (config) => this.spawnHound(spawner, config),
      onHoundRound: (active, x, y) => this.onHoundRound(active, x, y),
    };
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
      isPowered: () => power.isOn,
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
      power,
    }, map.layout.interactions);
    // Painel de horários, semáforos e bocas de túnel: só em mapas com estação de trem.
    const station = map.layout.station;
    this.station = station ? new StationBoard(this, this.lighting, station, () => this.eventSystem.trainStatus) : null;
    new EasterEggs(this, {
      interaction: this.interaction,
      player: this.player,
      spawnGoldenDrop: (x, y) => this.powerUps.spawnDrop('golden', x, y),
      secrets: map.layout.secrets,
    });
    const breakerDef = map.layout.interactions.find((i) => i.type === 'breaker');
    const breaker = breakerDef ? { x: breakerDef.tx * TILE_SIZE + TILE_SIZE / 2, y: breakerDef.ty * TILE_SIZE + TILE_SIZE / 2 } : null;
    this.minimap = new MinimapFeed(this, {
      map,
      player: this.player,
      zombies,
      bosses: bossGroup,
      isAreaOpen: (area) => spawner.isUnlocked(area),
      box: () => box,
      supply: () => this.eventSystem.supplyDrop,
      // Objetivo no minimapa: o disjuntor, enquanto a energia estiver desligada.
      objective: () => this.quest?.target ?? (power.isOn ? null : breaker),
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
    const stationDeps = { economy: this.economy, weapons: this.weaponSystem };
    for (const s of map.stations) {
      this.interaction.add(
        s.type === 'weapon' ? new WeaponCase(this, s.x, s.y, s.wall, s.weaponId, stationDeps) : new AmmoStation(this, s.x, s.y, s.wall, stationDeps),
      );
    }

    // Missão principal do Hospital: O Soro do Dr. Almeida.
    if (this.mapId === 'map2') {
      this.quest = createSerumQuest(this, {
        interaction: this.interaction,
        player: this.player,
        power,
        breaker,
        zombies,
        projectiles,
        spawnArmored: () => {
          const wave = Math.max(1, this.waveSystem.currentWave);
          return spawner.spawn(scaleZombie(getZombieConfig('armored'), getWaveParams(wave)), wave);
        },
        waves: this.waveSystem,
        effects,
        lighting: this.lighting,
        reward: () => this.serumReward(),
      });
    }

    this.cameraController = new CameraController(this, this.player, map.widthPx, map.heightPx);
    // A luz é desenhada depois da física, com as posições finais do frame.
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, this.updateLighting, this);

    this.input.setDefaultCursor('none');

    const unsubscribers = [
      onGameEvent(this.game.events, GameEvents.PlayerDied, this.onPlayerDied, this),
      onGameEvent(this.game.events, GameEvents.SettingsChanged, () => {
        this.music.syncSetting();
        Zombie.bigHeads = save.secret('konami') && save.setting('bigHeads');
      }),
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
    this.hazards.update(time, delta);
    this.mapInteractions.update(time);
    this.station?.update(time);
    this.minimap.update(time);
    this.quest?.update(time, delta);
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
  /** Cão Infernal cai num raio perto do jogador, num chão livre de área aberta. */
  private spawnHound(spawner: SpawnSystem, config: ZombieConfig): boolean {
    const round = houndRounds[this.mapId];
    if (!round) return false;
    const [min, max] = round.spawnDistance;
    const nav = this.map.nav;
    const p = this.player;
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Phaser.Math.Between(min, max);
      const x = p.x + Math.cos(a) * d;
      const y = p.y + Math.sin(a) * d;
      const area = this.map.areaAt(x, y);
      if (!area || !spawner.isUnlocked(area.id) || nav.getCost(nav.toTile(x), nav.toTile(y)) !== NavCost.Floor) continue;
      const zombie = spawner.spawnAt(config, x, y);
      if (!zombie) return false;
      this.effects.lightning([{ x: x + Phaser.Math.Between(-30, 30), y: y - 260 }, { x, y }], 0x9fd8ff);
      this.lighting.addFlash(x, y, 140, 0.9, 300);
      this.effects.burnPuff(x, y);
      audio.playAt('hound_burn', x, y, { category: 'zombie', volume: 0.7 });
      return true;
    }
    return false;
  }

  /** Início: névoa azulada, uivo e aviso. Fim: limpa a névoa e o último cão deixa um Max Ammo. */
  private onHoundRound(active: boolean, x: number, y: number): void {
    const round = houndRounds[this.mapId];
    if (!round) return;
    if (active) {
      this.lighting.setFog(round.fog.extraDarkness, round.fog.flashlightFactor);
      this.lighting.setDarknessTint(round.fog.tint);
      audio.play('hound_howl', { category: 'world', volume: 1, pitchJitter: 0 });
      emitGameEvent(this.game.events, GameEvents.WorldEventStarted, {
        id: 'hounds',
        name: 'CÃES INFERNAIS',
        hint: 'Sobreviva à matilha — o último cão deixa um Max Ammo',
        color: 0xff7a1a,
      });
      return;
    }
    this.lighting.setFog(0, 1);
    this.lighting.setDarknessTint(null);
    this.powerUps.spawnDrop('max_ammo', x, y);
  }

  /** Final da missão: todos os perks e o Canhão de Vento já como Tornado. */
  private serumReward(): void {
    for (const id of Object.keys(perks) as PerkId[]) if (!this.perks.isMaxed(id)) this.perks.grant(id);
    this.weaponSystem.give('wind_cannon');
    if (this.weaponSystem.current.config.id === 'wind_cannon' && this.weaponSystem.current.level === 0) this.weaponSystem.upgradeCurrent();
  }

  /** Levantou do Quick Revive: gasta o perk e afasta os zumbis em volta. */
  private onQuickRevive(effects: EffectsSystem): void {
    const cfg = quickReviveConfig;
    const p = this.player;
    this.perks.consume('quick_revive');
    for (const z of liveZombies(this.zombies)) {
      if (Phaser.Math.Distance.Between(p.x, p.y, z.x, z.y) > cfg.pushRadius) continue;
      z.knockback(Phaser.Math.Angle.Between(p.x, p.y, z.x, z.y), cfg.pushSpeed);
      z.stun(cfg.stunMs);
    }
    effects.shockwave(p.x, p.y, cfg.pushRadius, 0x5dade2);
    audio.play('powerup', { category: 'ui', volume: 0.9 });
    const left = this.perks.purchasesLeft('quick_revive') ?? 0;
    emitGameEvent(this.game.events, GameEvents.PowerUpCollected, {
      id: 'quick_revive',
      name: 'Quick Revive',
      color: 0x5dade2,
      detail: left > 0 ? `De pé! Pode comprar mais ${left} ${left === 1 ? 'vez' : 'vezes'}` : 'De pé! Não há mais Quick Revive',
    });
  }

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
