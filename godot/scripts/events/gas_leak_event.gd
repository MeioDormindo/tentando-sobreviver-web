class_name GasLeakEvent
extends WorldEvent
## Vazamento de gás: um cano se rompe perto do jogador e uma nuvem verde toma a área por um
## tempo; quem fica dentro (jogador e zumbis) perde vida. Segurar E na válvula fecha o gás.

const GAS := Color(0.6, 0.8, 0.2)

var center := Vector3.ZERO
var valve: GasValve

var _elapsed := 0.0
var _tick := 0.0
var _node: Node3D
var _cloud: Node3D
var _light: OmniLight3D
var _hiss: Dictionary = {}


func _init() -> void:
	id = &"gas_leak"


func can_start() -> bool:
	var range_m: Array = config.get("distance", [5.3, 11.9])
	return system.pick_floor_point(float(range_m[0]), float(range_m[1]), 20) != null


func start() -> void:
	duration = float(config.get("duration_time", 22.0))
	var range_m: Array = config.get("distance", [5.3, 11.9])
	var point: Variant = system.pick_floor_point(float(range_m[0]), float(range_m[1]))
	center = point if point is Vector3 else system.player.global_position + Vector3(float(range_m[0]), 0, 0)
	_elapsed = 0.0
	_tick = float(config.get("warning_time", 2.5))
	_node = Node3D.new()
	_node.name = "GasLeak"
	system.world_root().add_child(_node)
	_node.global_position = center
	# Nuvem em pixel art: poça tingida no chão e baforadas rolando por cima.
	var radius := float(config.get("radius", 3.75))
	_cloud = Node3D.new()
	_cloud.scale = Vector3.ONE * 0.1
	_node.add_child(_cloud)
	var pool := PixelFx.attach_loop(_cloud, "pool", radius * 2.0)
	if pool:
		pool.billboard = BaseMaterial3D.BILLBOARD_DISABLED
		pool.axis = Vector3.AXIS_Y
		pool.alpha_cut = SpriteBase3D.ALPHA_CUT_DISABLED
		pool.position.y = 0.03
		pool.modulate = Color(GAS, 0.35)
	for i in 6:
		var puff := PixelFx.attach_loop(_cloud, "gas", radius * 1.1)
		if puff:
			puff.alpha_cut = SpriteBase3D.ALPHA_CUT_DISABLED
			puff.modulate = Color(GAS.lightened(0.2), 0.55)
			var angle := i * TAU / 6.0
			puff.position = Vector3(cos(angle) * radius * 0.5, 0.8 + (i % 2) * 0.5, sin(angle) * radius * 0.5)
	_light = EventFx.light(GAS, 1.2, radius * 1.4)
	_light.position.y = 1.0
	_node.add_child(_light)
	_hiss = Audio.loop_at("evt_gas", center, "world", 0.9, 25.0)
	valve = GasValve.new()
	valve.hold_time = float(WorldEventData.shared().interactions.get("valve", {}).get("hold_time", 1.5))
	_node.add_child(valve)
	# A nuvem cresce durante o aviso.
	var tween := _cloud.create_tween().set_parallel()
	tween.tween_property(_cloud, "scale", Vector3.ONE, _tick)



func update(delta: float) -> bool:
	if valve.closed:
		Audio.play_at("lab_upgrade", center, "world", 0.6, -1.0, 0.0, 0.7)
		return false
	_elapsed += delta
	_light.light_energy = 1.0 + 0.3 * sin(_elapsed * 3.0)
	_tick -= delta
	if _tick <= 0.0:
		_tick = float(config.get("tick_time", 0.4))
		system.damage_area(center, float(config.get("radius", 3.75)), float(config.get("player_damage_per_tick", 5)), float(config.get("zombie_damage_per_tick", 12)))
	return true


func end() -> void:
	Audio.stop_loop(_hiss, 1.5)
	_hiss = {}
	if is_instance_valid(_node):
		valve.remove_from_group(&"interactable")
		var tween := _node.create_tween()
		tween.tween_property(_cloud, "scale", Vector3.ONE * 0.05, 1.5)
		tween.tween_callback(_node.queue_free)
	_node = null
