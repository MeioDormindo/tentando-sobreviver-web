class_name HealthComponent
extends Node
## Vida de qualquer personagem (seção 13), por composição: o dono só escuta os sinais.

signal damaged(info: DamageInfo, current: float)
signal health_changed(current: float, maximum: float)
signal died(info: DamageInfo)

@export var max_health: float = 100.0
## Ignora dano (depuração e testes).
@export var invulnerable: bool = false

var current: float = 0.0
## Filtro opcional do dano (ex.: armadura do Blindado): recebe o DamageInfo e devolve o dano final.
var damage_filter: Callable
var is_dead: bool = false


func _ready() -> void:
	reset()


## Volta à vida cheia; `new_max` > 0 troca a vida máxima (ex.: multiplicador do round).
func reset(new_max: float = -1.0) -> void:
	if new_max > 0.0:
		max_health = new_max
	current = max_health
	is_dead = false
	health_changed.emit(current, max_health)


## Aplica o dano e devolve quanto de vida foi realmente tirado.
func apply_damage(info: DamageInfo) -> float:
	if is_dead or invulnerable or info.amount <= 0.0:
		return 0.0
	if damage_filter.is_valid():
		info.amount = damage_filter.call(info)
	var applied := minf(current, info.amount)
	current -= applied
	damaged.emit(info, current)
	health_changed.emit(current, max_health)
	if current <= 0.0:
		is_dead = true
		died.emit(info)
	return applied


func heal(amount: float) -> void:
	if is_dead or amount <= 0.0:
		return
	current = minf(max_health, current + amount)
	health_changed.emit(current, max_health)
