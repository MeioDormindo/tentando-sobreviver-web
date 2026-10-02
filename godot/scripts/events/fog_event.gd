class_name FogEvent
extends WorldEvent
## Neblina: tudo mais escuro e enevoado, e a lanterna alcança menos.


func _init() -> void:
	id = &"fog"


func start() -> void:
	duration = float(config.get("duration_time", 25.0))
	system.world.set_event_mood(id, true, config)
	for someone in Players.victims(system.player):
		(someone as Player).set_flashlight_factor(float(config.get("flashlight_factor", 0.6)))


func end() -> void:
	system.world.set_event_mood(id, false, config)
	for someone in Players.victims(system.player):
		(someone as Player).set_flashlight_factor(1.0)


func client_start(_params: Dictionary) -> void:
	start()


func client_end() -> void:
	end()
