class_name Door
extends StaticBody3D
## Porta comprável (seção 24): bloqueia a passagem (e a navegação) até o jogador pagar.
## Aberta, libera as duas áreas que liga (e os spawns delas), some e o mapa refaz a navegação.
## Interagível: fica no grupo "interactable" e responde a get_interaction_prompt/interact.

signal opened(door: Door)

const HEIGHT := 3.0
const COLOR := Color(0.55, 0.36, 0.16)
## Estilo da porta pelo ambiente que ela liga (o primeiro da lista que a porta toca): cada
## passagem tem a cara do lugar — portão de enrolar na bilheteria, grade de embarque na
## plataforma, comporta blindada nos túneis, câmara fria no necrotério, risco biológico no
## laboratório... Arte em assets/tiles/door_<estilo>.png (npm run godot:scenery).
const STYLE_BY_AREA := [
	# Templo dos Mortos.
	[&"sanctuary", &"olympus"], [&"arena", &"infernal"], [&"underworld", &"infernal"], [&"gorgon_temple", &"serpent"],
	[&"forest", &"roots"], [&"necropolis", &"bones"], [&"labyrinth", &"bronze"], [&"ruins", &"bronze"],
	[&"lab", &"biohazard"], [&"morgue", &"cold"], [&"cafeteria", &"kitchen"], [&"pharmacy", &"pharmacy"],
	[&"radiology", &"radiation"], [&"pediatrics", &"pediatric"], [&"icu", &"ward"], [&"surgery", &"ward"],
	[&"ward", &"ward"], [&"reception", &"ward"], [&"maintenance", &"blast"], [&"tunnels", &"blast"],
	[&"tech", &"service"], [&"platform", &"boarding"], [&"ticket", &"shutter"], [&"shops", &"shutter"],
]
## Cor da placa no chão de cada estilo (o nome da área do outro lado).
const SIGN_COLORS := {
	&"shutter": Color(0.95, 0.78, 0.3), &"boarding": Color(0.55, 0.75, 1.0), &"service": Color(0.95, 0.78, 0.3),
	&"blast": Color(0.9, 0.62, 0.35), &"ward": Color(0.75, 0.95, 0.85), &"pediatric": Color(1.0, 0.85, 0.4),
	&"kitchen": Color(0.85, 0.88, 0.9), &"radiation": Color(1.0, 0.82, 0.25), &"pharmacy": Color(0.45, 0.95, 0.6),
	&"cold": Color(0.7, 0.9, 1.0), &"biohazard": Color(1.0, 0.6, 0.3),
}

var door_id: StringName
## "buy" (compra com pontos) ou um portão especial do Templo que abre por outra via:
## "altar" (os 3 altares com Fragmentos de Alma), "quest" (chave do Minotauro), "secret" (12 estátuas).
var kind: StringName = &"buy"
## O que o portão especial pede (texto de interação).
const GATE_HINTS := {
	&"altar": "PORTÃO DO TEMPLO — leve Fragmentos de Alma aos 3 altares",
	&"quest": "PORTÃO DO SUBMUNDO — precisa da chave do Minotauro",
	&"secret": "PASSAGEM SELADA — ative as 12 estátuas dos deuses",
}
var cost: int = 0
var areas: PackedStringArray = PackedStringArray()
## Distância (m, do centro) para o jogador poder interagir.
var interaction_radius: float = 2.0
var is_open: bool = false

var _world: GameWorld
var _mesh: MeshInstance3D
var style: StringName = &"shutter"
var _signs: Array[Label3D] = []
## Direção que atravessa a porta (de uma área para a outra), vista pelas áreas dos dois lados.
var across := Vector3(0, 0, 1)
var _size := Vector2.ONE


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
	style = style_for(areas)
	_size = size
	across = Vector3(0, 0, 1) if size.x >= size.y else Vector3(1, 0, 0)
	box.material = _art_material(style, size, across)
	_mesh = MeshInstance3D.new()
	_mesh.mesh = box
	_mesh.position.y = HEIGHT * 0.5
	add_child(_mesh)
	interaction_radius = maxf(size.x, size.y) * 0.5 + 1.4
	add_to_group(&"interactable")
	_dress.call_deferred()


## Já no mapa: descobre para que lado a porta liga as áreas (portas 3 × 3 são ambíguas pelo
## tamanho), veste a arte do vão certo e põe as placas.
func _dress() -> void:
	if _world == null or not is_inside_tree():
		return
	for axis: Vector3 in [Vector3(0, 0, 1), Vector3(1, 0, 0)]:
		var half := (_size.y if axis.z != 0.0 else _size.x) * 0.5
		var a := _world.area_of(global_position + axis * (half + 0.5))
		var b := _world.area_of(global_position - axis * (half + 0.5))
		if a != &"" and b != &"" and a != b:
			across = axis
			break
	(_mesh.mesh as BoxMesh).material = _art_material(style, _size, across)
	_add_signs()


static func style_for(p_areas: PackedStringArray) -> StringName:
	for entry: Array in STYLE_BY_AREA:
		if p_areas.has(String(entry[0])):
			return entry[1]
	return &"shutter"


## Arte da porta: uma porta só do tamanho do vão (3 m ou 4 m, a mais próxima), não portões
## repetidos lado a lado; o topo é o listrado do estilo.
static func art_path(p_style: StringName, cap: bool, width := 3.0) -> String:
	if cap:
		return "res://assets/tiles/door_cap.png" if p_style == &"shutter" else "res://assets/tiles/door_%s_cap.png" % p_style
	return "res://assets/tiles/door_%s_%dm.png" % [p_style, 4 if width >= 3.5 else 3]


## Placa pintada no chão dos dois lados, com o nome da área do outro lado (como a sinalização
## de estação e hospital): dá para saber o que cada porta abre. Some com a porta.
func _add_signs() -> void:
	var half := (_size.y if across.z != 0.0 else _size.x) * 0.5
	for side: float in [1.0, -1.0]:
		var normal := across * side
		var beyond := _world.area_of(global_position - normal * (half + 0.5))
		if beyond == &"" or not areas.has(String(beyond)):
			continue
		var label := Label3D.new()
		label.outline_size = 0  # a fonte pixel já tem o contorno embutido
		label.text = _world.area_display_name(beyond).to_upper()
		label.font_size = 26
		label.pixel_size = 0.018
		label.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
		label.modulate = SIGN_COLORS.get(style, Color.WHITE)
		label.billboard = BaseMaterial3D.BILLBOARD_DISABLED
		label.double_sided = false
		label.no_depth_test = false
		label.position = normal * (half + 0.8) + Vector3.UP * 0.08
		# Deitada no chão. Em porta de parede horizontal, reta na tela (a câmera olha de +z); em
		# parede vertical, ao longo da porta, com o pé do texto para o lado de quem lê.
		label.rotation = Vector3(-PI * 0.5, (-side * PI * 0.5) if across.x != 0.0 else 0.0, 0.0)
		add_child(label)
		_signs.append(label)


## Porta em pixel art (npm run godot:scenery) com o shader das paredes (mesmo recorte quando o
## jogador passa atrás). A textura fica presa à porta e cada face mostra a porta inteira uma vez,
## do tamanho do vão. Um material por estilo, tamanho e orientação. Sem a arte, cor lisa.
static var _materials: Dictionary = {}


static func _art_material(p_style: StringName, size: Vector2, p_across: Vector3) -> Material:
	var key := "%s %.2fx%.2f %s" % [p_style, size.x, size.y, p_across]
	if _materials.has(key):
		return _materials[key]
	var width := size.x if p_across.z != 0.0 else size.y
	var side := art_path(p_style, false, width)
	var top := art_path(p_style, true)
	if not (ResourceLoader.exists(side) and ResourceLoader.exists(top)):
		side = art_path(&"shutter", false, width)
		top = art_path(&"shutter", true)
	var material: Material
	if ResourceLoader.exists(side) and ResourceLoader.exists(top):
		var shader_material := ShaderMaterial.new()
		shader_material.shader = load("res://shaders/wall.gdshader")
		shader_material.set_shader_parameter(&"side_texture", load(side))
		shader_material.set_shader_parameter(&"top_texture", load(top))
		shader_material.set_shader_parameter(&"object_space", true)
		shader_material.set_shader_parameter(&"object_offset", Vector3(size.x * 0.5, -HEIGHT * 0.5, size.y * 0.5))
		shader_material.set_shader_parameter(&"side_size", Vector2(size.x, HEIGHT))
		shader_material.set_shader_parameter(&"side_width_z", size.y)
		shader_material.set_shader_parameter(&"top_size", Vector2(2.0, 2.0))
		material = shader_material
	else:
		var plain := StandardMaterial3D.new()
		plain.albedo_color = COLOR
		material = plain
	_materials[key] = material
	return material


func get_interaction_prompt(_player: Node3D) -> String:
	if is_open:
		return ""
	if kind != &"buy":
		return String(GATE_HINTS.get(kind, "PORTÃO FECHADO"))
	var names := []
	for area in areas:
		if _world and not _world.is_area_open(StringName(area)):
			names.append(_world.area_display_name(StringName(area)).to_upper())
	var where := (" — " + ", ".join(names)) if not names.is_empty() else ""
	return "[E] ABRIR PORTA%s  ·  %d pontos" % [where, cost]


func interact(_player: Node3D) -> bool:
	if is_open or kind != &"buy":
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
	for label in _signs:
		label.hide()
	tween.tween_callback(queue_free)
