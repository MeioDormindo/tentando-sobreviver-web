class_name ContainmentBreachEvent
extends WorldEvent
## Contenção Rompida (Hospital): as portas de isolamento da UTI/Enfermaria se rompem, luz de
## emergência piscando (mesmo efeito do Apagão) e sirene (mesma da Alarme de Emergência), e um
## grupo de zumbis entra de uma vez pelos pontos de isolamento — reforço localizado, não o
## round inteiro (diferente da Horda).

var _siren: Dictionary = {}


func _init() -> void:
	id = &"containment_breach"


func can_start() -> bool:
	return HospitalEvents.in_hospital(system) and not _isolation_points().is_empty()


func start() -> void:
	duration = float(config.get("duration_time", 25.0))
	system.world.set_event_mood(id, true, config)
	Audio.play("evt_power_down", "world", 0.9, 0.0)
	if system.player:
		_siren = Audio.loop_at("evt_siren", system.player, "ambience", 0.8, 3000.0)
	var points := _isolation_points()
	points.shuffle()
	var types: Array = config.get("types", [&"walker", &"walker", &"runner"])
	var spawned := 0
	for i in int(config.get("count", 5)):
		if system.spawn_manager.spawn_at(types.pick_random(), points[i % points.size()]):
			spawned += 1
	if spawned > 0:
		Events.zombies_summoned.emit(spawned)


func end() -> void:
	system.world.set_event_mood(id, false, config)
	if not _siren.is_empty():
		Audio.stop_loop(_siren, 1.0)
		_siren = {}


## Pontos de spawn já existentes na UTI e na Enfermaria (isolamento).
func _isolation_points() -> Array[Vector3]:
	var points: Array[Vector3] = []
	for point in system.world.active_spawn_points(999):
		if system.world.area_of(point) in [&"icu", &"ward"]:
			points.append(point)
	return points


func client_start(_params: Dictionary) -> void:
	system.world.set_event_mood(id, true, config)
	Audio.play("evt_power_down", "world", 0.9, 0.0)
	var listener := Players.local_player()
	if listener:
		_siren = Audio.loop_at("evt_siren", listener, "ambience", 0.8, 3000.0)


func client_end() -> void:
	end()
