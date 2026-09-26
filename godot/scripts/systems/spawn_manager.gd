class_name SpawnManager
extends Node
## Onde e o que nasce (seção 18): pede ao mapa os pontos de spawn ativos (área aberta e
## round mínimo), escolhe um longe o bastante do jogador, cria o zumbi pela ZombieFactory e o
## coloca em `container`. Quantos e quando é decisão do RoundManager.

## Tipo padrão (quando o round não pede outro).
@export var zombie_data: ZombieData
## Pasta dos ZombieData (tipos pelo id: walker, runner, tank...).
@export_dir var zombies_dir: String = "res://data/zombies"
## Zumbi sem se aproximar do jogador por este tempo e longe dele é realocado (s, m).
@export var stuck_timeout: float = 12.0
@export var stuck_min_distance: float = 12.0
## Mapa (dá os pontos de spawn ativos).
@export var world: GameWorld
## Onde os zumbis ficam na árvore.
@export var container: Node3D
## Quem os zumbis perseguem.
@export var target: CharacterBase
## Distância mínima (m) entre o ponto de spawn e o jogador.
@export var min_player_distance: float = 8.0


var _types: Dictionary = {}
## Multiplicadores do round atual [vida, dano, velocidade, round] (zumbis invocados pelo boss).
var round_multipliers: Array = [1.0, 1.0, 1.0, 1]
var _stuck_check := 0.0


func _physics_process(delta: float) -> void:
	_stuck_check -= delta
	if _stuck_check <= 0.0:
		_stuck_check = 1.0
		_relocate_stuck()


## Dados de um tipo de zumbi pelo id (carregados uma vez).
func type_data(id: StringName) -> ZombieData:
	if id == &"" or (zombie_data and id == zombie_data.id):
		return zombie_data
	if not _types.has(id):
		var path := "%s/%s.tres" % [zombies_dir, id]
		_types[id] = load(path) if ResourceLoader.exists(path) else zombie_data
	return _types[id]


## Vivos por tipo (para os limites da composição).
func alive_by_type() -> Dictionary:
	var counts := {}
	for child in container.get_children():
		var zombie := child as ZombieBase
		if zombie and zombie.is_alive():
			counts[zombie.data.id] = int(counts.get(zombie.data.id, 0)) + 1
	return counts


## Zumbis vivos agora.
func alive_count() -> int:
	var count := 0
	for child in container.get_children():
		if child is ZombieBase and (child as ZombieBase).is_alive():
			count += 1
	return count


## Cria um zumbi com os multiplicadores do round; devolve null se não houver onde nascer.
func spawn_zombie(health_mult: float, damage_mult: float, speed_mult: float, round_number: int = 1, type: StringName = &"") -> ZombieBase:
	var points := world.active_spawn_points(round_number)
	var index := pick_spawn_index(points, target.global_position, min_player_distance)
	if index < 0:
		return null
	var zombie := ZombieFactory.create(type_data(type), target, health_mult, damage_mult, speed_mult)
	if zombie == null:
		return null
	# Posição definida antes de entrar na cena: se o zumbi nascesse na origem por um passo de
	# física, a colisão o empurraria para fora de onde estivesse sobreposto.
	# Pequeno desvio para não empilhar zumbis no mesmo ponto.
	var spot := points[index] + Vector3(randf_range(-0.6, 0.6), 0.0, randf_range(-0.6, 0.6))
	# Nunca dentro de parede, objeto ou estátua: encaixa num ponto livre do navmesh.
	spot = safe_point(target.get_world_3d(), spot, zombie.data.body_radius)
	zombie.position = container.to_local(spot)
	container.add_child(zombie)
	return zombie


## Cria um zumbi do tipo num ponto (invocação do boss), com os multiplicadores do round.
func spawn_at(type: StringName, at: Vector3) -> ZombieBase:
	var nav_map := target.get_world_3d().navigation_map
	var spot := NavigationServer3D.map_get_closest_point(nav_map, at)
	if spot.y > FLOOR_MAX_Y or Vector2(spot.x - at.x, spot.z - at.z).length() > 2.5:
		spot = safe_point(target.get_world_3d(), at, 0.4)
		if Vector2(spot.x - at.x, spot.z - at.z).length() > 3.5:
			return null
	var zombie := ZombieFactory.create(type_data(type), target, round_multipliers[0], round_multipliers[1], round_multipliers[2])
	if zombie == null:
		return null
	zombie.position = container.to_local(spot + Vector3.UP * 0.1)
	container.add_child(zombie)
	return zombie


## Cria um zumbi a uma distância aleatória do jogador, num ponto alcançável da navegação,
## com um raio caindo (rodada dos cães). Devolve null se não achar lugar.
func spawn_near_player(type: StringName, min_distance: float, max_distance: float, health_mult: float, damage_mult: float, speed_mult: float) -> ZombieBase:
	var nav_map := target.get_world_3d().navigation_map
	for attempt in 12:
		var angle := randf() * TAU
		var candidate := target.global_position + Vector3(cos(angle), 0.0, sin(angle)) * randf_range(min_distance, max_distance)
		var spot := NavigationServer3D.map_get_closest_point(nav_map, candidate)
		var distance := spot.distance_to(target.global_position)
		if spot.y > FLOOR_MAX_Y or spot.distance_to(candidate) > 1.5 or distance < min_distance * 0.8:
			continue
		var zombie := ZombieFactory.create(type_data(type), target, health_mult, damage_mult, speed_mult)
		if zombie == null:
			return null
		zombie.position = container.to_local(spot + Vector3.UP * 0.1)
		container.add_child(zombie)
		SpecialFire.flash(get_tree(), spot, 2.0, Color(0.55, 0.75, 1.0))
		return zombie
	return null


## Zumbis presos: longe do jogador (parede no caminho, canto sem saída) vão para um ponto de
## spawn ativo; perto dele, se estiverem fora do navmesh (numa fresta ou dentro de um objeto),
## voltam para o ponto livre mais próximo. Assim ninguém fica entalado e o round sempre termina.
const STUCK_NEAR_TIME := 6.0

func _relocate_stuck() -> void:
	if world == null or target == null:
		return
	var world3d := target.get_world_3d()
	for child in container.get_children():
		var zombie := child as ZombieBase
		if zombie == null or not zombie.is_alive():
			continue
		if zombie.stuck_time >= STUCK_NEAR_TIME and off_navmesh(world3d, zombie.global_position):
			zombie.global_position = safe_point(world3d, zombie.global_position, zombie.data.body_radius) + Vector3.UP * 0.05
			zombie.reset_stuck()
			continue
		if zombie.stuck_time < stuck_timeout:
			continue
		if zombie.global_position.distance_to(target.global_position) < stuck_min_distance:
			continue
		var points := world.active_spawn_points(99)
		var index := pick_spawn_index(points, target.global_position, min_player_distance)
		if index >= 0:
			zombie.global_position = safe_point(world3d, points[index], zombie.data.body_radius) + Vector3.UP * 0.05
			zombie.reset_stuck()


## Ponto livre perto de `at`: no navmesh e sem parede/objeto sobreposto a uma cápsula de raio
## `radius`. Procura em anéis em volta; sem navmesh ainda, devolve `at` se estiver livre.
static func safe_point(world3d: World3D, at: Vector3, radius := 0.4) -> Vector3:
	var nav_map := world3d.navigation_map
	var has_nav := NavigationServer3D.map_get_iteration_id(nav_map) > 0
	for ring: float in [0.0, 0.8, 1.6, 2.4, 3.2]:
		var steps := 1 if ring == 0.0 else 8
		for k in steps:
			var candidate := at + Vector3(cos(k * TAU / steps), 0.0, sin(k * TAU / steps)) * ring
			var spot := candidate
			if has_nav:
				spot = NavigationServer3D.map_get_closest_point(nav_map, candidate)
				# Só no chão (nunca em cima de parede ou móvel).
				if spot.y > FLOOR_MAX_Y or spot.distance_to(Vector3(candidate.x, spot.y, candidate.z)) > 1.0:
					continue
			if is_free(world3d, spot, radius):
				return Vector3(spot.x, maxf(spot.y, 0.0), spot.z)
	var fallback := NavigationServer3D.map_get_closest_point(nav_map, at) if has_nav else at
	return fallback if fallback.y <= FLOOR_MAX_Y else Vector3(at.x, 0.0, at.z)


## Altura máxima de um ponto de navegação "no chão" (acima disso é topo de parede ou móvel).
const FLOOR_MAX_Y := 1.0


## Uma cápsula de raio `radius` em `at` não encosta em parede nem objeto (WORLD|PROPS)?
static func is_free(world3d: World3D, at: Vector3, radius := 0.4) -> bool:
	var shape := CapsuleShape3D.new()
	shape.radius = radius
	shape.height = 1.6
	var query := PhysicsShapeQueryParameters3D.new()
	query.shape = shape
	query.transform = Transform3D(Basis(), Vector3(at.x, 0.95, at.z))
	# Parede, móvel, janela e tábuas: ninguém nasce dentro delas.
	query.collision_mask = PhysicsLayers.WORLD | PhysicsLayers.PROPS | PhysicsLayers.PLAYER_ONLY | PhysicsLayers.BARRICADES
	return world3d.direct_space_state.intersect_shape(query, 1).is_empty()


## Longe do navmesh (numa fresta ou dentro de algo)?
static func off_navmesh(world3d: World3D, at: Vector3, tolerance := 0.45) -> bool:
	var nav_map := world3d.navigation_map
	if NavigationServer3D.map_get_iteration_id(nav_map) == 0:
		return false
	var spot := NavigationServer3D.map_get_closest_point(nav_map, at)
	return spot.y > FLOOR_MAX_Y or Vector2(spot.x - at.x, spot.z - at.z).length() > tolerance


## Escolhe um ponto (função pura): um dos que estão a pelo menos `min_distance` do jogador,
## ao acaso; se nenhum estiver, o mais longe. -1 se a lista estiver vazia.
static func pick_spawn_index(points: Array[Vector3], player_position: Vector3, min_distance: float) -> int:
	if points.is_empty():
		return -1
	var far: Array[int] = []
	var farthest := 0
	for i in points.size():
		var distance := points[i].distance_to(player_position)
		if distance >= min_distance:
			far.append(i)
		if distance > points[farthest].distance_to(player_position):
			farthest = i
	return far.pick_random() if not far.is_empty() else farthest
