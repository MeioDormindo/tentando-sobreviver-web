class_name MapPanel
extends StaticBody3D
## Base dos painéis de parede do mapa (como no jogo web): corpo sólido, nome em cima e acesso
## aos eventos do mapa e aos pontos. As subclasses dizem o texto e o que acontece com E.

const SIZE := Vector3(0.9, 1.5, 0.45)

var interaction_radius: float = 1.6
var events_data: WorldEventData

var _label: Label3D
var _material: StandardMaterial3D


func build(title: String, color: Color) -> void:
	events_data = WorldEventData.shared()
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
	_material = StandardMaterial3D.new()
	_material.albedo_color = Color(0.3, 0.31, 0.29)
	_material.emission_enabled = true
	_material.emission = color * 0.35
	box.material = _material
	var mesh := MeshInstance3D.new()
	mesh.mesh = box
	mesh.position.y = SIZE.y * 0.5
	add_child(mesh)
	_label = Label3D.new()
	_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	_label.pixel_size = 0.004
	_label.font_size = 40
	_label.outline_size = 8
	_label.modulate = color.lightened(0.2)
	_label.text = title
	_label.position.y = SIZE.y + 0.35
	add_child(_label)
	add_to_group(&"interactable")


func world_events() -> WorldEventSystem:
	return get_tree().get_first_node_in_group(&"world_events") as WorldEventSystem


func points() -> PointsManager:
	return get_tree().get_first_node_in_group(&"points_manager") as PointsManager


## Cobra do jogador; avisa a HUD se não der.
func pay(amount: int) -> bool:
	var manager := points()
	if manager and manager.spend(amount):
		return true
	Events.purchase_denied.emit()
	return false


func interact(_player: Node3D) -> bool:
	return false


static func progress_bar(progress: float) -> String:
	return "  (%d%%)" % roundi(clampf(progress, 0.0, 1.0) * 100.0) if progress > 0.0 else ""
