class_name CharacterSprite
extends Node3D
## Visual de um personagem em pixel art (folhas geradas por `npm run godot:sprites`): sprite
## voltado para a câmera, 8 direções desenhadas na vista 3/4 do jogo, animações por quadros.
## A direção sai da rotação do nó pai (o Pivot, que o gameplay já gira para onde o personagem
## olha). Mesma API usada antes com os modelos 3D: play, play_once, current, has_animation.
## Camada extra opcional (a arma do jogador), no mesmo quadro, na frente ou atrás do corpo.
## A camada diz a postura ("stance" no JSON): com uma pistola, as animações que existem com o
## sufixo _pistol (Idle_pistol, Walk_pistol...) tomam o lugar das normais; com uma arma em cada
## mão (Uzi dupla), as de sufixo _dual.

const SPRITES := "res://assets/sprites/%s"
const PIXELS_PER_METER := 32.0
## Quanto a camada da arma fica à frente/atrás do corpo, na direção da câmera (m).
const LAYER_GAP := 0.03

## Folha do corpo agora (ex.: "zombie_golden").
var sheet_name := ""
var current: StringName = &""
## Animação da folha que está tocando (a atual, com o sufixo da postura se houver).
var playing: StringName = &""
## Sufixo da postura da arma ("" = fuzil, "_pistol", "_dual").
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
var _glow := Color(0, 0, 0, 0)


## Cria o visual a partir do nome da folha (ex.: "zombie_walker"); null se não existir.
static func create(sheet: String) -> CharacterSprite:
	var meta := _read_meta(sheet)
	if meta.is_empty():
		return null
	var node := CharacterSprite.new()
	node.name = "Sprite"
	node._meta = meta
	node.sheet_name = sheet
	node._body = node._make_sprite(sheet, "Body", meta)
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
	old.name = "OldBody"
	sheet_name = sheet
	_body = _make_sprite(sheet, "Body", meta)
	add_child(_body)
	old.queue_free()
	if _glow.a > 0.0:
		_body.set_instance_shader_parameter(&"glow_color", _glow)
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
	var meta := _read_meta(sheet)
	_layer = _make_sprite(sheet, "Layer", meta)
	add_child(_layer)
	layer_meta = meta
	_layer_behind = meta.get("weapon_behind", [])
	# A faca não muda a postura (o golpe é o mesmo com qualquer arma).
	match String(meta.get("stance", "")):
		"pistol":
			_set_stance("_pistol")
		"dual":
			_set_stance("_dual")
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


## A camada da arma está de fato visível no quadro atual? (falso no recorte mínimo de
## fallback, usado quando o quadro não tem nenhum pixel da arma — ver `trims` em
## scripts/godot/pixel/rig.mjs.)
func layer_visible() -> bool:
	if _layer == null:
		return false
	var atlas := _layer.texture as AtlasTexture
	return atlas != null and atlas.region.size.x > 2.0 and atlas.region.size.y > 2.0


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


## Começa a animação atual num quadro aleatório do ciclo (zumbis do mesmo tipo, nascendo
## juntos, param de andar em lockstep perfeito).
func randomize_phase() -> void:
	var anim: Dictionary = _meta.get("animations", {}).get(String(playing), {})
	if not anim.is_empty() and bool(anim.get("loop", false)):
		_frame = randf() * float(anim.count)
		_apply_frame()


## A animação atual (que não repete) chegou ao fim?
func finished() -> bool:
	var anim: Dictionary = _meta.animations.get(String(playing), {})
	return not anim.is_empty() and not bool(anim.loop) and _frame >= float(anim.count) - 1.0


## Pisca numa cor (dano, raio) por um instante.
func flash(color: Color, seconds := 0.08) -> void:
	_flash_left = seconds
	_set_modulate(color.lightened(0.3))


## Brilho próprio (brilha no escuro): cor e força em alfa; Color(0,0,0,0) apaga.
func set_glow(color: Color) -> void:
	_glow = color
	for child in get_children():
		if child is Sprite3D:
			(child as Sprite3D).set_instance_shader_parameter(&"glow_color", color)


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
	var per_dir := int(_meta.frames_per_direction)
	var index := direction * per_dir + int(anim.start) + mini(int(_frame), int(anim.count) - 1)
	_set_frame_texture(_body, index)
	if _layer:
		# A camada da arma acompanha os mesmos quadros do corpo (mesmo índice) — a folha da arma
		# tem o layout idêntico ao da folha do corpo, só desenhada sem oclusão.
		_set_frame_texture(_layer, index)
		# Arma à frente ou atrás do corpo, conforme a direção (sem brigar pela profundidade).
		var camera := get_viewport().get_camera_3d() if is_inside_tree() else null
		if camera:
			var to_camera := (camera.global_position - global_position).normalized()
			var behind: bool = direction < _layer_behind.size() and bool(_layer_behind[direction])
			_layer.global_position = global_position + to_camera * (-LAYER_GAP if behind else LAYER_GAP)


## Troca pro AtlasTexture pré-construído daquele índice (sem custo se já for o atual), com o
## offset que põe aquele recorte no lugar certo em relação aos pés.
func _set_frame_texture(sprite: Sprite3D, index: int) -> void:
	var atlases: Array = sprite.get_meta(&"atlases")
	var next: AtlasTexture = atlases[index]
	if sprite.texture != next:
		sprite.texture = next
		sprite.offset = (sprite.get_meta(&"offsets") as PackedVector2Array)[index]


## Um AtlasTexture por quadro, só com a região recortada: `cells[i]` = [x, y, w, h, x_no_quadro,
## y_no_quadro]. Sem `margin`: no Godot o tamanho do AtlasTexture é region.size + margin.size, e
## um quadro lógico fixo cortaria as armas compridas que passam dele.
static func make_atlas(meta: Dictionary, texture: Texture2D, index: int) -> AtlasTexture:
	var c: Array = meta.cells[index]
	var atlas := AtlasTexture.new()
	atlas.atlas = texture
	atlas.region = Rect2(c[0], c[1], c[2], c[3])
	return atlas


static func _build_atlases(meta: Dictionary, texture: Texture2D) -> Array:
	var out: Array = []
	var cells: Array = meta.cells
	out.resize(cells.size())
	for i in cells.size():
		out[i] = make_atlas(meta, texture, i)
	return out


## Canto do recorte de cada quadro em relação aos pés (pivô), no espaço do Sprite3D sem
## `centered` (y para cima): corpo e arma caem no mesmo lugar porque os dois usam o mesmo pivô.
static func _build_offsets(meta: Dictionary) -> PackedVector2Array:
	var pivot: Array = meta.pivot
	var out := PackedVector2Array()
	for c: Array in meta.cells:
		out.append(Vector2(float(c[4]) - float(pivot[0]), float(pivot[1]) - float(c[5]) - float(c[3])))
	return out


## `meta` é sempre o da PRÓPRIA folha (`sheet`) — nunca reusar `_meta` aqui: corpo e camada da
## arma são empacotados de forma independente, cada um com seu próprio `cells`, então usar o
## meta errado aponta pra região/posição de outra folha.
func _make_sprite(sheet: String, sprite_name: String, meta: Dictionary) -> Sprite3D:
	var sprite := Sprite3D.new()
	sprite.name = sprite_name
	# Textura crua (a folha empacotada inteira) — é ela que o shader amostra pelo uniform
	# `tex`, não o AtlasTexture ativo (o Godot gera a UV do quadro a partir do AtlasTexture,
	# mas o fragment shader sempre lê a imagem base).
	var raw_texture: Texture2D = load((SPRITES % sheet) + ".png")
	var atlases := _build_atlases(meta, raw_texture)
	var offsets := _build_offsets(meta)
	sprite.set_meta(&"atlases", atlases)
	sprite.set_meta(&"offsets", offsets)
	sprite.centered = false
	sprite.texture = atlases[0]
	sprite.offset = offsets[0]
	sprite.pixel_size = 1.0 / float(meta.get("pixels_per_meter", PIXELS_PER_METER))
	sprite.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	sprite.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	sprite.alpha_cut = SpriteBase3D.ALPHA_CUT_DISCARD
	sprite.shaded = true
	sprite.double_sided = false
	sprite.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	sprite.material_override = _material(sheet, raw_texture)
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
