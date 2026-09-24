class_name PlayerData
extends Resource
## Atributos do jogador. Gerado a partir do jogo web (npm run godot:data).

@export var starting_weapon: WeaponData
@export var knife: MeleeData
## Velocidade andando para a frente (m/s).
@export var move_speed: float = 6.25
@export var max_health: float = 100.0
## Armadura (absorve dano antes da vida); começa vazia, vem de power-ups.
@export var max_armor: float = 100.0
## Tempo invulnerável depois de levar dano (s).
@export var invulnerability_time: float = 0.4
## Velocidade andando de lado e de costas, em relação à mira.
@export var strafe_multiplier: float = 0.85
@export var backpedal_multiplier: float = 0.6
## Tempo sem levar dano até começar a regenerar (s) e vida por segundo.
@export var regen_delay: float = 5.0
@export var regen_per_second: float = 6.0
## Armas carregadas ao mesmo tempo e tempo para trocar (s).
@export var inventory_slots: int = 2
@export var switch_time: float = 0.35
