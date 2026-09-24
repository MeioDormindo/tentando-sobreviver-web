class_name PointsData
extends Resource
## Valores da pontuação (seção 23). Os pontos são a moeda da partida (portas, armas, perks).

@export var start_points: int = 500
## Bônus por abate na cabeça (somado aos pontos do zumbi).
@export var headshot_kill_bonus: int = 50
## Bônus por abate na faca.
@export var melee_kill_bonus: int = 60
## Bônus ao completar o round: base + por round.
@export var round_bonus_base: int = 300
@export var round_bonus_per_round: int = 50


func round_bonus(round_number: int) -> int:
	return round_bonus_base + round_bonus_per_round * maxi(1, round_number)
