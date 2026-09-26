class_name MapPanel
extends StaticBody3D
## Base dos painéis de parede do mapa (como no jogo web): corpo sólido, nome em cima e acesso
## aos eventos do mapa e aos pontos. As subclasses dizem o texto e o que acontece com E.

const SIZE := Vector3(0.9, 1.5, 0.45)

var interaction_radius: float = 1.6
var events_data: WorldEventData

var _label: Label3D
var _led: Node3D
var _blink := 0.0
var _material: StandardMaterial3D


## art: objeto do kit de cenário (PropFactory), ex.: "panel_alarm"; sem ele, caixa lisa.
func build(title: String, color: Color, art := "") -> void:
	events_data = WorldEventData.shared()
	collision_layer = PhysicsLayers.WORLD
	collision_mask = 0
	var shape := BoxShape3D.new()
	shape.size = SIZE
	var collision := CollisionShape3D.new()
	collision.shape = shape
	collision.position.y = SIZE.y * 0.5
	add_child(collision)
	var visual: Node3D = PropFactory.create(art) if art != "" else null
	if visual:
		add_child(visual)
		_led = visual.find_child("led", true, false) as Node3D
		_add_label(title, color)
		return
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
	_add_label(title, color)


func _add_label(title: String, color: Color) -> void:
	_label = Label3D.new()
	_label.outline_size = 0  # a fonte pixel já tem o contorno embutido
	_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	_label.pixel_size = 0.0035
	_label.font_size = 26
	_label.modulate = color.lightened(0.2)
	_label.text = title
	_label.position.y = 1.85
	add_child(_label)
	add_to_group(&"interactable")


func _process(delta: float) -> void:
	# LED do painel piscando (aceso ~70% do tempo).
	if _led:
		_blink += delta
		_led.visible = fmod(_blink, 1.1) < 0.8


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
