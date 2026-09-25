class_name PowerUpData
extends Resource
## Power-ups (gerado a partir do jogo web): o que cai dos zumbis, com que chance e o que faz.

## id → {name, color, duration} (duration 0 = efeito instantâneo).
@export var power_ups: Dictionary = {}
## Chance de um zumbi abatido pelo jogador soltar um power-up comum e, à parte, o Golden Drop.
@export var drop_chance: float = 0.05
@export var golden_chance: float = 0.005
## Pesos dos power-ups comuns no sorteio.
@export var drop_table: Dictionary = {}
@export var max_per_round: int = 4
## Tempo no chão antes de sumir e quando começa a piscar (s); raio para pegar (m).
@export var lifetime: float = 30.0
@export var blink_at: float = 22.0
@export var pickup_radius: float = 0.94

@export_group("Efeitos")
@export var cash_multiplier: float = 2.0
@export var speed_multiplier: float = 1.35
@export var nuke_reward: int = 400
@export var carpenter_reward: int = 200

@export_group("Golden Drop")
## Pesos de cada prêmio: weapon, money, perk, fury.
@export var golden_outcomes: Dictionary = {}
@export var golden_weapons: PackedStringArray = PackedStringArray()
@export var golden_money: int = 2000
@export var fury_duration: float = 20.0
@export var fury_damage_multiplier: float = 2.0
