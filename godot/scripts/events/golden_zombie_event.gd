class_name GoldenZombieEvent
extends WorldEvent
## Zumbi Dourado: um zumbi brilhante e rápido que foge de você. Se morrer antes de escapar,
## solta um Golden Drop e dinheiro; senão some no escuro.

const GOLD := Color(1.0, 0.83, 0.35)
const HIDEOUTS := 10
const RETHINK := 0.7

var zombie: ZombieBase
var _hideouts: Array[Vector3] = []
var _elapsed := 0.0
var _think := 0.0
var _last_position := Vector3.ZERO


func _init() -> void:
	id = &"golden_zombie"


func can_start() -> bool:
	return system.pick_floor_point(9.4, 21.9, 20) != null


func start() -> void:
	_elapsed = 0.0
	_think = 0.0
	_hideouts.clear()
	for i in HIDEOUTS * 3:
		if _hideouts.size() >= HIDEOUTS:
			break
		var spot: Variant = system.pick_floor_point(4.7, 43.75, 10)
		if spot is Vector3:
			_hideouts.append(spot)
	var point: Variant = system.pick_floor_point(9.4, 21.9)
	var at: Vector3 = point if point is Vector3 else system.player.global_position + Vector3(9.4, 0, 0)
	var data := system.spawn_manager.type_data(&"runner").duplicate() as ZombieData
	data.max_health = float(config.get("health", 450)) + float(config.get("health_per_wave", 60)) * system.round_manager.round_number
	data.move_speed = float(config.get("speed", 4.7))
	data.points_kill = 0
	data.damage = 5.0
	zombie = ZombieFactory.create(data, system.player, 1.0, 1.0, 1.0)
	zombie.name = "GoldenZombie"
	zombie.position = system.spawn_manager.container.to_local(at + Vector3.UP * 0.1)
	system.spawn_manager.container.add_child(zombie)
	Events.zombies_summoned.emit(1)
	# Todo em ouro (folha zombie_golden, com coroa), brilhando e soltando faíscas douradas;
	# marca própria no minimapa.
	zombie.add_to_group(&"minimap_golden")
	if zombie.model:
		zombie.model.set_sheet("zombie_golden")
		zombie.model.set_glow(Color(1.0, 0.8, 0.3, 0.55))
	else:
		for mesh: MeshInstance3D in zombie.find_children("*", "MeshInstance3D", true, false):
			mesh.material_override = EventFx.glow(GOLD, 1.0, 0.6)
	var sparkle := Node3D.new()
	sparkle.position.y = 1.0
	zombie.add_child(sparkle)
	var sparks := PixelFx.attach_loop(sparkle, "spark", 1.1)
	if sparks:
		sparks.modulate = GOLD.lightened(0.3)
	var light := EventFx.light(GOLD, 2.0, 3.0)
	light.position.y = 1.2
	zombie.add_child(light)
	_last_position = at


func update(delta: float) -> bool:
	if zombie == null:
		return false
	# Morreu (tiro, explosão...): prêmio no lugar.
	if not is_instance_valid(zombie) or not zombie.is_alive():
		zombie = null
		var reward := int(config.get("reward", 1000))
		var power_ups := system.get_tree().get_first_node_in_group(&"power_ups") as PowerUpSystem
		if power_ups:
			power_ups.spawn_drop(&"golden", _last_position)
		system.points_manager.add(reward, false)
		SpecialFire.flash(system.get_tree(), _last_position + Vector3.UP, 3.0, GOLD)
		Events.toast.emit("ZUMBI DOURADO ABATIDO!  +%d" % reward)
		return false
	_last_position = zombie.global_position
	_elapsed += delta
	# Foge para o esconderijo mais longe de você quando você chega perto.
	_think -= delta
	if _think <= 0.0:
		_think = RETHINK
		var player_at := system.player.global_position
		if zombie.global_position.distance_to(player_at) < float(config.get("flee_range", 11.9)) or zombie.flee_goal == null:
			var best := _last_position
			var best_distance := -1.0
			for spot in _hideouts:
				var distance := spot.distance_to(player_at)
				if distance > best_distance:
					best = spot
					best_distance = distance
			zombie.flee_goal = best
	# Escapou.
	if _elapsed >= float(config.get("escape_time", 20.0)):
		Events.toast.emit("O ZUMBI DOURADO ESCAPOU")
		var escaped := zombie
		zombie = null
		escaped.take_damage(DamageInfo.new(escaped.health.current + 1.0, DamageInfo.Kind.ENVIRONMENT, null, false, escaped.global_position))
		return false
	return true


func end() -> void:
	zombie = null
