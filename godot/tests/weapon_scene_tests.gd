extends RefCounted
## Testes de cena das armas especiais: arena de teste, jogador e zumbis parados (com muita
## vida) em posições conhecidas; o jogador atira com cada arma e confere o efeito.
## Executados por run_tests.gd depois da suíte isolada.

var _passed := 0
var _failed := 0
var _tree: SceneTree
var _arena: Node3D
var _player: Player


func run(tree: SceneTree) -> int:
	_tree = tree
	print("Armas especiais (cena)")
	_arena = (load("res://scenes/maps/test_arena.tscn") as PackedScene).instantiate()
	tree.root.add_child(_arena)
	_player = (load("res://scenes/player/player.tscn") as PackedScene).instantiate() as Player
	tree.root.add_child(_player)
	_player.controlled = false
	_player.health.invulnerable = true
	# Área aberta no meio da arena de teste, jogador mirando para -Z.
	_player.global_position = Vector3(0, 0.1, 5)
	await _frames(3)

	await _grenade()
	await _plasma()
	await _flame()
	await _arc()
	await _gust()

	_player.queue_free()
	_arena.queue_free()
	await _frames(2)
	print("\n%d ok, %d falharam (cena)" % [_passed, _failed])
	return _failed


func check(condition: bool, description: String) -> void:
	if condition:
		_passed += 1
		print("  ok  ", description)
	else:
		_failed += 1
		printerr("  FALHOU  ", description)


func _grenade() -> void:
	var zombies := _spawn([Vector3(0, 0, -6), Vector3(1.2, 0, -6.5), Vector3(-1.2, 0, -6.5)])
	await _shoot(&"grenade_launcher", Vector3(0, 1.2, -6), 1.5)
	var hurt := zombies.filter(func(z: ZombieBase) -> bool: return z.health.current < z.health.max_health).size()
	check(hurt == 3, "granada: a explosão atinge os 3 zumbis agrupados (%d)" % hurt)
	_clear(zombies)


func _plasma() -> void:
	var zombies := _spawn([Vector3(0, 0, -3), Vector3(0, 0, -6), Vector3(0, 0, -9)])
	await _shoot(&"energy_cannon", Vector3(0, 1.2, -15), 2.0)
	var hurt := zombies.filter(func(z: ZombieBase) -> bool: return z.health.current < z.health.max_health).size()
	check(hurt == 3, "plasma: atravessa a fila de 3 zumbis (%d)" % hurt)
	_clear(zombies)


func _flame() -> void:
	var zombies := _spawn([Vector3(0, 0, -2.5)])
	var zombie: ZombieBase = zombies[0]
	await _shoot(&"flamethrower", Vector3(0, 1.2, -2.5), 0.1)
	var after_shot := zombie.health.current
	await _tree.create_timer(1.0).timeout
	check(zombie.health.current < after_shot, "lança-chamas: o zumbi continua queimando depois do tiro (%.0f → %.0f)" % [after_shot, zombie.health.current])
	_clear(zombies)


func _arc() -> void:
	var zombies := _spawn([Vector3(0, 0, -5), Vector3(2, 0, -6), Vector3(4, 0, -7), Vector3(-2, 0, -6)])
	await _shoot(&"arc_gun", Vector3(0, 1.2, -5), 0.2)
	var hurt := zombies.filter(func(z: ZombieBase) -> bool: return z.health.current < z.health.max_health).size()
	check(hurt >= 3, "raio: salta entre zumbis próximos (%d atingidos)" % hurt)
	check(zombies[0]._stun_left > 0.0, "raio: atordoa")
	_clear(zombies)


func _gust() -> void:
	var zombies := _spawn([Vector3(0, 0, -2), Vector3(1, 0, -3.5), Vector3(6, 0, -2)])
	var start: Vector3 = (zombies[0] as ZombieBase).global_position
	await _shoot(&"wind_cannon", Vector3(0, 1.2, -5), 0.6)
	var in_cone: Array = zombies.slice(0, 2)
	var pushed := in_cone.all(func(z: ZombieBase) -> bool: return z.health.current < z.health.max_health)
	check(pushed, "vento: fere os zumbis no cone à frente")
	var moved := (zombies[0] as ZombieBase).global_position.distance_to(start)
	check(moved > 1.0, "vento: arremessa (%.1f m)" % moved)
	check(zombies[2].health.current == zombies[2].health.max_health, "vento: não atinge quem está fora do cone")
	_clear(zombies)


## Zumbis parados (velocidade 0) com vida alta, em posições relativas ao jogador (-Z = à frente).
func _spawn(offsets: Array) -> Array:
	var data := load("res://data/zombies/walker.tres") as ZombieData
	var zombies: Array = []
	for offset: Vector3 in offsets:
		var zombie := ZombieFactory.create(data, _player, 60.0, 0.0, 0.0)
		zombie.position = _arena.to_local(_player.global_position + offset)
		_arena.add_child(zombie)
		zombies.append(zombie)
	return zombies


func _shoot(weapon_id: StringName, aim: Vector3, wait: float) -> void:
	var data := load("res://data/weapons/%s.tres" % weapon_id) as WeaponData
	var dropped := _player.give_weapon(data)
	if dropped:
		dropped.queue_free()
	await _tree.create_timer(0.5).timeout  # tempo de troca de arma
	_player.aim_point = _player.global_position + Vector3(aim.x, 0.0, aim.z) + Vector3.UP * aim.y
	_player.fire()
	await _tree.create_timer(wait).timeout


func _clear(zombies: Array) -> void:
	for z in zombies:
		if is_instance_valid(z):
			z.queue_free()


func _frames(count: int) -> void:
	for i in count:
		await _tree.physics_frame
