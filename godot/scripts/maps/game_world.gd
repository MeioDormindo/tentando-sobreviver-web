class_name GameWorld
extends Node3D
## Base de todo mapa jogável: onde o jogador começa, quais pontos de spawn estão ativos e
## quais áreas estão abertas. Os sistemas (GameManager, SpawnManager, portas) só conhecem
## esta interface, não o tipo de mapa.

var _open_areas: Dictionary = {}


func get_player_spawn() -> Vector3:
	return Vector3.ZERO


## Pontos de spawn que valem neste round (área aberta e round mínimo atingido).
func active_spawn_points(_round_number: int) -> Array[Vector3]:
	var points: Array[Vector3] = []
	for node in get_tree().get_nodes_in_group(&"zombie_spawn"):
		if node is Node3D and is_ancestor_of(node):
			points.append((node as Node3D).global_position)
	return points


func is_area_open(area_id: StringName) -> bool:
	return _open_areas.has(area_id)


## Abre a área (porta comprada). Devolve true se era novidade.
func open_area(area_id: StringName) -> bool:
	if _open_areas.has(area_id):
		return false
	_open_areas[area_id] = true
	Events.area_opened.emit(area_id, area_display_name(area_id))
	return true


## Área que contém o ponto (vazio se nenhuma).
func area_of(_point: Vector3) -> StringName:
	return &""


func area_display_name(area_id: StringName) -> String:
	return String(area_id)


## Recalcula a navegação (ex.: porta aberta).
func rebake_navigation() -> void:
	pass
