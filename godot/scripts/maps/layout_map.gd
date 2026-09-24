class_name LayoutMap
extends GameWorld
## Mapa migrado do jogo web: lê data/maps/<id>.json (gerado por `npm run godot:data`) e
## monta o mapa 3D. Tiles vizinhos iguais viram um bloco só (poucos corpos e malhas):
## chão por tipo de piso, paredes, o trem parado, portas compráveis, janelas (só o jogador
## não passa), props com colisão, luzes e pontos de spawn por área. Depois gera a navegação.
## 1 tile = 1 m; x do jogo web = x, y do jogo web = z.

const WALL_HEIGHT := 3.0
const TRAIN_HEIGHT := 2.6
const WINDOW_HEIGHT := 1.1
const PROP_HEIGHT := 0.9
const LAMP_HEIGHT := 3.2

## Cores dos pisos (letras da grade → cor).
const FLOOR_COLORS := {
	"t": Color(0.34, 0.33, 0.3), "c": Color(0.27, 0.27, 0.26), "m": Color(0.3, 0.32, 0.34),
	"r": Color(0.22, 0.2, 0.18), "u": Color(0.2, 0.21, 0.2), "w": Color(0.28, 0.3, 0.32),
	"h": Color(0.62, 0.64, 0.6), "l": Color(0.45, 0.5, 0.48), "g": Color(0.5, 0.55, 0.58),
}
const WALL_COLOR := Color(0.16, 0.16, 0.15)
const TRAIN_COLOR := Color(0.23, 0.33, 0.4)
const WINDOW_COLOR := Color(0.55, 0.7, 0.8, 0.35)
const PROP_COLOR := Color(0.4, 0.33, 0.24)

@export_file("*.json") var map_file: String = "res://data/maps/terminal.json"
@export var door_scene: PackedScene

var data: Dictionary = {}
var width: int = 0
var height: int = 0

var _cells: PackedStringArray
var _materials: Dictionary = {}
var _area_names: Dictionary = {}

@onready var nav_region: NavigationRegion3D = $NavigationRegion3D


func _ready() -> void:
	data = _load(map_file)
	if data.is_empty():
		return
	width = data.width
	height = data.height
	_cells = PackedStringArray(data.cells)
	for area: Dictionary in data.areas:
		_area_names[StringName(area.id)] = area.name
	_build_floor()
	_build_solids("#", WALL_HEIGHT, WALL_COLOR, PhysicsLayers.WORLD, "Wall")
	_build_solids("T", TRAIN_HEIGHT, TRAIN_COLOR, PhysicsLayers.WORLD, "Train")
	_build_solids("W", WINDOW_HEIGHT, WINDOW_COLOR, PhysicsLayers.PLAYER_ONLY, "Window")
	_build_doors()
	_build_props()
	_build_lamps()
	_build_spawns()
	open_area(StringName(data.start_area))
	nav_region.bake_navigation_mesh(false)


func get_player_spawn() -> Vector3:
	var start: Dictionary = data.get("player_start", {"x": 0.0, "z": 0.0})
	return Vector3(start.x, 0.1, start.z)


func active_spawn_points(round_number: int) -> Array[Vector3]:
	var points: Array[Vector3] = []
	for node in get_tree().get_nodes_in_group(&"zombie_spawn"):
		var marker := node as Marker3D
		if marker == null or not is_ancestor_of(marker):
			continue
		if is_area_open(marker.get_meta(&"area", &"")) and round_number >= int(marker.get_meta(&"min_round", 1)):
			points.append(marker.global_position)
	return points


func area_display_name(area_id: StringName) -> String:
	return _area_names.get(area_id, String(area_id))


func rebake_navigation() -> void:
	if not nav_region.is_baking():
		nav_region.bake_navigation_mesh(true)


## Letra da grade no tile (fora do mapa = parede).
func cell(x: int, z: int) -> String:
	if x < 0 or z < 0 or x >= width or z >= height:
		return "#"
	return _cells[z][x]


# ───────────────────────── Montagem ─────────────────────────

func _load(path: String) -> Dictionary:
	var text := FileAccess.get_file_as_string(path)
	var parsed: Variant = JSON.parse_string(text)
	if parsed is Dictionary:
		return parsed
	push_error("LayoutMap: não foi possível ler %s" % path)
	return {}


func _build_floor() -> void:
	# Um colisor único para o chão todo (as paredes limitam onde se anda).
	var ground := StaticBody3D.new()
	ground.name = "Ground"
	ground.collision_layer = PhysicsLayers.WORLD
	ground.collision_mask = 0
	var shape := BoxShape3D.new()
	shape.size = Vector3(width, 1.0, height)
	var collision := CollisionShape3D.new()
	collision.shape = shape
	ground.add_child(collision)
	nav_region.add_child(ground)
	ground.position = Vector3(width * 0.5, -0.5, height * 0.5)
	# Visual por tipo de piso (portas e janelas usam o piso de concreto).
	var visuals := Node3D.new()
	visuals.name = "FloorVisuals"
	add_child(visuals)
	for ch: String in FLOOR_COLORS:
		var match_chars := ch + ("DW" if ch == "c" else "")
		for rect in _merge(func(c: String) -> bool: return match_chars.contains(c)):
			visuals.add_child(_box_mesh(rect, -0.05, 0.05, _material(FLOOR_COLORS[ch])))


func _build_solids(ch: String, box_height: float, color: Color, layer: int, label: String) -> void:
	var group := Node3D.new()
	group.name = label + "s"
	nav_region.add_child(group)
	var material := _material(color)
	for rect in _merge(func(c: String) -> bool: return c == ch):
		var body := StaticBody3D.new()
		body.collision_layer = layer
		body.collision_mask = 0
		var shape := BoxShape3D.new()
		shape.size = Vector3(rect.size.x, box_height, rect.size.y)
		var collision := CollisionShape3D.new()
		collision.shape = shape
		body.add_child(collision)
		body.add_child(_box_mesh(Rect2(-rect.size * 0.5, rect.size), 0.0, box_height, material, true))
		group.add_child(body)
		body.position = Vector3(rect.get_center().x, box_height * 0.5, rect.get_center().y)


func _build_doors() -> void:
	if door_scene == null:
		return
	for door_data: Dictionary in data.doors:
		var door := door_scene.instantiate() as Door
		var rect := Rect2(door_data.rect.x, door_data.rect.y, door_data.rect.w, door_data.rect.h)
		door.setup(StringName(door_data.id), int(door_data.cost), PackedStringArray(door_data.areas), rect.size, self)
		nav_region.add_child(door)
		door.position = Vector3(rect.get_center().x, 0.0, rect.get_center().y)


func _build_props() -> void:
	var group := Node3D.new()
	group.name = "Props"
	nav_region.add_child(group)
	var material := _material(PROP_COLOR)
	for prop: Dictionary in data.props:
		var center := Vector3(prop.x, 0.0, prop.z)
		var body_data: Variant = prop.body
		if body_data is Dictionary:
			var body := StaticBody3D.new()
			body.name = prop.type
			# Móveis que param bala contam como parede; os outros só bloqueiam a passagem.
			body.collision_layer = PhysicsLayers.WORLD if prop.blocks_bullets else PhysicsLayers.PROPS
			body.collision_mask = 0
			var size := Vector3(body_data.w, PROP_HEIGHT, body_data.d)
			var shape := BoxShape3D.new()
			shape.size = size
			var collision := CollisionShape3D.new()
			collision.shape = shape
			body.add_child(collision)
			body.add_child(_box_mesh(Rect2(-size.x * 0.5, -size.z * 0.5, size.x, size.z), -PROP_HEIGHT * 0.5, PROP_HEIGHT * 0.5, material))
			group.add_child(body)
			body.position = center + Vector3(body_data.ox, PROP_HEIGHT * 0.5, body_data.oz)
		else:
			# Decorativo (mala, cadeira...): uma placa baixa, sem colisão.
			var mesh := _box_mesh(Rect2(-0.3, -0.2, 0.6, 0.4), 0.0, 0.3, material)
			group.add_child(mesh)
			mesh.position = center
			mesh.rotation.y = deg_to_rad(-float(prop.angle))
		var light_data: Variant = prop.light
		if light_data is Dictionary:
			_add_light(center + Vector3.UP * 1.2, light_data.radius, light_data.intensity, int(light_data.color))


func _build_lamps() -> void:
	for lamp: Dictionary in data.lamps:
		_add_light(Vector3(lamp.x, LAMP_HEIGHT, lamp.z), lamp.radius, lamp.intensity, int(lamp.color))


func _add_light(position_3d: Vector3, radius: float, intensity: float, color_hex: int) -> void:
	var light := OmniLight3D.new()
	light.light_color = Color.hex((color_hex << 8) | 0xff)
	light.light_energy = intensity * 2.4
	light.omni_range = maxf(3.0, radius * 1.6)
	add_child(light)
	light.position = position_3d


func _build_spawns() -> void:
	var group := Node3D.new()
	group.name = "ZombieSpawns"
	add_child(group)
	for spawn: Dictionary in data.spawns:
		var marker := Marker3D.new()
		marker.name = spawn.id
		marker.set_meta(&"area", StringName(spawn.area))
		marker.set_meta(&"min_round", int(spawn.min_round))
		marker.add_to_group(&"zombie_spawn")
		group.add_child(marker)
		marker.position = Vector3(spawn.x, 0.1, spawn.z)


## Junta tiles vizinhos que passam no filtro em retângulos (varredura gulosa por linhas).
func _merge(accept: Callable) -> Array[Rect2]:
	var used := PackedByteArray()
	used.resize(width * height)
	var rects: Array[Rect2] = []
	for z in height:
		for x in width:
			if used[z * width + x] or not accept.call(cell(x, z)):
				continue
			var w := 1
			while x + w < width and not used[z * width + x + w] and accept.call(cell(x + w, z)):
				w += 1
			var h := 1
			while z + h < height and _row_free(x, z + h, w, accept, used):
				h += 1
			for zz in range(z, z + h):
				for xx in range(x, x + w):
					used[zz * width + xx] = 1
			rects.append(Rect2(x, z, w, h))
	return rects


func _row_free(x: int, z: int, w: int, accept: Callable, used: PackedByteArray) -> bool:
	for xx in range(x, x + w):
		if used[z * width + xx] or not accept.call(cell(xx, z)):
			return false
	return true


## Malha de caixa cobrindo o retângulo (no plano XZ) entre as alturas `bottom` e `top`.
func _box_mesh(rect: Rect2, bottom: float, top: float, material: Material, centered := false) -> MeshInstance3D:
	var mesh := BoxMesh.new()
	mesh.size = Vector3(rect.size.x, top - bottom, rect.size.y)
	var instance := MeshInstance3D.new()
	instance.mesh = mesh
	instance.material_override = material
	if centered:
		instance.position = Vector3.ZERO
	else:
		instance.position = Vector3(rect.get_center().x, (top + bottom) * 0.5, rect.get_center().y)
	return instance


func _material(color: Color) -> StandardMaterial3D:
	var key := color.to_html()
	if not _materials.has(key):
		var material := StandardMaterial3D.new()
		material.albedo_color = color
		material.roughness = 0.9
		if color.a < 1.0:
			material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		_materials[key] = material
	return _materials[key]
