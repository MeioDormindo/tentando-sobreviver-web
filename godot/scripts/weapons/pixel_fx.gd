class_name PixelFx
extends RefCounted
## Efeitos em pixel art (npm run godot:sprites → assets/sprites/fx): clarão, faísca,
## explosão, fumaça, sangue, plasma, granada, chama e vento. Cada um é uma tira de quadros;
## aqui vira um sprite voltado para a câmera que toca e some (ou fica, se repete), ou um
## decalque deitado no chão (poças de sangue).

const DIR := "res://assets/sprites/fx/%s"

static var _meta := {}


static func _info(fx_name: String) -> Dictionary:
	if not _meta.has(fx_name):
		var path := (DIR % fx_name) + ".json"
		var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(path)) if FileAccess.file_exists(path) else null
		_meta[fx_name] = parsed if parsed is Dictionary else {}
	return _meta[fx_name]


## Sprite do efeito (sem pôr na cena). `size`: tamanho em metros do quadro (0 = natural).
static func make(fx_name: String, size := 0.0) -> Sprite3D:
	var info := _info(fx_name)
	if info.is_empty() or not ResourceLoader.exists((DIR % fx_name) + ".png"):
		return null
	var sprite := Sprite3D.new()
	sprite.name = "Fx_" + fx_name
	sprite.texture = load((DIR % fx_name) + ".png")
	sprite.hframes = int(info.frames)
	var frame_px := float(info.frame[0])
	var natural := 1.0 / float(info.get("pixels_per_meter", 48))
	sprite.pixel_size = (size / frame_px) if size > 0.0 else natural
	sprite.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	sprite.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	sprite.shaded = false
	sprite.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	sprite.alpha_cut = SpriteBase3D.ALPHA_CUT_DISCARD
	sprite.set_meta(&"fps", float(info.fps))
	sprite.set_meta(&"loop", bool(info.loop))
	return sprite


## Toca o efeito no ponto e some no fim. Devolve o sprite (ou null sem a arte).
static func spawn(tree: SceneTree, fx_name: String, at: Vector3, size := 0.0, speed := 1.0) -> Sprite3D:
	var sprite := make(fx_name, size)
	if sprite == null or tree == null:
		return null
	SpecialFire.world_root(tree).add_child(sprite)
	sprite.global_position = at
	var frames := sprite.hframes
	var duration := float(frames) / maxf(1.0, float(sprite.get_meta(&"fps")) * speed)
	var tween := sprite.create_tween()
	tween.tween_property(sprite, "frame", frames - 1, duration).from(0)
	tween.tween_callback(sprite.queue_free)
	return sprite


## Animação que repete (projéteis): o dono decide quando apagar.
static func attach_loop(parent: Node3D, fx_name: String, size := 0.0) -> Sprite3D:
	var sprite := make(fx_name, size)
	if sprite == null:
		return null
	parent.add_child(sprite)
	var tween := sprite.create_tween().set_loops()
	tween.tween_property(sprite, "frame", sprite.hframes - 1, float(sprite.hframes) / float(sprite.get_meta(&"fps"))).from(0)
	return sprite


## Decalque no chão (poça de sangue): uma variação ao acaso, gira ao acaso e some aos poucos.
static func decal(tree: SceneTree, fx_name: String, at: Vector3, size := 1.0, lifetime := 25.0) -> Sprite3D:
	var sprite := make(fx_name, size)
	if sprite == null or tree == null:
		return null
	sprite.billboard = BaseMaterial3D.BILLBOARD_DISABLED
	sprite.axis = Vector3.AXIS_Y
	sprite.shaded = true
	sprite.frame = randi() % sprite.hframes
	SpecialFire.world_root(tree).add_child(sprite)
	sprite.global_position = Vector3(at.x, 0.015, at.z)
	sprite.rotation.y = randf() * TAU
	var tween := sprite.create_tween()
	tween.tween_interval(lifetime)
	tween.tween_property(sprite, "modulate:a", 0.0, 3.0)
	tween.tween_callback(sprite.queue_free)
	return sprite
