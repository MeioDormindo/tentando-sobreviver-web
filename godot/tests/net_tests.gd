extends RefCounted
## Testes da rede (sem internet): o protocolo de entrada do WebRTC com a sinalização em memória
## (host e colegas no mesmo processo, cada um com o seu SceneMultiplayer) — entra, conecta,
## sala cheia e partida começada recusam. Executados por run_tests.gd.

var _passed := 0
var _failed := 0
var _tree: SceneTree


func run(tree: SceneTree) -> int:
	_tree = tree
	print("Rede: entrar na sala pelo WebRTC (sinalização em memória)")
	await _webrtc_join()
	print("Rede: partida em dois processos (ENet local, o colega é outro Godot)")
	await _match()
	print("Rede: Hospital e Templo em dois processos (inimigos, eventos e chefe de cada mapa)")
	await _map_smoke("map2", [&"crawler", &"spitter", &"armored", &"hound"], [&"containment_breach", &"blackout", &"fog"], &"patient_zero")
	await _map_smoke("temple", [&"harpy", &"gorgon", &"skeleton_archer", &"hoplite_shield", &"satyr", &"hellwolf"], [&"zeus_wrath", &"artemis_hunt", &"underworld_portal", &"blood_of_gods"], &"minotaur")
	print("\n%d ok, %d falharam (rede)" % [_passed, _failed])
	return _failed


func check(condition: bool, description: String) -> void:
	if condition:
		_passed += 1
		print("  ok  ", description)
	else:
		_failed += 1
		printerr("  FALHOU  ", description)


## Um lado da conexão: transporte + SceneMultiplayer próprio (fora da árvore, com poll manual).
class Endpoint:
	var transport: WebRTCTransport
	var api := SceneMultiplayer.new()
	var signaling := Signaling.new()
	var seen: Array[int] = []
	var rejected := ""

	func _init(code: String) -> void:
		transport = WebRTCTransport.new()
		signaling.code = code
		transport.rejected.connect(_on_rejected)
		api.peer_connected.connect(_on_peer)

	func _on_rejected(reason: String) -> void:
		rejected = reason

	func _on_peer(id: int) -> void:
		seen.append(id)

	func poll(delta: float) -> void:
		transport.poll(delta)
		api.poll()


func _pump(sides: Array, until: Callable, seconds := 8.0) -> bool:
	var started := Time.get_ticks_msec()
	while Time.get_ticks_msec() - started < seconds * 1000.0:
		await _tree.process_frame
		for side: Endpoint in sides:
			side.poll(0.016)
		if until.call():
			return true
	return false


func _webrtc_join() -> void:
	var host := Endpoint.new("TESTE")
	host.transport.max_players = 3
	check(host.transport.host(host.signaling) == OK, "host abre a sala")
	host.api.multiplayer_peer = host.transport.peer
	var ana := Endpoint.new("TESTE")
	var beto := Endpoint.new("TESTE")
	check(ana.transport.join(ana.signaling, {"name": "ANA"}) == OK and beto.transport.join(beto.signaling, {"name": "BETO"}) == OK, "dois colegas pedem para entrar")
	ana.api.multiplayer_peer = ana.transport.peer
	beto.api.multiplayer_peer = beto.transport.peer
	var everyone := [host, ana, beto]
	var connected := await _pump(everyone, func() -> bool:
		return host.seen.size() == 2 and ana.seen.has(1) and beto.seen.has(1))
	check(connected, "oferta, resposta e candidatos: o host vê os 2 e cada um vê o host (%s)" % [host.seen])
	check(ana.api.get_unique_id() != beto.api.get_unique_id() and ana.api.get_unique_id() > 1, "cada colega tem o seu id (%d, %d)" % [ana.api.get_unique_id(), beto.api.get_unique_id()])
	# Os colegas se veem pelo host (retransmissão do SceneMultiplayer).
	var relayed := await _pump(everyone, func() -> bool: return ana.seen.size() >= 2 and beto.seen.size() >= 2, 3.0)
	check(relayed, "os colegas se enxergam pelo host")
	# Sala de 3 cheia: o quarto é recusado.
	var caio := Endpoint.new("TESTE")
	caio.transport.join(caio.signaling, {"name": "CAIO"})
	caio.api.multiplayer_peer = caio.transport.peer
	everyone.append(caio)
	var full := await _pump(everyone, func() -> bool: return caio.rejected != "", 3.0)
	check(full and caio.rejected.contains("cheia"), "sala cheia recusa (%s)" % caio.rejected)
	# Partida começada: ninguém mais entra.
	host.transport.max_players = 4
	host.transport.accepting = false
	var dani := Endpoint.new("TESTE")
	dani.transport.join(dani.signaling, {"name": "DANI"})
	dani.api.multiplayer_peer = dani.transport.peer
	everyone.append(dani)
	var late := await _pump(everyone, func() -> bool: return dani.rejected != "", 3.0)
	check(late and dani.rejected.contains("começou"), "partida começada recusa (%s)" % dani.rejected)
	for side: Endpoint in everyone:
		side.transport.close()
		side.api.multiplayer_peer = null
	Signaling._boxes.clear()


func _wait(until: Callable, seconds: float) -> bool:
	var started := Time.get_ticks_msec()
	while Time.get_ticks_msec() - started < seconds * 1000.0:
		if until.call():
			return true
		await _tree.process_frame
	return until.call()


## Este processo é o host; o colega é outro Godot sem janela (net_peer.gd) que entra, fica
## pronto, atira, compra uma porta e anota o que viu chegar daqui.
func _match() -> void:
	const PORT := 24711
	var out := "user://net_peer_result.json"
	DirAccess.remove_absolute(ProjectSettings.globalize_path(out))
	if not String(Save.get("_path")).contains("test"):
		Save.load_from("user://test_save.json")
	Net.host_local("ANA", "", PORT)
	var pid := OS.create_process(OS.get_executable_path(), ["--headless", "--path", ProjectSettings.globalize_path("res://"),
		"-s", "res://tests/net_peer.gd", "--", "--port=%d" % PORT, "--out=" + out, "--lang=en"])
	check(pid > 0, "abre o colega (outro processo, jogando em inglês)")
	var joined := await _wait(func() -> bool: return Net.players.size() == 2 and Net.everyone_ready(), 25.0)
	check(joined, "o colega entra na sala e fica pronto (%d jogadores)" % Net.players.size())
	if not joined:
		OS.kill(pid)
		Net.leave()
		return
	check(Net.start_match(), "o host começa a partida")
	var live := await _wait(func() -> bool: return Net.live and _tree.current_scene != null and _tree.current_scene.name == "Main", 25.0)
	check(live, "os dois carregaram a partida")
	if not live:
		OS.kill(pid)
		Net.leave()
		return
	var main := _tree.current_scene
	var host := main.get_node("Player") as Player
	var mates := Players.all().filter(func(p: Player) -> bool: return p != host)
	var mate: Player = mates[0] if not mates.is_empty() else null
	check(mate != null and mate.net_puppet and not mate.is_local and host.is_local and not host.net_puppet, "o host roda o próprio personagem; o do colega segue a rede")
	if mate == null:
		OS.kill(pid)
		return
	# Ninguém cai sozinho antes da hora (os zumbis do round vêm vindo).
	host.health.invulnerable = true
	mate.health.invulnerable = true
	var moved := await _wait(func() -> bool: return mate.get(&"_net_has_target"), 5.0)
	check(moved, "a posição do colega chega no host")
	var opened := [false]
	Events.area_opened.connect(func(_id: StringName, _n: String) -> void: opened[0] = true)
	var points := main.get_node("PointsManager") as PointsManager
	points.add(5000, false, mate)
	var spawn := main.get_node("SpawnManager") as SpawnManager
	for i in 3:
		spawn.spawn_at(&"walker", mate.global_position + Vector3(6.0, 0.0, -2.0 + i * 2.0))
	var paid := await _wait(func() -> bool: return points.earned_of(mate) > 5000, 30.0)
	check(paid, "o tiro do colega mata no host e os pontos vão para ele (+%d)" % (points.earned_of(mate) - 5000))
	var door := await _wait(func() -> bool: return opened[0], 15.0)
	check(door and points.points_of(mate) < points.earned_of(mate) + 500, "o colega compra uma porta com a carteira dele")
	# Cai e um colega revive (o host faz e a máquina do colega vê).
	mate.health.invulnerable = false
	mate.take_damage(DamageInfo.new(999, DamageInfo.Kind.ENVIRONMENT, null, false, mate.global_position))
	check(mate.bleeding, "o colega cai (no host)")
	await _tree.create_timer(1.0).timeout
	host.global_position = mate.global_position + Vector3(1.0, 0.0, 0.0)
	mate.help_revive(host, Player.REVIVE_TIME + 0.1)
	check(mate.is_standing(), "o host revive o colega")
	await _tree.create_timer(1.0).timeout
	# Chefe: o colega vê o Conductor (fantoche), a barra de vida e a derrota.
	var bosses := main.get_node("BossManager") as BossManager
	bosses.start(&"conductor")
	var spawned := await _wait(func() -> bool: return is_instance_valid(bosses.boss), 6.0)
	check(spawned, "o host chama o chefe")
	if spawned:
		await _tree.create_timer(1.5).timeout
		# Um ataque com os parâmetros do host (as esferas de alma ficam num grupo fácil de achar).
		bosses.boss._fx(&"volley", [bosses.boss.global_position + Vector3.UP * 1.4, Vector3.FORWARD])
		await _tree.create_timer(0.6).timeout
		bosses.boss.health.invulnerable = false
		bosses.boss.take_damage(DamageInfo.new(bosses.boss.health.current + 1.0, DamageInfo.Kind.WEAPON, host, false, bosses.boss.global_position))
		check(not bosses.boss.is_alive(), "o host derrota o chefe")
		await _tree.create_timer(1.0).timeout
	# Eventos do mapa: o colega vê a caixa de suprimentos, o zumbi dourado e o trem (e a caixa some
	# quando o host encerra).
	var events := main.get_node("WorldEventSystem") as WorldEventSystem
	var supply := events.trigger(&"supply_drop")
	var golden := events.trigger(&"golden_zombie")
	var train := events.call_train()
	check(supply and golden, "o host começa eventos (suprimentos, dourado%s)" % (", trem" if train else ""))
	# A caixa pousa em 2,2 s (só então entra no minimapa).
	await _tree.create_timer(3.2).timeout
	events.stop()
	await _tree.create_timer(1.0).timeout
	# Missão do Terminal: o colega vê as peças, o cadeado abrir e o fusível ser pego.
	var quest := main.get_node("TrainQuest") as TrainQuest
	var power := _tree.get_first_node_in_group(&"power_system") as PowerSystem
	if power:
		power.turn_on()
	var parts := await _wait(func() -> bool: return quest.index >= 1, 3.0)
	check(parts, "a missão avança no host (energia ligada)")
	await _tree.create_timer(1.0).timeout
	if parts and quest.lock:
		(quest.lock.get_node("HealthComponent") as HealthComponent).apply_damage(DamageInfo.new(5.0, DamageInfo.Kind.WEAPON, host))
	var fuse := main.get_node("World").find_child("SignalFuse", true, false) as QuestSpot
	if fuse:
		fuse.finish()
	await _tree.create_timer(1.0).timeout
	# Etapa final (o chefe caiu ali): o colega pega a Lanterna segurando E na máquina dele, e o
	# prêmio (todos os perks + a Lanterna) é só dele, que concluiu.
	quest.boss_down = host.global_position + Vector3(3.0, 0.0, 0.0)
	quest.index = 3
	var finished_quest := await _wait(func() -> bool: return quest.done, 20.0)
	check(finished_quest, "o colega conclui a missão segurando E na lanterna (etapa %d)" % quest.index)
	var mate_perks := mate.perks.owned.size()
	check(mate_perks >= 7 and mate.inventory.owns(&"conductor_lantern"), "prêmio da missão para quem concluiu: todos os perks (%d) e a Lanterna" % mate_perks)
	check(host.perks.owned.size() < 7 and not host.inventory.owns(&"conductor_lantern"), "o host, que não concluiu, fica sem o prêmio")
	await _tree.create_timer(1.0).timeout
	# O time inteiro cai: fim de jogo para os dois.
	host.health.invulnerable = false
	mate.take_damage(DamageInfo.new(999, DamageInfo.Kind.ENVIRONMENT, null, false, mate.global_position))
	host.take_damage(DamageInfo.new(999, DamageInfo.Kind.ENVIRONMENT, null, false, host.global_position))
	var game := main.get_node("GameManager") as GameManager
	check(game.over, "todos caídos: fim de jogo no host")
	check(Net.ping_of(mate.peer_id) >= 0, "o host mede a latência do colega (%d ms)" % Net.ping_of(mate.peer_id))
	var finished := await _wait(func() -> bool: return not OS.is_process_running(pid), 20.0)
	if not finished:
		OS.kill(pid)
	var seen: Variant = JSON.parse_string(FileAccess.get_file_as_string(out)) if FileAccess.file_exists(out) else null
	var peer: Dictionary = seen if seen is Dictionary else {}
	check(bool(peer.get("live", false)) and bool(peer.get("host_puppet", false)) and bool(peer.get("own_local", false)), "no colega: o host é um fantoche e o personagem dele é o local (%s)" % [peer.keys()])
	check(int(peer.get("round_started", 0)) >= 1, "no colega: o round chega do host")
	check(bool(peer.get("puppet_seen", false)) and bool(peer.get("puppet_died", false)), "no colega: zumbis fantoches nascem e morrem quando o host avisa")
	check(int(peer.get("points_gained", 0)) > 0, "no colega: a HUD recebe os pontos dele (+%d)" % int(peer.get("points_gained", 0)))
	check(bool(peer.get("door_opened", false)), "no colega: a porta que ele comprou abre")
	check(bool(peer.get("was_down", false)) and bool(peer.get("revived", false)) and bool(peer.get("down_prompt", false)), "no colega: cai (com o aviso na HUD) e levanta (caiu=%s levantou=%s aviso=%s)" % [peer.get("was_down", false), peer.get("revived", false), peer.get("down_prompt", false)])
	check(bool(peer.get("boss_puppet", false)) and bool(peer.get("boss_bar", false)) and bool(peer.get("boss_defeated", false)), "no colega: o chefe aparece (fantoche, com a barra) e cai quando o host derrota (%s, %s, %s)" % [peer.get("boss_puppet", false), peer.get("boss_bar", false), peer.get("boss_defeated", false)])
	check(bool(peer.get("boss_fx", false)), "no colega: o ataque do chefe aparece com os parâmetros do host")
	check(bool(peer.get("crate_seen", false)) and bool(peer.get("crate_gone", false)), "no colega: a caixa de suprimentos cai e some quando o evento acaba")
	check(bool(peer.get("golden_seen", false)), "no colega: o zumbi dourado aparece dourado")
	check(not train or bool(peer.get("train_seen", false)), "no colega: o trem passa")
	check(bool(peer.get("quest_text", false)), "no colega: o objetivo da missão chega na HUD")
	check(bool(peer.get("fuse_seen", false)) and bool(peer.get("padlock_seen", false)), "no colega: as peças da missão aparecem (fusível, cadeado)")
	check(bool(peer.get("padlock_gone", false)) and bool(peer.get("fuse_used", false)), "no colega: o cadeado abre e o fusível é pego quando o host faz")
	check(int(peer.get("perks", 0)) >= 7 and bool(peer.get("lantern", false)), "no colega: a HUD mostra os perks do prêmio (%d) e a Lanterna chega nas armas dele" % int(peer.get("perks", 0)))
	check(String(peer.get("feed", "")).contains("levantou"), "no colega: o feed mostra quem levantou quem (%s)" % peer.get("feed", ""))
	var shown := String(peer.get("feed_shown", ""))
	check(String(peer.get("lang", "")) == "en" and shown.contains(" revived ") and not shown.contains("levantou"),
		"no colega em inglês: o feed do host (em português) aparece em inglês (%s)" % shown)
	check(bool(peer.get("ping", false)), "no colega: chega a latência medida pelo host")
	check(bool(peer.get("game_over", false)) and int(peer.get("summary_players", 0)) == 2 and int(peer.get("summary_kills", 0)) > 0, "no colega: fim de jogo com o resumo dele (%d abates)" % int(peer.get("summary_kills", 0)))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(out))
	Net.leave()
	_tree.paused = false
	if is_instance_valid(main):
		main.queue_free()
	await _tree.process_frame


## Um mapa em dois processos: o host escolhe o mapa na sala, faz nascer os inimigos com
## habilidades dele, começa eventos e chama o chefe; o colega anota o que viu chegar.
func _map_smoke(map_id: String, types: Array, event_ids: Array, boss_id: StringName) -> void:
	const PORT := 24712
	var out := "user://net_peer_smoke.json"
	DirAccess.remove_absolute(ProjectSettings.globalize_path(out))
	Net.host_local("ANA", "", PORT)
	Net.set_map(map_id)
	var pid := OS.create_process(OS.get_executable_path(), ["--headless", "--path", ProjectSettings.globalize_path("res://"),
		"-s", "res://tests/net_peer.gd", "--", "--port=%d" % PORT, "--out=" + out, "--smoke"])
	var joined := await _wait(func() -> bool: return Net.players.size() == 2 and Net.everyone_ready(), 25.0)
	if not joined or not Net.start_match():
		check(false, "%s: o colega entra e a partida começa" % map_id)
		OS.kill(pid)
		Net.leave()
		return
	var live := await _wait(func() -> bool: return Net.live and _tree.current_scene != null and _tree.current_scene.name == "Main", 25.0)
	check(live and Session.map_id == map_id, "%s: os dois carregaram a partida no mapa escolhido" % map_id)
	if not live:
		OS.kill(pid)
		Net.leave()
		return
	var main := _tree.current_scene
	var host := main.get_node("Player") as Player
	for someone in Players.all():
		someone.health.invulnerable = true
	var mates := Players.all().filter(func(p: Player) -> bool: return p != host)
	check(not mates.is_empty() and (mates[0] as Player).weapon.data.id == host.weapon.data.id and host.weapon.data.id == host.start_weapon_id(),
		"%s: o colega começa com a arma inicial do mapa (%s)" % [map_id, host.weapon.data.id])
	var spawn := main.get_node("SpawnManager") as SpawnManager
	for i in types.size():
		var angle := TAU * i / types.size()
		spawn.spawn_at(types[i], host.global_position + Vector3(cos(angle), 0.0, sin(angle)) * 6.0)
	var events := main.get_node("WorldEventSystem") as WorldEventSystem
	var started: Array = []
	for id: StringName in event_ids:
		if events.trigger(id):
			started.append(String(id))
	(main.get_node("BossManager") as BossManager).start(boss_id)
	await _tree.create_timer(9.0).timeout
	Net.leave()
	_tree.paused = false
	main.queue_free()
	await _wait(func() -> bool: return not OS.is_process_running(pid), 20.0)
	if OS.is_process_running(pid):
		OS.kill(pid)
	var seen: Variant = JSON.parse_string(FileAccess.get_file_as_string(out)) if FileAccess.file_exists(out) else null
	var peer: Dictionary = seen if seen is Dictionary else {}
	DirAccess.remove_absolute(ProjectSettings.globalize_path(out))
	var seen_types: Array = peer.get("types", [])
	var missing := types.filter(func(t: StringName) -> bool: return not seen_types.has(String(t)))
	check(String(peer.get("map", "")) == map_id and missing.is_empty(), "%s: no colega aparecem os fantoches de cada tipo (faltou %s)" % [map_id, missing])
	var seen_events: Array = peer.get("events", [])
	check(not started.is_empty() and started.all(func(id: String) -> bool: return seen_events.has(id)), "%s: os eventos começados no host chegam ao colega (%s)" % [map_id, started])
	check(String(peer.get("boss", "")) == String(boss_id), "%s: o chefe aparece no colega (%s)" % [map_id, peer.get("boss", "")])
	if types.has(&"harpy"):
		check(bool(peer.get("flying", false)), "%s: a Harpia voa no colega (altura vinda do host)" % map_id)
	await _tree.process_frame
