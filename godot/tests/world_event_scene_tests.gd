extends RefCounted
## Testes de cena dos eventos do mapa, painéis, armadilhas e segredos (main.tscn, Terminal).
## O sorteio automático fica desligado (chance 0) para os eventos não aparecerem sozinhos;
## cada evento é disparado e conferido. Executados por run_tests.gd.

var _passed := 0
var _failed := 0
var _tree: SceneTree
var _main: Node
var _player: Player
var _system: WorldEventSystem
var _rounds: RoundManager
var _points: PointsManager
var _world: LayoutMap


func run(tree: SceneTree) -> int:
	_tree = tree
	# Nunca no save do jogador: sem o save de teste do run_tests, usa um só desta suíte.
	if not String(Save.get("_path")).contains("test"):
		Save.load_from("user://test_save.json")
	print("Eventos do mapa, painéis e segredos (cena)")
	_main = (load("res://scenes/main.tscn") as PackedScene).instantiate()
	tree.root.add_child(_main)
	_player = _main.get_node("Player") as Player
	_player.controlled = false
	_system = _main.get_node("WorldEventSystem") as WorldEventSystem
	_rounds = _main.get_node("RoundManager") as RoundManager
	_points = _main.get_node("PointsManager") as PointsManager
	_world = _main.get_node("World") as LayoutMap
	# Sem sorteio automático: só os eventos que o teste dispara.
	_system.data = _system.data.duplicate(true)
	_system.data.schedule["chance_per_wave"] = 0.0
	_system.data.configs[&"train"]["chance_per_wave"] = 0.0
	_system.data.configs[&"train"]["second_pass_chance"] = 0.0
	await _tree.create_timer(0.4).timeout
	_player.health.reset(5000.0)
	_rounds.stop()

	check(_system.events.size() == 15, "10 eventos do jogo web + 5 do Templo registrados")
	var base := WorldEventData.shared()
	check(float(base.schedule.chance_per_wave) >= 0.9 and float(base.config(&"train").chance_per_wave) >= 0.95 and float(base.config(&"train").second_pass_chance) >= 0.8,
		"eventos mais frequentes e o trem quase todo round")
	check([&"zeus_wrath", &"rise_of_dead", &"artemis_hunt", &"underworld_portal", &"blood_of_gods"].all(func(id: StringName) -> bool: return not _system.events[id].can_start()), "eventos do Templo não acontecem fora dele")
	await _horde()
	await _blackout_and_panel()
	await _alarm_and_panel()
	await _blood_moon_and_fog()
	await _collapse()
	await _gas_leak()
	await _supply_drop()
	await _golden_zombie()
	await _train()
	await _trap()
	await _secrets()
	await _lighting()

	ZombieBase.event_speed = 1.0
	_main.queue_free()
	await tree.physics_frame
	print("\n%d ok, %d falharam (eventos)" % [_passed, _failed])
	return _failed


func check(condition: bool, description: String) -> void:
	if condition:
		_passed += 1
		print("  ok  ", description)
	else:
		_failed += 1
		printerr("  FALHOU  ", description)


## Espera `count` quadros de física completos (o sinal vem antes do _physics_process dos nós).
func _frames(count: int) -> void:
	for i in count + 1:
		await _tree.physics_frame


func _clear_zombies() -> void:
	for zombie in _system.live_zombies():
		zombie.queue_free()
	await _tree.physics_frame


func _horde() -> void:
	_rounds.start_round(5)
	var base := _rounds.total
	check(_system.trigger(&"horde"), "Horda começa")
	check(_rounds.total == base + roundi(base * 0.6), "Horda: +60%% de zumbis no round (%d → %d)" % [base, _rounds.total])
	check(_rounds._max_alive() > _rounds.data.max_alive(5) and _rounds._spawn_interval() < _rounds.data.spawn_interval(5), "Horda: mais vivos ao mesmo tempo e spawn mais rápido")
	var state := [{}]
	Events.world_event_state.connect(func(s: Dictionary) -> void: state[0] = s, CONNECT_ONE_SHOT)
	await _frames(2)
	check(String(state[0].get("name", "")) == "HORDA", "indicador da HUD: %s" % state[0].get("name", "(nada)"))
	Events.round_completed.emit(5)
	check(_system.active_id() == &"" and _rounds.spawn_modifiers.is_empty(), "Horda acaba com o round")
	_rounds.stop()
	await _clear_zombies()


func _panel(panel_name: String) -> Node:
	return _world.find_child(panel_name, true, false)


## Segura E no painel pelo tempo pedido (em passos de física).
func _hold(target: Node, seconds: float) -> bool:
	var done := false
	var left := seconds
	while left > 0.0 and not done:
		done = target.call(&"hold_interact", _player, 1.0 / 30.0)
		left -= 1.0 / 30.0
	return done


func _blackout_and_panel() -> void:
	var power := _tree.get_first_node_in_group(&"power_system") as PowerSystem
	check(not _system.trigger(&"blackout"), "sem energia não há Apagão")
	power.turn_on()
	var env := _world._environment()
	var energy := env.ambient_light_energy
	check(_system.trigger(&"blackout"), "Apagão começa com a energia ligada")
	check(power.blackout and env.ambient_light_energy < energy, "Apagão: luzes apagam e fica mais escuro")
	var panel := _panel("PowerPanel") as EventSwitch
	check(panel != null, "painel de energia no mapa")
	if panel == null:
		return
	_points.add(5000, false)
	var before := _points.points
	check(_hold(panel, panel.hold_time + 0.2), "segurar E no painel religa a energia")
	check(_system.active_id() == &"" and not power.blackout and _points.points == before - panel.price, "Apagão acaba e cobra %d" % panel.price)
	check(is_equal_approx(env.ambient_light_energy, energy), "a luz ambiente volta")


func _alarm_and_panel() -> void:
	check(_system.trigger(&"emergency_alarm"), "Alarme começa")
	check(_rounds.spawn_modifiers.has(&"emergency_alarm"), "Alarme acelera o spawn")
	var panel := _panel("AlarmPanel") as EventSwitch
	check(panel != null and _hold(panel, panel.hold_time + 0.2) and _system.active_id() == &"", "painel do alarme desliga a sirene")
	check(not _rounds.spawn_modifiers.has(&"emergency_alarm"), "spawn volta ao normal")


func _blood_moon_and_fog() -> void:
	check(_system.trigger(&"blood_moon"), "Lua de Sangue começa")
	check(ZombieBase.event_speed > 1.0 and _points.add(100) == 200, "Lua de Sangue: zumbis mais rápidos e dinheiro em dobro")
	_system.stop()
	check(ZombieBase.event_speed == 1.0 and _points.add(100) == 100, "fim da Lua de Sangue volta ao normal")
	var env := _world._environment()
	check(_system.trigger(&"fog") and env.fog_enabled, "Neblina: névoa no mapa")
	_system.stop()
	check(not env.fog_enabled, "fim da Neblina tira a névoa")


func _collapse() -> void:
	var event := _system.events[&"collapse"] as CollapseEvent
	var chance: float = event.config.aim_at_player_chance
	event.config["aim_at_player_chance"] = 1.0
	var before := _player.health.current
	check(_system.trigger(&"collapse"), "Desabamento começa")
	await _tree.create_timer(2.2).timeout
	check(_player.health.current < before, "pedaço do teto cai no jogador (-%.0f)" % (before - _player.health.current))
	_system.stop()
	event.config["aim_at_player_chance"] = chance


func _gas_leak() -> void:
	check(_system.trigger(&"gas_leak"), "Vazamento de gás começa")
	var event := _system.events[&"gas_leak"] as GasLeakEvent
	_player.global_position = event.center + Vector3(0.5, 0.1, 0.0)
	var before := _player.health.current
	await _tree.create_timer(float(event.config.warning_time) + 0.6).timeout
	check(_player.health.current < before, "o gás fere quem está na nuvem (-%.0f)" % (before - _player.health.current))
	check(_hold(event.valve, event.valve.hold_time + 0.1), "segurar E fecha a válvula")
	await _frames(2)
	check(_system.active_id() == &"", "válvula fechada acaba com o gás")


func _supply_drop() -> void:
	check(_system.trigger(&"supply_drop"), "Suprimentos: a caixa cai")
	var event := _system.events[&"supply_drop"] as SupplyDropEvent
	await _tree.create_timer(float(event.config.fall_time) + 0.3).timeout
	var crate := event.crate
	check(crate != null and crate.landed and crate.is_in_group(&"minimap_supply"), "caixa pousou (e aparece no minimapa)")
	if crate == null:
		return
	_player.armor = 0.0
	_player.weapon.magazine = 0
	var before := _points.points
	await _tree.create_timer(0.6).timeout
	check(_hold(crate, crate.hold_time + 0.1), "segurar E abre a caixa")
	check(_player.armor == _player.data.max_armor and _player.weapon.magazine > 0 and _points.points == before + 750, "munição cheia, armadura e +750")
	await _frames(2)
	check(_system.active_id() == &"", "caixa aberta encerra o evento")


func _golden_zombie() -> void:
	_rounds.start_round(3)
	_rounds.stop()
	_rounds.phase = RoundManager.Phase.ACTIVE
	var total := _rounds.total
	check(_system.trigger(&"golden_zombie"), "Zumbi Dourado aparece")
	var event := _system.events[&"golden_zombie"] as GoldenZombieEvent
	var zombie := event.zombie
	check(zombie != null and _rounds.total == total + 1, "o Zumbi Dourado conta no round")
	await _tree.create_timer(1.0).timeout
	check(zombie.flee_goal is Vector3, "ele foge para um esconderijo")
	check(zombie.model != null and zombie.model.sheet_name == "zombie_golden", "todo em ouro (folha zombie_golden)")
	var feed := _main.get_node("MinimapFeed") as MinimapFeed
	check(feed != null and feed.build_state().golden is Vector2, "marca própria no minimapa")
	var before := _points.points
	zombie.take_damage(DamageInfo.new(zombie.health.current + 1.0, DamageInfo.Kind.WEAPON, _player, false, zombie.global_position))
	await _frames(2)
	var golden := _tree.root.find_children("PowerUp_golden*", "", true, false)
	check(_points.points >= before + 1000 and not golden.is_empty(), "abatido: +1000 e Golden Drop")
	check(_system.active_id() == &"", "o evento acaba")
	_rounds.stop()
	for drop in golden:
		drop.queue_free()


func _train() -> void:
	check(not _system.call_train(), "sem a Plataforma aberta o trem não vem")
	_world.open_area(&"platform")
	var station := _world.station()
	var lane_z := float(station.lane.y) + float(station.lane.h) * 0.5
	var board := _world.find_child("StationBoard", true, false) as StationBoard
	check(board != null, "estação: túneis, semáforos e painel de horários")
	check(_system.call_train(), "o trem é chamado")
	check(String(_system.train_status().state) == "warning", "aviso antes de o trem passar")
	# Um zumbi e o jogador na faixa dos trilhos.
	var spawn := _main.get_node("SpawnManager") as SpawnManager
	var zombie := ZombieFactory.create(spawn.type_data(&"walker"), _player, 1.0, 1.0, 0.0)
	zombie.position = spawn.container.to_local(Vector3(64.0, 0.1, lane_z))
	spawn.container.add_child(zombie)
	_player.global_position = Vector3(40.0, 0.1, lane_z)
	_player.armor = 0.0
	var hits: Array[float] = []
	var on_hit := func(info: DamageInfo, _current: float) -> void:
		if info.kind == DamageInfo.Kind.ENVIRONMENT:
			hits.append(info.amount)
	_player.health.damaged.connect(on_hit)
	var run_over := [0]
	Events.train_run_over.connect(func(count: int) -> void: run_over[0] = count, CONNECT_ONE_SHOT)
	await _tree.create_timer(5.0).timeout
	check(String(_system.train_status().state) == "passing", "o trem passa")
	await _tree.create_timer(3.5).timeout
	check(not zombie.is_alive() if is_instance_valid(zombie) else true, "zumbi na faixa atropelado")
	check(hits.size() == 1 and is_equal_approx(hits[0], 70.0), "jogador na faixa leva o golpe do trem uma vez (%s)" % str(hits))
	_player.health.damaged.disconnect(on_hit)
	check(run_over[0] >= 1 and String(_system.train_status().state) == "none", "trem foi embora (%d atropelado)" % run_over[0])
	var panel := _panel("TrainPanel") as TrainPanel
	_points.add(5000, false)
	var points_before := _points.points
	check(panel != null and panel.interact(_player) and _points.points == points_before - panel.price, "painel do trem chama o trem pagando")
	check(not panel.interact(_player), "painel do trem recarrega depois de usar")
	await _tree.create_timer(0.1).timeout


func _trap() -> void:
	var trap := _world.find_children("*", "", true, false).filter(func(n: Node) -> bool: return n is ElectricTrap)
	check(trap.size() == 2, "2 armadilhas elétricas no Terminal")
	if trap.is_empty():
		return
	var electric := trap[0] as ElectricTrap
	var spawn := _main.get_node("SpawnManager") as SpawnManager
	var zombie := ZombieFactory.create(spawn.type_data(&"walker"), _player, 3.0, 1.0, 0.0)
	var center := electric.zone.get_center()
	zombie.position = spawn.container.to_local(Vector3(center.x, 0.1, center.y))
	spawn.container.add_child(zombie)
	await _tree.physics_frame
	electric.activate()
	await _tree.create_timer(0.4).timeout
	check(not is_instance_valid(zombie) or not zombie.is_alive(), "armadilha ligada mata o zumbi na grade")
	check(electric.get_interaction_prompt(_player).begins_with("ARMADILHA ELÉTRICA LIGADA"), "aviso: %s" % electric.get_interaction_prompt(_player))


## Luz por área (Fase 5): a luz ambiente segue a área do jogador; a lanterna liga/desliga.
func _lighting() -> void:
	var env := (_world.get_node("WorldEnvironment") as WorldEnvironment).environment
	var changes: Array[String] = []
	var on_change := func(lighting: String) -> void: changes.append(lighting)
	Events.lighting_changed.connect(on_change)
	_world.open_area(&"tech")
	var hall_at := _world.get_player_spawn()
	_player.global_position = hall_at
	await _tree.create_timer(2.5).timeout
	var lit_energy := env.ambient_light_energy
	check(_world.lighting == "lit", "Hall: bem iluminado (%s)" % _world.lighting)
	var tech: Dictionary = _world.data.areas.filter(func(a: Dictionary) -> bool: return a.id == "tech")[0]
	var r: Dictionary = tech.rects[0]
	_player.global_position = Vector3(float(r.x) + 2.5, 0.1, float(r.y) + 1.5)
	await _tree.create_timer(2.5).timeout
	check(_world.lighting == "dark" and changes.has("dark"), "Área Técnica: escura, com aviso da mudança")
	check(env.ambient_light_energy < lit_energy * 0.5, "no escuro a luz ambiente cai (%.2f → %.2f)" % [lit_energy, env.ambient_light_energy])
	Events.lighting_changed.disconnect(on_change)
	var flashlight := _player.get_node("Pivot/Flashlight") as SpotLight3D
	var toggled: Array[bool] = []
	var on_toggle := func(on: bool) -> void: toggled.append(on)
	Events.flashlight_toggled.connect(on_toggle)
	_player.toggle_flashlight()
	check(not _player.flashlight_on and not flashlight.visible and toggled == [false], "lanterna desliga (F)")
	_player.toggle_flashlight()
	check(_player.flashlight_on and flashlight.visible and toggled == [false, true], "lanterna liga de novo")
	Events.flashlight_toggled.disconnect(on_toggle)
	check(InputMap.has_action(&"flashlight"), "ação da lanterna no mapa de controles")
	_player.global_position = hall_at


func _secrets() -> void:
	var teddies := _tree.get_nodes_in_group(&"teddies")
	check(teddies.size() == 3, "3 ursinhos escondidos no Terminal")
	var found := [0]
	Events.teddy_found.connect(func(n: int, _t: int) -> void: found[0] = n)
	for teddy: Teddy in teddies:
		teddy.interact(_player)
	await _tree.physics_frame
	check(found[0] == 3 and Save.has_achievement("teddies") and bool(Save.data.secrets.get("teddies", false)), "todos os ursinhos: conquista e segredo salvo (no save de teste)")
	var toasts: Array[String] = []
	Events.toast.connect(func(text: String) -> void: toasts.append(text))
	var radio := _world.find_child("Radio", true, false) as LoreRadio
	check(radio != null and _hold(radio, radio.hold_time + 0.1) and not toasts.is_empty(), "rádio conta a história: %s" % (toasts[0].left(40) if not toasts.is_empty() else ""))
	var credits := _world.find_child("CreditsSign", true, false) as CreditsSign
	check(credits != null and credits.interact(_player) and toasts.back().contains("Godot"), "placa de créditos")
