class_name BloodMoonEvent
extends WorldEvent
## Lua de Sangue: escuridão avermelhada, zumbis mais rápidos e dinheiro e score em dobro.


func _init() -> void:
	id = &"blood_moon"


func start() -> void:
	duration = float(config.get("duration_time", 25.0))
	ZombieBase.event_speed = float(config.get("zombie_speed", 1.3))
	Events.reward_multiplier_changed.emit(float(config.get("reward_multiplier", 2.0)))
	system.world.set_event_mood(id, true, config)


func end() -> void:
	ZombieBase.event_speed = 1.0
	Events.reward_multiplier_changed.emit(1.0)
	system.world.set_event_mood(id, false, config)
