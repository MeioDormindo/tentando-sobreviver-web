class_name AudioManager
extends Node
## Volumes independentes por barramento (seção 35): Music, SFX, Weapons, Zombies,
## Environment, UI e Voice (layout em data/configs/default_bus_layout.tres).
## Os sons chegam com os assets de áudio; por enquanto só o controle de volume.


## Volume de um barramento de 0 a 1 (0 = mudo).
func set_bus_volume(bus: StringName, linear: float) -> void:
	var index := AudioServer.get_bus_index(bus)
	if index < 0:
		push_warning("AudioManager: barramento %s não existe" % bus)
		return
	AudioServer.set_bus_mute(index, linear <= 0.0)
	AudioServer.set_bus_volume_db(index, linear_to_db(clampf(linear, 0.0001, 1.0)))


func get_bus_volume(bus: StringName) -> float:
	var index := AudioServer.get_bus_index(bus)
	return db_to_linear(AudioServer.get_bus_volume_db(index)) if index >= 0 else 0.0
