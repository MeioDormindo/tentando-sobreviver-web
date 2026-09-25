class_name PixelShapes
extends RefCounted
## Formas em pixel art geradas na hora, brancas (a cor entra pelo modulate), para marcas no
## chão: anel pontilhado (onda de choque) e disco de aviso (anel com o miolo em pontilhado).

const SIZE := 64

static var _textures: Dictionary = {}


## Textura: "ring" (só o anel) ou "disc" (anel e miolo pontilhado).
static func texture(kind: String) -> ImageTexture:
	if _textures.has(kind):
		return _textures[kind]
	var image := Image.create(SIZE, SIZE, false, Image.FORMAT_RGBA8)
	var half := SIZE * 0.5
	for y in SIZE:
		for x in SIZE:
			var d := Vector2(x + 0.5 - half, y + 0.5 - half).length() / half
			var alpha := 0.0
			if d <= 1.0 and d > 0.9:
				alpha = 1.0
			elif d <= 0.9 and d > 0.84 and (x + y) % 2 == 0:
				alpha = 0.7
			elif kind == "disc" and d <= 0.84 and (x % 4 == 0 and y % 4 == 0 or (x + 2) % 4 == 0 and (y + 2) % 4 == 0):
				alpha = 0.55
			image.set_pixel(x, y, Color(1, 1, 1, alpha))
	var result := ImageTexture.create_from_image(image)
	_textures[kind] = result
	return result


## Objeto pequeno em pixel art de pé no chão, voltado para a câmera (ursinho, rádio): a
## base da imagem no chão. ppm = pixels por metro da arte. null sem a imagem.
static func standing(path: String, ppm: float) -> Sprite3D:
	if not ResourceLoader.exists(path):
		return null
	var sprite := Sprite3D.new()
	sprite.texture = load(path)
	sprite.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	sprite.billboard = BaseMaterial3D.BILLBOARD_FIXED_Y
	sprite.alpha_cut = SpriteBase3D.ALPHA_CUT_DISCARD
	sprite.pixel_size = 1.0 / ppm
	sprite.offset = Vector2(0.0, sprite.texture.get_height() * 0.5)
	return sprite


## Sprite deitado no chão com a forma, do raio dado (m), na cor dada.
static func flat(kind: String, color: Color, radius: float) -> Sprite3D:
	var sprite := Sprite3D.new()
	sprite.texture = texture(kind)
	sprite.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	sprite.axis = Vector3.AXIS_Y
	sprite.shaded = false
	sprite.double_sided = true
	sprite.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	sprite.pixel_size = radius * 2.0 / float(SIZE)
	sprite.modulate = color
	sprite.position.y = 0.03
	return sprite
