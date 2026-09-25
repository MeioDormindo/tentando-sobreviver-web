extends RefCounted
## Testes de cena da missão do Soro (main.tscn no Hospital): as 5 etapas de ponta a ponta —
## energia, componentes (geladeira, cadeado no tiro, cartão do Blindado, gaveta), defesa da
## centrífuga, Paciente Zero enfurecido e aplicar o soro — e o prêmio. Executados por
## run_tests.gd (save de teste).

var _passed := 0
var _failed := 0
var _tree: SceneTree
var _main: Node
var _player: Player
var _quest: SerumQuest
var _rounds: RoundManager
var _state: Dictionary = {}


func run(tree: SceneTree) -> int:
	_tree = tree
	# Nunca no save do jogador: sem o save de teste do run_tests, usa um só desta suíte.
	if not String(Save.get("_path")).contains("test"):
		Save.load_from("user://test_save.json")
	print("Missão do Soro (cena, Hospital)")
	var previous_map := Session.map_id
	Session.map_id = "map2"
	Events.quest_state.connect(_on_state)
	_main = (load("res://scenes/main.tscn") as PackedScene).instantiate()
	tree.root.add_child(_main)
	_player = _main.get_node("Player") as Player
	_player.controlled = false
	_quest = _main.get_node("SerumQuest") as SerumQuest
	_rounds = _main.get_node("RoundManager") as RoundManager
	var events := _main.get_node("WorldEventSystem") as WorldEventSystem
	events.data = events.data.duplicate(true)
	events.data.schedule["chance_per_wave"] = 0.0
	await _tree.create_timer(0.5).timeout
	_player.health.reset(99999.0)
	_rounds.stop()

	await _power()
	await _components()
	await _centrifuge()
	await _boss_and_serum()

	Events.quest_state.disconnect(_on_state)
	_main.queue_free()
	Session.map_id = previous_map
	await tree.physics_frame
	print("\n%d ok, %d falharam (missão)" % [_passed, _failed])
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
	var left := seconds
	while left > 0.0 and not done:
		done = target.call(&"hold_interact", _player, 1.0 / 30.0)
		left -= 1.0 / 30.0
	return done


func _spot(spot_name: String) -> QuestSpot:
	for node in _tree.get_nodes_in_group(&"quest_spots"):
		if node.name == spot_name and not node.is_queued_for_deletion():
			return node as QuestSpot
	return null


func _power() -> void:
	check(_quest.is_physics_processing() and _quest.index == 0, "missão ativa no Hospital, etapa 1")
	check(String(_state.get("objective", "")).begins_with("Ligue a energia"), "objetivo: %s" % _state.get("objective", ""))
	check(_quest.current_target() is Vector3 and not _tree.get_nodes_in_group(&"minimap_objective").is_empty(), "disjuntor marcado no minimapa")
	var world := _main.get_node("World")
	check((_main.get_node("MinimapFeed") as MinimapFeed).world == world and (_main.get_node("WorldEventSystem") as WorldEventSystem).world == world,
		"minimapa e eventos usam o mapa escolhido no menu (Hospital)")
	check((_main.get_node("MinimapFeed") as MinimapFeed).build_state().get("objective") is Vector2, "objetivo da missão no estado do minimapa")
	(_tree.get_first_node_in_group(&"power_system") as PowerSystem).turn_on()
	await _frames(2)
	check(_quest.index == 1 and int(_state.get("step", 0)) == 2, "energia ligada: etapa 2 (componentes)")


func _components() -> void:
	var fridge := _spot("SampleFridge")
	check(fridge != null and _hold(fridge, fridge.hold_time + 0.1) and _quest.got.fridge, "segurar E na geladeira: amostras")
	var cabinet := _spot("MedCabinet")
	check(cabinet != null and not cabinet.available() and cabinet.get_interaction_prompt(_player).contains("ATIRE NO CADEADO"), "armário trancado")
	# Um tiro de verdade no cadeado (raio da arma).
	var lock_at := _quest.lock.global_position
	var space := _player.get_world_3d().direct_space_state
	_player.weapon.shoot(space, lock_at + Vector3(0, 0, 2.0), lock_at, [_player.get_rid()], _player)
	await _frames(2)
	check(_quest.lock == null and cabinet.available(), "o tiro abre o cadeado")
	check(cabinet.interact(_player) and _quest.got.cabinet, "pegar o reagente")
	var drawer := _spot("MorgueDrawer")
	check(drawer != null and not drawer.available(), "gaveta trancada sem o cartão")
	# O Blindado com o cartão surge sozinho; ao morrer, deixa o cartão.
	var waited := 0.0
	while _quest.armored == null and waited < 6.0:
		await _tree.create_timer(0.25).timeout
		waited += 0.25
	var armored := _quest.armored
	check(armored != null and armored.data.id == &"armored", "um Blindado com o cartão de acesso aparece")
	if armored == null:
		return
	armored.take_damage(DamageInfo.new(armored.health.current + 999.0, DamageInfo.Kind.WEAPON, _player, false, armored.global_position))
	await _frames(3)
	var card := _spot("Keycard")
	check(card != null, "o Blindado deixa o cartão onde morreu")
	check(card != null and card.interact(_player) and _quest.has_card and drawer.available(), "pegar o cartão libera a gaveta")
	check(drawer.interact(_player), "abrir a gaveta: catalisador")
	await _frames(2)
	check(_quest.index == 2 and String(_state.get("objective", "")).contains("centrífuga"), "3/3 componentes: etapa 3 (%s)" % _state.get("objective", ""))


func _centrifuge() -> void:
	var spot: QuestSpot = null
	for node in _tree.get_nodes_in_group(&"quest_spots"):
		if (node as QuestSpot).label.begins_with("COLOCAR"):
			spot = node
	check(spot != null and spot.interact(_player) and _quest.centrifuge_running, "componentes na centrífuga: começa a girar")
	check(_rounds.spawn_modifiers.has(&"serum"), "mais zumbis durante a defesa")
	await _tree.create_timer(0.5).timeout
	check(_quest.centrifuge_progress > 0.3, "sem zumbis perto o tempo corre (%.1fs)" % _quest.centrifuge_progress)
	# Um zumbi encostado na centrífuga pausa o tempo.
	var spawn := _main.get_node("SpawnManager") as SpawnManager
	var at := _quest._at(_quest.cfg.centrifuge)
	var zombie := ZombieFactory.create(spawn.type_data(&"walker"), _player, 1.0, 1.0, 0.0)
	zombie.position = spawn.container.to_local(at + Vector3(0.8, 0.1, 0.0))
	spawn.container.add_child(zombie)
	await _frames(3)
	var paused_at := _quest.centrifuge_progress
	await _tree.create_timer(0.5).timeout
	check(_quest.under_attack and is_equal_approx(_quest.centrifuge_progress, paused_at), "zumbi perto: CENTRÍFUGA SOB ATAQUE, o tempo para")
	zombie.queue_free()
	_quest.centrifuge_progress = float(_quest.cfg.centrifuge.defend_time) - 0.1
	await _tree.create_timer(0.4).timeout
	check(_quest.index == 3 and not _rounds.spawn_modifiers.has(&"serum"), "soro pronto: etapa 4 (boss)")


func _boss_and_serum() -> void:
	check(_quest.boss_round == _rounds.round_number + 1 and not _rounds.forced_boss.is_empty(), "o próximo round é do Paciente Zero enfurecido (round %d)" % _quest.boss_round)
	_rounds.start_round(_quest.boss_round)
	check(_rounds.is_boss_round and not _rounds.is_hound_round, "round de boss forçado")
	var bosses := _main.get_node("BossManager") as BossManager
	var waited := 0.0
	while not is_instance_valid(bosses.boss) and waited < 6.0:
		await _tree.create_timer(0.25).timeout
		waited += 0.25
	var boss := bosses.boss
	check(boss != null and boss.data.id == &"patient_zero", "o Paciente Zero aparece")
	if boss == null:
		return
	check(boss.health.max_health > boss.data.max_health * 1.4, "enfurecido: vida x1,5 (%.0f)" % boss.health.max_health)
	# O rugido de entrada deixa o boss invulnerável: espera ele começar a perseguir.
	waited = 0.0
	while boss.is_invulnerable() and waited < 8.0:
		await _tree.create_timer(0.25).timeout
		waited += 0.25
	boss.take_damage(DamageInfo.new(boss.health.current + 1.0, DamageInfo.Kind.WEAPON, _player, false, boss.global_position))
	waited = 0.0
	while _quest.index < 4 and waited < 8.0:
		await _tree.create_timer(0.25).timeout
		waited += 0.25
	check(_quest.index == 4 and _quest.boss_down is Vector3, "boss derrotado: etapa 5 (aplicar o soro)")
	var vial := _spot("SerumVial")
	var completed := [""]
	Events.quest_completed.connect(func(id: StringName, _t: String, _s: String) -> void: completed[0] = String(id), CONNECT_ONE_SHOT)
	check(vial != null and _hold(vial, vial.hold_time + 0.1), "segurar E aplica o soro")
	await _frames(2)
	check(_quest.done and completed[0] == "serum" and _state.is_empty(), "missão concluída")
	check(_player.perks.owned.size() >= 7 and _player.inventory.owns(&"wind_cannon"), "prêmio: todos os perks e o Canhão de Vento")
	check(Save.has_achievement("serum"), "conquista O Soro (no save de teste)")
