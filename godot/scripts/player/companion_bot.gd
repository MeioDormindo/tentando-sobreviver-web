class_name CompanionBot
extends Node
## Colega controlado pelo computador, só para testar o cooperativo sem rede (opção de
## desenvolvimento `-- --coop=N`, ver Session): segue o jogador local, atira no zumbi mais perto,
## foge de quem chega muito perto e revive quem estiver caído (segurando E, como uma pessoa).
## Munição de reserva infinita, para não ficar parado no meio do teste.

const FOLLOW_FAR := 5.0
const FOLLOW_NEAR := 2.5
const SHOOT_RANGE := 14.0
const TOO_CLOSE := 2.2
const REVIVE_REACH := 1.4
const THINK_EVERY := 0.2

var player: Player
var _think := 0.0
var _target: Node3D


func _physics_process(delta: float) -> void:
	if player == null or not player.is_standing():
		if player:
			player.move_input = Vector2.ZERO
		return
	_think -= delta
	if _think <= 0.0:
		_think = THINK_EVERY
		_target = _nearest_zombie()
	var downed := _downed_mate()
	if downed:
		_go_revive(downed, delta)
		return
	var move := Vector3.ZERO
	var leader := Players.local_player()
	if leader and leader != player:
		var to_leader := _flat(leader.global_position - player.global_position)
		if to_leader.length() > FOLLOW_FAR:
			move = to_leader.normalized()
		elif to_leader.length() < FOLLOW_NEAR * 0.5:
			move = -to_leader.normalized() * 0.5
	if is_instance_valid(_target) and (_target as CharacterBase).is_alive():
		var away := _flat(player.global_position - _target.global_position)
		if away.length() < TOO_CLOSE:
			move = away.normalized()
		player.aim_point = _target.global_position + Vector3.UP * 1.2
		if player.weapon:
			if player.weapon.reserve <= 0:
				player.weapon.reserve = player.weapon.data.reserve_ammo
			player.weapon.hold_trigger()
			player.fire()
	player.move_input = Vector2(move.x, move.z).limit_length(1.0)


## Colega caído por perto (o bot vai lá e segura E até levantar).
func _downed_mate() -> Player:
	for mate in Players.all():
		if mate != player and mate.bleeding and mate.global_position.distance_to(player.global_position) < 15.0:
			return mate
	return null


func _go_revive(mate: Player, delta: float) -> void:
	var to_mate := _flat(mate.global_position - player.global_position)
	if to_mate.length() > REVIVE_REACH:
		player.move_input = Vector2(to_mate.x, to_mate.z).normalized()
		return
	player.move_input = Vector2.ZERO
	player.aim_point = mate.global_position
	mate.help_revive(player, delta)


func _nearest_zombie() -> Node3D:
	var best: Node3D = null
	var best_distance := SHOOT_RANGE
	for node in get_tree().get_nodes_in_group(&"zombies"):
		var zombie := node as CharacterBase
		if zombie == null or not zombie.is_alive():
			continue
		var distance := zombie.global_position.distance_to(player.global_position)
		if distance < best_distance:
			best = zombie
			best_distance = distance
	return best


static func _flat(v: Vector3) -> Vector3:
	return Vector3(v.x, 0.0, v.z)
