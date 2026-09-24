class_name PowerData
extends Resource
## Energia do mapa (gerado a partir do jogo web).

## Segurar E no disjuntor por este tempo (s).
@export var breaker_hold_time: float = 2.0
## Luzes comuns ficam nesta fração sem energia.
@export var lamp_factor_off: float = 0.55
## As luzes voltam piscando por este tempo ao ligar (s).
@export var restore_flicker_time: float = 1.4
