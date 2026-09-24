extends RefCounted
## Testes de cena dos bosses nos mapas migrados: round de boss, fases, ataques, invocação,
## recompensa e fim do round. Executados por run_tests.gd.

var _passed := 0
var _failed := 0
var _tree: SceneTree
var _nodes: Array[Node] = []
var _player: Player
var _rounds: RoundManager
var _bosses: BossManager
var _points: PointsManager
var _container: Node3D


func run(tree: SceneTree) -> int:
	_tree = tree
	print("Bosses (cena)")
	await _conductor()
	await _patient_zero()
	print("\n%d ok, %d falharam (bosses)" % [_passed, _failed])
	return _failed


func check(condition: bool, description: String) -> void:
	if condition:
		_passed += 1
		print("  ok  ", description)
	else:
		_failed += 1
		printerr("  FALHOU  ", description)


func _conductor() -> void:
	var map := await _setup("res://scenes/maps/terminal.tscn")
	var incoming := [""]
	Events.boss_incoming.connect(func(n: String) -> void: incoming[0] = n, CONNECT_ONE_SHOT)
	_rounds.start_round(10)
	check(_rounds.is_boss_round and _rounds.total == 11, "round 10: boss com escolta reduzida (%d zumbis)" % _rounds.total)
	check(incoming[0] == "The Conductor", "aviso: The Conductor se aproxima")
	await _tree.create_timer(3.6).timeout
	var boss := _bosses.boss
	check(is_instance_valid(boss) and boss.mode == Boss.Mode.ROAR, "o boss surge rugindo")
	var hp := boss.health.current
	boss.take_damage(DamageInfo.new(500.0, DamageInfo.Kind.WEAPON, _player))
	check(boss.health.current == hp, "invulnerável durante o rugido")
	await _tree.create_timer(1.3).timeout
	# Longe e com linha de visão: prepara a investida.
	_player.global_position = boss.global_position + Vector3(0, 0, 10)
	var modes := await _watch(boss, 2.0)
	check(modes.has(Boss.Mode.CHARGE_WINDUP) or modes.has(Boss.Mode.CHARGING), "investida quando o jogador está a média distância")
	await _wait_chase(boss)
	boss.take_damage(DamageInfo.new(boss.health.max_health * 0.3, DamageInfo.Kind.WEAPON, _player))
	check(boss.phase == 2 and boss.mode == Boss.Mode.ROAR, "fase 2 aos 75% da vida, com rugido")
	await _wait_chase(boss)
	_player.global_position = boss.global_position + Vector3(4.0, 0, 0)
	var hurt_before := _player.health.current
	await _tree.create_timer(1.6).timeout
	check(_player.health.current < hurt_before, "onda de choque na fase 2 fere o jogador por perto")
	var summoned := [0]
	Events.zombies_summoned.connect(func(c: int) -> void: summoned[0] += c)
	var total_before := _rounds.total
	await _wait_chase(boss)
	boss.take_damage(DamageInfo.new(boss.health.max_health * 0.25, DamageInfo.Kind.WEAPON, _player))
	await _tree.create_timer(2.5).timeout
	check(boss.phase == 3 and summoned[0] > 0, "fase 3: invoca zumbis (%d)" % summoned[0])
	check(_rounds.total == total_before + summoned[0], "invocados entram na contagem do round")
	var points_before := _points.points
	await _wait_chase(boss)
	boss.take_damage(DamageInfo.new(boss.health.current + 10.0, DamageInfo.Kind.WEAPON, _player))
	await _tree.create_timer(0.3).timeout
	check(not boss.is_alive() and _points.points >= points_before + 2000, "derrotado: +2000 pontos")
	check(_rounds.phase == RoundManager.Phase.ACTIVE, "o round continua enquanto houver escolta viva")
	for i in 40:
		for z in _container.get_children():
			if z is ZombieBase and (z as ZombieBase).is_alive():
				(z as ZombieBase).take_damage(DamageInfo.new(99999.0, DamageInfo.Kind.WEAPON, _player))
		if _rounds.phase != RoundManager.Phase.ACTIVE:
			break
		await _tree.create_timer(0.5).timeout
	check(_rounds.phase == RoundManager.Phase.INTERMISSION, "boss e escolta abatidos: fim do round")
	await _teardown()


func _patient_zero() -> void:
	await _setup("res://scenes/maps/hospital.tscn")
	_rounds.start_round(10)
	await _tree.create_timer(3.6).timeout
	var boss := _bosses.boss
	check(is_instance_valid(boss) and boss.data.id == &"patient_zero", "Hospital: o boss é o Paciente Zero")
	await _wait_chase(boss)
	_player.global_position = boss.global_position + Vector3(0, 0, 5.0)
	await _tree.create_timer(2.0).timeout
	check(_tree.get_nodes_in_group(&"hazards").size() > 0, "vômito ácido deixa poças")
	await _wait_chase(boss)
	boss.take_damage(DamageInfo.new(boss.health.max_health * 0.3, DamageInfo.Kind.WEAPON, _player))
	await _wait_chase(boss)
	_player.global_position = boss.global_position + Vector3(0, 0, 9.0)
	var slowed := false
	for i in 30:
		await _tree.create_timer(0.1).timeout
		if _player._clock < _player._slow_until:
			slowed = true
			break
	check(slowed, "grito (fase 2) deixa o jogador lento")
	await _teardown()


## Monta mapa, jogador, zumbis, spawn, pontos, boss e rounds (como a cena principal).
func _setup(map_path: String) -> LayoutMap:
	var map := (load(map_path) as PackedScene).instantiate() as LayoutMap
	_add(map)
	_player = (load("res://scenes/player/player.tscn") as PackedScene).instantiate() as Player
	_player.position = map.get_player_spawn()
	_add(_player)
	_player.controlled = false
	_container = Node3D.new()
	_add(_container)
	var spawner := SpawnManager.new()
	spawner.world = map
	spawner.container = _container
	spawner.target = _player
	spawner.zombie_data = load("res://data/zombies/walker.tres")
	_add(spawner)
	_points = PointsManager.new()
	_points.data = load("res://data/configs/points.tres")
	_add(_points)
	_bosses = BossManager.new()
	_bosses.spawn_manager = spawner
	_add(_bosses)
	_rounds = RoundManager.new()
	_rounds.data = load("res://data/configs/rounds.tres")
	_rounds.spawn_manager = spawner
	_rounds.boss_manager = _bosses
	_add(_rounds)
	await _tree.create_timer(0.3).timeout
	_player.health.reset(99999.0)
	return map


func _add(node: Node) -> void:
	_tree.root.add_child(node)
	_nodes.append(node)


func _teardown() -> void:
	for node in _nodes:
		if is_instance_valid(node):
			node.queue_free()
	_nodes.clear()
	for node in _tree.get_nodes_in_group(&"hazards"):
		node.queue_free()
	await _tree.physics_frame
	await _tree.physics_frame


## Modos pelos quais o boss passou durante `seconds`.
func _watch(boss: Boss, seconds: float) -> Dictionary:
	var modes := {}
	var t := 0.0
	while t < seconds and is_instance_valid(boss):
		modes[boss.mode] = true
		await _tree.physics_frame
		t += 1.0 / 60.0
	return modes


## Espera o boss voltar a perseguir (fim de rugido, ataque, atordoamento).
func _wait_chase(boss: Boss) -> void:
	for i in 300:
		if not is_instance_valid(boss) or boss.mode == Boss.Mode.CHASE:
			return
		await _tree.physics_frame
