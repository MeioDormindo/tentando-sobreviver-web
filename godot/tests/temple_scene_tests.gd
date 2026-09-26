extends RefCounted
## Testes de cena do Templo dos Mortos (Mapa 3): liberação pela missão do Terminal ou do
## Hospital, o mapa (áreas, portões especiais, portas por ambiente, lava, tochas, colunas,
## altares, estátuas), o arsenal todo novo, as skins adaptadas, os inimigos novos (escudo,
## esqueleto que levanta, flecha), o rodízio de bosses e o Minotauro, a missão do Portão do
## Submundo de ponta a ponta e o segredo das 12 estátuas. Executados por run_tests.gd.

var _passed := 0
var _failed := 0
var _tree: SceneTree
var _main: Node
var _world: LayoutMap
var _player: Player
var _quest: TempleQuest
var _rounds: RoundManager
var _state: Dictionary = {}


func run(tree: SceneTree) -> int:
	_tree = tree
	if not String(Save.get("_path")).contains("test"):
		Save.load_from("user://test_save.json")
	print("Templo dos Mortos (cena)")
	_unlock()
	var previous_map := Session.map_id
	Session.map_id = "temple"
	Events.quest_state.connect(_on_state)
	_main = (load("res://scenes/main.tscn") as PackedScene).instantiate()
	tree.root.add_child(_main)
	_player = _main.get_node("Player") as Player
	_player.controlled = false
	_world = _main.get_node("World") as LayoutMap
	_quest = _main.get_node("TempleQuest") as TempleQuest
	_rounds = _main.get_node("RoundManager") as RoundManager
	var events := _main.get_node("WorldEventSystem") as WorldEventSystem
	events.data = events.data.duplicate(true)
	events.data.schedule["chance_per_wave"] = 0.0
	await _tree.create_timer(0.6).timeout
	_player.health.reset(99999.0)
	_rounds.stop()

	_map()
	_arsenal_and_looks()
	await _enemies()
	await _creatures()
	await _bosses()
	await _quest_flow()
	await _statues()
	await _blessings()
	await _temple_events()

	Events.quest_state.disconnect(_on_state)
	_main.queue_free()
	for node in tree.get_nodes_in_group(&"hazards"):
		node.queue_free()
	await _frames(2)
	Session.map_id = previous_map
	print("\n%d ok, %d falharam (templo)" % [_passed, _failed])
	return _failed


func check(condition: bool, description: String) -> void:
	if condition:
		_passed += 1
		print("  ok  ", description)
	else:
		_failed += 1
		printerr("  FALHOU  ", description)


func _on_state(state: Dictionary) -> void:
	_state = state


func _frames(count: int) -> void:
	for i in count + 1:
		await _tree.physics_frame


func _hold(target: Node, seconds: float) -> bool:
	var done := false
	var left := seconds + 0.2
	while left > 0.0 and not done:
		done = target.call(&"hold_interact", _player, 1.0 / 30.0)
		left -= 1.0 / 30.0
	return done


func _spot(spot_name: String) -> QuestSpot:
	for node in _tree.get_nodes_in_group(&"quest_spots"):
		if node.name == spot_name and not node.is_queued_for_deletion():
			return node as QuestSpot
	return null


# ── Liberação (save de teste) ──

func _unlock() -> void:
	var catalog := Save.catalog
	check(catalog.order.has("temple") and catalog.display_name("temple") == "Templo dos Mortos", "Templo no catálogo de mapas (3º)")
	Save.reset()
	check(not Save.is_unlocked("temple"), "Templo começa trancado")
	check(catalog.unlocked_by_achievement("last_train").has("temple") and catalog.unlocked_by_achievement("serum").has("temple"),
		"libera com a missão do Terminal ou a do Hospital")
	check(String(load("res://scripts/ui/map_select.gd").unlock_text(catalog.info("temple"))).contains("Terminal") and String(load("res://scripts/ui/map_select.gd").unlock_text(catalog.info("temple"))).contains("Hospital"), "cartão trancado explica: %s" % String(load("res://scripts/ui/map_select.gd").unlock_text(catalog.info("temple"))))
	# Save antigo que já tinha a missão do Hospital: o Templo aparece liberado ao carregar.
	var old := Save.data.duplicate(true)
	old.achievements["serum"] = "2026-09-01"
	check(Save.sanitize(old).unlockedMaps.has("temple"), "save com a missão do Hospital já libera o Templo")
	Save.reset()


# ── Mapa ──

func _map() -> void:
	check(_world.map_id() == "temple" and _world.width == 120 and _world.height == 116, "Templo montado (120×116)")
	check(_world.area_of(_player.global_position) == &"ruins", "jogador nasce nas Ruínas")
	var doors: Array = _world.find_children("*", "", true, false).filter(func(n: Node) -> bool: return n is Door)
	check(doors.size() == 7, "7 portas e portões (%d)" % doors.size())
	var gate := _world.door_by_id(&"gate_temple")
	check(gate != null and gate.kind == &"altar" and not gate.interact(_player) and not gate.is_open, "Portão do Templo não se compra (pede os altares)")
	check(gate.get_interaction_prompt(_player).contains("altares"), "Portão do Templo explica o que falta")
	check(_world.door_by_id(&"gate_underworld").kind == &"quest" and _world.door_by_id(&"gate_sanctuary").kind == &"secret", "Portão do Submundo (missão) e passagem do Santuário (segredo)")
	var styles := {}
	for door: Door in doors:
		door._dress()
		styles[door.style] = true
	check(styles.has(&"bones") and styles.has(&"roots") and styles.has(&"serpent") and styles.has(&"infernal") and styles.has(&"olympus"),
		"portas com a cara de cada ambiente (%s)" % ", ".join(styles.keys()))
	var lava := _world.find_child("Lava", true, false)
	check(lava != null and lava.get_child_count() >= 9, "rios e poços de lava (%d)" % (lava.get_child_count() if lava else 0))
	var power := _tree.get_first_node_in_group(&"power_system") as PowerSystem
	var torch_lit := false
	for node in _world.get_children():
		if node is OmniLight3D and Vector2(node.position.x - 44.5, node.position.z - 44.5).length() < 0.1:
			torch_lit = node.visible and (node as OmniLight3D).light_energy > 0.0
	check(not power.is_on and torch_lit, "tochas acesas mesmo sem energia")
	check(_tree.get_nodes_in_group(&"breakable_pillars").size() == 7, "7 colunas que o Minotauro derruba")
	check(_tree.get_nodes_in_group(&"soul_altars").size() == 3, "3 altares no Portão do Templo")
	check(_tree.get_nodes_in_group(&"god_statues").size() == 12, "12 estátuas dos deuses")
	check(not _world.find_children("*", "PrizePedestal", true, false).is_empty() or _has_pedestal(), "pedestal do Arco de Artemis no Santuário")
	var decor := _world.find_child("Decor", false, false)
	check(decor != null and decor.get_child_count() > 50, "decoração do Templo espalhada")


func _has_pedestal() -> bool:
	for node in _world.find_children("*", "", true, false):
		if node is PrizePedestal:
			return true
	return false


# ── Arsenal e visuais ──

func _arsenal_and_looks() -> void:
	check(_player.weapon.data.id == &"makarov", "arma inicial: Makarov (%s)" % _player.weapon.data.id)
	var terminal: Array = JSON.parse_string(FileAccess.get_file_as_string("res://data/maps/terminal.json")).stations.map(func(s: Dictionary) -> String: return String(s.get("weaponId", "")))
	var hospital: Array = JSON.parse_string(FileAccess.get_file_as_string("res://data/maps/map2.json")).stations.map(func(s: Dictionary) -> String: return String(s.get("weaponId", "")))
	var buys: Array = _world.get_children().filter(func(n: Node) -> bool: return n is WallBuy and (n as WallBuy).weapon_data != null)
	var repeated := buys.filter(func(b: WallBuy) -> bool: return terminal.has(String(b.weapon_data.id)) or hospital.has(String(b.weapon_data.id)))
	check(buys.size() == 7 and repeated.is_empty(), "7 armas de parede, nenhuma dos outros mapas (%s)" % ", ".join(buys.map(func(b: WallBuy) -> String: return String(b.weapon_data.id))))
	check(buys.all(func(b: WallBuy) -> bool: return ResourceLoader.exists("res://assets/sprites/weapon_%s.png" % b.weapon_data.id)), "armas do Templo com sprite")
	var box := _tree.get_first_node_in_group(&"mystery_box") as MysteryBox
	check(box != null and box._model != null and String(box._model.name) == "Prop_mystery_box_temple", "Mystery Box temática do Templo")
	var skins := (load("res://data/configs/skins.tres") as SkinCatalog).for_map("temple")
	check(skins.size() == 4 and String(skins[0].id) == "archaeologist" and CharacterSprite.exists("player_archaeologist"), "arqueóloga e 4 visuais no Templo")
	check(SkinCatalog.setting_key("temple") == "skinTemple", "visual do Templo guardado à parte")
	check(String(load("res://scripts/ui/character_screen.gd").start_weapon("temple")) == "makarov", "retrato do Templo com a Makarov")
	for type: StringName in [&"walker", &"runner", &"tank", &"exploder", &"crawler", &"spitter", &"armored"]:
		var zombie := _spawn(type, Vector3(3, 0, 3), 0.0)
		check(zombie.sprite_sheet() == "zombie_%s_temple" % type, "%s com roupa do Templo (%s)" % [type, zombie.sprite_sheet()])
		zombie.queue_free()
	var hound := _spawn(&"hound", Vector3(3, 0, 3), 0.0)
	check(hound.sprite_sheet() == "hound_temple", "cão de Hades no Templo")
	hound.queue_free()


func _spawn_boss(id: StringName, offset: Vector3) -> Boss:
	var data := load("res://data/bosses/%s.tres" % id) as BossData
	var boss := data.scene.instantiate() as Boss
	boss.setup(data, _player, 1.0, func(_t: Array, _n: int, _at: Vector3) -> void: pass)
	(_main.get_node("SpawnManager") as SpawnManager).container.add_child(boss)
	boss.global_position = _player.global_position + offset
	return boss


func _spawn(type: StringName, offset: Vector3, speed_mult: float) -> ZombieBase:
	var data := load("res://data/zombies/%s.tres" % type) as ZombieData
	var zombie := ZombieFactory.create(data, _player, 1.0, 1.0, speed_mult)
	var container := (_main.get_node("SpawnManager") as SpawnManager).container
	container.add_child(zombie)
	zombie.global_position = _player.global_position + offset
	return zombie


# ── Inimigos ──

func _enemies() -> void:
	# Escudo: de frente passa 20%, de costas tudo; headshot de frente passa.
	var hoplite := _spawn(&"hoplite_shield", Vector3(0, 0, -6), 0.0)
	await _frames(2)
	hoplite.pivot.rotation.y = 0.0  # olhando para -Z
	var front := Node3D.new()
	var back := Node3D.new()
	_world.add_child(front)
	_world.add_child(back)
	front.global_position = hoplite.global_position + Vector3(0, 0, -4)
	back.global_position = hoplite.global_position + Vector3(0, 0, 4)
	var start := hoplite.health.current
	(hoplite.get_node("BodyHurtbox") as Hurtbox).receive_hit(100.0, 1.0, DamageInfo.Kind.WEAPON, front, hoplite.global_position)
	var frontal := start - hoplite.health.current
	start = hoplite.health.current
	(hoplite.get_node("BodyHurtbox") as Hurtbox).receive_hit(100.0, 1.0, DamageInfo.Kind.WEAPON, back, hoplite.global_position)
	var behind := start - hoplite.health.current
	check(is_equal_approx(frontal, 20.0) and is_equal_approx(behind, 100.0), "Hoplita: escudo segura de frente (%.0f) e não de costas (%.0f)" % [frontal, behind])
	check(ResourceLoader.exists("res://assets/sprites/zombie_hoplite_shield.png"), "Hoplita com escudo tem sprite próprio")
	hoplite.queue_free()
	front.queue_free()
	back.queue_free()
	# Esqueleto: com a chance forçada, levanta de novo (uma vez) e entra na conta do round.
	var data := (load("res://data/zombies/skeleton.tres") as ZombieData).duplicate()
	data.revive = {"chance": 1.0, "delay_time": 0.3, "health_factor": 0.5}
	var skeleton := ZombieFactory.create(data, _player, 1.0, 1.0, 0.0)
	(_main.get_node("SpawnManager") as SpawnManager).container.add_child(skeleton)
	skeleton.global_position = _player.global_position + Vector3(4, 0, -4)
	await _frames(2)
	var summoned := [0]
	var on_summon := func(n: int) -> void: summoned[0] += n
	Events.zombies_summoned.connect(on_summon)
	skeleton.take_damage(DamageInfo.new(9999.0, DamageInfo.Kind.WEAPON, _player))
	await _tree.create_timer(0.6).timeout
	Events.zombies_summoned.disconnect(on_summon)
	var risen := _tree.get_nodes_in_group(&"zombies").filter(func(z: Node) -> bool: return z.has_meta(&"revived"))
	check(risen.size() == 1 and summoned[0] == 1, "Esqueleto se levanta de novo uma vez (conta no round)")
	for z in risen:
		(z as ZombieBase).take_damage(DamageInfo.new(9999.0, DamageInfo.Kind.WEAPON, _player))
	await _tree.create_timer(0.5).timeout
	check(_tree.get_nodes_in_group(&"zombies").filter(func(z: Node) -> bool: return z.has_meta(&"revived")).is_empty(), "o que levantou não levanta de novo")
	# Arqueiro: de longe, flecha reta que fere.
	var before := _player.health.current
	var archer := _spawn(&"skeleton_archer", Vector3(0, 0, 8), 0.0)
	await _tree.create_timer(3.5).timeout
	check(_player.health.current < before, "Esqueleto Arqueiro acerta flecha de longe (%.0f)" % (before - _player.health.current))
	archer.queue_free()
	await _frames(2)


# ── Bosses ──

# ── Floresta e Templo da Górgona ──

func _creatures() -> void:
	for type in ["satyr", "hellwolf", "harpy", "gorgon"]:
		check(ResourceLoader.exists("res://data/zombies/%s.tres" % type) and CharacterSprite.exists("zombie_%s" % type), "%s com dados e sprite" % type)
	# Sátiro: corre em zigue-zague (sai da linha reta até o jogador).
	var satyr := _spawn(&"satyr", Vector3(0, 0, -12), 1.0)
	var start_x := satyr.global_position.x
	var drift := 0.0
	for i in 16:
		await _tree.create_timer(0.1).timeout
		drift = maxf(drift, absf(satyr.global_position.x - start_x))
	check(drift > 0.25, "Sátiro corre em zigue-zague (desvio de %.2f m)" % drift)
	satyr.queue_free()
	# Lobo Infernal: investe (fere) e recua (a distância volta a crescer).
	var before := _player.health.current
	var wolf := _spawn(&"hellwolf", Vector3(0, 0, -4.5), 1.0)
	var closest := 99.0
	var after_hit := 0.0
	for i in 40:
		await _tree.create_timer(0.1).timeout
		var d := wolf.global_position.distance_to(_player.global_position)
		closest = minf(closest, d)
		if _player.health.current < before:
			after_hit = maxf(after_hit, d)
	check(_player.health.current < before, "Lobo Infernal investe e fere (%.0f)" % (before - _player.health.current))
	check(after_hit > closest + 1.0, "Lobo Infernal recua depois do bote (%.1f m → %.1f m)" % [closest, after_hit])
	wolf.queue_free()
	await _frames(2)
	# Harpia: no ar a faca não alcança; o mergulho fere.
	var harpy := _spawn(&"harpy", Vector3(0, 0, -1.8), 0.0)
	await _tree.create_timer(0.8).timeout
	check(harpy.is_airborne(), "Harpia voa (fora do alcance da faca)")
	var harpy_hp := harpy.health.current
	_player.aim_point = harpy.global_position + Vector3.UP
	_player.knife()
	await _tree.create_timer(0.5).timeout
	check(is_equal_approx(harpy.health.current, harpy_hp), "faca não acerta a Harpia no ar")
	harpy.queue_free()
	before = _player.health.current
	var diver := _spawn(&"harpy", Vector3(0, 0, -5), 1.0)
	for i in 40:
		await _tree.create_timer(0.1).timeout
		if _player.health.current < before:
			break
	check(_player.health.current < before, "Harpia mergulha e fere")
	diver.queue_free()
	await _frames(2)
	# Górgona: olhando para ela, petrifica; de costas, não. Depois do olhar, fica vulnerável.
	var gorgon := _spawn(&"gorgon", Vector3(0, 0, -8), 0.0)
	gorgon._abilities._cooldown_left = 0.0
	_player.aim_point = gorgon.global_position + Vector3.UP
	var stoned := false
	var petrified := 0.0
	for i in 60:
		await _tree.create_timer(0.1).timeout
		_player.aim_point = gorgon.global_position + Vector3.UP
		petrified = maxf(petrified, _player.petrification)
		if _player.is_stone():
			stoned = true
			break
	check(petrified > 0.3 or stoned, "o olhar da Górgona petrifica quem olha para ela (%.2f)" % petrified)
	check(stoned, "petrificação completa: vira pedra")
	check(_player.fire().is_empty() and not _player.knife(), "petrificado não atira nem golpeia")
	await _tree.create_timer(Player.STONE_TIME + 0.2).timeout
	check(not _player.is_stone(), "a pedra passa depois de %.1f s" % Player.STONE_TIME)
	gorgon.queue_free()
	await _frames(2)
	var back := _spawn(&"gorgon", Vector3(0, 0, -8), 0.0)
	back._abilities._cooldown_left = 0.0
	_player.petrification = 0.0
	for i in 30:
		await _tree.create_timer(0.1).timeout
		_player.aim_point = _player.global_position + Vector3(0, 1, 6)  # de costas para ela
	check(_player.petrification < 0.05 and not _player.is_stone(), "de costas o olhar não pega")
	back._abilities._vulnerable_left = 1.0
	var hp := back.health.current
	back.take_damage(DamageInfo.new(50.0, DamageInfo.Kind.WEAPON, _player))
	check(is_equal_approx(hp - back.health.current, 100.0), "depois do olhar a Górgona leva dano dobrado")
	back.queue_free()
	await _frames(2)


func _bosses() -> void:
	var data := _rounds.data
	check(data.boss_for("temple", 10) == &"minotaur" and data.boss_for("terminal", 10) == &"conductor", "round 10: Minotauro no Templo, Condutor no Terminal")
	check(data.is_boss_round_number("temple", 40) and not data.is_boss_round_number("terminal", 40), "no Templo os rounds de boss continuam depois do 30")
	check(ResourceLoader.exists("res://data/bosses/minotaur.tres") and CharacterSprite.exists("boss_minotaur"), "Minotauro com dados e sprite")
	check(data.boss_for("temple", 20) == &"cerberus" and data.boss_for("temple", 30) == &"entity" and data.boss_for("temple", 40) == &"minotaur",
		"rodízio: 20 Cérbero, 30 Entidade, 40 Minotauro de novo")
	check(CharacterSprite.exists("boss_cerberus") and CharacterSprite.exists("boss_entity") and CharacterSprite.exists("boss_entity_monstrous"), "Cérbero e as duas formas da Entidade com sprite")
	# Cérbero: o fogo da cabeça da esquerda deixa chamas no chão.
	var cerberus := _spawn_boss(&"cerberus", Vector3(0, 0, -6))
	var fire := 0
	for i in 60:
		await _tree.create_timer(0.1).timeout
		fire = maxi(fire, _tree.get_nodes_in_group(&"hazards").filter(func(h: Node) -> bool: return h is HazardPool).size())
		if fire > 0:
			break
	check(fire > 0, "Cérbero cospe fogo (%d chamas)" % fire)
	cerberus.queue_free()
	for node in _tree.get_nodes_in_group(&"hazards"):
		node.queue_free()
	await _frames(2)
	# Entidade: esferas de alma e, na fase 3, a forma monstruosa.
	var entity := _spawn_boss(&"entity", Vector3(0, 0, -9))
	var orbs := false
	for i in 40:
		await _tree.create_timer(0.1).timeout
		if not _tree.get_nodes_in_group(&"boss_orbs").is_empty():
			orbs = true
			break
	check(orbs, "Entidade atira esferas de alma")
	entity.health.invulnerable = false
	entity.take_damage(DamageInfo.new(entity.health.max_health * 0.7, DamageInfo.Kind.WEAPON, _player))
	await _frames(2)
	check(entity.phase == 3 and entity.model != null and entity.model.sheet_name == "boss_entity_monstrous", "fase 3: a Entidade assume a forma monstruosa")
	entity.queue_free()
	for node in _tree.get_nodes_in_group(&"hazards"):
		node.queue_free()
	await _frames(2)
	var pillar := _tree.get_nodes_in_group(&"breakable_pillars")[0] as BreakablePillar
	pillar.collapse()
	check(pillar.broken and pillar.collision_layer == 0 and not pillar.is_in_group(&"breakable_pillars"), "coluna desaba e abre caminho")
	var minotaur := load("res://data/bosses/minotaur.tres") as BossData
	var cfg := minotaur.area.duplicate()
	cfg["rubble_time"] = 1.0
	cfg["telegraph_time"] = 0.1
	BossAttacks.area(_tree, _player.global_position + Vector3(6, 0, 6), cfg, false, null)
	await _tree.create_timer(0.3).timeout
	check(not _tree.get_nodes_in_group(&"boss_rubble").is_empty(), "Colapso: pedras viram escombro")
	await _tree.create_timer(2.0).timeout
	check(_tree.get_nodes_in_group(&"boss_rubble").is_empty(), "escombros somem depois")


# ── Missão ──

func _quest_flow() -> void:
	check(_quest.is_physics_processing() and _quest.index == 0 and String(_state.get("objective", "")).contains("gerador"), "missão do Templo ativa: %s" % _state.get("objective", ""))
	(_tree.get_first_node_in_group(&"power_system") as PowerSystem).turn_on()
	await _frames(3)
	check(_quest.index == 1, "etapa 2: Fragmentos de Alma")
	for key in ["necropolis", "forest"]:
		var spot := _spot("Fragment_%s" % key)
		check(spot != null and _hold(spot, TempleQuest.FRAGMENT_HOLD), "pegou o fragmento (%s)" % key)
		await _tree.create_timer(0.4).timeout
		check(not is_instance_valid(spot), "o fragmento (%s) some ao ser pego" % key)
	await _frames(3)
	await _tree.create_timer(TempleQuest.RETRY + 0.3).timeout
	var carrier := _quest.carrier
	check(carrier != null and carrier.data.id == &"skeleton", "um Esqueleto carrega o 3º fragmento")
	if carrier:
		carrier.take_damage(DamageInfo.new(99999.0, DamageInfo.Kind.WEAPON, _player))
	await _frames(4)
	var dropped := _spot("Fragment_carrier")
	check(dropped != null and _hold(dropped, TempleQuest.FRAGMENT_HOLD), "o fragmento cai onde o Esqueleto morreu")
	await _frames(3)
	check(_quest.index == 2, "etapa 3: altares")
	var spots := _tree.get_nodes_in_group(&"quest_spots").filter(func(s: Node) -> bool: return not s.is_queued_for_deletion())
	check(spots.size() == 3, "um ponto de entrega por altar")
	for spot: QuestSpot in spots:
		_hold(spot, TempleQuest.ALTAR_HOLD)
	await _frames(4)
	check(_world.door_by_id(&"gate_temple").is_open and _world.is_area_open(&"gorgon_temple"), "altares acesos abrem o Templo da Górgona")
	check(_tree.get_nodes_in_group(&"soul_altars").all(func(a: SoulAltar) -> bool: return a.active), "os 3 altares brilham")
	check(_quest.index == 3 and StringName(_rounds.forced_boss.get("boss", &"")) == &"minotaur", "o guardião (Minotauro) vem no próximo round")
	Events.boss_defeated.emit(&"minotaur", "O Minotauro", 0, _player.global_position + Vector3(2, 0, 0))
	await _frames(4)
	var key := _spot("UnderworldKey")
	check(key != null and _hold(key, 1.0), "pegou a chave do Submundo onde o Minotauro caiu")
	await _frames(4)
	check(_quest.index == 5, "etapa: abrir o Portão do Submundo")
	var gate_spot := _tree.get_nodes_in_group(&"quest_spots").filter(func(s: Node) -> bool: return not s.is_queued_for_deletion())
	check(gate_spot.size() == 1 and _hold(gate_spot[0], TempleQuest.GATE_HOLD), "abriu o portão")
	await _frames(4)
	check(_world.door_by_id(&"gate_underworld").is_open and _world.is_area_open(&"underworld"), "Portão do Submundo aberto")
	check(_quest.index == 6 and StringName(_rounds.forced_boss.get("boss", &"")) == &"cerberus", "o Cérbero vem no próximo round")
	Events.boss_defeated.emit(&"cerberus", "Cérbero", 0, _player.global_position)
	await _frames(4)
	var seal := _spot("ArenaSeal")
	check(_quest.index == 7 and seal != null and _hold(seal, TempleQuest.GATE_HOLD), "selou o portão no altar da Arena Final")
	await _frames(4)
	check(Save.has_achievement("cerberus"), "conquista Guardião dos Três")
	var zeus := _player.inventory.find(&"zeus_bolt")
	check(zeus != null and zeus.level == 1, "prêmio: Raio de Zeus Mk II")
	check(Save.has_achievement("underworld_gate"), "conquista O Portão do Submundo")


# ── Segredo das 12 estátuas ──

func _statues() -> void:
	var statues := _tree.get_nodes_in_group(&"god_statues")
	var free_areas := [&"ruins", &"necropolis", &"labyrinth", &"forest"]
	var gated := statues.filter(func(st: Node) -> bool: return not free_areas.has(_world.area_of((st as Node3D).global_position)))
	check(gated.is_empty(), "as 12 estátuas ficam em áreas de porta comum (nenhuma atrás dos portões da missão)")
	var nav := _world.get_world_3d().navigation_map
	var unreachable := statues.filter(func(st: Node) -> bool:
		var at := (st as Node3D).global_position
		var p := NavigationServer3D.map_get_closest_point(nav, at)
		return p.y > SpawnManager.FLOOR_MAX_Y or Vector2(p.x - at.x, p.z - at.z).length() > (st as GodStatue).interaction_radius)
	check(unreachable.is_empty(), "dá para chegar perto de todas as 12 estátuas")
	var first := statues[0] as GodStatue
	check(_hold(first, GodStatue.HOLD_TIME) and first.lit, "segurar E acende a estátua (%s)" % first.god)
	for statue: GodStatue in statues:
		statue.light_up()
	await _frames(3)
	check(_world.door_by_id(&"gate_sanctuary").is_open and _world.is_area_open(&"sanctuary"), "as 12 estátuas abrem o Santuário do Olimpo")
	check(Save.has_achievement("twelve_statues"), "conquista Os Doze do Olimpo")
	var pedestal: PrizePedestal = null
	for node in _world.find_children("*", "", true, false):
		if node is PrizePedestal:
			pedestal = node
	check(pedestal != null and _hold(pedestal, PrizePedestal.HOLD_TIME) and _player.inventory.find(&"artemis_bow") != null, "Arco de Artemis no pedestal do Santuário")


# ── Bênçãos dos Deuses ──

func _hit_info(amount: float) -> DamageInfo:
	return DamageInfo.new(amount, DamageInfo.Kind.WEAPON, _player, false, _player.global_position)


func _blessings() -> void:
	var altars := _tree.get_nodes_in_group(&"blessing_altars")
	var gods := {}
	for altar: BlessingAltar in altars:
		gods[altar.god] = true
	check(altars.size() == 3 and gods.size() == 3, "3 altares de bênção, cada um com um deus (%s)" % ", ".join(gods.keys()))
	var blessings := _player.get_node("Blessings") as BlessingSystem
	var points := _main.get_node("PointsManager") as PointsManager
	points.add(3000, false)
	var altar := altars[0] as BlessingAltar
	var before: int = points.points
	check(altar.interact(_player) and blessings.active == altar.god and points.points == before - BlessingAltar.PRICE, "altar dá a bênção de %s por %d pontos" % [altar.god, BlessingAltar.PRICE])
	check(not altar.interact(_player), "a mesma bênção não se compra de novo")
	# Atena: mira precisa e crítico.
	blessings.grant(&"athena")
	check(is_equal_approx(_player.weapon.spread_multiplier, BlessingSystem.ATHENA_SPREAD) and is_equal_approx(_player.weapon.crit_chance, BlessingSystem.ATHENA_CRIT), "Atena: menos dispersão e chance de crítico")
	# Hermes: mais rápido em tudo.
	blessings.grant(&"hermes")
	check(is_equal_approx(_player.blessing_speed, BlessingSystem.HERMES_BONUS) and _player.weapon.reload_multiplier < 1.0 and is_equal_approx(_player.weapon.spread_multiplier, 1.0), "Hermes: anda e recarrega mais rápido (Atena saiu)")
	# Ares: abates seguidos somam dano e zeram sem abater.
	blessings.grant(&"ares")
	var dummy := _spawn(&"walker", Vector3(0, 0, -5), 0.0)
	for i in 3:
		Events.zombie_killed.emit(dummy, _hit_info(10))
	check(is_equal_approx(_player.blessing_damage, 1.0 + 3 * BlessingSystem.ARES_STEP) and _player.weapon.damage_multiplier > 1.2, "Ares: 3 abates seguidos = +24% de dano")
	await _tree.create_timer(BlessingSystem.ARES_WINDOW + 0.3).timeout
	check(is_equal_approx(_player.blessing_damage, 1.0), "Ares: sem abater, o bônus zera")
	# Poseidon: o tiro empurra.
	blessings.grant(&"poseidon")
	Events.zombie_hit.emit(dummy, _hit_info(10))
	check(dummy._knockback.length() > 1.0, "Poseidon: os tiros empurram os zumbis")
	# Zeus: raios saltam para os vizinhos.
	blessings.grant(&"zeus")
	var near := [_spawn(&"walker", Vector3(1.5, 0, -5), 0.0), _spawn(&"walker", Vector3(-1.5, 0, -5), 0.0)]
	near[0].health.reset(99999.0)
	near[1].health.reset(99999.0)
	await _frames(2)
	for i in 80:
		Events.zombie_hit.emit(dummy, _hit_info(40))
	check(near.any(func(z: ZombieBase) -> bool: return z.health.current < z.health.max_health), "Zeus: raios saltam entre os zumbis")
	# Hades: abatidos voltam como aliados.
	blessings.grant(&"hades")
	for i in 60:
		Events.zombie_killed.emit(dummy, _hit_info(10))
	check(not _tree.get_nodes_in_group(&"ally_spirits").is_empty(), "Hades: espíritos aliados surgem (%d)" % _tree.get_nodes_in_group(&"ally_spirits").size())
	blessings.clear()
	check(blessings.active == &"" and is_equal_approx(_player.blessing_speed, 1.0), "sem bênção, tudo normal")
	for z in near:
		z.queue_free()
	dummy.queue_free()
	for spirit in _tree.get_nodes_in_group(&"ally_spirits"):
		spirit.queue_free()
	await _frames(2)


# ── Eventos do Templo ──

func _temple_events() -> void:
	var events := _main.get_node("WorldEventSystem") as WorldEventSystem
	for id: StringName in [&"zeus_wrath", &"rise_of_dead", &"artemis_hunt", &"underworld_portal", &"blood_of_gods"]:
		check(events.events.has(id) and not events.data.info(id).is_empty(), "evento %s registrado com dados" % id)
	# Ira de Zeus: raios ferem.
	var before := _player.health.current
	check(events.trigger(&"zeus_wrath"), "Ira de Zeus começa")
	for i in 80:
		await _tree.create_timer(0.1).timeout
		if _player.health.current < before:
			break
	check(_player.health.current < before, "raio de Zeus fere quem está no círculo")
	events.stop()
	# Levante dos Mortos: esqueletos saem dos sarcófagos.
	_world.open_area(&"necropolis")
	var skeletons := func() -> int: return _tree.get_nodes_in_group(&"zombies").filter(func(z: Node) -> bool: return z is ZombieBase and String((z as ZombieBase).data.id).begins_with("skeleton")).size()
	var count: int = skeletons.call()
	check(events.trigger(&"rise_of_dead"), "Levante dos Mortos começa (sarcófagos na Necrópole)")
	await _tree.create_timer(3.5).timeout
	check(skeletons.call() > count, "esqueletos saem dos sarcófagos (%d)" % (skeletons.call() - count))
	events.stop()
	# Caçada de Artemis: sátiros e lobos.
	var hunters := func() -> int: return _tree.get_nodes_in_group(&"zombies").filter(func(z: Node) -> bool: return z is ZombieBase and (z as ZombieBase).data.id in [&"satyr", &"hellwolf"]).size()
	count = hunters.call()
	check(events.trigger(&"artemis_hunt"), "Caçada de Artemis começa")
	await _tree.create_timer(3.0).timeout
	check(hunters.call() > count, "sátiros e lobos surgem perto do jogador")
	events.stop()
	# Portão do Submundo: solta criaturas; destruído, deixa o Tridente.
	check(events.trigger(&"underworld_portal"), "Portão do Submundo se abre")
	var portal := events.running as UnderworldPortalEvent
	check(portal != null and is_instance_valid(portal.portal), "portal no chão")
	await _tree.create_timer(2.0).timeout
	portal.health.apply_damage(DamageInfo.new(999999.0, DamageInfo.Kind.WEAPON, _player))
	await _frames(3)
	var pedestal: PrizePedestal = null
	for node in _tree.root.find_children("*", "", true, false):
		if node is PrizePedestal and (node as PrizePedestal).weapon_path.ends_with("poseidon_trident.tres"):
			pedestal = node
	check(portal.destroyed and pedestal != null, "portal destruído deixa o Tridente de Poseidon")
	if pedestal:
		check(_hold(pedestal, PrizePedestal.HOLD_TIME) and _player.inventory.find(&"poseidon_trident") != null, "pegou o Tridente de Poseidon")
	events.stop()
	# Sangue dos Deuses: bênção de graça.
	check(events.trigger(&"blood_of_gods"), "Sangue dos Deuses começa")
	var altar := _tree.get_nodes_in_group(&"blessing_altars")[1] as BlessingAltar
	var points := _main.get_node("PointsManager") as PointsManager
	var total: int = points.points
	check(altar.is_free() and altar.interact(_player) and points.points == total, "no Sangue dos Deuses a bênção sai de graça")
	events.stop()
	check(not altar.is_free(), "acabou o evento, volta a custar")
	# Power-ups com visual grego.
	check(ResourceLoader.exists("res://assets/sprites/powerups/insta_kill_temple.png"), "Insta-kill com o símbolo de Ares no Templo")
	for node in _tree.get_nodes_in_group(&"zombies"):
		node.queue_free()
	await _frames(2)
