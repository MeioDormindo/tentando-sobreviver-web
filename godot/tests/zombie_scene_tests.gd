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
	await _hound_round()
	await _flinch()
	await _hit_slow()
	await _walker_grab()
	await _runner_dash()
	await _tank_stomp()
	await _hoplite_reach()
	await _blood_and_corpses()
	await _hit_feedback()
	await _impact()

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
	var head := zombie.get_node("HeadHurtbox") as Node3D
	var low_body: bool = zombie.pivot.scale.y < 0.6 or (zombie.model != null and zombie.model.current == &"Crawl")
	check(low_body and head.position.y < 1.0, "Rastejante: corpo baixo (animação rastejando, cabeça a %.2f m)" % head.position.y)
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
	# Maior: hurtboxes escaladas e, com o sprite, uma folha desenhada em tamanho maior.
	var body := zombie.get_node("BodyHurtbox") as Node3D
	var bigger: bool = zombie.model == null or int(zombie.model._meta.frame[1]) > int(CharacterSprite._read_meta("zombie_walker").frame[1])
	check(body.scale.x > 1.3 and bigger, "Tank: maior que os outros")
	zombie.queue_free()


## Impacto dos tiros: o zumbi baleado recua e hesita (fica para trás de um igual que não leva
## tiro), pisca; o Tank não recua.
func _flinch() -> void:
	var shot := _spawn(&"walker", Vector3(-2.5, 0, -12), 1.0)
	var calm := _spawn(&"walker", Vector3(2.5, 0, -12), 1.0)
	shot.health.reset(100000.0)
	calm.health.reset(100000.0)
	await _tree.physics_frame
	var body := shot.get_node("BodyHurtbox") as Hurtbox
	for i in 12:
		body.receive_hit(1.0, 1.0, DamageInfo.Kind.WEAPON, _player, shot.global_position)
		await _tree.create_timer(0.1).timeout
	var shot_left := shot.global_position.distance_to(_player.global_position)
	var calm_left := calm.global_position.distance_to(_player.global_position)
	check(shot_left > calm_left + 0.8, "Tiros: o zumbi baleado recua e fica para trás (%.1f m × %.1f m)" % [shot_left, calm_left])
	shot.queue_free()
	calm.queue_free()
	var tank := _spawn(&"tank", Vector3(0, 0, -9), 0.0)
	await _tree.physics_frame
	var start := tank.global_position
	(tank.get_node("BodyHurtbox") as Hurtbox).receive_hit(5.0, 1.0, DamageInfo.Kind.WEAPON, _player, start)
	await _tree.create_timer(0.3).timeout
	check(tank.global_position.distance_to(start) < 0.1, "Tiros: o Tank não recua")
	tank.queue_free()
	await _tree.physics_frame


## Golpe de zumbi deixa o jogador mais lento por um instante; ácido não.
func _hit_slow() -> void:
	await _tree.create_timer(1.0).timeout
	check(is_equal_approx(_player.slow_factor(), 1.0), "Golpe: sem golpe, velocidade normal")
	_player.take_damage(DamageInfo.new(1.0, DamageInfo.Kind.ENVIRONMENT))
	check(is_equal_approx(_player.slow_factor(), 1.0), "Golpe: ácido e gás não deixam lento")
	_player.take_damage(DamageInfo.new(1.0, DamageInfo.Kind.ZOMBIE))
	check(_player.slow_factor() < 0.7, "Golpe de zumbi: jogador fica lento (×%.2f)" % _player.slow_factor())
	await _tree.create_timer(Player.HIT_SLOW_TIME + 0.2).timeout
	check(is_equal_approx(_player.slow_factor(), 1.0), "Golpe de zumbi: a lentidão passa")


## Agarrão (Walker): de vez em quando, o golpe prende o jogador mais forte que o golpe comum
## (×0.6 de sempre) — em ~9s de ataques (chance de 35% cada) é bem improvável não acontecer.
func _walker_grab() -> void:
	var zombie := _spawn(&"walker", Vector3(0, 0, -1.0), 0.0)
	var min_slow := 1.0
	for i in 130:
		min_slow = minf(min_slow, _player.slow_factor())
		await _tree.create_timer(0.1).timeout
	check(min_slow < 0.5, "Agarrão: o Walker às vezes prende mais forte que o golpe comum (×%.2f)" % min_slow)
	zombie.queue_free()
	await _tree.physics_frame


## Investida (Runner): fecha distância de repente antes do ataque normal.
func _runner_dash() -> void:
	var zombie := _spawn(&"runner", Vector3(0, 0, -5.5), 1.0)
	await _tree.physics_frame
	var start := zombie.global_position.distance_to(_player.global_position)
	await _tree.create_timer(0.3).timeout
	var after := zombie.global_position.distance_to(_player.global_position)
	check(start - after > 2.0, "Investida: o Runner fecha distância de repente (%.1f m → %.1f m em 0.3s)" % [start, after])
	zombie.queue_free()
	await _tree.physics_frame


## Pisão em área (Tank): de vez em quando, colado no jogador, atordoa mais forte que o golpe comum.
func _tank_stomp() -> void:
	var zombie := _spawn(&"tank", Vector3(0, 0, -1.0), 0.0)
	var min_slow := 1.0
	for i in 130:
		min_slow = minf(min_slow, _player.slow_factor())
		await _tree.create_timer(0.1).timeout
	check(min_slow < 0.3, "Pisão: o Tank às vezes atordoa quem fica colado nele (×%.2f)" % min_slow)
	zombie.queue_free()
	await _tree.physics_frame


## Lança (Hoplita comum): alcança de mais longe que o Walker (mesma distância do jogador).
func _hoplite_reach() -> void:
	var walker := _spawn(&"walker", Vector3(-0.6, 0, -1.5), 0.0)
	var hoplite := _spawn(&"hoplite", Vector3(0.6, 0, -1.5), 0.0)
	await _tree.create_timer(0.5).timeout
	check(walker.state != ZombieBase.State.ATTACK, "de 1.6 m, o Walker não alcança")
	check(hoplite.state == ZombieBase.State.ATTACK, "Lança: o Hoplita alcança de 1.6 m, o Walker não")
	walker.queue_free()
	hoplite.queue_free()
	await _tree.physics_frame


## Sangue (opção, desligado por padrão) e corpos que ficam no chão.
func _fx_count(fx_name: String) -> int:
	return _tree.root.find_children("Fx_" + fx_name, "Sprite3D", true, false).filter(func(n: Node) -> bool: return not n.is_queued_for_deletion()).size()


func _blood_and_corpses() -> void:
	check(not bool(Save.get_setting("blood")), "sangue vem desligado por padrão")
	var zombie := _spawn(&"walker", Vector3(3, 0, -10), 0.0)
	zombie.health.reset(100000.0)
	await _tree.physics_frame
	var body := zombie.get_node("BodyHurtbox") as Hurtbox
	var before := _fx_count("blood_splat")
	body.receive_hit(5.0, 1.0, DamageInfo.Kind.WEAPON, _player, zombie.global_position + Vector3.UP)
	check(_fx_count("blood_splat") == before, "sem sangue: o acerto não espirra sangue")
	Save.set_setting("blood", true)
	for i in 14:
		body.receive_hit(5.0, 1.0, DamageInfo.Kind.WEAPON, _player, zombie.global_position + Vector3.UP)
	check(_fx_count("blood_splat") > before and _fx_count("blood_pool") > 0, "com sangue: espirra e pinga no chão (%d jatos, %d gotas)" % [_fx_count("blood_splat") - before, _fx_count("blood_pool")])
	zombie.take_damage(DamageInfo.new(999999.0, DamageInfo.Kind.WEAPON, _player))
	await _tree.create_timer(3.0).timeout
	check(is_instance_valid(zombie) and not zombie.is_alive() and zombie.pivot.position.y > -0.1, "o corpo continua no chão")
	Save.set_setting("blood", false)
	zombie._sink()
	await _tree.create_timer(ZombieBase.CORPSE_TIME + 0.3).timeout
	check(not is_instance_valid(zombie), "o corpo afunda e some no fim")


## Rodada dos cães no Hospital migrado: só cães, perto do jogador, névoa; o último deixa munição.
func _hound_round() -> void:
	var map := (load("res://scenes/maps/hospital.tscn") as PackedScene).instantiate() as LayoutMap
	_tree.root.add_child(map)
	var player := (load("res://scenes/player/player.tscn") as PackedScene).instantiate() as Player
	player.position = map.get_player_spawn()
	_tree.root.add_child(player)
	player.controlled = false
	player.health.invulnerable = true
	var container := Node3D.new()
	_tree.root.add_child(container)
	var spawner := SpawnManager.new()
	spawner.world = map
	spawner.container = container
	spawner.target = player
	spawner.zombie_data = load("res://data/zombies/walker.tres")
	_tree.root.add_child(spawner)
	var rounds := RoundManager.new()
	rounds.data = load("res://data/configs/rounds.tres")
	rounds.spawn_manager = spawner
	_tree.root.add_child(rounds)
	await _tree.create_timer(0.5).timeout
	var max_ammo := [false]
	Events.max_ammo.connect(func(_at: Vector3) -> void: max_ammo[0] = true, CONNECT_ONE_SHOT)
	rounds.start_round(5)
	var env := (map.get_node("WorldEnvironment") as WorldEnvironment).environment
	check(rounds.is_hound_round and rounds.total == 7, "round 5 no Hospital é rodada dos cães (%d cães)" % rounds.total)
	check(env.fog_enabled, "névoa na rodada dos cães")
	await _tree.create_timer(4.0).timeout
	var alive := container.get_children().filter(func(z: Node) -> bool: return z is ZombieBase and (z as ZombieBase).is_alive())
	var all_hounds := alive.all(func(z: ZombieBase) -> bool: return z.data.id == &"hound")
	check(alive.size() > 0 and all_hounds, "só cães (%d vivos)" % alive.size())
	check(alive.size() <= 5, "no máximo 5 cães vivos")
	player.weapon.magazine = 0
	player.weapon.reserve = 0
	for i in 60:
		for z in container.get_children():
			var hound := z as ZombieBase
			if hound and hound.is_alive():
				hound.take_damage(DamageInfo.new(99999.0, DamageInfo.Kind.WEAPON, player))
		if rounds.phase != RoundManager.Phase.ACTIVE:
			break
		await _tree.create_timer(0.5).timeout
	check(rounds.phase == RoundManager.Phase.INTERMISSION, "matou os 7 cães: fim do round")
	check(max_ammo[0] and player.weapon.reserve == player.weapon.data.reserve_ammo, "o último cão deixa munição cheia")
	check(not env.fog_enabled, "a névoa vai embora")
	for node in [rounds, spawner, container, player, map]:
		node.queue_free()
	await _tree.physics_frame


## Aviso de acerto (marcador, som, número): só os acertos do jogador desta máquina, com arma ou
## faca, somados no quadro; abate, headshot e bloqueado (armadura) marcados.
func _hit_feedback() -> void:
	var seen: Array = []
	var listen := func(key: int, at: Vector3, amount: float, headshot: bool, kill: bool, blocked: bool) -> void:
		seen.append({"key": key, "at": at, "amount": amount, "headshot": headshot, "kill": kill, "blocked": blocked})
	Events.hit_confirmed.connect(listen)
	var zombie := _spawn(&"walker", Vector3(-3, 0, -10), 0.0)
	zombie.health.reset(100000.0)
	await _tree.physics_frame
	var body := zombie.get_node("BodyHurtbox") as Hurtbox
	var head := zombie.get_node("HeadHurtbox") as Hurtbox
	body.receive_hit(30.0, 1.5, DamageInfo.Kind.WEAPON, _player, zombie.global_position)
	await _tree.process_frame
	check(seen.size() == 1 and is_equal_approx(float(seen[0].amount), 30.0) and not seen[0].headshot and not seen[0].kill
		and int(seen[0].key) == HitFeedback.key_of(zombie), "acerto seu: um aviso com o dano (%s)" % [seen])
	# Espingarda: 7 chumbos no mesmo quadro viram um aviso só, com a soma.
	seen.clear()
	for i in 7:
		body.receive_hit(10.0, 1.5, DamageInfo.Kind.WEAPON, _player, zombie.global_position)
	await _tree.process_frame
	check(seen.size() == 1 and is_equal_approx(float(seen[0].amount), 70.0), "chumbos do mesmo disparo: um aviso com a soma (%s)" % [seen])
	seen.clear()
	head.receive_hit(20.0, 2.0, DamageInfo.Kind.WEAPON, _player, zombie.global_position + Vector3.UP * 1.6)
	await _tree.process_frame
	check(seen.size() == 1 and bool(seen[0].headshot), "headshot marcado no aviso")
	# Outro jogador (colega/bot, não desta máquina), queimadura e golpe sem atirador: nada.
	seen.clear()
	var mate := (load("res://scenes/player/player.tscn") as PackedScene).instantiate() as Player
	mate.is_local = false
	mate.controlled = false
	mate.position = Vector3(6, 0.1, 5)
	_tree.root.add_child(mate)
	await _tree.physics_frame
	body.receive_hit(30.0, 1.5, DamageInfo.Kind.WEAPON, mate, zombie.global_position)
	zombie.take_damage(DamageInfo.new(5.0, DamageInfo.Kind.BURN, _player, false, zombie.global_position))
	body.receive_hit(30.0, 1.5, DamageInfo.Kind.WEAPON, null, zombie.global_position)
	await _tree.process_frame
	check(seen.is_empty(), "acerto do colega, queimadura e golpe sem atirador não avisam você (%d)" % seen.size())
	mate.queue_free()
	# Abate.
	zombie.health.current = 10.0
	body.receive_hit(50.0, 1.5, DamageInfo.Kind.WEAPON, _player, zombie.global_position)
	await _tree.process_frame
	check(seen.size() == 1 and bool(seen[0].kill), "abate marcado no aviso")
	# Blindado: o corpo com armadura marca "bloqueado"; a cabeça não.
	seen.clear()
	var armored := _spawn(&"armored", Vector3(3, 0, -10), 0.0)
	armored.health.reset(100000.0)
	await _tree.physics_frame
	(armored.get_node("BodyHurtbox") as Hurtbox).receive_hit(40.0, 1.5, DamageInfo.Kind.WEAPON, _player, armored.global_position)
	await _tree.process_frame
	var body_blocked: bool = seen.size() == 1 and bool(seen[0].blocked)
	seen.clear()
	(armored.get_node("HeadHurtbox") as Hurtbox).receive_hit(40.0, 1.5, DamageInfo.Kind.WEAPON, _player, armored.global_position)
	await _tree.process_frame
	check(body_blocked and seen.size() == 1 and not bool(seen[0].blocked), "Blindado: armadura no corpo marca bloqueado; headshot não")
	armored.queue_free()
	Events.hit_confirmed.disconnect(listen)
	await _tree.physics_frame


## O corpo sente o tiro: pisca de verdade (shader), dá um solavanco e volta, e o empurrão cresce
## com o dano. Sem sangue, o acerto solta poeira e o headshot que mata, um estouro.
func _impact() -> void:
	check(ZombieBase.flinch_factor(25.0, false) < ZombieBase.flinch_factor(160.0, false)
		and ZombieBase.flinch_factor(160.0, true) > ZombieBase.flinch_factor(160.0, false)
		and is_equal_approx(ZombieBase.flinch_factor(0.0, false), ZombieBase.FLINCH_MIN), "tranco: cresce com o dano e na cabeça (mínimo sem dano)")
	var weak := _spawn(&"walker", Vector3(-3, 0, -12), 0.0)
	var strong := _spawn(&"walker", Vector3(3, 0, -12), 0.0)
	weak.health.reset(100000.0)
	strong.health.reset(100000.0)
	await _tree.physics_frame
	var base: Vector3 = strong.model.position
	(weak.get_node("BodyHurtbox") as Hurtbox).receive_hit(25.0, 1.5, DamageInfo.Kind.WEAPON, _player, weak.global_position)
	for i in 8:
		(strong.get_node("BodyHurtbox") as Hurtbox).receive_hit(20.0, 1.5, DamageInfo.Kind.WEAPON, _player, strong.global_position)
	var weak_push: float = (weak.get(&"_knockback") as Vector3).length()
	var strong_push: float = (strong.get(&"_knockback") as Vector3).length()
	check(strong_push > weak_push * 1.5, "espingarda (8 chumbos) empurra mais que a pistola (%.1f × %.1f)" % [strong_push, weak_push])
	check(strong.model.flash_amount() > 0.5, "o zumbi pisca de verdade ao levar tiro (%.2f)" % strong.model.flash_amount())
	await _tree.process_frame
	check(strong.model.position.distance_to(base) > 0.05 and not strong.model.scale.is_equal_approx(Vector3.ONE), "solavanco: o sprite recua e achata")
	await _tree.create_timer(0.35).timeout
	check(strong.model.flash_amount() == 0.0 and strong.model.position.distance_to(base) < 0.01 and strong.model.scale.is_equal_approx(Vector3.ONE),
		"depois o piscar apaga e o sprite volta ao lugar")
	# Sem sangue (padrão): o acerto solta poeira e o headshot que mata, faíscas e poeira na cabeça.
	var dust_before := _fx_like("dust")
	(weak.get_node("BodyHurtbox") as Hurtbox).receive_hit(10.0, 1.5, DamageInfo.Kind.WEAPON, _player, weak.global_position + Vector3.UP)
	check(_fx_like("dust") > dust_before, "sem sangue, o acerto mostra poeira (o efeito existe)")
	var spark_before := _fx_like("spark")
	weak.health.current = 5.0
	(weak.get_node("HeadHurtbox") as Hurtbox).receive_hit(50.0, 2.0, DamageInfo.Kind.WEAPON, _player, weak.global_position + Vector3.UP * 1.6)
	check(_fx_like("spark") > spark_before, "headshot que mata: estouro na cabeça")
	weak.queue_free()
	strong.queue_free()
	await _tree.create_timer(0.6).timeout


## Efeitos de um tipo na cena (o nome pode ganhar número quando há vários).
func _fx_like(fx_name: String) -> int:
	return _tree.root.find_children("*Fx_" + fx_name + "*", "Sprite3D", true, false).size()


func _spawn(type: StringName, offset: Vector3, speed_mult: float) -> ZombieBase:
	var data := load("res://data/zombies/%s.tres" % type) as ZombieData
	var zombie := ZombieFactory.create(data, _player, 1.0, 1.0, speed_mult)
	zombie.position = _arena.to_local(_player.global_position + offset)
	_arena.add_child(zombie)
	return zombie
