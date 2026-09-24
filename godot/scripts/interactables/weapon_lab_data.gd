class_name WeaponLabData
extends Resource
## Weapon Lab: Mk II e Mk III (gerado a partir do jogo web).

@export var price_mk2: int = 5000
@export var price_mk3: int = 10000
@export_group("Mk II")
@export var damage_multiplier: float = 1.8
@export var magazine_multiplier: float = 1.5
@export var reserve_multiplier: float = 1.5
@export var reload_multiplier: float = 0.75
@export var fire_rate_multiplier: float = 1.111
@export var extra_pierce: int = 1
@export var tracer_mk2: Color = Color(0.76, 0.55, 1.0)
@export_group("Mk III")
@export var mk3_pellet_multiplier: int = 2
@export var mk3_extra_spread: float = 2.5
@export var tracer_mk3: Color = Color(1.0, 0.83, 0.35)
