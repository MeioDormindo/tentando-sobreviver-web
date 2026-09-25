extends Node
## Bot do teste jogado: abre a cena principal, mira e atira nos zumbis (alternando cabeça e
## corpo) até o round 3, depois deixa o jogador morrer, confere a tela de fim e reinicia.

const TIME_SCALE := 3.0
## Tempo máximo de jogo (s, já acelerado) antes de desistir.
const MAX_GAME_TIME := 240.0
const TARGET_ROUND := 3

var _checks: Array[String] = []
var _failed := 0
var _game_time := 0.0
var _phase := &"boot"
var _kills := 0
var _headshots := 0
var _body_kills := 0
var _saw_attack := false
var _saw_nav_path := false
var _shot_mid := false
var _body_turn := false
## Munição cheia ao começar o round 2 (reabastecimento do MVP).
var _refilled := false
var _bought_glock := false
var _bought_ammo := false
var _saw_break := false
var _repaired := false
## Mystery Box: 0 = não usou, 1 = sorteando, 2 = pegou. Weapon Lab: melhorou a arma.
var _box_step := 0
var _box_weapon := ""
var _upgraded := ""
## Energia e perks.
var _perk_refused_without_power := false
var _power_on := false
var _fortify_health := 0.0
var _has_revive := false
var _saw_revive := false
var _gave_glock := false
var _gave_pump := false
var _switched := false
var _max_hits_one_shot := 0
var _melee_hits := 0
var _knife_swings := 0
## Quando começou a esperar a morte do jogador (s de jogo).
var _die_started := 0.0
## Compra da porta Hall → Plataforma: 0 = ainda não, 1 = posicionado, 2 = feito.
var _door_step := 0
var _door_bought := false
var _platform_spawns_before := 0
var _platform_spawns_after := 0


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	# Save de teste: o bot nunca mexe no save de verdade do jogador.
	Save.load_from("user://test_save.json")
	Save.reset()
	# Offline: o bot nunca envia nada ao ranking global de verdade.
	Online.data = Online.data.duplicate()
	Online.data.url = ""
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://tests/output"))
	Events.zombie_killed.connect(_on_zombie_killed)
	Events.round_started.connect(_on_round_started)
	Events.zombie_hit.connect(func(_z: Node3D, info: DamageInfo) -> void: _melee_hits += 1 if info.kind == DamageInfo.Kind.MELEE else 0)
	get_tree().change_scene_to_file.call_deferred("res://scenes/main.tscn")
	Engine.time_scale = TIME_SCALE
	_phase = &"play"


func _physics_process(delta: float) -> void:
	var main := get_tree().current_scene
	if main == null or main.name != &"Main":
		return
	var player := main.get_node("Player") as Player
	var rounds := main.get_node("RoundManager") as RoundManager
	_game_time += delta
	if int(_game_time / 10.0) != int((_game_time - delta) / 10.0):
		var alive := main.get_node("Zombies").get_children().filter(func(z: Node) -> bool: return z is ZombieBase and (z as ZombieBase).is_alive())
		print("t=%.0f fase=%s round=%d abates=%d vida=%.0f arma=%s %d/%d vivos=%d spawnados=%d busy=%s spun=%s estados=%s" % [_game_time, _phase, rounds.round_number, _kills, player.health.current, player.weapon.data.id, player.weapon.magazine, player.weapon.reserve, alive.size(), rounds.spawned, player.weapon.busy, player.weapon.is_spun_up(), alive.map(func(z: ZombieBase) -> String: return "%s@%.0f,%.0f" % [ZombieBase.State.keys()[z.state], z.global_position.x, z.global_position.z])])
	match _phase:
		&"play":
			_play(main, player, rounds)
		&"die":
			if player.is_down:
				_saw_revive = true
			# Se nenhum zumbi alcançar o jogador a tempo, o golpe final vem do teste.
			if player.is_alive() and not player.is_down and _game_time - _die_started > 30.0:
				player.take_damage(DamageInfo.new(9999.0, DamageInfo.Kind.ENVIRONMENT))
			# Caído no Quick Revive não é o fim: espera a morte de verdade.
			if not player.is_alive() and not player.is_down:
				_phase = &"game_over"
				_finish_game_over.call_deferred(main)


func _play(main: Node, player: Player, rounds: RoundManager) -> void:
	player.controlled = false
	player.health.invulnerable = true
	var zombies := main.get_node("Zombies").get_children().filter(func(z: Node) -> bool: return z is ZombieBase and (z as ZombieBase).is_alive())
	for z in zombies:
		var zombie := z as ZombieBase
		if zombie.state == ZombieBase.State.ATTACK:
			_saw_attack = true
		if zombie.agent.get_current_navigation_path().size() > 1:
			_saw_nav_path = true
	if zombies.size() >= 4 and not _shot_mid:
		_shot_mid = true
		_screenshot.call_deferred("playtest_combate")
	# Deixa os primeiros zumbis chegarem (confere o ataque) antes de atirar.
	var hold_fire := not _saw_attack and _game_time < 60.0
	var nearest: ZombieBase = null
	for z in zombies:
		if nearest == null or player.global_position.distance_to(z.global_position) < player.global_position.distance_to(nearest.global_position):
			nearest = z
	player.move_input = Vector2.ZERO
	_use_inventory(player, rounds)
	_shop_and_barricades(main, player)
	_power_and_perks(main, player)
	_box_and_lab(main, player)
	if _door_step < 2 and _game_time > 6.0:
		_buy_door(main, player)
		return
	if nearest and not hold_fire:
		var aim := nearest.get_node("BodyHurtbox" if _body_turn else "HeadHurtbox") as Node3D
		player.aim_point = aim.global_position
		# Faca quando um zumbi chega perto (algumas vezes).
		if _knife_swings < 4 and player.global_position.distance_to(nearest.global_position) < 2.5 and player.melee.ready_to_swing():
			if player.knife():
				_knife_swings += 1
			return
		var hits := player.fire()
		if player.weapon.data.pellets > 1:
			_max_hits_one_shot = maxi(_max_hits_one_shot, hits.size())
	if rounds.round_number >= TARGET_ROUND or _game_time > MAX_GAME_TIME:
		_end_play(main, player, rounds)


## Vai até a porta Hall → Plataforma, compra e volta (confere área, porta e spawns).
func _buy_door(main: Node, player: Player) -> void:
	var world := main.get_node("World") as LayoutMap
	if _door_step == 0:
		_platform_spawns_before = world.active_spawn_points(99).size()
		(main.get_node("PointsManager") as PointsManager).add(2000)
		player.global_position = Vector3(64.0, 0.1, 29.6)
		player.aim_point = Vector3(64.0, 1.2, 26.0)
		_door_step = 1
		return
	var door := world.find_child("door_hall_platform", true, false)
	_door_bought = player.interact() and world.is_area_open(&"platform")
	_platform_spawns_after = world.active_spawn_points(99).size()
	player.global_position = world.get_player_spawn()
	_door_step = 2
	_check(door != null, "porta Hall → Plataforma existe no mapa migrado")


## Compra na parede com esse id (ou a de munição, com id vazio).
func _wall_buy(player: Player, weapon_id: StringName) -> WallBuy:
	for node in player.get_tree().get_nodes_in_group(&"interactable"):
		var buy := node as WallBuy
		if buy and (buy.weapon_data.id if buy.weapon_data else &"") == weapon_id:
			return buy
	return null


## Munição na parede quando acaba; confere zumbis quebrando tábuas e o conserto (+pontos).
func _shop_and_barricades(main: Node, player: Player) -> void:
	var points := main.get_node("PointsManager") as PointsManager
	# Uma vez: esvazia a reserva para conferir a compra de munição (não depende da sorte).
	if not _bought_ammo and _game_time > 20.0 and not player.inventory.is_switching():
		player.weapon.reserve = 0
	if player.weapon.reserve == 0 and not player.weapon.reloading:
		points.add(player.weapon.data.ammo_price)
		var own := _wall_buy(player, player.weapon.data.id)
		var buy := own if own else _wall_buy(player, &"")
		if buy.interact(player):
			_bought_ammo = true
	for node in player.get_tree().get_nodes_in_group(&"barricades"):
		var barricade := node as Barricade
		if barricade.planks < barricade.data.max_planks:
			_saw_break = true
			if not _repaired and barricade.planks > 0:
				var before := points.points
				barricade.hold_interact(player, barricade.data.repair_time + 0.01)
				_repaired = points.points == before + barricade.data.repair_reward


## Usa a Mystery Box (paga, espera a roleta, pega a arma) e melhora a arma no Weapon Lab.
func _box_and_lab(main: Node, player: Player) -> void:
	var points := main.get_node("PointsManager") as PointsManager
	var box := main.find_child("MysteryBox", true, false) as MysteryBox
	if box == null or _game_time < 12.0:
		return
	if _box_step == 0 and box.state == MysteryBox.State.IDLE:
		points.add(box.price)
		if box.interact(player):
			_box_step = 1
	elif _box_step == 1 and box.state == MysteryBox.State.READY:
		_box_weapon = box.result.display_name
		box.interact(player)
		_box_step = 2
	elif _box_step == 2 and _upgraded == "":
		var lab := main.find_child("WeaponLab", true, false) as WeaponLab
		points.add(lab.price_for(player.weapon.level))
		if lab.interact(player):
			_upgraded = player.weapon.data.display_name


## Sem energia a máquina recusa; liga o disjuntor (segurando E); compra Fortify e Quick Revive.
func _power_and_perks(main: Node, player: Player) -> void:
	if _has_revive or _game_time < 8.0:
		return
	var world := main.get_node("World") as LayoutMap
	var points := main.get_node("PointsManager") as PointsManager
	var machines := world.find_children("*", "StaticBody3D", true, false).filter(func(n: Node) -> bool: return n is PerkMachine)
	var fortify: PerkMachine = machines.filter(func(m: PerkMachine) -> bool: return m.perk.id == &"fortify").front()
	var revive: PerkMachine = machines.filter(func(m: PerkMachine) -> bool: return m.perk.id == &"quick_revive").front()
	if not world.power.is_on:
		points.add(fortify.perk.price)
		_perk_refused_without_power = not fortify.interact(player)
		var breaker: Breaker = world.find_children("*", "StaticBody3D", true, false).filter(func(n: Node) -> bool: return n is Breaker).front()
		breaker.hold_interact(player, world.power.data.breaker_hold_time * 0.5)
		breaker.hold_interact(player, world.power.data.breaker_hold_time * 0.6)
		_power_on = world.power.is_on
		return
	points.add(fortify.perk.price + revive.perk.price)
	fortify.interact(player)
	_fortify_health = player.health.max_health
	_has_revive = revive.interact(player) and player.perks.has_perk(&"quick_revive")


## Troca de arma: pega a Glock no começo e a Pump no round 2 (confere a troca e os chumbos).
func _use_inventory(player: Player, rounds: RoundManager) -> void:
	if not _gave_glock:
		_gave_glock = true
		var points := (player.get_parent().get_node("PointsManager") as PointsManager)
		var before := points.points
		var glock_buy := _wall_buy(player, &"glock")
		_bought_glock = glock_buy != null and glock_buy.interact(player) and player.inventory.owns(&"glock") and points.points == before - 500
	elif not _switched and not player.inventory.is_switching() and _game_time > 3.0:
		_switched = player.inventory.switch_to(0) and player.weapon.data.id == &"m1911"
	if rounds.round_number >= 2 and not _gave_pump:
		_gave_pump = true
		var dropped := player.give_weapon(load("res://data/weapons/pump.tres"))
		if dropped:
			dropped.queue_free()


func _end_play(main: Node, player: Player, rounds: RoundManager) -> void:
	var points := (main.get_node("PointsManager") as PointsManager).points
	_check(rounds.round_number >= TARGET_ROUND, "chegou ao round %d (round atual %d, %.0fs de jogo)" % [TARGET_ROUND, rounds.round_number, _game_time])
	_check(_saw_nav_path, "zumbis seguiram caminho da navegação")
	_check(_saw_attack, "zumbis chegaram e atacaram o jogador")
	_check(_kills >= 21, "abateu os zumbis dos rounds 1 e 2 (%d abates)" % _kills)
	_check(_headshots > 0 and _body_kills > 0, "abates na cabeça (%d) e no corpo (%d)" % [_headshots, _body_kills])
	_check(_door_bought, "comprou a porta: Plataforma aberta")
	_check(_platform_spawns_after > _platform_spawns_before, "spawns da Plataforma ativos (%d → %d)" % [_platform_spawns_before, _platform_spawns_after])
	_check(_switched, "troca de arma (Glock → M1911)")
	_check(_max_hits_one_shot > 1, "espingarda: vários chumbos acertam no mesmo tiro (%d)" % _max_hits_one_shot)
	_check(_melee_hits > 0, "faca acerta zumbis (%d acertos em %d golpes)" % [_melee_hits, _knife_swings])
	_check(_perk_refused_without_power, "sem energia a máquina de perk recusa")
	_check(_power_on, "disjuntor liga a energia (segurando E)")
	_check(is_equal_approx(_fortify_health, 150.0), "Fortify: vida máxima 150 (%.0f)" % _fortify_health)
	_check(_has_revive, "comprou o Quick Revive")
	_check(_box_step == 2 and _box_weapon != "", "Mystery Box sorteou e entregou: %s" % _box_weapon)
	_check(_upgraded.ends_with("Mk II") or _upgraded == "Tornado", "Weapon Lab melhorou a arma: %s" % _upgraded)
	_check(_bought_glock, "comprou a Glock na parede (-500)")
	_check(_bought_ammo, "comprou munição na parede quando acabou")
	_check(_saw_break, "zumbis arrancaram tábuas das barricadas")
	_check(_repaired, "consertou uma barricada (+pontos)")
	_check(points > 500, "pontos subiram (%d)" % points)
	var data := (main.get_node("RoundManager") as RoundManager).data
	var alive := (main.get_node("SpawnManager") as SpawnManager).alive_count()
	_check(alive <= data.max_alive(rounds.round_number), "respeita o limite de vivos (%d)" % alive)
	# Agora o jogador fica vulnerável e para de atirar: os zumbis devem matá-lo.
	player.health.invulnerable = false
	_die_started = _game_time
	_phase = &"die"


func _finish_game_over(main: Node) -> void:
	await get_tree().create_timer(2.0 * TIME_SCALE).timeout
	var hud := main.get_node("HUD")
	var panel := hud.get(&"_game_over_panel") as Control
	_check(_saw_revive, "Quick Revive: caiu e levantou antes de morrer de vez")
	_check(panel != null and panel.visible, "tela de fim de jogo aparece quando o jogador morre")
	var name_edit := hud.find_child("RankName", true, false) as LineEdit
	_check(name_edit != null, "fim de jogo: entrou no top e pede o nome")
	if name_edit:
		name_edit.text = "bot teste"
		name_edit.text_submitted.emit(name_edit.text)
	var ranking := Save.ranking(Session.map_id)
	_check(not ranking.is_empty() and ranking[0].name == "BOT TESTE", "nome gravado no ranking local")
	_check(Save.lifetime.gamesPlayed == 1 and int(Save.records(Session.map_id).bestWave) >= 3, "recordes e totais gravados no save")
	await _screenshot("playtest_game_over")
	Events.restart_requested.emit()
	await get_tree().create_timer(1.0 * TIME_SCALE).timeout
	var fresh := get_tree().current_scene
	var restarted := fresh != main and (fresh.get_node("RoundManager") as RoundManager).round_number == 0 and (fresh.get_node("Player") as Player).is_alive()
	_check(restarted, "jogar novamente reinicia a partida")
	_report()


func _on_round_started(round_number: int, _total: int) -> void:
	var main := get_tree().current_scene
	if round_number == 2 and main and main.has_node("Player"):
		var weapon := (main.get_node("Player") as Player).weapon
		_refilled = weapon.reserve == weapon.data.reserve_ammo


func _on_zombie_killed(_zombie: Node3D, info: DamageInfo) -> void:
	_kills += 1
	if info.is_headshot:
		_headshots += 1
	else:
		_body_kills += 1
	# Alterna o alvo: um zumbi na cabeça, o próximo no corpo.
	_body_turn = not _body_turn


func _screenshot(file_name: String) -> void:
	await RenderingServer.frame_post_draw
	var image := get_viewport().get_texture().get_image()
	image.save_png(ProjectSettings.globalize_path("res://tests/output/%s.png" % file_name))


func _check(condition: bool, description: String) -> void:
	if not condition:
		_failed += 1
	_checks.append(("  ok  " if condition else "  FALHOU  ") + description)


func _report() -> void:
	print("\nPLAYTEST")
	for line in _checks:
		print(line)
	print("%d falharam" % _failed)
	DirAccess.remove_absolute(ProjectSettings.globalize_path("user://test_save.json"))
	Engine.time_scale = 1.0
	get_tree().quit(1 if _failed > 0 else 0)
