extends RefCounted
## Testes de cena do cooperativo sem rede (main.tscn, Terminal, 2 jogadores no mesmo processo:
## o segundo controlado por código): jogadores criados pela roster, HUD presa ao jogador local,
## zumbi persegue o mais perto de pé, pontos para quem atirou, compra na carteira de quem
## comprou, Mystery Box só para quem pagou, cair/reviver, sangrar até o fim e voltar no round,
## câmera assistindo o colega e o time inteiro caído encerrando a partida. Os rounds ficam
## parados (sem horda) para nada acontecer sozinho. Executados por run_tests.gd.

var _passed := 0
var _failed := 0
var _tree: SceneTree
var _main: Node
var _host: Player
var _mate: Player
var _points: PointsManager
var _game: GameManager


func run(tree: SceneTree) -> int:
	_tree = tree
	# Nunca no save do jogador: sem o save de teste do run_tests, usa um só desta suíte.
	if not String(Save.get("_path")).contains("test"):
		Save.load_from("user://test_save.json")
	print("Cooperativo: 2 jogadores na mesma partida (cena)")
	var previous_map := Session.map_id
	Session.map_id = "terminal"
	Session.local_peer = 1
	Session.roster.assign([{"peer": 1, "name": "ANA"}, {"peer": 2, "name": "BETO", "bot": true}])
	_main = (load("res://scenes/main.tscn") as PackedScene).instantiate()
	(_main.get_node("RoundManager") as Node).process_mode = Node.PROCESS_MODE_DISABLED
	tree.root.add_child(_main)
	_host = _main.get_node("Player") as Player
	_mate = _main.get_node_or_null("Player2") as Player
	_host.controlled = false
	_points = _main.get_node("PointsManager") as PointsManager
	_game = _main.get_node("GameManager") as GameManager
	await _tree.create_timer(0.5).timeout

	_roster()
	if _mate:
		_round_scaling()
		await _hud_is_local()
		await _chase_nearest()
		_points_per_player()
		await _purchases()
		await _down_and_revive()
		await _bleed_out_and_return()
		await _team_wipe()

	tree.paused = false
	_main.queue_free()
	for node in tree.get_nodes_in_group(&"weapon_drops"):
		node.queue_free()
	await tree.physics_frame
	Session.roster.clear()
	Session.local_peer = 1
	Session.map_id = previous_map
	print("\n%d ok, %d falharam (cooperativo)" % [_passed, _failed])
	return _failed


func check(condition: bool, description: String) -> void:
	if condition:
		_passed += 1
		print("  ok  ", description)
	else:
		_failed += 1
		printerr("  FALHOU  ", description)


func _roster() -> void:
	check(_mate != null and Players.coop() and Players.all() == [_host, _mate], "um jogador por pessoa da roster (Player e Player2)")
	if _mate == null:
		return
	check(_host.peer_id == 1 and _host.is_local and _host.player_name == "ANA", "o do host é o local (peer 1)")
	check(_mate.peer_id == 2 and not _mate.is_local and not _mate.controlled and _mate.player_name == "BETO", "o colega é de outra máquina (peer 2, sem ler o teclado)")
	check(Players.local_player() == _host and (_main.get_node("Camera") as TopDownCamera).target == _host and _host.camera != null and _mate.camera == null, "câmera presa ao jogador local")
	var apart := Vector2(_host.global_position.x - _mate.global_position.x, _host.global_position.z - _mate.global_position.z).length()
	check(apart > 0.9 and apart < 4.0, "cada um começa num ponto, perto do outro (%.1f m entre eles)" % apart)
	check(_mate.is_on_floor() and absf(_mate.global_position.y - _host.global_position.y) < 0.3, "o colega começa no chão (altura %.1f)" % _mate.global_position.y)


## Cada jogador a mais soma metade da horda do solo (e 25% do limite de vivos).
func _round_scaling() -> void:
	var rounds := _main.get_node("RoundManager") as RoundManager
	rounds.start_round(1)
	check(rounds.total == roundi(rounds.data.total_zombies(1) * 1.5) and rounds.total == rounds.data.total_zombies(1, 2), "round 1 em dupla: %d zumbis (solo: %d)" % [rounds.total, rounds.data.total_zombies(1)])
	check(rounds._max_alive() == rounds.data.max_alive(1, 2) and rounds._max_alive() > rounds.data.max_alive(1), "mais vivos ao mesmo tempo em dupla (%d)" % rounds._max_alive())


func _hud_is_local() -> void:
	var seen := [0]
	var count := func(_c: float, _m: float) -> void: seen[0] += 1
	Events.player_health_changed.connect(count)
	_mate.take_damage(DamageInfo.new(10, DamageInfo.Kind.ENVIRONMENT, null, false, _mate.global_position))
	var mate_quiet: bool = seen[0] == 0
	_host.take_damage(DamageInfo.new(10, DamageInfo.Kind.ENVIRONMENT, null, false, _host.global_position))
	Events.player_health_changed.disconnect(count)
	check(mate_quiet and seen[0] == 1, "a HUD só ouve a vida do jogador local")
	_mate.health.reset()
	_host.health.reset()
	await _tree.process_frame


func _chase_nearest() -> void:
	var spawn := _main.get_node("SpawnManager") as SpawnManager
	var zombie := ZombieFactory.create(spawn.type_data(&"walker"), _host, 1.0, 0.0, 0.0)
	zombie.position = (_main.get_node("Zombies") as Node3D).to_local(_mate.global_position + Vector3(1.5, 0.1, 0.0))
	_main.get_node("Zombies").add_child(zombie)
	await _tree.create_timer(0.7).timeout
	check(zombie.target == _mate, "o zumbi troca para o jogador de pé mais perto")
	_mate.take_damage(DamageInfo.new(999, DamageInfo.Kind.ENVIRONMENT, null, false, _mate.global_position))
	await _tree.create_timer(0.3).timeout
	check(zombie.target == _host, "colega caído: o zumbi vai atrás de quem está de pé")
	_mate.revive()
	zombie.queue_free()
	await _tree.process_frame


func _points_per_player() -> void:
	var walker := ZombieFactory.create(load("res://data/zombies/walker.tres"), _host, 1.0, 0.0, 0.0)
	walker.position = (_main.get_node("Zombies") as Node3D).to_local(_host.global_position + Vector3(30.0, 0.1, 0.0))
	_main.get_node("Zombies").add_child(walker)
	var local_events := [0]
	var count := func(_t: int, _d: int) -> void: local_events[0] += 1
	Events.points_changed.connect(count)
	var host_before := _points.points_of(_host)
	var mate_before := _points.points_of(_mate)
	Events.zombie_hit.emit(walker, DamageInfo.new(10, DamageInfo.Kind.WEAPON, _mate))
	Events.zombie_killed.emit(walker, DamageInfo.new(10, DamageInfo.Kind.WEAPON, _mate))
	Events.points_changed.disconnect(count)
	check(_points.points_of(_mate) > mate_before and _points.points_of(_host) == host_before and _points.points == host_before,
		"acerto e abate pagam quem atirou (%d → %d)" % [mate_before, _points.points_of(_mate)])
	check(local_events[0] == 0, "pontos do colega não mexem na HUD local")
	var each := _points.add_all(100)
	check(each == 100 and _points.points_of(_host) == host_before + 100, "bônus de time vai para todos")
	var score := _main.get_node("ScoreManager") as ScoreManager
	check(score.score_of(_mate) > 0 and score.score == score.score_of(_host) + score.score_of(_mate), "score de cada um e o do time é a soma")
	walker.queue_free()


func _purchases() -> void:
	var world := _main.get_node("World") as GameWorld
	var doors := world.find_children("*", "Door", true, false).filter(func(n: Node) -> bool: return n is Door and (n as Door).kind == &"buy" and not (n as Door).is_open)
	if doors.is_empty():
		check(false, "há porta de compra no Terminal")
		return
	var door := doors[0] as Door
	_points.add(door.cost, false, _mate)
	var host_before := _points.points_of(_host)
	var mate_before := _points.points_of(_mate)
	check(door.interact(_mate) and _points.points_of(_mate) == mate_before - door.cost and _points.points_of(_host) == host_before,
		"porta paga pela carteira de quem comprou (%d)" % door.cost)
	var box := _main.find_child("MysteryBox", true, false) as MysteryBox
	if box == null:
		check(false, "Mystery Box no mapa")
		return
	_points.add(box.price, false, _mate)
	check(box.interact(_mate), "o colega paga a Mystery Box")
	box.set(&"_timer", 0.0)
	await _tree.process_frame
	await _tree.process_frame
	check(box.state == MysteryBox.State.READY and not box.interact(_host) and box.get_interaction_prompt(_host).contains("BETO"), "a arma sorteada não é de quem não pagou")
	check(box.interact(_mate) and _mate.inventory.owns(box.result.id if box.result else &"") or box.state == MysteryBox.State.IDLE, "quem pagou pega a arma")


func _down_and_revive() -> void:
	var downed := [false, false]
	var on_down := func(p: Node3D) -> void: downed[0] = p == _mate
	var on_up := func(p: Node3D) -> void: downed[1] = p == _mate
	Events.player_downed.connect(on_down)
	Events.player_revived.connect(on_up)
	_mate.perks.grant(load("res://data/perks/deadeye.tres") as PerkData)
	_mate.global_position = _host.global_position + Vector3(1.0, 0.0, 0.0)
	_mate.take_damage(DamageInfo.new(999, DamageInfo.Kind.ENVIRONMENT, null, false, _mate.global_position))
	await _tree.physics_frame
	check(downed[0] and _mate.bleeding and _mate.is_down and not _mate.is_standing() and not _game.over, "caiu: sangra no chão e a partida segue")
	check(_mate.perks.owned.is_empty() and _mate.perks.can_buy(load("res://data/perks/deadeye.tres") as PerkData), "quem cai perde os perks (e pode comprar de novo)")
	var spot := _mate.get_node_or_null("ReviveSpot") as ReviveSpot
	check(spot != null and spot.is_in_group(&"interactable") and spot.get_interaction_prompt(_host).contains("REVIVER BETO"), "o colega vê \"segure E para reviver\"")
	check(not _mate.help_revive(_mate, 1.0), "não dá para reviver a si mesmo")
	_mate.help_revive(_host, 1.5)
	check(_mate.bleeding, "reviver leva %.0fs segurando E" % Player.REVIVE_TIME)
	_mate.help_revive(_host, 1.6)
	check(downed[1] and _mate.is_standing() and is_equal_approx(_mate.health.current, _mate.health.max_health) and not spot.is_in_group(&"interactable"), "revivido: de pé com a vida cheia")
	# Quick Revive de quem ajuda: metade do tempo.
	_host.perks.grant(load("res://data/perks/quick_revive.tres") as PerkData)
	_mate.take_damage(DamageInfo.new(999, DamageInfo.Kind.ENVIRONMENT, null, false, _mate.global_position))
	_mate.help_revive(_host, Player.REVIVE_TIME_QUICK + 0.05)
	check(_mate.is_standing(), "com Quick Revive, reviver é mais rápido (%.1fs)" % Player.REVIVE_TIME_QUICK)
	Events.player_downed.disconnect(on_down)
	Events.player_revived.disconnect(on_up)


func _bleed_out_and_return() -> void:
	var camera := _main.get_node("Camera") as TopDownCamera
	_host.take_damage(DamageInfo.new(999, DamageInfo.Kind.ENVIRONMENT, null, false, _host.global_position))
	check(_host.bleeding and not _game.over, "o local caiu (o colega segue de pé)")
	_host.bleed_left = 0.05
	await _tree.create_timer(0.2).timeout
	check(not _host.is_alive() and not _host.bleeding and not _host.visible and not _game.over, "sangrou até o fim: fora até o próximo round")
	check(camera.call(&"_followed") == _mate, "morto, a câmera assiste o colega")
	Events.round_started.emit(2, 10)
	await _tree.physics_frame
	var near := _host.global_position.distance_to(_mate.global_position)
	check(_host.is_standing() and _host.visible and _host.weapon.data.id == _host.start_weapon_id() and near < 4.0,
		"volta no começo do round, perto do colega e com a pistola inicial (%.1f m)" % near)
	check(camera.call(&"_followed") == _host, "a câmera volta para o jogador local")


func _team_wipe() -> void:
	var summary := {}
	var capture := func(s: Dictionary) -> void: summary.merge(s)
	Events.game_over.connect(capture)
	_mate.take_damage(DamageInfo.new(999, DamageInfo.Kind.ENVIRONMENT, null, false, _mate.global_position))
	check(not _game.over, "um caído com o outro de pé: a partida segue")
	_host.take_damage(DamageInfo.new(999, DamageInfo.Kind.ENVIRONMENT, null, false, _host.global_position))
	await _tree.process_frame
	Events.game_over.disconnect(capture)
	check(_game.over and int(summary.get("players", 0)) == 2, "todos caídos: fim de jogo do time (%d jogadores)" % int(summary.get("players", 0)))
