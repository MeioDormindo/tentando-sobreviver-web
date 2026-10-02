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
		"-s", "res://tests/net_peer.gd", "--", "--port=%d" % PORT, "--out=" + out])
	check(pid > 0, "abre o colega (outro processo)")
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
	# O time inteiro cai: fim de jogo para os dois.
	host.health.invulnerable = false
	mate.take_damage(DamageInfo.new(999, DamageInfo.Kind.ENVIRONMENT, null, false, mate.global_position))
	host.take_damage(DamageInfo.new(999, DamageInfo.Kind.ENVIRONMENT, null, false, host.global_position))
	var game := main.get_node("GameManager") as GameManager
	check(game.over, "todos caídos: fim de jogo no host")
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
	check(bool(peer.get("game_over", false)) and int(peer.get("summary_players", 0)) == 2 and int(peer.get("summary_kills", 0)) > 0, "no colega: fim de jogo com o resumo dele (%d abates)" % int(peer.get("summary_kills", 0)))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(out))
	Net.leave()
	_tree.paused = false
	if is_instance_valid(main):
		main.queue_free()
	await _tree.process_frame
