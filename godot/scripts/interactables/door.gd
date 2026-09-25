class_name Door
extends StaticBody3D
## Porta comprável (seção 24): bloqueia a passagem (e a navegação) até o jogador pagar.
## Aberta, libera as duas áreas que liga (e os spawns delas), some e o mapa refaz a navegação.
## Interagível: fica no grupo "interactable" e responde a get_interaction_prompt/interact.

signal opened(door: Door)

const HEIGHT := 3.0
const COLOR := Color(0.55, 0.36, 0.16)

var door_id: StringName
var cost: int = 0
var areas: PackedStringArray = PackedStringArray()
## Distância (m, do centro) para o jogador poder interagir.
var interaction_radius: float = 2.0
var is_open: bool = false

var _world: GameWorld
var _mesh: MeshInstance3D


func setup(p_id: StringName, p_cost: int, p_areas: PackedStringArray, size: Vector2, world: GameWorld) -> void:
	door_id = p_id
	cost = p_cost
	areas = p_areas
	_world = world
	name = String(p_id)
	collision_layer = PhysicsLayers.WORLD
	collision_mask = 0
	var shape := BoxShape3D.new()
	shape.size = Vector3(size.x, HEIGHT, size.y)
	var collision := CollisionShape3D.new()
	collision.shape = shape
	collision.position.y = HEIGHT * 0.5
	add_child(collision)
	var box := BoxMesh.new()
	box.size = shape.size
	box.material = _art_material()
	_mesh = MeshInstance3D.new()
	_mesh.mesh = box
	_mesh.position.y = HEIGHT * 0.5
	add_child(_mesh)
	interaction_radius = maxf(size.x, size.y) * 0.5 + 1.4
	add_to_group(&"interactable")


## Portão de aço em pixel art (npm run godot:scenery), com o shader das paredes: mesma
## densidade de pixels e o mesmo recorte quando o jogador passa atrás. Sem a arte, cor lisa.
static var _shared_material: Material


static func _art_material() -> Material:
	if _shared_material:
		return _shared_material
	var side := "res://assets/tiles/door_shutter.png"
	var top := "res://assets/tiles/door_cap.png"
	if ResourceLoader.exists(side) and ResourceLoader.exists(top):
		var material := ShaderMaterial.new()
		material.shader = load("res://shaders/wall.gdshader")
		material.set_shader_parameter(&"side_texture", load(side))
		material.set_shader_parameter(&"top_texture", load(top))
		_shared_material = material
	else:
		var plain := StandardMaterial3D.new()
		plain.albedo_color = COLOR
		_shared_material = plain
	return _shared_material


func get_interaction_prompt(_player: Node3D) -> String:
	if is_open:
		return ""
	var names := []
	for area in areas:
		if _world and not _world.is_area_open(StringName(area)):
			names.append(_world.area_display_name(StringName(area)).to_upper())
	var where := (" — " + ", ".join(names)) if not names.is_empty() else ""
	return "[E] ABRIR PORTA%s  ·  %d pontos" % [where, cost]


func interact(_player: Node3D) -> bool:
	if is_open:
		return false
	var points := get_tree().get_first_node_in_group(&"points_manager") as PointsManager
	if points == null or not points.spend(cost):
		Events.purchase_denied.emit()
		return false
	open()
	return true


## Abre sem cobrar (compras já feitas, testes, eventos).
func open() -> void:
	if is_open:
		return
	is_open = true
	remove_from_group(&"interactable")
	collision_layer = 0
	for area in areas:
		_world.open_area(StringName(area))
	_world.rebake_navigation()
	opened.emit(self)
	var tween := create_tween()
	tween.tween_property(_mesh, "position:y", -HEIGHT * 0.5, 0.6).set_ease(Tween.EASE_IN)
	tween.tween_callback(queue_free)
