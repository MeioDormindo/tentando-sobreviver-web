class_name WeaponInventory
extends Node3D
## Armas carregadas pelo jogador (2 espaços, como no jogo web). Pegar uma arma nova com os
## espaços cheios troca a arma em mãos (quem chama decide o que fazer com a que saiu).
## Trocar de arma leva `switch_time` sem poder atirar.

signal weapon_changed(current: Weapon, other: Weapon)

@export var slots: int = 2
@export var switch_time: float = 0.35

var weapons: Array[Weapon] = []
var current_index: int = 0

var _switch_left := 0.0


var current: Weapon:
	get:
		return weapons[current_index] if current_index < weapons.size() else null


func _process(delta: float) -> void:
	if _switch_left > 0.0:
		_switch_left -= delta
		if _switch_left <= 0.0 and current:
			current.busy = false


func owns(id: StringName) -> bool:
	return weapons.any(func(w: Weapon) -> bool: return w.data.id == id)


func find(id: StringName) -> Weapon:
	for weapon in weapons:
		if weapon.data.id == id:
			return weapon
	return null


## Adiciona uma arma: ocupa um espaço livre ou substitui a arma em mãos. Devolve a arma que
## saiu do inventário (ou null). Se o jogador já a tem, só enche a munição.
func give(data: WeaponData) -> Weapon:
	var existing := find(data.id)
	if existing:
		existing.reset_ammo()
		return null
	var weapon := Weapon.new()
	weapon.name = String(data.id)
	weapon.data = data
	add_child(weapon)
	weapon.reset_ammo()
	return _add(weapon)


## Começa de novo só com esta arma (a pistola inicial do mapa).
func reset_to(data: WeaponData) -> void:
	for weapon in weapons:
		weapon.queue_free()
	weapons.clear()
	current_index = 0
	give(data)


## Pega de volta uma arma que estava no chão (com a munição e as melhorias dela). Devolve a
## arma que saiu no lugar (ou null).
func take_back(weapon: Weapon) -> Weapon:
	if owns(weapon.data.id):
		return null
	add_child(weapon)
	return _add(weapon)


func _add(weapon: Weapon) -> Weapon:
	var dropped: Weapon = null
	if weapons.size() < slots:
		weapons.append(weapon)
		_equip(weapons.size() - 1, weapons.size() > 1)
	else:
		dropped = weapons[current_index]
		weapons[current_index] = weapon
		remove_child(dropped)
		_equip(current_index, true)
	return dropped


## Troca para o espaço `index` (com o tempo de troca).
func switch_to(index: int) -> bool:
	if index == current_index or index < 0 or index >= weapons.size():
		return false
	_equip(index, true)
	return true


func switch_next() -> bool:
	return weapons.size() > 1 and switch_to((current_index + 1) % weapons.size())


func is_switching() -> bool:
	return _switch_left > 0.0


func other() -> Weapon:
	return weapons[(current_index + 1) % weapons.size()] if weapons.size() > 1 else null


func _equip(index: int, animate: bool) -> void:
	if current:
		current.cancel_reload()
		current.busy = false
	current_index = index
	_switch_left = switch_time if animate else 0.0
	current.busy = animate
	weapon_changed.emit(current, other())
