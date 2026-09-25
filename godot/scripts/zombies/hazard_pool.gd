class_name HazardPool
extends Node3D
## Poça de ácido (Cuspidor) ou nuvem de gás (Rastejante), como no jogo web: fere o jogador
## enquanto ele estiver dentro e some depois de um tempo.

var radius: float = 1.4
var dps: float = 12.0
var duration: float = 3.5

var _left := 0.0
var _visuals: Array[Sprite3D] = []
var _alpha := 0.85
## Pouco tempo de vida restante: o visual some aos poucos.
const FADE_TIME := 0.8


## `params`: radius, duration_time, dps (como exportado do jogo web). gas = nuvem por cima.
func setup(params: Dictionary, color: Color, gas := false) -> void:
	radius = float(params.get("radius", radius))
	dps = float(params.get("dps", dps))
	duration = float(params.get("duration_time", duration))
	_left = duration
	# Pixel art (npm run godot:sprites): poça borbulhando no chão e, no gás, a nuvem rolando.
	var pool := PixelFx.attach_loop(self, "pool", radius * 2.2)
	if pool:
		pool.billboard = BaseMaterial3D.BILLBOARD_DISABLED
		pool.axis = Vector3.AXIS_Y
		pool.position.y = 0.03
		pool.alpha_cut = SpriteBase3D.ALPHA_CUT_DISABLED
		pool.modulate = Color(color, 0.55 if gas else _alpha)
		_visuals.append(pool)
	if gas:
		for i in 3:
			var cloud := PixelFx.attach_loop(self, "gas", radius * 1.5)
			if cloud:
				cloud.alpha_cut = SpriteBase3D.ALPHA_CUT_DISABLED
				cloud.modulate = Color(color.lightened(0.15), 0.6)
				cloud.position = Vector3(cos(i * TAU / 3.0) * radius * 0.4, 0.6 + i * 0.15, sin(i * TAU / 3.0) * radius * 0.4)
				_visuals.append(cloud)
	add_to_group(&"hazards")


func _physics_process(delta: float) -> void:
	_left -= delta
	if _left <= 0.0:
		queue_free()
		return
	var fade := clampf(_left / FADE_TIME, 0.0, 1.0)
	for visual in _visuals:
		if not visual.has_meta(&"alpha"):
			visual.set_meta(&"alpha", visual.modulate.a)
		visual.modulate.a = float(visual.get_meta(&"alpha")) * fade
	for node in get_tree().get_nodes_in_group(&"player"):
		var player := node as CharacterBase
		if player == null or not player.is_alive():
			continue
		var offset := player.global_position - global_position
		offset.y = 0.0
		if offset.length() <= radius:
			player.take_damage(DamageInfo.new(dps * delta, DamageInfo.Kind.ENVIRONMENT, self, false, global_position))
