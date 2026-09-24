class_name PowerSystem
extends Node
## Energia do mapa (como no jogo web / CoD): a partida começa sem energia. Perks (menos o
## Quick Revive) e o Weapon Lab só funcionam depois de ligar o disjuntor. As luzes do mapa
## ficam mais fracas até lá e voltam piscando. Máquinas perguntam `is_on` pelo grupo.

@export var data: PowerData

var is_on: bool = false

## Luzes controladas: luz → energia normal.
var _lights: Dictionary = {}


func _ready() -> void:
	add_to_group(&"power_system")


## Registra uma luz do mapa (fica fraca sem energia).
func register_light(light: Light3D) -> void:
	_lights[light] = light.light_energy
	if not is_on:
		light.light_energy *= data.lamp_factor_off


func turn_on() -> bool:
	if is_on:
		return false
	is_on = true
	for light: Light3D in _lights:
		if is_instance_valid(light):
			_flicker_back(light, _lights[light])
	Events.power_changed.emit(true)
	return true


func _flicker_back(light: Light3D, energy: float) -> void:
	var tween := create_tween()
	var steps := 6
	for i in steps:
		tween.tween_property(light, "light_energy", energy * (0.2 if i % 2 == 0 else 1.0), data.restore_flicker_time / steps)
	tween.tween_property(light, "light_energy", energy, 0.05)
