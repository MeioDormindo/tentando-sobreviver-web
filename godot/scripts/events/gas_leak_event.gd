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
var _cloud: MeshInstance3D
var _light: OmniLight3D


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
	var sphere := SphereMesh.new()
	sphere.radius = float(config.get("radius", 3.75))
	sphere.height = sphere.radius * 1.2
	sphere.material = EventFx.glow(GAS, 0.0, 0.6)
	_cloud = MeshInstance3D.new()
	_cloud.mesh = sphere
	_cloud.scale = Vector3.ONE * 0.1
	_node.add_child(_cloud)
	_light = EventFx.light(GAS, 1.2, sphere.radius * 1.4)
	_light.position.y = 1.0
	_node.add_child(_light)
	valve = GasValve.new()
	valve.hold_time = float(WorldEventData.shared().interactions.get("valve", {}).get("hold_time", 1.5))
	_node.add_child(valve)
	# A nuvem cresce durante o aviso.
	var tween := _cloud.create_tween().set_parallel()
	tween.tween_property(_cloud, "scale", Vector3.ONE, _tick)
	tween.tween_property(_cloud.mesh.material, "albedo_color:a", 0.2, _tick)


func update(delta: float) -> bool:
	if valve.closed:
		return false
	_elapsed += delta
	_light.light_energy = 1.0 + 0.3 * sin(_elapsed * 3.0)
	_tick -= delta
	if _tick <= 0.0:
		_tick = float(config.get("tick_time", 0.4))
		system.damage_area(center, float(config.get("radius", 3.75)), float(config.get("player_damage_per_tick", 5)), float(config.get("zombie_damage_per_tick", 12)))
	return true


func end() -> void:
	if is_instance_valid(_node):
		valve.remove_from_group(&"interactable")
		var tween := _node.create_tween()
		tween.tween_property(_cloud.mesh.material, "albedo_color:a", 0.0, 1.5)
		tween.tween_callback(_node.queue_free)
	_node = null
