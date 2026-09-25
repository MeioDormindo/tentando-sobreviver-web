class_name Tracer
extends MeshInstance3D
## Projétil visível dos tiros instantâneos (hitscan): uma bala luminosa em pixel art (cabeça
## branca-amarelada, rastro na cor da arma que some) que voa do cano até onde o tiro acertou.
## O dano já foi aplicado na hora; isto é só o visual. Deitado no plano do chão, na altura do
## tiro (a câmera olha de cima), com mistura aditiva para brilhar no escuro.

const SPEED := 75.0
const LENGTH := 2.0
const WIDTH := 0.2
const PIXELS := Vector2i(24, 3)

static var _textures: Dictionary = {}

var _from: Vector3
var _to: Vector3
var _travel := 0.0
var _distance := 0.0
var _speed := SPEED
var _beam_left := -1.0


static func fire(parent: Node, from: Vector3, to: Vector3, color: Color, speed := SPEED) -> Tracer:
	var tracer := Tracer.new()
	tracer._from = from
	tracer._to = to
	tracer._distance = from.distance_to(to)
	tracer._speed = speed
	var quad := QuadMesh.new()
	quad.size = Vector2(WIDTH, 1.0)
	quad.orientation = PlaneMesh.FACE_Y
	tracer.mesh = quad
	var material := StandardMaterial3D.new()
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	material.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	material.albedo_texture = _texture(color)
	material.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	material.cull_mode = BaseMaterial3D.CULL_DISABLED
	tracer.material_override = material
	tracer.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	tracer.top_level = true
	parent.add_child(tracer)
	tracer._place()
	return tracer


## Feixe instantâneo (raio, vento): o trecho inteiro, em zigue-zague, some em ~0,1 s.
static func beam(parent: Node, from: Vector3, to: Vector3, color: Color, seconds := 0.1) -> Tracer:
	var tracer := fire(parent, from, to, color, 0.0)
	tracer._beam_left = seconds
	var material := tracer.material_override as StandardMaterial3D
	material.albedo_texture = _bolt_texture()
	material.albedo_color = color.lightened(0.2)
	material.texture_repeat = true
	material.uv1_scale = Vector3(1.0, maxf(1.0, tracer._distance / 0.6), 1.0)
	tracer._place()
	return tracer


static var _bolt: ImageTexture


## Raio em pixels: linha quebrada de 1 px com brilho de 1 px dos lados, 7×24, que emenda.
static func _bolt_texture() -> ImageTexture:
	if _bolt:
		return _bolt
	var image := Image.create(7, 24, false, Image.FORMAT_RGBA8)
	var x := 3
	for y in 24:
		if y % 4 == 0 and y > 0 and y < 20:
			x = clampi(x + (1 if (y / 4) % 2 == 0 else -1) * 2, 1, 5)
		elif y >= 20:
			x = clampi(x + signi(3 - x), 1, 5)
		image.set_pixel(x, y, Color(1, 1, 1, 1))
		image.set_pixel(x - 1, y, Color(1, 1, 1, 0.45))
		image.set_pixel(x + 1, y, Color(1, 1, 1, 0.45))
	_bolt = ImageTexture.create_from_image(image)
	return _bolt


## Rastro em pixels: 24×3, cabeça quase branca, corpo na cor da arma, cauda pontilhada.
static func _texture(color: Color) -> ImageTexture:
	var key := color.to_html(false)
	if _textures.has(key):
		return _textures[key]
	var image := Image.create(PIXELS.y, PIXELS.x, false, Image.FORMAT_RGBA8)
	for i in PIXELS.x:
		# i = 0 na cabeça (topo da imagem), cresce para a cauda.
		var t := float(i) / float(PIXELS.x - 1)
		var core := color.lerp(Color(1.0, 0.97, 0.85), clampf(1.0 - t * 4.0, 0.0, 1.0))
		for x in PIXELS.y:
			var edge := x != 1
			var alpha := 1.0 - t
			if edge:
				alpha *= 0.45 if i < 6 else 0.0
			if t > 0.55 and (i + x) % 2 == 1:
				alpha = 0.0
			image.set_pixel(x, i, Color(core, clampf(alpha, 0.0, 1.0)))
	var texture := ImageTexture.create_from_image(image)
	_textures[key] = texture
	return texture


func _process(delta: float) -> void:
	if _beam_left >= 0.0:
		_beam_left -= delta
		if _beam_left < 0.0:
			queue_free()
		return
	_travel += _speed * delta
	if _travel >= _distance + LENGTH:
		queue_free()
		return
	_place()


## Segmento visível: da cauda (atrás) até a cabeça (na frente), dentro de origem → alvo.
func _place() -> void:
	var direction := (_to - _from) / maxf(_distance, 0.001)
	var head := _distance if _beam_left >= 0.0 else minf(_travel + 0.35, _distance)
	var tail := 0.0 if _beam_left >= 0.0 else maxf(0.0, head - LENGTH)
	var length := head - tail
	if length <= 0.01:
		visible = false
		return
	visible = true
	var mid := _from + direction * (tail + head) * 0.5
	var flat := Vector3(direction.x, 0.0, direction.z)
	if flat.length() < 0.001:
		flat = Vector3.FORWARD
	# Eixo Z local (a altura da imagem) ao longo do tiro; a cabeça (topo da imagem) na frente.
	var basis := Basis.looking_at(-flat.normalized(), Vector3.UP)
	global_transform = Transform3D(basis.scaled_local(Vector3(1.0, 1.0, length)), mid)
