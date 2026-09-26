class_name RiseOfDeadEvent
extends WorldEvent
## Levante dos Mortos (Templo): as tampas dos sarcófagos das áreas abertas deslizam e esqueletos
## saem de dentro, um por vez (contam no round).

var _tombs: Array[Node3D] = []
var _left := 0
var _next := 0.0


func _init() -> void:
	id = &"rise_of_dead"


func can_start() -> bool:
	return TempleEvents.in_temple(system) and not _open_tombs().is_empty()


func start() -> void:
	_tombs = _open_tombs()
	_tombs.shuffle()
	_tombs = _tombs.slice(0, int(config.get("tombs", 4)))
	_left = _tombs.size() * int(config.get("per_tomb", 2))
	_next = 0.8
	for tomb in _tombs:
		var lid := tomb.find_child("lid", true, false) as Node3D
		if lid:
			lid.create_tween().tween_property(lid, "position:x", lid.position.x + 0.9, 1.2)
		SpecialFire.flash(system.get_tree(), tomb.global_position + Vector3.UP, 1.4, Color(0.7, 0.8, 1.0))
	Audio.play("boss_summon", "world", 0.7)


func update(delta: float) -> bool:
	_next -= delta
	if _next <= 0.0 and _left > 0:
		_next = float(config.get("every_time", 1.4))
		var tomb := _tombs[_left % _tombs.size()]
		if is_instance_valid(tomb):
			var type := &"skeleton_archer" if randf() < float(config.get("archer_chance", 0.25)) else &"skeleton"
			var zombie := system.spawn_manager.spawn_at(type, tomb.global_position + Vector3(randf_range(-1.5, 1.5), 0, 1.6))
			if zombie:
				Events.zombies_summoned.emit(1)
		_left -= 1
	return _left > 0


## Sarcófagos (objetos do mapa) nas áreas abertas.
func _open_tombs() -> Array[Node3D]:
	var tombs: Array[Node3D] = []
	for node in system.world.find_children("sarcophagus", "StaticBody3D", true, false):
		var body := node as Node3D
		if system.world.is_area_open(system.world.area_of(body.global_position)):
			tombs.append(body)
	return tombs
