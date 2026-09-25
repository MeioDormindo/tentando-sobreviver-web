class_name PrizePedestal
extends StaticBody3D
## Pedestal com uma arma de prêmio (Santuário do Olimpo: o Arco de Artemis). Segurar E pega a
## arma (uma vez por partida); o pedestal fica vazio.

const HOLD_TIME := 1.0

var weapon_path := "res://data/weapons/artemis_bow.tres"
var prop_name := "bow_pedestal"
var interaction_radius := 1.9
var taken := false
var _hold := 0.0
var _since_hold := 1.0
var _weapon: WeaponData


func _ready() -> void:
	add_to_group(&"interactable")
	collision_layer = PhysicsLayers.WORLD
	collision_mask = 0
	var shape := BoxShape3D.new()
	shape.size = Vector3(0.9, 1.0, 0.9)
	var collision := CollisionShape3D.new()
	collision.shape = shape
	collision.position.y = 0.5
	add_child(collision)
	var art := PropFactory.create(prop_name)
	add_child(art if art else EventFx.box(Vector3(0.9, 1.0, 0.9), EventFx.glow(Color(0.85, 0.83, 0.78), 1.0, 0.0)))
	if ResourceLoader.exists(weapon_path):
		_weapon = load(weapon_path) as WeaponData
	var light := EventFx.light(Color(0.85, 0.94, 1.0), 1.0, 3.5)
	light.position.y = 2.0
	add_child(light)


func _process(delta: float) -> void:
	_since_hold += delta
	if _since_hold > 0.2:
		_hold = 0.0


func get_interaction_prompt(_player: Node3D) -> String:
	if taken or _weapon == null:
		return ""
	return "[SEGURE E] PEGAR %s  (%d%%)" % [_weapon.display_name.to_upper(), roundi(_hold / HOLD_TIME * 100.0)]


func interact(_player: Node3D) -> bool:
	return false


func hold_interact(player: Node3D, delta: float) -> bool:
	if taken or _weapon == null or not player is Player:
		return false
	_since_hold = 0.0
	_hold += delta
	if _hold < HOLD_TIME:
		return false
	taken = true
	remove_from_group(&"interactable")
	var dropped := (player as Player).give_weapon(_weapon)
	if dropped:
		Events.weapon_dropped.emit(dropped, player.global_position)
	var art := find_child("Part1", true, false) as Node3D
	if art:
		art.visible = false
	SpecialFire.flash(get_tree(), global_position + Vector3.UP * 1.5, 3.0, Color(0.85, 0.94, 1.0))
	Events.toast.emit("%s — presente de Artemis" % _weapon.display_name.to_upper())
	return true
