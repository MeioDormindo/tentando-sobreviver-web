class_name CharacterSprite
extends Node3D
## Visual de um personagem em pixel art (folhas geradas por `npm run godot:sprites`): sprite
## voltado para a câmera, 8 direções desenhadas na vista 3/4 do jogo, animações por quadros.
## A direção sai da rotação do nó pai (o Pivot, que o gameplay já gira para onde o personagem
## olha). Mesma API usada antes com os modelos 3D: play, play_once, current, has_animation.
## Camada extra opcional (a arma do jogador), no mesmo quadro, na frente ou atrás do corpo.
## A camada diz a postura ("stance" no JSON): com uma pistola, as animações que existem com o
## sufixo _pistol (Idle_pistol, Walk_pistol...) tomam o lugar das normais.

const SPRITES := "res://assets/sprites/%s"
const PIXELS_PER_METER := 32.0
## Quanto a camada da arma fica à frente/atrás do corpo, na direção da câmera (m).
const LAYER_GAP := 0.03

var current: StringName = &""
## Animação da folha que está tocando (a atual, com o sufixo da postura se houver).
var playing: StringName = &""
## Sufixo da postura da arma ("" = fuzil, "_pistol").
var stance_suffix := ""
## Dados da folha da camada (postura, ponta do cano...); vazio sem camada.
var layer_meta: Dictionary = {}
## Direção desenhada agora (0 = olhando para a câmera, 2 = leste).
var direction: int = 0

var _meta: Dictionary = {}
var _body: Sprite3D
var _layer: Sprite3D
var _layer_behind: Array = []
var _frame := 0.0
var _speed := 1.0
var _flash_left := 0.0
var _tint := Color.WHITE


## Cria o visual a partir do nome da folha (ex.: "zombie_walker"); null se não existir.
static func create(sheet: String) -> CharacterSprite:
	var meta := _read_meta(sheet)
	if meta.is_empty():
		return null
	var node := CharacterSprite.new()
	node.name = "Sprite"
	node._meta = meta
	node._body = node._make_sprite(sheet, "Body")
	node.add_child(node._body)
	node.play(&"Idle", 0.0)
	return node


static func exists(sheet: String) -> bool:
	return ResourceLoader.exists((SPRITES % sheet) + ".png") and FileAccess.file_exists((SPRITES % sheet) + ".json")


static func _read_meta(sheet: String) -> Dictionary:
	if not exists(sheet):
		return {}
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string((SPRITES % sheet) + ".json"))
	return parsed if parsed is Dictionary else {}


## Troca a folha do corpo (ex.: blindado sem a armadura), mantendo a animação.
func set_sheet(sheet: String) -> void:
	var meta := _read_meta(sheet)
	if meta.is_empty() or _body == null:
		return
	_meta = meta
	var old := _body
	_body = _make_sprite(sheet, "Body")
	add_child(_body)
	old.queue_free()
	_apply_frame()


## Camada por cima (arma do jogador): mesma pose e quadro; "" tira a camada.
func set_layer(sheet: String) -> void:
	if _layer:
		_layer.queue_free()
		_layer = null
	_layer_behind = []
	layer_meta = {}
	if sheet == "" or not exists(sheet):
		return
	_layer = _make_sprite(sheet, "Layer")
	add_child(_layer)
	var meta := _read_meta(sheet)
	layer_meta = meta
	_layer_behind = meta.get("weapon_behind", [])
	# A faca não muda a postura (o golpe é o mesmo com qualquer arma).
	match String(meta.get("stance", "")):
		"pistol":
			_set_stance("_pistol")
		"rifle":
			_set_stance("")
	_apply_frame()


func _set_stance(suffix: String) -> void:
	if suffix == stance_suffix:
		return
	stance_suffix = suffix
	if current != &"":
		playing = _resolve(current)


func _resolve(anim_name: StringName) -> StringName:
	var with_stance := StringName(String(anim_name) + stance_suffix)
	return with_stance if stance_suffix != "" and has_animation(with_stance) else anim_name


func has_animation(anim_name: StringName) -> bool:
	return _meta.get("animations", {}).has(String(anim_name))


## Toca se já não for a atual (uma que não repete fica parada no último quadro).
func play(anim_name: StringName, _blend := 0.15, speed := 1.0) -> void:
	if not has_animation(anim_name):
		return
	_speed = speed
	if current == anim_name:
		return
	current = anim_name
	playing = _resolve(anim_name)
	_frame = 0.0
	_apply_frame()


## Toca do começo mesmo se for a mesma (golpe, tiro, rugido).
func play_once(anim_name: StringName, _blend := 0.08, speed := 1.0) -> void:
	if not has_animation(anim_name):
		return
	current = anim_name
	playing = _resolve(anim_name)
	_speed = speed
	_frame = 0.0
	_apply_frame()


## A animação atual (que não repete) chegou ao fim?
func finished() -> bool:
	var anim: Dictionary = _meta.animations.get(String(playing), {})
	return not anim.is_empty() and not bool(anim.loop) and _frame >= float(anim.count) - 1.0


## Pisca numa cor (dano, raio) por um instante.
func flash(color: Color, seconds := 0.08) -> void:
	_flash_left = seconds
	_set_modulate(color.lightened(0.3))


## Cor fixa (atordoado, congelado); branco = normal.
func tint(color: Color) -> void:
	_tint = color
	if _flash_left <= 0.0:
		_set_modulate(color)


func _process(delta: float) -> void:
	if _flash_left > 0.0:
		_flash_left -= delta
		if _flash_left <= 0.0:
			_set_modulate(_tint)
	var anim: Dictionary = _meta.get("animations", {}).get(String(playing), {})
	if anim.is_empty():
		return
	var count := int(anim.count)
	_frame += delta * float(anim.fps) * _speed
	if bool(anim.loop):
		_frame = fmod(_frame, float(count))
	else:
		_frame = minf(_frame, float(count) - 1.0)
	# Direção: a frente do pai (-Z) no plano do chão, relativa ao giro da câmera (os
	# desenhos são feitos do ponto de vista dela: 0 = olhando para a câmera).
	var parent := get_parent() as Node3D
	if parent:
		var forward := -parent.global_basis.z
		var angle := atan2(forward.x, forward.z)
		var camera := get_viewport().get_camera_3d()
		if camera:
			angle -= camera.global_rotation.y
		direction = posmod(roundi(angle / (PI / 4.0)), 8)
	_apply_frame()


func _apply_frame() -> void:
	if _body == null:
		return
	var anim: Dictionary = _meta.get("animations", {}).get(String(playing), {})
	if anim.is_empty():
		return
	var columns := int(_meta.columns)
	var index := direction * columns + int(anim.start) + mini(int(_frame), int(anim.count) - 1)
	_body.frame = index
	if _layer:
		_layer.frame = index
		# Arma à frente ou atrás do corpo, conforme a direção (sem brigar pela profundidade).
		var camera := get_viewport().get_camera_3d() if is_inside_tree() else null
		if camera:
			var to_camera := (camera.global_position - global_position).normalized()
			var behind: bool = direction < _layer_behind.size() and bool(_layer_behind[direction])
			_layer.global_position = global_position + to_camera * (-LAYER_GAP if behind else LAYER_GAP)


func _make_sprite(sheet: String, sprite_name: String) -> Sprite3D:
	var sprite := Sprite3D.new()
	sprite.name = sprite_name
	sprite.texture = load((SPRITES % sheet) + ".png")
	sprite.hframes = int(_meta.columns)
	sprite.vframes = int(_meta.directions)
	sprite.pixel_size = 1.0 / float(_meta.get("pixels_per_meter", PIXELS_PER_METER))
	sprite.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	sprite.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	sprite.alpha_cut = SpriteBase3D.ALPHA_CUT_DISCARD
	sprite.shaded = true
	sprite.double_sided = false
	sprite.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	sprite.material_override = _material(sheet, sprite.texture)
	# Pés (pivô da folha) na origem do nó; o y do offset do Sprite3D cresce para cima.
	var frame_size: Array = _meta.frame
	var pivot: Array = _meta.pivot
	sprite.offset = Vector2(float(frame_size[0]) * 0.5 - float(pivot[0]), float(pivot[1]) - float(frame_size[1]) * 0.5)
	return sprite


## Material do quadro (shaders/character_sprite.gdshader), um por folha: puxa o quadro para
## perto da câmera, para as pernas não entrarem no chão nem nos objetos logo atrás.
static var _materials: Dictionary = {}


static func _material(sheet: String, texture: Texture2D) -> ShaderMaterial:
	if not _materials.has(sheet):
		var material := ShaderMaterial.new()
		material.shader = preload("res://shaders/character_sprite.gdshader")
		material.set_shader_parameter(&"tex", texture)
		_materials[sheet] = material
	return _materials[sheet]


func _set_modulate(color: Color) -> void:
	for child in get_children():
		if child is Sprite3D:
			(child as Sprite3D).modulate = color
