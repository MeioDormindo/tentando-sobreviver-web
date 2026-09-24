class_name SpawnManager
extends Node
## Onde e o que nasce (seção 18): pede ao mapa os pontos de spawn ativos (área aberta e
## round mínimo), escolhe um longe o bastante do jogador, cria o zumbi pela ZombieFactory e o
## coloca em `container`. Quantos e quando é decisão do RoundManager.

@export var zombie_data: ZombieData
## Mapa (dá os pontos de spawn ativos).
@export var world: GameWorld
## Onde os zumbis ficam na árvore.
@export var container: Node3D
## Quem os zumbis perseguem.
@export var target: CharacterBase
## Distância mínima (m) entre o ponto de spawn e o jogador.
@export var min_player_distance: float = 8.0


## Zumbis vivos agora.
func alive_count() -> int:
	var count := 0
	for child in container.get_children():
		if child is ZombieBase and (child as ZombieBase).is_alive():
			count += 1
	return count


## Cria um zumbi com os multiplicadores do round; devolve null se não houver onde nascer.
func spawn_zombie(health_mult: float, damage_mult: float, speed_mult: float, round_number: int = 1) -> ZombieBase:
	var points := world.active_spawn_points(round_number)
	var index := pick_spawn_index(points, target.global_position, min_player_distance)
	if index < 0:
		return null
	var zombie := ZombieFactory.create(zombie_data, target, health_mult, damage_mult, speed_mult)
	if zombie == null:
		return null
	# Posição definida antes de entrar na cena: se o zumbi nascesse na origem por um passo de
	# física, a colisão o empurraria para fora de onde estivesse sobreposto.
	# Pequeno desvio para não empilhar zumbis no mesmo ponto.
	var spot := points[index] + Vector3(randf_range(-0.6, 0.6), 0.0, randf_range(-0.6, 0.6))
	zombie.position = container.to_local(spot)
	container.add_child(zombie)
	return zombie


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
