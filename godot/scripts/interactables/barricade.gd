class_name Barricade
extends StaticBody3D
## Barricada de janela (como no jogo web): tábuas que os zumbis arrancam vindo de fora e o
## jogador repõe segurando E (+pontos por tábua; levar dano interrompe). Sempre bloqueia o
## jogador; bloqueia os zumbis só enquanto tem tábuas. A navegação passa pela janela.

signal planks_changed(planks: int, maximum: int)

const HEIGHT := 2.2
const PLANK_COLOR := Color(0.52, 0.38, 0.22)

var data: BarricadeData
var window_id: StringName
var planks: int = 0
## Direção (no plano) que aponta para dentro da área protegida.
var inside_direction: Vector3 = Vector3.FORWARD
var interaction_radius: float = 1.9

var _repair_progress := 0.0
var _plank_meshes: Array[MeshInstance3D] = []


func setup(p_id: StringName, size: Vector2, p_inside: Vector3, p_data: BarricadeData) -> void:
	window_id = p_id
	name = String(p_id)
	data = p_data
	inside_direction = p_inside.normalized()
	planks = data.max_planks
	var shape := BoxShape3D.new()
	shape.size = Vector3(size.x, HEIGHT, size.y)
	var collision := CollisionShape3D.new()
	collision.shape = shape
	collision.position.y = HEIGHT * 0.5
	add_child(collision)
	# Tábuas: faixas ao longo da janela, uma ao lado da outra na espessura da parede.
	var along_x := size.x > size.y
	var length := maxf(size.x, size.y) + 0.2
	# Tábua em pixel art (arte do jogo web); sem ela, cor lisa.
	var material := StandardMaterial3D.new()
	material.albedo_color = PLANK_COLOR
	if ResourceLoader.exists("res://assets/web/map/plank.png"):
		material.albedo_color = Color.WHITE
		material.albedo_texture = load("res://assets/web/map/plank.png")
		material.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	for i in data.max_planks:
		var mesh := BoxMesh.new()
		mesh.size = Vector3(length, 0.08, 0.14) if along_x else Vector3(0.14, 0.08, length)
		var plank := MeshInstance3D.new()
		plank.mesh = mesh
		plank.material_override = material
		var offset := lerpf(-0.4, 0.4, float(i) / maxf(1.0, data.max_planks - 1.0))
		plank.position = Vector3(0.0, 1.0 + i * 0.12, offset) if along_x else Vector3(offset, 1.0 + i * 0.12, 0.0)
		plank.rotation.y = deg_to_rad(8.0 if i % 2 == 0 else -8.0)
		add_child(plank)
		_plank_meshes.append(plank)
	add_to_group(&"interactable")
	add_to_group(&"barricades")
	_update()


func is_intact() -> bool:
	return planks > 0


## Posição do lado de fora (de onde os zumbis vêm)?
func is_outside(point: Vector3) -> bool:
	var offset := point - global_position
	offset.y = 0.0
	return offset.dot(inside_direction) < 0.0


## Um zumbi arrancou tábuas.
func take_hit(amount: int) -> void:
	if planks <= 0:
		return
	planks = maxi(0, planks - amount)
	if amount > 0:
		Audio.play_at("wood_break", global_position, "world", 0.9)
	_update()


func get_interaction_prompt(_player: Node3D) -> String:
	if planks >= data.max_planks:
		return ""
	return "[SEGURE E] CONSERTAR BARRICADA  ·  +%d por tábua" % data.repair_reward


func get_interaction_progress(_player: Node3D) -> float:
	if planks >= data.max_planks:
		return -1.0
	return _repair_progress / data.repair_time


func interact(_player: Node3D) -> bool:
	return false


## Segurando E: repõe uma tábua a cada `repair_time`. Devolve true quando repõe.
func hold_interact(player: Node3D, delta: float) -> bool:
	if planks >= data.max_planks:
		return false
	if player.has_method(&"hurt_within") and player.call(&"hurt_within", data.repair_interrupt):
		_repair_progress = 0.0
		return false
	_repair_progress += delta
	if _repair_progress < data.repair_time:
		return false
	_repair_progress = 0.0
	planks += 1
	Audio.play_at("hammer", global_position, "world", 0.9)
	_update()
	var points := get_tree().get_first_node_in_group(&"points_manager") as PointsManager
	if points:
		points.add(data.repair_reward)
	return true


func _update() -> void:
	for i in _plank_meshes.size():
		_plank_meshes[i].visible = i < planks
	# Sem tábuas, os zumbis passam; o jogador nunca.
	collision_layer = PhysicsLayers.PLAYER_ONLY | (PhysicsLayers.BARRICADES if planks > 0 else 0)
	collision_mask = 0
	planks_changed.emit(planks, data.max_planks)
