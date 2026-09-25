class_name AlarmEvent
extends WorldEvent
## Alarme de emergência: luzes vermelhas piscando e zumbis chegando mais rápido (e mais deles
## vivos ao mesmo tempo). O painel do alarme desliga pagando.


func _init() -> void:
	id = &"emergency_alarm"
	ends_with_round = true


func start() -> void:
	duration = float(config.get("duration_time", 20.0))
	system.world.set_event_mood(id, true, config)
	system.round_manager.set_spawn_modifier(id, config)


func end() -> void:
	system.world.set_event_mood(id, false, config)
	system.round_manager.set_spawn_modifier(id, {})
