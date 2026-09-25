class_name GameWorld
extends Node3D
## Base de todo mapa jogável: onde o jogador começa, quais pontos de spawn estão ativos e
## quais áreas estão abertas. Os sistemas (GameManager, SpawnManager, portas) só conhecem
## esta interface, não o tipo de mapa.

var _open_areas: Dictionary = {}


func get_player_spawn() -> Vector3:
	return Vector3.ZERO


## Onde o boss pode surgir (o BossManager usa o mais longe do jogador).
func boss_spawn_points() -> Array[Vector3]:
	return [get_player_spawn() + Vector3(0, 0, -12)]


## Id do mapa (composição de zumbis, armas da Mystery Box). Vazio = genérico.
func map_id() -> String:
	return ""


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


## Tamanho da grade do minimapa em tiles (zero = mapa sem minimapa).
func minimap_size() -> Vector2i:
	return Vector2i.ZERO


## Grade do minimapa: um código por tile (0 nada, 1 área aberta, 2 fechada, 3 porta, 4 trem,
## 5 janela), linha a linha.
func minimap_cells() -> PackedByteArray:
	return PackedByteArray()


## Ponto bom para um evento (chão livre em volta, área aberta).
func is_open_floor(_point: Vector3) -> bool:
	return true


## Tipo de piso no ponto (som dos passos): terminal, concrete, metal, tracks, tunnel, wagon...
func surface_at(_point: Vector3) -> String:
	return "concrete"


## Rotação (em y) para um objeto encostado na parede olhar para o chão livre.
func facing_toward_open(_point: Vector3) -> float:
	return 0.0


## Estação de trem (faixa dos trilhos, trecho, semáforos...) ou {} se o mapa não tiver.
func station() -> Dictionary:
	return {}


## Visual dos eventos do mapa (Apagão, Alarme, Lua de Sangue, Neblina).
func set_event_mood(_id: StringName, _on: bool, _config: Dictionary) -> void:
	pass


## Recalcula a navegação (ex.: porta aberta).
func rebake_navigation() -> void:
	pass
