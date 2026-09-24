class_name PerkSystem
extends Node
## Perks do jogador (seção 25): guarda os perks comprados e soma os efeitos num conjunto de
## modificadores. O Player e as armas só leem os modificadores; nenhum perk tem lógica
## própria dentro do Player. O Quick Revive é um perk que se gasta ao cair.

signal perks_changed()

var owned: Array[PerkData] = []
## Compras por perk na partida (limite `max_purchases`).
var purchases: Dictionary = {}

var max_health_bonus: float = 0.0
var speed_multiplier: float = 1.0
var reload_multiplier: float = 1.0
var headshot_bonus: float = 0.0
var regen_multiplier: float = 1.0
var damage_multiplier: float = 1.0


func has_perk(id: StringName) -> bool:
	return owned.any(func(p: PerkData) -> bool: return p.id == id)


## Pode comprar: não tem agora e não passou do limite de compras.
func can_buy(perk: PerkData) -> bool:
	return not has_perk(perk.id) and int(purchases.get(perk.id, 0)) < perk.max_purchases


func grant(perk: PerkData) -> bool:
	if not can_buy(perk):
		return false
	owned.append(perk)
	purchases[perk.id] = int(purchases.get(perk.id, 0)) + 1
	_recalculate()
	return true


## Gasta o perk de reviver (Quick Revive), se houver. Devolve os dados dele, ou null.
func consume_self_revive() -> PerkData:
	for perk in owned:
		if perk.self_revive:
			owned.erase(perk)
			_recalculate()
			return perk
	return null


## Perde todos (o jogador caiu de vez).
func clear() -> void:
	owned.clear()
	_recalculate()


func _recalculate() -> void:
	max_health_bonus = 0.0
	speed_multiplier = 1.0
	reload_multiplier = 1.0
	headshot_bonus = 0.0
	regen_multiplier = 1.0
	damage_multiplier = 1.0
	for perk in owned:
		max_health_bonus += perk.max_health_bonus
		speed_multiplier *= perk.speed_multiplier
		reload_multiplier *= perk.reload_multiplier
		headshot_bonus += perk.headshot_bonus
		regen_multiplier *= perk.regen_multiplier
		damage_multiplier *= perk.damage_multiplier
	perks_changed.emit()
