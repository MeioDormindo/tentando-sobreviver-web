class_name PowerSystem
extends Node
## Energia do mapa (como no jogo web / CoD): a partida começa sem energia. Perks (menos o
## Quick Revive) e o Weapon Lab só funcionam depois de ligar o disjuntor. As luzes do mapa
## ficam mais fracas até lá e voltam piscando. Máquinas perguntam `is_on` pelo grupo.

@export var data: PowerData

var is_on: bool = false

## Apagão (evento do mapa): as luminárias apagam mesmo com energia.
var blackout: bool = false

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


## Apagão: as luzes piscam e apagam (ou voltam piscando).
func set_blackout(on: bool, flicker_time: float = 1.4) -> void:
	if blackout == on:
		return
	blackout = on
	for light: Light3D in _lights:
		if not is_instance_valid(light):
			continue
		var energy: float = _lights[light] * (1.0 if is_on else data.lamp_factor_off)
		var tween := create_tween()
		for i in 5:
			tween.tween_property(light, "light_energy", energy * (1.0 if i % 2 == 0 else 0.15), flicker_time / 6.0)
		tween.tween_property(light, "light_energy", 0.0 if on else energy, flicker_time / 6.0)


func _flicker_back(light: Light3D, energy: float) -> void:
	var tween := create_tween()
	var steps := 6
	for i in steps:
		tween.tween_property(light, "light_energy", energy * (0.2 if i % 2 == 0 else 1.0), data.restore_flicker_time / steps)
	tween.tween_property(light, "light_energy", energy, 0.05)
