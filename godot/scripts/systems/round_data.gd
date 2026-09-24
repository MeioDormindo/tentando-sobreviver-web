class_name RoundData
extends Resource
## Fórmulas dos rounds (seção 17), as mesmas do jogo TS (difficulty.ts): tudo configurável
## no .tres. As funções são puras (dado o round, devolvem o valor), fáceis de testar.

@export_group("Quantidade")
@export var base_zombies: int = 6
@export var zombies_per_round: int = 3

@export_group("Dificuldade")
## Vida: +x por round a partir do 2.
@export var health_per_round: float = 0.12
## A partir deste round a vida cresce mais rápido.
@export var late_from_round: int = 10
@export var late_health_per_round: float = 0.06
@export var damage_per_round: float = 0.08
@export var speed_per_round: float = 0.015

@export_group("Spawn")
## Intervalo entre spawns (s): base + por round, até o mínimo.
@export var spawn_interval_base: float = 1.8
@export var spawn_interval_per_round: float = -0.12
@export var spawn_interval_min: float = 0.4
## Zumbis vivos ao mesmo tempo: base + por round, até o teto.
@export var max_alive_base: float = 8.0
@export var max_alive_per_round: float = 1.75
@export var max_alive_cap: int = 30

@export_group("Tempo")
## Espera antes do primeiro round (s).
@export var first_round_delay: float = 3.5
## Intervalo entre rounds (s).
@export var intermission: float = 10.0

@export_group("Regras")
## Reabastece a munição ao fim de cada round. Serve ao MVP, que ainda não tem compra de
## munição; desligar quando as armas e munição na parede existirem.
@export var refill_ammo_on_round_end: bool = true


func total_zombies(round_number: int) -> int:
	return base_zombies + _r(round_number) * zombies_per_round


func health_multiplier(round_number: int) -> float:
	var r := _r(round_number)
	return 1.0 + (r - 1) * health_per_round + maxi(0, r - late_from_round) * late_health_per_round


func damage_multiplier(round_number: int) -> float:
	return 1.0 + (_r(round_number) - 1) * damage_per_round


func speed_multiplier(round_number: int) -> float:
	return 1.0 + (_r(round_number) - 1) * speed_per_round


func spawn_interval(round_number: int) -> float:
	return maxf(spawn_interval_min, spawn_interval_base + (_r(round_number) - 1) * spawn_interval_per_round)


func max_alive(round_number: int) -> int:
	return mini(max_alive_cap, int(max_alive_base + (_r(round_number) - 1) * max_alive_per_round))


func _r(round_number: int) -> int:
	return maxi(1, round_number)
