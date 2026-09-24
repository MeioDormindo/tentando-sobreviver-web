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

@export_group("Composição")
## Tipos por round: [{"from_round": n, "weights": {&"walker": 100, ...}}] (vale o último cujo
## from_round já chegou).
@export var composition: Array = []
## Composição própria de um mapa (id do mapa → tabela como a de cima).
@export var composition_by_map: Dictionary = {}
## Máximo de vivos ao mesmo tempo por tipo (tipos fortes não dominam a tela).
@export var max_alive_per_type: Dictionary = {}
@export var late_caps_from_round: int = 16
@export var late_max_alive_per_type: Dictionary = {}

@export_group("Rodadas especiais")
## Boss de cada mapa (id do mapa → id do boss).
@export var boss_by_map: Dictionary = {}
## Rounds de boss (a rodada dos cães nunca cai neles).
@export var boss_rounds: PackedInt32Array = PackedInt32Array()
## Rodada dos cães por mapa: first_round, every, per_round, cap, max_alive, spawn_interval,
## spawn_distance_min/max, fog_darkness, flashlight_factor.
@export var hound_rounds: Dictionary = {}


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


## Sorteia o tipo do próximo zumbi (função pura): pesos da composição do round (do mapa, se
## houver), sem os tipos que já estão no limite de vivos. Vazio se nenhum couber.
func pick_type(round_number: int, map_id: String, alive_by_type: Dictionary, rng: RandomNumberGenerator) -> StringName:
	var table: Array = composition_by_map.get(map_id, composition)
	var weights: Dictionary = {&"walker": 1}
	for entry: Dictionary in table:
		if int(entry.from_round) <= _r(round_number):
			weights = entry.weights
	var total := 0.0
	var options: Array[StringName] = []
	for type: StringName in weights:
		if int(alive_by_type.get(type, 0)) < type_cap(type, round_number):
			options.append(type)
			total += float(weights[type])
	if options.is_empty():
		return &""
	var pick := rng.randf() * total
	for type in options:
		pick -= float(weights[type])
		if pick < 0.0:
			return type
	return options.back()


## Limite de vivos do tipo neste round (sem limite = muito alto).
func type_cap(type: StringName, round_number: int) -> int:
	if _r(round_number) >= late_caps_from_round and late_max_alive_per_type.has(type):
		return int(late_max_alive_per_type[type])
	return int(max_alive_per_type.get(type, 999))


## Este round é uma rodada dos cães neste mapa? (nunca em round de boss)
func is_hound_round(round_number: int, map_id: String) -> bool:
	var cfg: Dictionary = hound_rounds.get(map_id, {})
	if cfg.is_empty() or round_number < int(cfg.first_round) or boss_rounds.has(round_number):
		return false
	return (round_number - int(cfg.first_round)) % int(cfg.every) == 0


## Quantos cães na rodada.
func hound_total(round_number: int, map_id: String) -> int:
	var cfg: Dictionary = hound_rounds.get(map_id, {})
	return mini(int(cfg.get("cap", 0)), roundi(float(cfg.get("per_round", 0)) * round_number))
