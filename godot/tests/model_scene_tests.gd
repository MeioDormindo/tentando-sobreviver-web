extends RefCounted
## Testes dos modelos do Blender (arena de teste): cada personagem carrega o glb, troca as
## cores pelo material e toca a animação do estado (andar, rastejar, golpe, morte, rugido do
## boss); o jogador segura o modelo da arma do tipo certo; a Mystery Box abre a tampa.
## Executados por run_tests.gd.

var _passed := 0
var _failed := 0
var _tree: SceneTree
var _arena: Node3D
var _player: Player


func run(tree: SceneTree) -> int:
	_tree = tree
	print("Modelos do Blender (cena)")
	_arena = (load("res://scenes/maps/test_arena.tscn") as PackedScene).instantiate()
	tree.root.add_child(_arena)
	_player = (load("res://scenes/player/player.tscn") as PackedScene).instantiate() as Player
	_player.position = Vector3(0, 0.1, 6)
	tree.root.add_child(_player)
	_player.controlled = false
	await _tree.create_timer(0.3).timeout
	_player.health.reset(99999.0)

	_player_model()
	await _zombies()
	await _boss()
	await _mystery_box()

	_player.queue_free()
	_arena.queue_free()
	await tree.physics_frame
	print("\n%d ok, %d falharam (modelos)" % [_passed, _failed])
	return _failed


func check(condition: bool, description: String) -> void:
	if condition:
		_passed += 1
		print("  ok  ", description)
	else:
		_failed += 1
		printerr("  FALHOU  ", description)


func _player_model() -> void:
	var model := _player.model
	check(model != null and model.skeleton != null and model.has_animation(&"Run"), "jogador: modelo com esqueleto e animações")
	check(not _pivot_body_visible(), "formas simples escondidas quando o modelo carrega")
	var catalog := load("res://data/configs/skins.tres") as SkinCatalog
	var skin := catalog.find(String(Save.get_setting("skin")))
	var jacket := model.find_material("Jacket") if model else null
	check(jacket != null and jacket.albedo_color.is_equal_approx(skin.jacket), "jaqueta com a cor do visual escolhido")
	var gun := _player.get_node("Pivot/Hand").get_node_or_null("GunModel")
	check(gun != null and _player._gun_kind == _player.weapon.data.kind, "arma na mão: modelo %s" % _player._gun_kind)
	_player.give_weapon(load("res://data/weapons/pump.tres"))
	check(_player._gun_kind == &"shotgun", "trocar de arma troca o modelo (espingarda)")


func _pivot_body_visible() -> bool:
	return (_player.get_node("Pivot/Body") as MeshInstance3D).visible


func _spawn(type: StringName, offset: Vector3, speed := 1.0) -> ZombieBase:
	var zombie := ZombieFactory.create(load("res://data/zombies/%s.tres" % type), _player, 1.0, 1.0, speed)
	zombie.position = _arena.to_local(_player.global_position + offset)
	_arena.add_child(zombie)
	return zombie


func _zombies() -> void:
	var walker := _spawn(&"walker", Vector3(0, 0, -7))
	var crawler := _spawn(&"crawler", Vector3(-3, 0, -7))
	var hound := _spawn(&"hound", Vector3(3, 0, -9))
	var tank := _spawn(&"tank", Vector3(6, 0, -9), 0.0)
	await _tree.create_timer(0.8).timeout
	check(walker.model != null and walker.model.current == &"Walk", "zumbi andando: animação Walk")
	var shirt := walker.model.find_material("Shirt")
	check(shirt != null and shirt.albedo_color.is_equal_approx(walker.data.shirt_color), "cor da roupa do tipo (walker)")
	check(tank.model.find_material("Shirt").albedo_color.is_equal_approx(tank.data.shirt_color) and tank.pivot.scale.x > 1.3, "tanque: cor própria e maior")
	check(crawler.model.current == &"Crawl", "rastejante: animação Crawl")
	check(hound.model != null and hound.model.has_animation(&"Run") and hound.model.find_material("Fur") != null, "cão: modelo próprio (pelo)")
	check(not walker._materials.is_empty() and walker._materials.all(func(m: StandardMaterial3D) -> bool: return m.resource_name != "Eyes"), "piscar de dano usa os materiais do modelo (sem os olhos)")
	# Golpe ao alcançar o jogador.
	walker.global_position = _player.global_position + Vector3(0, 0, -1.0)
	var attacked := false
	for i in 40:
		await _tree.physics_frame
		if walker.model.current == &"Attack":
			attacked = true
			break
	check(attacked, "zumbi perto do jogador: animação Attack")
	walker.take_damage(DamageInfo.new(99999.0, DamageInfo.Kind.WEAPON, _player, false, walker.global_position))
	await _tree.process_frame
	check(walker.model.current == &"Death", "morte: animação Death")
	for zombie in [crawler, hound, tank]:
		zombie.queue_free()


func _boss() -> void:
	var data := load("res://data/bosses/conductor.tres") as BossData
	var boss := data.scene.instantiate() as Boss
	boss.setup(data, _player, 1.0, Callable())
	boss.position = _arena.to_local(_player.global_position + Vector3(0, 0, -12))
	_arena.add_child(boss)
	await _tree.process_frame
	await _tree.process_frame
	check(boss.model != null and boss.model.current == &"Roar", "boss: modelo do Conductor rugindo na chegada")
	check(boss.model.has_animation(&"Slam") and boss.model.has_animation(&"Charge"), "boss: golpes (Slam, Charge)")
	boss.queue_free()


func _mystery_box() -> void:
	var box := (load("res://scenes/interactables/mystery_box.tscn") as PackedScene).instantiate() as MysteryBox
	box.setup(load("res://data/configs/mystery_box.tres"), load("res://data/weapons/catalog.tres"), "", [], null)
	_arena.add_child(box)
	check(box._model != null and box._model.current == &"Closed", "Mystery Box: baú do Blender, fechado")
	box._roll()
	check(box._model.current == &"Open", "sorteio abre a tampa")
	box.queue_free()
