class_name CharacterBase
extends CharacterBody3D
## Base de jogador, zumbis e NPCs (seção 13): vida por composição (filho HealthComponent),
## gravidade e o sinal de morte. Movimento e comportamento ficam nas subclasses.

signal died(character: CharacterBase, info: DamageInfo)

@export var gravity: float = 20.0

@onready var health: HealthComponent = $HealthComponent


func _ready() -> void:
	health.died.connect(_on_health_died)


func take_damage(info: DamageInfo) -> float:
	return health.apply_damage(info)


func is_alive() -> bool:
	return not health.is_dead


func apply_gravity(delta: float) -> void:
	if is_on_floor():
		velocity.y = minf(velocity.y, 0.0)
	else:
		velocity.y -= gravity * delta


## Chamado quando a vida chega a zero; subclasses estendem (chamando super).
func _on_health_died(info: DamageInfo) -> void:
	died.emit(self, info)
