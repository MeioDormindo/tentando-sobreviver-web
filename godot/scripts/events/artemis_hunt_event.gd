class_name ArtemisHuntEvent
extends WorldEvent
## Caçada de Artemis (Templo): uma matilha de sátiros e lobos infernais surge perto do jogador e
## corre atrás dele (contam no round).

var _next := 0.0
var _satyrs := 0
var _wolves := 0


func _init() -> void:
	id = &"artemis_hunt"


func can_start() -> bool:
	return TempleEvents.in_temple(system)


func start() -> void:
	duration = float(config.get("duration_time", 25.0))
	_satyrs = int(config.get("satyrs", 8))
	_wolves = int(config.get("wolves", 3))
	_next = 0.5
	Audio.play("hound_howl", "world", 0.8)


func update(delta: float) -> bool:
	_next -= delta
	if _next <= 0.0 and (_satyrs > 0 or _wolves > 0):
		_next = float(config.get("every_time", 2.2))
		var type := &"hellwolf" if _wolves > 0 and (_satyrs == 0 or randf() < 0.3) else &"satyr"
		var rounds := system.round_manager
		var number := maxi(1, rounds.round_number) if rounds else 1
		var data := rounds.data if rounds else null
		var zombie := system.spawn_manager.spawn_near_player(type, float(config.get("min_distance", 7.0)), float(config.get("max_distance", 14.0)),
			data.health_multiplier(number) if data else 1.0, data.damage_multiplier(number) if data else 1.0, 1.0)
		if zombie:
			Events.zombies_summoned.emit(1)
			if type == &"hellwolf":
				_wolves -= 1
			else:
				_satyrs -= 1
	return true
