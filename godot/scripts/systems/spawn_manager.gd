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


## Jogador de referência para nascer: no cooperativo, um de pé ao acaso (a horda se divide entre
## o time); no solo, o alvo de sempre.
func anchor_player() -> CharacterBase:
	if Players.coop():
		var someone := Players.random_standing()
		if someone:
			return someone
	return target


## Quem o zumbi nascido em `spot` persegue primeiro: no cooperativo, o de pé mais perto.
func target_for(spot: Vector3) -> CharacterBase:
	if Players.coop():
		var someone := Players.nearest(spot)
		if someone:
			return someone
	return target


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
	var anchor := anchor_player()
	# No cooperativo, longe de todos os de pé (não só do jogador de referência).
	var others: Array[Vector3] = []
	if Players.coop():
		for someone in Players.standing():
			others.append(someone.global_position)
	var index := pick_spawn_index(points, anchor.global_position, min_player_distance, others)
	if index < 0:
		return null
	var zombie := ZombieFactory.create(type_data(type), target_for(points[index]), health_mult, damage_mult, speed_mult)
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


## Cria um zumbi do tipo num ponto (invocação do boss, sarcófago, portal), com os multiplicadores
## do round. Perto do ponto pedido, só em chão de área aberta; sem lugar ali, nasce no ponto de
## spawn ativo mais perto. Null só se não houver nenhum.
func spawn_at(type: StringName, at: Vector3) -> ZombieBase:
	var data := type_data(type)
	var found: Variant = spot_near(at, data.body_radius if data else 0.4)
	if found == null:
		return null
	var spot: Vector3 = found
	var zombie := ZombieFactory.create(data, target_for(spot), round_multipliers[0], round_multipliers[1], round_multipliers[2])
	if zombie == null:
		return null
	zombie.position = container.to_local(spot + Vector3.UP * 0.1)
	container.add_child(zombie)
	return zombie


## Um inimigo pode surgir aqui? (chão de área aberta; sem mapa, sempre).
func is_spawnable(spot: Vector3) -> bool:
	return world == null or world.is_spawnable(spot)


## Ponto para nascer perto de `at`: no navmesh, no chão (não em cima de móvel), livre e numa área
## aberta, em anéis até 6 m (um ponto de isolamento do lado de fora da janela ainda acha o chão da
## sala). Sem nenhum, o ponto de spawn ativo mais perto; null sem nenhum.
func spot_near(at: Vector3, radius := 0.4) -> Variant:
	var world3d := target.get_world_3d()
	var nav_map := world3d.navigation_map
	var has_nav := NavigationServer3D.map_get_iteration_id(nav_map) > 0
	for ring: float in [0.0, 0.8, 1.6, 2.4, 3.2, 4.0, 5.0, 6.0]:
		var steps := 1 if ring == 0.0 else (8 if ring < 4.0 else 12)
		for k in steps:
			var candidate := at + Vector3(cos(k * TAU / steps), 0.0, sin(k * TAU / steps)) * ring
			var spot := NavigationServer3D.map_get_closest_point(nav_map, candidate) if has_nav else candidate
			if spot.y > FLOOR_MAX_Y or Vector2(spot.x - candidate.x, spot.z - candidate.z).length() > 1.0:
				continue
			if is_spawnable(spot) and is_free(world3d, spot, radius):
				return Vector3(spot.x, maxf(spot.y, 0.0), spot.z)
	var nearest: Variant = _nearest_spawn_point(at)
	return safe_point(world3d, nearest, radius) if nearest is Vector3 else null


## O ponto de spawn ativo mais perto de `at` (ou null).
func _nearest_spawn_point(at: Vector3) -> Variant:
	if world == null:
		return null
	var best: Variant = null
	for point in world.active_spawn_points(int(round_multipliers[3])):
		if best == null or point.distance_to(at) < (best as Vector3).distance_to(at):
			best = point
	return best


## Cria um zumbi a uma distância aleatória do jogador, num ponto alcançável da navegação,
## com um raio caindo (rodada dos cães). Só em chão de área aberta; sem lugar em volta (corredor
## estreito), nasce num ponto de spawn como os zumbis. Devolve null se não achar lugar nenhum.
func spawn_near_player(type: StringName, min_distance: float, max_distance: float, health_mult: float, damage_mult: float, speed_mult: float) -> ZombieBase:
	var anchor := anchor_player()
	var nav_map := anchor.get_world_3d().navigation_map
	for attempt in 24:
		var angle := randf() * TAU
		var candidate := anchor.global_position + Vector3(cos(angle), 0.0, sin(angle)) * randf_range(min_distance, max_distance)
		var spot := NavigationServer3D.map_get_closest_point(nav_map, candidate)
		var distance := spot.distance_to(anchor.global_position)
		if spot.y > FLOOR_MAX_Y or spot.distance_to(candidate) > 1.5 or distance < min_distance * 0.8 or not is_spawnable(spot):
			continue
		var zombie := ZombieFactory.create(type_data(type), target_for(spot), health_mult, damage_mult, speed_mult)
		if zombie == null:
			return null
		zombie.position = container.to_local(spot + Vector3.UP * 0.1)
		container.add_child(zombie)
		SpecialFire.flash(get_tree(), spot, 2.0, Color(0.55, 0.75, 1.0))
		if Net.world and Net.is_host():
			Net.world.on_flash(spot, 2.0, Color(0.55, 0.75, 1.0))
		return zombie
	if world == null:
		return null
	return spawn_zombie(health_mult, damage_mult, speed_mult, int(round_multipliers[3]), type)


## Zumbis presos: longe do jogador (parede no caminho, canto sem saída) vão para um ponto de
## spawn ativo; perto dele, se estiverem fora do navmesh (numa fresta ou dentro de um objeto),
## voltam para o ponto livre mais próximo. Assim ninguém fica entalado e o round sempre termina.
const STUCK_NEAR_TIME := 6.0
## Colidindo com parede/objeto sem progresso por tanto tempo seguido: vale um empurrão local
## pequeno mesmo perto do jogador (a fila da horda ao seu redor não aciona isto, porque ela vai
## progredindo aos poucos à medida que os da frente morrem).
const WALL_JAM_TIME := 5.0

func _relocate_stuck() -> void:
	if world == null or target == null:
		return
	var world3d := target.get_world_3d()
	for child in container.get_children():
		var zombie := child as ZombieBase
		if zombie == null or not zombie.is_alive():
			continue
		if (zombie.stuck_time >= STUCK_NEAR_TIME and off_navmesh(world3d, zombie.global_position)) or zombie.wall_jam_time >= WALL_JAM_TIME:
			# Empurrão local, mas nunca para o outro lado de uma parede, numa área fechada.
			var nudge := safe_point(world3d, zombie.global_position, zombie.data.body_radius)
			if is_spawnable(nudge) or world.area_of(nudge) == world.area_of(zombie.global_position):
				zombie.global_position = nudge + Vector3.UP * 0.05
				zombie.reset_stuck()
				continue
			var back: Variant = _nearest_spawn_point(zombie.global_position)
			if back is Vector3:
				zombie.global_position = safe_point(world3d, back, zombie.data.body_radius) + Vector3.UP * 0.05
			zombie.reset_stuck()
			continue
		if zombie.stuck_time < stuck_timeout:
			continue
		var chased: Node3D = zombie.target if is_instance_valid(zombie.target) else target
		if zombie.global_position.distance_to(chased.global_position) < stuck_min_distance:
			continue
		var points := world.active_spawn_points(99)
		var index := pick_spawn_index(points, chased.global_position, min_player_distance)
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
## Móveis com colisão (banco, caixa, armário) têm 0.9m (`PROP_HEIGHT`, layout_map.gd) — o 1.0
## antigo deixava o topo deles passar como chão válido. O bake do navmesh quantiza a altura do
## chão de verdade (Templo assa a 0.5m, Terminal/Hospital mais perto de 0) — 0.65 cobre os três
## com folga e ainda fica bem abaixo do topo de um móvel.
const FLOOR_MAX_Y := 0.65


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


## Escolhe um ponto (função pura): um dos que estão a pelo menos `min_distance` do jogador (e
## de cada um de `others`, os colegas), ao acaso; se nenhum estiver, o mais longe do mais
## perto deles. -1 se a lista estiver vazia.
static func pick_spawn_index(points: Array[Vector3], player_position: Vector3, min_distance: float, others: Array[Vector3] = []) -> int:
	if points.is_empty():
		return -1
	var far: Array[int] = []
	var farthest := 0
	var best := -1.0
	for i in points.size():
		var distance := points[i].distance_to(player_position)
		for other in others:
			distance = minf(distance, points[i].distance_to(other))
		if distance >= min_distance:
			far.append(i)
		if distance > best:
			best = distance
			farthest = i
	return far.pick_random() if not far.is_empty() else farthest
