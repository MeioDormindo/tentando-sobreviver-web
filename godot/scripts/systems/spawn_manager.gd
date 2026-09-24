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
	zombie.position = container.to_local(spot)
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
		if spot.distance_to(candidate) > 1.5 or distance < min_distance * 0.8:
			continue
		var zombie := ZombieFactory.create(type_data(type), target, health_mult, damage_mult, speed_mult)
		if zombie == null:
			return null
		zombie.position = container.to_local(spot + Vector3.UP * 0.1)
		container.add_child(zombie)
		SpecialFire.flash(get_tree(), spot, 2.0, Color(0.55, 0.75, 1.0))
		return zombie
	return null


## Leva para um ponto de spawn ativo os zumbis presos longe do jogador (a parede no caminho,
## um canto sem saída): assim o round sempre termina.
func _relocate_stuck() -> void:
	if world == null or target == null:
		return
	for child in container.get_children():
		var zombie := child as ZombieBase
		if zombie == null or not zombie.is_alive() or zombie.stuck_time < stuck_timeout:
			continue
		if zombie.global_position.distance_to(target.global_position) < stuck_min_distance:
			continue
		var points := world.active_spawn_points(99)
		var index := pick_spawn_index(points, target.global_position, min_player_distance)
		if index >= 0:
			zombie.global_position = points[index]
			zombie.reset_stuck()


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
