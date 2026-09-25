class_name WorldEventData
extends Resource
## Eventos do mapa (gerado a partir do jogo web): nomes, pesos no sorteio, agenda e os números
## de cada evento; também os painéis e armadilhas do mapa. Tempos em s, distâncias em m.

## id → {name, hint, color, weight, min_round, cooldown_rounds}.
@export var events: Dictionary = {}
## Agenda: first_wave, chance_per_wave, start_delay_time [min, max], forced {first_wave, every, id}.
@export var schedule: Dictionary = {}
## id do evento → números dele (ex.: &"blackout": {duration_time, extra_darkness...}).
@export var configs: Dictionary = {}
## Painéis e armadilhas: power, alarm, train, trap, valve.
@export var interactions: Dictionary = {}
## Texto da placa de créditos (segredo).
@export var credits: String = ""


func info(id: StringName) -> Dictionary:
	return events.get(id, {})


func config(id: StringName) -> Dictionary:
	return configs.get(id, {})


static var _shared: WorldEventData

## Os dados do jogo (carregados uma vez): painéis e armadilhas do mapa usam sem precisar de ligação.
static func shared() -> WorldEventData:
	if _shared == null:
		_shared = load("res://data/configs/world_events.tres") as WorldEventData
	return _shared
