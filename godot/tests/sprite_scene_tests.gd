extends RefCounted
## Testes do visual em pixel art (arena de teste): cada personagem carrega a folha de sprites
## do tipo, a direção desenhada segue para onde ele olha, a animação acompanha o estado (andar,
## rastejar, golpe, morte, rugido do boss), a arma do jogador é a camada do tipo certo e o
## blindado perde a armadura no sprite. Executados por run_tests.gd.

var _passed := 0
var _failed := 0
var _tree: SceneTree
var _arena: Node3D
var _player: Player


func run(tree: SceneTree) -> int:
	_tree = tree
	print("Pixel art: sprites dos personagens (cena)")
	_arena = (load("res://scenes/maps/test_arena.tscn") as PackedScene).instantiate()
	tree.root.add_child(_arena)
	_player = (load("res://scenes/player/player.tscn") as PackedScene).instantiate() as Player
	_player.position = Vector3(0, 0.1, 6)
	tree.root.add_child(_player)
	_player.controlled = false
	await _tree.create_timer(0.3).timeout
	_player.health.reset(99999.0)

	await _player_sprite()
	await _zombies()
	await _boss()
	await _mystery_box()

	_player.queue_free()
	_arena.queue_free()
	await tree.physics_frame
	print("\n%d ok, %d falharam (sprites)" % [_passed, _failed])
	return _failed


func check(condition: bool, description: String) -> void:
	if condition:
		_passed += 1
		print("  ok  ", description)
	else:
		_failed += 1
		printerr("  FALHOU  ", description)


func _frames(count: int) -> void:
	for i in count + 1:
		await _tree.process_frame


func _player_sprite() -> void:
	var sprite := _player.model
	check(sprite != null and sprite.has_animation(&"Run") and sprite.has_animation(&"Reload"), "jogador: folha em pixel art com as animações")
	check(not (_player.get_node("Pivot/Body") as MeshInstance3D).visible, "formas simples escondidas quando o sprite carrega")
	check(_player._gun_kind == _player.weapon.data.kind and sprite.get_node_or_null("Layer") != null, "arma na mão: camada %s" % _player._gun_kind)
	_player.give_weapon(load("res://data/weapons/pump.tres"))
	check(_player._gun_kind == &"shotgun", "trocar de arma troca a camada (espingarda)")
	# Direção: olhando para o leste (+X) → direção 2; para a câmera (+Z) → 0.
	# (o jogador vira o corpo para a mira a cada quadro)
	_player.aim_point = _player.global_position + Vector3(6, 0, 0)
	await _tree.create_timer(0.2).timeout
	var east := sprite.direction
	_player.aim_point = _player.global_position + Vector3(0, 0, 6)
	await _tree.create_timer(0.2).timeout
	check(east == 2 and sprite.direction == 0, "direção do desenho segue para onde olha (leste=%d, câmera=%d)" % [east, sprite.direction])
	_player._on_fired()
	check(sprite.current == &"Shoot", "tiro: animação Shoot")


func _spawn(type: StringName, offset: Vector3, speed := 1.0) -> ZombieBase:
	var zombie := ZombieFactory.create(load("res://data/zombies/%s.tres" % type), _player, 1.0, 1.0, speed)
	zombie.position = _arena.to_local(_player.global_position + offset)
	_arena.add_child(zombie)
	return zombie


func _zombies() -> void:
	var walker := _spawn(&"walker", Vector3(0, 0, -7))
	var crawler := _spawn(&"crawler", Vector3(-3, 0, -7))
	var hound := _spawn(&"hound", Vector3(3, 0, -9))
	var armored := _spawn(&"armored", Vector3(6, 0, -9), 0.0)
	await _tree.create_timer(0.8).timeout
	check(walker.model != null and walker.model.current == &"Walk", "zumbi andando: animação Walk")
	check(crawler.model.current == &"Crawl", "rastejante: animação Crawl")
	check(hound.model != null and hound.model.has_animation(&"Run") and hound.sprite_sheet() == "hound", "cão: folha própria")
	armored.break_armor()
	await _frames(1)
	check(armored.model._meta == CharacterSprite._read_meta("zombie_armored_bare"), "blindado: a armadura cai do sprite")
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
	for zombie in [crawler, hound, armored]:
		zombie.queue_free()


func _boss() -> void:
	var data := load("res://data/bosses/conductor.tres") as BossData
	var boss := data.scene.instantiate() as Boss
	boss.setup(data, _player, 1.0, Callable())
	boss.position = _arena.to_local(_player.global_position + Vector3(0, 0, -12))
	_arena.add_child(boss)
	await _frames(2)
	check(boss.model != null and boss.model.current == &"Roar", "boss: sprite do Conductor rugindo na chegada")
	check(boss.model.has_animation(&"Slam") and boss.model.has_animation(&"Charge"), "boss: golpes (Slam, Charge)")
	boss.queue_free()


func _mystery_box() -> void:
	var box := (load("res://scenes/interactables/mystery_box.tscn") as PackedScene).instantiate() as MysteryBox
	box.setup(load("res://data/configs/mystery_box.tres"), load("res://data/weapons/catalog.tres"), "", [], null)
	_arena.add_child(box)
	check(box._model != null and box._model.current == &"Closed", "Mystery Box: baú fechado")
	box._roll()
	check(box._model.current == &"Open", "sorteio abre a tampa")
	box.queue_free()
