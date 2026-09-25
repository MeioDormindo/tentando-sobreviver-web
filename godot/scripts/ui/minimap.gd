class_name Minimap
extends Control
## Minimapa no canto da HUD (como no jogo web): mapa inteiro (áreas abertas claras, fechadas
## escuras, portas em laranja), o jogador (seta amarela), zumbis (pontos vermelhos), boss,
## Mystery Box, suprimentos e o objetivo. Tab segurado: mapa grande no centro da tela.
## Liga/desliga e tamanho nas configurações. Recebe tudo por Events (MinimapFeed).

## Cor de cada código da grade (ver LayoutMap.minimap_cells).
const CELL_COLORS: Array[Color] = [
	Color(0, 0, 0, 0), Color8(120, 124, 112, 235), Color8(48, 50, 46, 200),
	Color8(214, 140, 50), Color8(70, 86, 102, 235), Color8(150, 110, 60),
]
const SIZE_SCALE := {"small": 0.7, "medium": 1.0, "large": 1.5}
const BASE_WIDTH := 150.0
const CORNER := Vector2(24, 116)

var expanded := false
var cols := 0
var rows := 0

var _texture: ImageTexture
var _state: Dictionary = {}
var _scale := 1.0
var _clock := 0.0


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	Events.minimap_base.connect(set_base)
	Events.minimap_state.connect(func(state: Dictionary) -> void:
		_state = state
		queue_redraw())
	get_viewport().size_changed.connect(apply_settings)
	apply_settings()


func _process(delta: float) -> void:
	_clock += delta
	if Input.is_action_pressed(&"map") != expanded and not get_tree().paused:
		set_expanded(not expanded)


func set_base(width: int, height: int, cells: PackedByteArray) -> void:
	if width <= 0 or height <= 0 or cells.size() < width * height:
		cols = 0
		apply_settings()
		return
	cols = width
	rows = height
	var image := Image.create_empty(width, height, false, Image.FORMAT_RGBA8)
	for i in cells.size():
		image.set_pixel(i % width, i / width, CELL_COLORS[cells[i]] if cells[i] < CELL_COLORS.size() else CELL_COLORS[0])
	_texture = ImageTexture.create_from_image(image)
	apply_settings()


func set_expanded(value: bool) -> void:
	expanded = value
	apply_settings()


## Liga/desliga e tamanho (configurações); chamado também quando a janela muda.
func apply_settings() -> void:
	visible = cols > 0 and (expanded or bool(Save.get_setting("minimap")))
	if cols <= 0:
		return
	var grid := Vector2(cols, rows)
	# O mapa gira com a câmera (isométrica): o que está "para cima" na tela fica para cima no
	# mapa. Girado, ele ocupa um losango; o tamanho conta esse losango.
	var yaw := _camera_yaw()
	var spread := absf(cos(yaw)) + absf(sin(yaw))
	if expanded:
		var screen := get_viewport_rect().size
		_scale = minf(screen.x * 0.8, screen.y * 0.8) / ((cols + rows) * 0.5 * spread)
	else:
		_scale = clampf(BASE_WIDTH * float(SIZE_SCALE.get(String(Save.get_setting("minimapSize")), 1.0)) / (cols * spread), 0.5, 3.5)
	size = grid * _scale
	pivot_offset = size * 0.5
	rotation = yaw
	var extent := Vector2(size.x * absf(cos(yaw)) + size.y * absf(sin(yaw)), size.x * absf(sin(yaw)) + size.y * absf(cos(yaw)))
	if expanded:
		position = (get_viewport_rect().size - size) * 0.5
	else:
		position = CORNER + (extent - size) * 0.5
	queue_redraw()


## Altura que o mapa ocupa na tela (girado).
func screen_height() -> float:
	var yaw := rotation
	return size.x * absf(sin(yaw)) + size.y * absf(cos(yaw))


func _camera_yaw() -> float:
	var camera := get_viewport().get_camera_3d() if is_inside_tree() else null
	return camera.global_rotation.y if camera else 0.0


## Ponto do mapa (metros no plano x/z) → posição no controle.
func to_local_point(world_point: Vector2) -> Vector2:
	return world_point * _scale


func _draw() -> void:
	if _texture == null:
		return
	if expanded:
		draw_rect(Rect2(-position, get_viewport_rect().size), Color(0, 0, 0, 0.6))
	draw_rect(Rect2(Vector2(-3, -3), size + Vector2(6, 6)), Color(0, 0, 0, 0.55))
	draw_rect(Rect2(Vector2(-3, -3), size + Vector2(6, 6)), Color8(106, 109, 100, 230), false, 1.0)
	draw_texture_rect(_texture, Rect2(Vector2.ZERO, size), false)
	draw_string(get_theme_default_font(), Vector2(0, size.y + 24), "MAPA", HORIZONTAL_ALIGNMENT_LEFT, -1, 26, Color8(138, 141, 132))
	if _state.is_empty():
		return
	var zoom := 2.4 if expanded else 1.0
	for z: Vector2 in _state.get("zombies", PackedVector2Array()):
		draw_rect(Rect2(to_local_point(z) - Vector2(1.1, 1.1) * zoom, Vector2(2.2, 2.2) * zoom), Color8(224, 65, 47, 242))
	var supply: Variant = _state.get("supply")
	if supply is Vector2:
		draw_rect(Rect2(to_local_point(supply) - Vector2(2.5, 2.5), Vector2(5, 5)), Color8(123, 214, 123))
	var objective: Variant = _state.get("objective")
	if objective is Vector2:
		var o := to_local_point(objective)
		var r := 3.5 + sin(_clock * 5.0)
		var diamond := PackedVector2Array([o + Vector2(0, -r), o + Vector2(r, 0), o + Vector2(0, r), o + Vector2(-r, 0)])
		draw_colored_polygon(diamond, Color8(255, 211, 90))
		draw_polyline(diamond + PackedVector2Array([diamond[0]]), Color.BLACK, 1.0)
	for b: Vector2 in _state.get("boxes", PackedVector2Array()):
		var rect := Rect2(to_local_point(b) - Vector2(2.5, 2.5), Vector2(5, 5))
		draw_rect(rect, Color8(255, 210, 122))
		draw_rect(rect, Color(0, 0, 0, 0.8), false, 1.0)
	# Zumbi dourado: estrela dourada pulsando, maior que os outros pontos.
	var golden: Variant = _state.get("golden")
	if golden is Vector2:
		var g := to_local_point(golden)
		var gr := (3.5 + 1.2 * sin(_clock * 8.0)) * (1.6 if expanded else 1.0)
		var star := PackedVector2Array()
		for i in 10:
			var angle := -PI / 2.0 + i * PI / 5.0
			star.append(g + Vector2(cos(angle), sin(angle)) * (gr if i % 2 == 0 else gr * 0.45))
		draw_colored_polygon(star, Color8(255, 214, 74))
		draw_polyline(star + PackedVector2Array([star[0]]), Color.BLACK, 1.0)
	var boss: Variant = _state.get("boss")
	if boss is Vector2:
		var pulse := 3.5 + sin(_clock * 6.0)
		draw_circle(to_local_point(boss), pulse, Color8(255, 42, 26))
		draw_arc(to_local_point(boss), pulse + 1.0, 0.0, TAU, 16, Color.WHITE, 1.0)
	# Jogador: seta apontando para a mira.
	var center := to_local_point(_state.get("player", Vector2.ZERO))
	var facing: float = _state.get("facing", 0.0)
	var arrow := PackedVector2Array([
		center + Vector2.from_angle(facing) * 5.0 * zoom,
		center + Vector2.from_angle(facing + 2.5) * 3.5 * zoom,
		center + Vector2.from_angle(facing - 2.5) * 3.5 * zoom,
	])
	draw_colored_polygon(arrow, Color8(255, 230, 106))
	draw_polyline(arrow + PackedVector2Array([arrow[0]]), Color(0, 0, 0, 0.9), 1.0)
