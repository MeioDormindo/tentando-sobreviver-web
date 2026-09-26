extends RefCounted
## Anti-travamento nos 3 mapas (Terminal, Hospital, Templo), com todas as portas abertas e as
## janelas sem tábuas:
## - início, spawns, pontos de boss e da Mystery Box no navmesh e livres;
## - nenhuma "fresta": tile de chão livre fora do navmesh (o jogador entra, os zumbis não);
## - de cada spawn existe caminho até o início;
## - zumbis de todos os spawns chegam perto do jogador sem ficar presos;
## - o jogador anda do início até cada área sem ficar preso;
## - o runtime tira de dentro de objetos, não derruba escombro no jogador e não perde rebake.
## Executados por run_tests.gd.

const MAPS := [["res://scenes/maps/terminal.tscn", "Terminal"], ["res://scenes/maps/hospital.tscn", "Hospital"], ["res://scenes/maps/temple.tscn", "Templo"]]
## Tolerâncias (m): distância ao navmesh de um ponto "no navmesh" e de um tile "coberto".
const ON_NAV := 0.3
const TILE_NAV := 0.7
const CHASE_TIME := 26.0

var _passed := 0
var _failed := 0
var _tree: SceneTree
var _nodes: Array[Node] = []


func run(tree: SceneTree) -> int:
	_tree = tree
	print("Anti-travamento (3 mapas)")
	for entry: Array in MAPS:
		await _map(entry[0], entry[1])
	await _runtime()
	print("\n%d ok, %d falharam (travamento)" % [_passed, _failed])
	return _failed


func check(condition: bool, description: String) -> void:
	if condition:
		_passed += 1
		print("  ok  ", description)
	else:
		_failed += 1
		printerr("  FALHOU  ", description)


func _add(node: Node) -> void:
	_tree.root.add_child(node)
	_nodes.append(node)


func _teardown() -> void:
	for node in _nodes:
		if is_instance_valid(node):
			node.queue_free()
	_nodes.clear()
	await _tree.physics_frame
	await _tree.physics_frame


## Espera a navegação terminar de assar (e os pedidos pendentes).
func _wait_nav(map: LayoutMap) -> void:
	for i in 400:
		await _tree.physics_frame
		if not map.nav_region.is_baking() and not map.has_pending_rebake():
			break
	for i in 4:
		await _tree.physics_frame


func _setup(path: String) -> Array:
	var map := (load(path) as PackedScene).instantiate() as LayoutMap
	_add(map)
	await _tree.physics_frame
	for node in map.nav_region.get_children():
		if node is Door:
			(node as Door).open()
	for node in map.find_children("*", "", true, false):
		if node is Barricade:
			while (node as Barricade).is_intact():
				(node as Barricade).take_hit(99)
	await _tree.create_timer(0.8).timeout
	await _wait_nav(map)
	var player := (load("res://scenes/player/player.tscn") as PackedScene).instantiate() as Player
	player.position = map.get_player_spawn()
	_add(player)
	player.controlled = false
	await _tree.physics_frame
	player.health.reset(999999.0)
	player.health.invulnerable = true
	return [map, player]


func _map(path: String, label: String) -> void:
	var setup: Array = await _setup(path)
	var map: LayoutMap = setup[0]
	var player: Player = setup[1]
	var world3d := player.get_world_3d()
	var nav := world3d.navigation_map
	var data := map.data
	var start := map.get_player_spawn()

	# 1. Pontos importantes: no navmesh e livres.
	var bad: Array[String] = []
	var points: Array = [["início", start, 0.35]]
	for sp: Dictionary in data.spawns:
		points.append(["spawn %s" % sp.id, Vector3(sp.x, 0, sp.z), 0.35])
	for bp: Dictionary in data.boss_spawns:
		points.append(["boss", Vector3(bp.x, 0, bp.z), 0.7])
	for p: Array in points:
		var at: Vector3 = p[1]
		if SpawnManager.off_navmesh(world3d, at, ON_NAV) or not SpawnManager.is_free(world3d, at, p[2]):
			bad.append("%s (%.1f, %.1f)%s" % [p[0], at.x, at.z, _blocker(world3d, at, p[2])])
	for bx: Dictionary in data.box_spots:
		if SpawnManager.off_navmesh(world3d, Vector3(bx.x, 0, bx.z), 1.6):
			bad.append("caixa (%.1f, %.1f)" % [bx.x, bx.z])
	check(bad.is_empty(), "%s: início, spawns, bosses e caixa no navmesh e livres%s" % [label, "" if bad.is_empty() else " — " + ", ".join(bad)])

	# 2. Frestas: tile de chão livre (cabe o jogador) fora do navmesh.
	var pinch: Array[String] = []
	for z in map.height:
		for x in map.width:
			var ch := map.cell(x, z)
			if not map._is_floor(ch):
				continue
			var at := Vector3(x + 0.5, 0.0, z + 0.5)
			if not SpawnManager.is_free(world3d, at, 0.3):
				continue
			if SpawnManager.off_navmesh(world3d, at, TILE_NAV):
				pinch.append("(%d, %d)%s" % [x, z, _blocker(world3d, at, 0.9)])
	check(pinch.is_empty(), "%s: nenhuma fresta sem navegação (%d%s)" % [label, pinch.size(), "" if pinch.is_empty() else ": " + ", ".join(pinch)])

	# 2b. O encaixe nunca usa o topo de parede ou de móvel (zumbi nascendo em cima do muro).
	var on_top := 0
	for z in range(0, map.height, 3):
		for x in range(0, map.width, 3):
			if map.cell(x, z) == "#":
				var p := SpawnManager.safe_point(world3d, Vector3(x + 0.5, 0.0, z + 0.5), 0.4)
				if p.y > SpawnManager.FLOOR_MAX_Y:
					on_top += 1
	check(on_top == 0, "%s: pontos de encaixe nunca em cima das paredes (%d)" % [label, on_top])
	var spawner := SpawnManager.new()
	spawner.world = map
	spawner.target = player
	var holder := Node3D.new()
	_add(holder)
	spawner.container = holder
	spawner.zombie_data = load("res://data/zombies/walker.tres")
	spawner.min_player_distance = 0.0
	_add(spawner)
	var wrong: Array[String] = []
	for i in 60:
		var zombie := spawner.spawn_zombie(1.0, 0.0, 0.0, 99)
		if zombie == null:
			continue
		var at := zombie.global_position
		if at.y > SpawnManager.FLOOR_MAX_Y or not map._is_floor(map.cell(floori(at.x), floori(at.z))):
			wrong.append("(%.1f, %.1f, %.1f)" % [at.x, at.y, at.z])
		zombie.queue_free()
	check(wrong.is_empty(), "%s: 60 spawns, todos no chão%s" % [label, "" if wrong.is_empty() else " — " + ", ".join(wrong)])
	holder.queue_free()
	spawner.queue_free()
	await _tree.physics_frame

	# 3. De cada spawn há caminho até o início.
	var no_path: Array[String] = []
	for sp: Dictionary in data.spawns:
		var from := NavigationServer3D.map_get_closest_point(nav, Vector3(sp.x, 0, sp.z))
		var route := NavigationServer3D.map_get_path(nav, from, start, true)
		if route.is_empty() or route[route.size() - 1].distance_to(Vector3(start.x, route[route.size() - 1].y, start.z)) > 1.0:
			no_path.append(String(sp.id))
	check(no_path.is_empty(), "%s: caminho de todos os spawns até o início%s" % [label, "" if no_path.is_empty() else " — sem: " + ", ".join(no_path)])

	# 4. Zumbis de todos os spawns chegam perto do jogador.
	var container := Node3D.new()
	_add(container)
	var runner := load("res://data/zombies/runner.tres") as ZombieData
	var zombies: Array[ZombieBase] = []
	for sp: Dictionary in data.spawns:
		var zombie := ZombieFactory.create(runner, player, 1.0, 0.0, 1.0)
		zombie.position = SpawnManager.safe_point(world3d, Vector3(sp.x, 0, sp.z), 0.4) + Vector3.UP * 0.05
		zombie.set_meta(&"spawn", String(sp.id))
		container.add_child(zombie)
		zombies.append(zombie)
	var arrived := {}
	var clock := 0.0
	while clock < CHASE_TIME and arrived.size() < zombies.size():
		await _tree.create_timer(0.5).timeout
		clock += 0.5
		for zombie in zombies:
			if is_instance_valid(zombie) and zombie.global_position.distance_to(player.global_position) < 5.0:
				arrived[zombie] = true
	var lost: Array[String] = []
	for zombie in zombies:
		# Preso = longe e sem avançar (quem está na fila atrás da horda em volta do jogador não conta).
		if not arrived.has(zombie) and zombie.stuck_time > 6.0 and zombie.global_position.distance_to(player.global_position) > 7.0:
			lost.append("%s em (%.1f, %.1f) a %.1f m, parado %.0f s%s" % [zombie.get_meta(&"spawn"), zombie.global_position.x, zombie.global_position.z, zombie.global_position.distance_to(player.global_position), zombie.stuck_time, _blocker(world3d, zombie.global_position, 0.8)])
	check(lost.is_empty(), "%s: zumbis de todos os spawns chegam ao jogador (%d/%d)%s" % [label, arrived.size(), zombies.size(), "" if lost.is_empty() else " — presos: " + ", ".join(lost)])
	container.queue_free()
	await _tree.physics_frame

	# 5. O jogador anda até cada área sem ficar preso.
	var stuck_at: Array[String] = []
	for area: Dictionary in data.areas:
		var r: Dictionary = area.rects[0]
		var goal := NavigationServer3D.map_get_closest_point(nav, Vector3(float(r.x) + float(r.w) * 0.5, 0, float(r.y) + float(r.h) * 0.5))
		if not await _walk(player, goal):
			stuck_at.append("%s (parou em %.1f, %.1f)" % [area.id, player.global_position.x, player.global_position.z])
	check(stuck_at.is_empty(), "%s: o jogador anda até todas as áreas sem ficar preso%s" % [label, "" if stuck_at.is_empty() else " — " + ", ".join(stuck_at)])
	await _teardown()


## O que está encostado num ponto (nomes dos corpos), para o relatório.
func _blocker(world3d: World3D, at: Vector3, radius: float) -> String:
	var shape := CapsuleShape3D.new()
	shape.radius = radius
	shape.height = 1.6
	var query := PhysicsShapeQueryParameters3D.new()
	query.shape = shape
	query.transform = Transform3D(Basis(), Vector3(at.x, 0.95, at.z))
	query.collision_mask = PhysicsLayers.WORLD | PhysicsLayers.PROPS
	var names: Array[String] = []
	for hit in world3d.direct_space_state.intersect_shape(query, 4):
		var body := hit.collider as Node
		if body:
			names.append(String(body.name) if body.get_parent() == null or String(body.get_parent().name).begins_with("Wall") == false else "parede")
	return "" if names.is_empty() else " [" + "/".join(names) + "]"


## Anda pelo caminho do navmesh até `goal`. False se ficar 2 s sem avançar.
func _walk(player: Player, goal: Vector3) -> bool:
	var nav := player.get_world_3d().navigation_map
	var route := NavigationServer3D.map_get_path(nav, player.global_position, goal, true)
	var index := 1
	var still := 0.0
	var last := player.global_position
	var elapsed := 0.0
	while index < route.size() and elapsed < 60.0:
		var target := route[index]
		var to := Vector2(target.x - player.global_position.x, target.z - player.global_position.z)
		if to.length() < 0.4:
			index += 1
			continue
		player.move_input = to.normalized()
		player.aim_point = Vector3(target.x, 1.0, target.z)
		await _tree.physics_frame
		var dt := player.get_physics_process_delta_time()
		elapsed += dt
		if player.global_position.distance_to(last) < 0.01:
			still += dt
			if still > 2.0:
				player.move_input = Vector2.ZERO
				return false
		else:
			still = 0.0
		last = player.global_position
	player.move_input = Vector2.ZERO
	return Vector2(player.global_position.x - goal.x, player.global_position.z - goal.z).length() < 1.5


## Runtime: tira de dentro de objeto, escombro não cai no jogador, rebake pendente é feito.
func _runtime() -> void:
	var setup: Array = await _setup("res://scenes/maps/temple.tscn")
	var map: LayoutMap = setup[0]
	var player: Player = setup[1]
	var world3d := player.get_world_3d()
	var statue := _tree.get_nodes_in_group(&"god_statues")[0] as Node3D
	var inside := statue.global_position
	var out := SpawnManager.safe_point(world3d, inside, 0.4)
	check(out.distance_to(inside) > 0.4 and SpawnManager.is_free(world3d, out, 0.4), "ponto dentro de uma estátua vai para um lugar livre")
	# Zumbi posto dentro da estátua: o SpawnManager tira de lá.
	var spawner := SpawnManager.new()
	spawner.world = map
	spawner.target = player
	var container := Node3D.new()
	_add(container)
	spawner.container = container
	spawner.zombie_data = load("res://data/zombies/walker.tres")
	_add(spawner)
	var zombie := ZombieFactory.create(spawner.zombie_data, player, 1.0, 0.0, 0.0)
	zombie.position = inside + Vector3.UP * 0.05
	container.add_child(zombie)
	await _tree.physics_frame
	zombie.stuck_time = SpawnManager.STUCK_NEAR_TIME + 1.0
	await _tree.create_timer(1.3).timeout
	check(SpawnManager.is_free(world3d, zombie.global_position, 0.3), "zumbi preso dentro de objeto é tirado de lá")
	# Escombros do Minotauro: nunca em cima do jogador.
	var cfg := {"count": 1, "radius": 1.0, "telegraph_time": 0.05, "damage": 0, "spread": 0.0, "rubble_time": 2.0}
	BossAttacks.area(_tree, player.global_position, cfg, false, player)
	await _tree.create_timer(0.3).timeout
	var on_player := _tree.get_nodes_in_group(&"boss_rubble").filter(func(r: Node) -> bool: return (r as Node3D).global_position.distance_to(player.global_position) < BossAttacks.RUBBLE_CLEAR)
	check(on_player.is_empty(), "escombro não cai em cima do jogador")
	# Jogador dentro de uma estátua: desenrosca ao tentar andar.
	player.global_position = inside + Vector3.UP * 0.05
	player.move_input = Vector2(1, 0)
	await _tree.create_timer(Player.UNSTUCK_TIME + 0.6).timeout
	player.move_input = Vector2.ZERO
	check(SpawnManager.is_free(world3d, player.global_position, 0.3), "jogador preso num objeto é solto ao tentar andar")
	# Dois pedidos de navegação seguidos: o segundo não se perde.
	map.rebake_navigation()
	map.rebake_navigation()
	check(map.has_pending_rebake(), "pedido de navegação durante outro fica na fila")
	await _wait_nav(map)
	check(not map.has_pending_rebake(), "o pedido da fila é feito")
	await _teardown()
