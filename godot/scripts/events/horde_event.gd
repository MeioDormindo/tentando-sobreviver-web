class_name HordeEvent
extends WorldEvent
## Horda: o round ganha muito mais zumbis, que chegam mais rápido. Dura até o round acabar.


func _init() -> void:
	id = &"horde"
	ends_with_round = true
	at_round_start = true


func start() -> void:
	var rounds := system.round_manager
	var base := rounds.data.total_zombies(rounds.round_number, Session.player_count())
	rounds.add_enemies(roundi(base * float(config.get("extra_enemies_ratio", 0.6))))
	rounds.set_spawn_modifier(id, config)
	# A horda chega de uma vez (uma leva grande na hora; o resto do round vem mais rápido).
	rounds.burst(int(config.get("burst", 8)) + 2 * (Session.player_count() - 1))
	Events.screen_shake.emit(0.5, 0.12)


func end() -> void:
	system.round_manager.set_spawn_modifier(id, {})


func client_start(_params: Dictionary) -> void:
	Events.screen_shake.emit(0.5, 0.12)
