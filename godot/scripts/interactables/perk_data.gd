class_name PerkData
extends Resource
## Um perk (gerado a partir do jogo web). Os efeitos são modificadores aplicados pelo
## PerkSystem, não lógica dentro do Player (seção 25).

@export var id: StringName = &""
@export var display_name: String = "Perk"
@export_multiline var description: String = ""
@export var price: int = 2000
@export var color: Color = Color.WHITE
## Quantas vezes pode ser comprado na partida (perks que se gastam, como o Quick Revive).
@export var max_purchases: int = 1
## Funciona sem energia (Quick Revive, como no CoD solo).
@export var works_without_power: bool = false

@export_group("Efeitos")
@export var max_health_bonus: float = 0.0
@export var speed_multiplier: float = 1.0
@export var reload_multiplier: float = 1.0
## Dano extra no headshot (1 = +100%).
@export var headshot_bonus: float = 0.0
@export var regen_multiplier: float = 1.0
@export var damage_multiplier: float = 1.0

@export_group("Quick Revive")
## Ao cair, levanta sozinho (gasta o perk).
@export var self_revive: bool = false
@export var down_time: float = 0.0
@export var revive_push_radius: float = 0.0
@export var revive_push_speed: float = 0.0
