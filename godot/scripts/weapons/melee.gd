class_name Melee
extends Node3D
## Faca (como no jogo web): se houver um zumbi à frente, o jogador avança até ele; depois de
## uma breve preparação, o golpe acerta todos os zumbis no arco à frente e os empurra.
## As armas ficam paradas durante o golpe.

signal swung()

@export var data: MeleeData
@export var zombie_group: StringName = &"zombies"

var _cooldown := 0.0
## Direção e tempo restante do avanço (lidos pelo Player).
var lunge_velocity: Vector3 = Vector3.ZERO
var lunge_left := 0.0


func _process(delta: float) -> void:
	_cooldown = maxf(0.0, _cooldown - delta)
	lunge_left = maxf(0.0, lunge_left - delta)


func ready_to_swing() -> bool:
	return _cooldown <= 0.0


## Golpeia na direção `forward` (plano XZ). Devolve false se ainda estiver em recarga.
func swing(owner_body: Node3D, forward: Vector3, weapon: Weapon) -> bool:
	if not ready_to_swing():
		return false
	_cooldown = data.cooldown
	forward.y = 0.0
	forward = forward.normalized()
	var target := _nearest_in_front(owner_body.global_position, forward, data.lunge_range)
	if target:
		var to_target := target.global_position - owner_body.global_position
		to_target.y = 0.0
		# Para a ~1 m do alvo: o arco pega ele e quem estiver ao lado e logo atrás.
		var gap := maxf(0.0, to_target.length() - 1.0)
		lunge_left = minf(data.lunge_time, gap / data.lunge_speed)
		lunge_velocity = to_target.normalized() * data.lunge_speed
		forward = to_target.normalized()
	if weapon:
		weapon.busy = true
		get_tree().create_timer(data.busy_time).timeout.connect(func() -> void: weapon.busy = false)
	swung.emit()
	get_tree().create_timer(data.windup + lunge_left).timeout.connect(_strike.bind(owner_body, forward))
	return true


func _strike(owner_body: Node3D, forward: Vector3) -> void:
	if not is_instance_valid(owner_body):
		return
	_slash_fx(owner_body, forward)
	for zombie in _zombies_in_arc(owner_body.global_position - forward * 0.3, forward, data.reach + 0.3, data.arc_degrees):
		var hurtbox := zombie.get_node_or_null("BodyHurtbox") as Hurtbox
		if hurtbox == null:
			continue
		hurtbox.receive_hit(data.damage, 1.0, DamageInfo.Kind.MELEE, owner_body, zombie.global_position)
		if zombie.has_method(&"apply_knockback"):
			var push := zombie.global_position - owner_body.global_position
			push.y = 0.0
			zombie.call(&"apply_knockback", push.normalized() * data.knockback)


## Rastro do corte em pixel art: meia-lua deitada na altura da cintura, virada para o golpe.
func _slash_fx(owner_body: Node3D, forward: Vector3) -> void:
	var fx := PixelFx.spawn(get_tree(), "slash", owner_body.global_position + forward * 0.9 + Vector3.UP * 0.9, data.reach * 1.5, 1.0)
	if fx:
		fx.billboard = BaseMaterial3D.BILLBOARD_DISABLED
		fx.axis = Vector3.AXIS_Y
		fx.double_sided = true
		fx.rotation.y = atan2(-forward.x, -forward.z)


func _nearest_in_front(origin: Vector3, forward: Vector3, max_distance: float) -> Node3D:
	var best: Node3D = null
	for zombie in _zombies_in_arc(origin, forward, max_distance, 70.0):
		if best == null or origin.distance_to(zombie.global_position) < origin.distance_to(best.global_position):
			best = zombie
	return best


## Zumbis vivos até `distance` (m) e dentro do arco de `arc_degrees` à frente.
func _zombies_in_arc(origin: Vector3, forward: Vector3, distance: float, arc_degrees: float) -> Array[Node3D]:
	var found: Array[Node3D] = []
	var cos_half := cos(deg_to_rad(arc_degrees * 0.5))
	for node in get_tree().get_nodes_in_group(zombie_group):
		var zombie := node as CharacterBase
		if zombie == null or not zombie.is_alive():
			continue
		var to := zombie.global_position - origin
		to.y = 0.0
		# Raio do corpo do zumbi conta no alcance.
		if to.length() > distance + 0.35:
			continue
		if to.length() < 0.3 or forward.dot(to.normalized()) >= cos_half:
			found.append(zombie)
	return found
