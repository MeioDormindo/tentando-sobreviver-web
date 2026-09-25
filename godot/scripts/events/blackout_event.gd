class_name BlackoutEvent
extends WorldEvent
## Apagão: as luminárias piscam e apagam; sobram a lanterna e o brilho das máquinas. O painel
## de energia religa pagando.


func _init() -> void:
	id = &"blackout"


## Sem energia não há o que apagar.
func can_start() -> bool:
	var power := system.get_tree().get_first_node_in_group(&"power_system") as PowerSystem
	return power != null and power.is_on


func start() -> void:
	duration = float(config.get("duration_time", 25.0))
	system.world.set_event_mood(id, true, config)


func end() -> void:
	system.world.set_event_mood(id, false, config)
