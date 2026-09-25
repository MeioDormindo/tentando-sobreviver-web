extends RefCounted
## Testes de cena dos power-ups (como no jogo web): arena de teste, jogador, pontos e o
## sistema de power-ups; cada efeito é aplicado e conferido, e um drop é pego andando por cima.
## Executados por run_tests.gd.

var _passed := 0
var _failed := 0
var _tree: SceneTree
var _arena: Node3D
var _player: Player
var _points: PointsManager
var _system: PowerUpSystem


func run(tree: SceneTree) -> int:
	_tree = tree
	print("Power-ups (cena)")
	_arena = (load("res://scenes/maps/test_arena.tscn") as PackedScene).instantiate()
	tree.root.add_child(_arena)
	_player = (load("res://scenes/player/player.tscn") as PackedScene).instantiate() as Player
	_player.position = Vector3(0, 0.1, 5)
	tree.root.add_child(_player)
	_player.controlled = false
	_points = PointsManager.new()
	_points.data = load("res://data/configs/points.tres")
	tree.root.add_child(_points)
	_system = PowerUpSystem.new()
	_system.data = load("res://data/configs/powerups.tres")
	_system.player = _player
	_system.points_manager = _points
	_system.weapon_catalog = load("res://data/weapons/catalog.tres")
	tree.root.add_child(_system)
	await _tree.create_timer(0.2).timeout

	await _pickup()
	_double_cash()
	await _insta_kill()
	_armor()
	_speed_and_heal()
	_fury()
	await _nuke()
	await _timers_expire()

	for node: Node in [_system, _points, _player, _arena]:
		node.queue_free()
	Hurtbox.insta_kill = false
	await tree.physics_frame
	print("\n%d ok, %d falharam (power-ups)" % [_passed, _failed])
	return _failed


func check(condition: bool, description: String) -> void:
	if condition:
		_passed += 1
		print("  ok  ", description)
	else:
		_failed += 1
		printerr("  FALHOU  ", description)


func _pickup() -> void:
	var collected: Array[StringName] = []
	var on_collect := func(id: StringName, _n: String, _c: Color, _d: String) -> void: collected.append(id)
	Events.power_up_collected.connect(on_collect)
	_player.weapon.magazine = 0
	var drop := _system.spawn_drop(&"max_ammo", _player.global_position + Vector3(4, 0, 0))
	await _tree.physics_frame
	check(is_instance_valid(drop) and collected.is_empty(), "Drop longe do jogador fica no chão")
	_player.global_position = drop.global_position + Vector3(0, 0.1, 0)
	await _tree.create_timer(0.15).timeout
	check(collected == [&"max_ammo"], "Passar por cima pega o power-up")
	check(not is_instance_valid(drop) or drop.is_queued_for_deletion(), "O drop some ao ser pego")
	check(_player.weapon.magazine == _player.weapon.data.magazine_size, "Max Ammo enche o pente")
	Events.power_up_collected.disconnect(on_collect)
	var old := _system.spawn_drop(&"nuke", _player.global_position + Vector3(0, 0, 20))
	old.set_meta(&"age", _system.data.lifetime - 0.01)
	await _tree.create_timer(0.1).timeout
	check(not is_instance_valid(old) or old.is_queued_for_deletion(), "Drop não pego some depois do tempo de vida")


func _double_cash() -> void:
	_system.apply(&"double_cash")
	check(_points.add(50) == 100, "Double Cash dobra os pontos ganhos")
	check(_points.add(50, false) == 50, "Prêmio fixo não passa pelo Double Cash")
	check(_system.active.has(&"double_cash"), "Double Cash fica ativo com cronômetro")


func _insta_kill() -> void:
	var data := load("res://data/zombies/walker.tres") as ZombieData
	var zombie := ZombieFactory.create(data, _player, 50.0, 1.0, 0.0)
	zombie.position = _arena.to_local(_player.global_position + Vector3(0, 0, -6))
	_arena.add_child(zombie)
	await _tree.physics_frame
	_system.apply(&"insta_kill")
	var hurtbox := zombie.find_children("*", "Hurtbox", true, false)[0] as Hurtbox
	hurtbox.receive_hit(1.0, 1.0, DamageInfo.Kind.WEAPON, _player, zombie.global_position)
	check(not zombie.is_alive(), "Instant Kill: um tiro mata um zumbi de vida alta")
	_system.active[&"insta_kill"] = 0.0
	await _tree.physics_frame
	check(not Hurtbox.insta_kill, "Instant Kill acaba com o cronômetro")


func _armor() -> void:
	_player.health.reset(100.0)
	_system.apply(&"armor")
	check(_player.armor == _player.data.max_armor, "Armor enche a armadura")
	_player.take_damage(DamageInfo.new(30.0, DamageInfo.Kind.ENVIRONMENT, null, false, _player.global_position))
	check(_player.health.current == 100.0 and _player.armor == _player.data.max_armor - 30.0, "A armadura absorve o dano antes da vida")
	_player.take_damage(DamageInfo.new(_player.armor + 20.0, DamageInfo.Kind.ENVIRONMENT, null, false, _player.global_position))
	check(_player.armor == 0.0 and _player.health.current == 80.0, "O que passa da armadura vai para a vida")


func _speed_and_heal() -> void:
	_system.apply(&"full_heal")
	check(_player.health.current == _player.health.max_health, "Full Heal enche a vida")
	_system.apply(&"speed_boost")
	check(_player.speed_buff == _system.data.speed_multiplier, "Speed Boost acelera o jogador")


func _fury() -> void:
	var before := _player.weapon.damage_multiplier
	_player.fury_multiplier = _system.data.fury_damage_multiplier
	check(is_equal_approx(_player.weapon.damage_multiplier, before * _system.data.fury_damage_multiplier), "Fúria multiplica o dano das armas")
	_player.fury_multiplier = 1.0
	check(is_equal_approx(_player.weapon.damage_multiplier, before), "Fim da Fúria volta o dano")
	var points_before := _points.points
	var weapons_before := _player.inventory.weapons.size()
	var detail := _system.apply(&"golden")
	check(detail != "" and (_points.points > points_before or _player.inventory.weapons.size() != weapons_before or _system.active.has(&"fury") or detail.begins_with("Perk") or detail.begins_with("+")), "Golden Drop dá um prêmio (%s)" % detail)


func _nuke() -> void:
	var data := load("res://data/zombies/walker.tres") as ZombieData
	var zombies: Array[ZombieBase] = []
	for i in 3:
		var zombie := ZombieFactory.create(data, _player, 1.0, 1.0, 0.0)
		zombie.position = _arena.to_local(_player.global_position + Vector3(-4 + i * 4, 0, -8))
		_arena.add_child(zombie)
		zombies.append(zombie)
	await _tree.physics_frame
	var before := _points.points
	_system.active.erase(&"double_cash")
	_points.multiplier = 1.0
	_system.apply(&"nuke")
	check(zombies.all(func(z: ZombieBase) -> bool: return not z.is_alive()), "Nuke mata todos os zumbis vivos")
	check(_points.points - before == _system.data.nuke_reward, "Nuke paga o valor fixo (%d)" % (_points.points - before))


func _timers_expire() -> void:
	_system.apply(&"double_cash")
	_system.apply(&"speed_boost")
	for id: StringName in _system.active.keys():
		_system.active[id] = 0.01
	await _tree.create_timer(0.1).timeout
	check(_system.active.is_empty(), "Os cronômetros acabam")
	check(_points.multiplier == 1.0 and _player.speed_buff == 1.0, "Os efeitos com tempo são desfeitos ao acabar")
