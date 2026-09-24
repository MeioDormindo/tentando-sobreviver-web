class_name Breaker
extends StaticBody3D
## Disjuntor principal (como no jogo web): segurar E por alguns segundos liga a energia.

const SIZE := Vector3(1.0, 1.8, 0.5)

var power: PowerSystem
var interaction_radius: float = 1.8

var _progress := 0.0
var _label: Label3D


func setup(p_power: PowerSystem) -> void:
	power = p_power
	name = "Breaker"
	collision_layer = PhysicsLayers.WORLD
	collision_mask = 0
	var shape := BoxShape3D.new()
	shape.size = SIZE
	var collision := CollisionShape3D.new()
	collision.shape = shape
	collision.position.y = SIZE.y * 0.5
	add_child(collision)
	var box := BoxMesh.new()
	box.size = SIZE
	var material := StandardMaterial3D.new()
	material.albedo_color = Color(0.35, 0.37, 0.33)
	box.material = material
	var mesh := MeshInstance3D.new()
	mesh.mesh = box
	mesh.position.y = SIZE.y * 0.5
	add_child(mesh)
	_label = Label3D.new()
	_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	_label.pixel_size = 0.005
	_label.font_size = 48
	_label.outline_size = 10
	_label.modulate = Color(1.0, 0.83, 0.35)
	_label.text = "DISJUNTOR"
	_label.position.y = SIZE.y + 0.4
	add_child(_label)
	add_to_group(&"interactable")


func get_interaction_prompt(_player: Node3D) -> String:
	if power.is_on:
		return ""
	return "[SEGURE E] LIGAR A ENERGIA  (%d%%)" % roundi(_progress / power.data.breaker_hold_time * 100.0)


func interact(_player: Node3D) -> bool:
	return false


func hold_interact(_player: Node3D, delta: float) -> bool:
	if power.is_on:
		return false
	_progress += delta
	if _progress < power.data.breaker_hold_time:
		return false
	power.turn_on()
	_label.text = "ENERGIA LIGADA"
	remove_from_group(&"interactable")
	return true
