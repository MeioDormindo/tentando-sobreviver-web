class_name MinimapFeed
extends Node
## Alimenta o minimapa da HUD (como no jogo web): envia a grade do mapa (de novo quando uma
## área abre) e, a cada 0,15s, as posições do jogador, zumbis, boss, Mystery Box e do que
## estiver nos grupos "minimap_supply" (suprimentos) e "minimap_objective" (objetivo atual).
## Posições no plano do mapa: Vector2(x, z), em metros (1 tile = 1 m).

const STATE_EVERY := 0.15

@export var world: GameWorld
@export var player: Player

var _next := 0.0


func _ready() -> void:
	Events.area_opened.connect(func(_id: StringName, _n: String) -> void: send_base())
	send_base.call_deferred()


func _process(delta: float) -> void:
	_next -= delta
	if _next > 0.0 or player == null:
		return
	_next = STATE_EVERY
	Events.minimap_state.emit(build_state())


func send_base() -> void:
	if world:
		var grid := world.minimap_size()
		Events.minimap_base.emit(grid.x, grid.y, world.minimap_cells())


func build_state() -> Dictionary:
	var zombies := PackedVector2Array()
	var boss: Variant = null
	for node in get_tree().get_nodes_in_group(&"zombies"):
		var zombie := node as CharacterBase
		if zombie == null or not zombie.is_alive():
			continue
		if zombie is Boss:
			boss = _flat(zombie.global_position)
		else:
			zombies.append(_flat(zombie.global_position))
	var boxes := PackedVector2Array()
	for node in get_tree().get_nodes_in_group(&"mystery_box"):
		var box := node as Node3D
		if box.visible and not box.is_queued_for_deletion():
			boxes.append(_flat(box.global_position))
	var aim := player.aim_point - player.global_position
	return {
		"player": _flat(player.global_position),
		"facing": atan2(aim.z, aim.x) if aim.length_squared() > 0.01 else -PI / 2.0,
		"zombies": zombies,
		"boss": boss,
		"boxes": boxes,
		"supply": _first(&"minimap_supply"),
		"objective": _first(&"minimap_objective"),
	}


func _first(group: StringName) -> Variant:
	var node := get_tree().get_first_node_in_group(group) as Node3D
	return _flat(node.global_position) if node else null


static func _flat(p: Vector3) -> Vector2:
	return Vector2(p.x, p.z)
