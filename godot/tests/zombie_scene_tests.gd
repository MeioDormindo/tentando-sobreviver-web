extends RefCounted
## Testes de cena dos tipos de zumbi (habilidades migradas do jogo web): arena de teste,
## jogador com vida alta e um zumbi de cada tipo em posição conhecida.
## Executados por run_tests.gd.

var _passed := 0
var _failed := 0
var _tree: SceneTree
var _arena: Node3D
var _player: Player


func run(tree: SceneTree) -> int:
	_tree = tree
	print("Tipos de zumbi (cena)")
	_arena = (load("res://scenes/maps/test_arena.tscn") as PackedScene).instantiate()
	tree.root.add_child(_arena)
	_player = (load("res://scenes/player/player.tscn") as PackedScene).instantiate() as Player
	_player.position = Vector3(0, 0.1, 5)
	tree.root.add_child(_player)
	_player.controlled = false
	await _tree.create_timer(0.2).timeout
	_player.health.reset(5000.0)

	await _exploder()
	await _spitter()
	await _armored()
	await _crawler()
	await _hound()
	await _tank()

	_player.queue_free()
	_arena.queue_free()
	for node in tree.get_nodes_in_group(&"hazards"):
		node.queue_free()
	await tree.physics_frame
	print("\n%d ok, %d falharam (zumbis)" % [_passed, _failed])
	return _failed


func check(condition: bool, description: String) -> void:
	if condition:
		_passed += 1
		print("  ok  ", description)
	else:
		_failed += 1
		printerr("  FALHOU  ", description)


func _exploder() -> void:
	var before := _player.health.current
	var zombie := _spawn(&"exploder", Vector3(0, 0, -2.5), 1.0)
	await _tree.create_timer(2.5).timeout
	check(not is_instance_valid(zombie) or not zombie.is_alive(), "Exploder: chega perto, arma e explode")
	check(_player.health.current < before, "Exploder: a explosão fere o jogador (%.0f)" % (before - _player.health.current))


func _spitter() -> void:
	var zombie := _spawn(&"spitter", Vector3(0, 0, -7), 0.0)
	var before := _player.health.current
	await _tree.create_timer(4.5).timeout
	var pools := _tree.get_nodes_in_group(&"hazards").size()
	check(pools > 0, "Cuspidor: cospe de longe e deixa poça de ácido")
	check(_player.health.current < before, "Cuspidor: a poça fere o jogador (%.0f)" % (before - _player.health.current))
	zombie.queue_free()
	for node in _tree.get_nodes_in_group(&"hazards"):
		node.queue_free()
	await _tree.physics_frame


func _armored() -> void:
	var zombie := _spawn(&"armored", Vector3(3, 0, -8), 0.0)
	await _tree.physics_frame
	var body := zombie.get_node("BodyHurtbox") as Hurtbox
	var head := zombie.get_node("HeadHurtbox") as Hurtbox
	var start := zombie.health.current
	body.receive_hit(100.0, 1.5, DamageInfo.Kind.WEAPON, _player, zombie.global_position)
	check(is_equal_approx(start - zombie.health.current, 25.0), "Blindado: a armadura deixa passar só 25%% no corpo (%.0f)" % (start - zombie.health.current))
	head.receive_hit(10.0, 1.5, DamageInfo.Kind.WEAPON, _player, zombie.global_position)
	var after_head := zombie.health.current
	body.receive_hit(50.0, 1.5, DamageInfo.Kind.WEAPON, _player, zombie.global_position)
	check(is_equal_approx(after_head - zombie.health.current, 50.0), "Blindado: headshot derruba o capacete (dano cheio depois)")
	zombie.queue_free()


func _crawler() -> void:
	var zombie := _spawn(&"crawler", Vector3(-3, 0, -8), 0.0)
	await _tree.physics_frame
	check(zombie.pivot.scale.y < 0.6, "Rastejante: corpo baixo")
	zombie.take_damage(DamageInfo.new(9999.0, DamageInfo.Kind.WEAPON, _player))
	await _tree.physics_frame
	check(_tree.get_nodes_in_group(&"hazards").size() > 0, "Rastejante: deixa nuvem de gás ao morrer")
	for node in _tree.get_nodes_in_group(&"hazards"):
		node.queue_free()


func _hound() -> void:
	var zombie := _spawn(&"hound", Vector3(0, 0, -9), 0.0)
	await _tree.physics_frame
	zombie.take_damage(DamageInfo.new(9999.0, DamageInfo.Kind.WEAPON, _player))
	await _tree.create_timer(0.8).timeout
	check(not is_instance_valid(zombie), "Cão: pega fogo e não deixa corpo")


func _tank() -> void:
	var zombie := _spawn(&"tank", Vector3(0, 0, -9), 0.0)
	await _tree.physics_frame
	var start := zombie.global_position
	zombie.apply_knockback(Vector3(20, 0, 0))
	await _tree.create_timer(0.4).timeout
	check(zombie.global_position.distance_to(start) < 0.2, "Tank: não é empurrado")
	check(zombie.pivot.scale.x > 1.3, "Tank: maior que os outros")
	zombie.queue_free()


func _spawn(type: StringName, offset: Vector3, speed_mult: float) -> ZombieBase:
	var data := load("res://data/zombies/%s.tres" % type) as ZombieData
	var zombie := ZombieFactory.create(data, _player, 1.0, 1.0, speed_mult)
	zombie.position = _arena.to_local(_player.global_position + offset)
	_arena.add_child(zombie)
	return zombie
