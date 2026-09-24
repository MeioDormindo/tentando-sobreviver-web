class_name MeleeData
extends Resource
## Dados do golpe corpo a corpo (faca). Gerado a partir do jogo web (npm run godot:data).

@export var damage: float = 150.0
## Alcance do golpe (m, do centro do jogador).
@export var reach: float = 1.5
## Abertura do arco (graus).
@export var arc_degrees: float = 120.0
## Tempo mínimo entre golpes (s).
@export var cooldown: float = 1.0
## Tempo do início do golpe até o acerto (s).
@export var windup: float = 0.07
## Tempo em que as armas ficam paradas por causa do golpe (s).
@export var busy_time: float = 0.38
## Se houver um zumbi à frente até esta distância (m), o jogador avança até ele.
@export var lunge_range: float = 3.75
@export var lunge_speed: float = 17.5
@export var lunge_time: float = 0.13
## Velocidade do empurrão no zumbi atingido (m/s).
@export var knockback: float = 8.0
