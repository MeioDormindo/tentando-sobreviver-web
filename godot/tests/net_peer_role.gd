extends RefCounted
## Roteiro do colega do teste de rede (carregado por net_peer.gd, outro processo sem janela; o
## host é a suíte `net`): entra na sala local (ENet), fica pronto e, na partida, atira nos
## zumbis que aparecerem, compra uma porta e anota o que viu chegar do host. No fim grava o que
## viu em `--out`.

var tree: SceneTree
var root: Window
var _seen := {}
var _out := ""
var _clock := 0.0
var _door_asked := false
var _door_name := ""


func run(p_tree: SceneTree) -> void:
	tree = p_tree
	root = tree.root
	# Nunca no save do jogador.
	var save := root.get_node("Save")
	save.call(&"load_from", "user://test_save_peer.json")
	save.call(&"reset")
	var port := 24711
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--port="):
			port = int(arg.trim_prefix("--port="))
		elif arg.begins_with("--out="):
			_out = arg.trim_prefix("--out=")
	var events := root.get_node("Events")
	events.connect(&"points_changed", func(_total: int, delta: int) -> void:
		if delta > 0:
			_seen.points_gained = int(_seen.get("points_gained", 0)) + delta)
	events.connect(&"round_started", func(n: int, _t: int) -> void: _seen.round_started = n)
	events.connect(&"quest_state", func(state: Dictionary) -> void:
		if String(state.get("objective", "")).contains("Peças"):
			_seen.quest_text = true)
	events.connect(&"boss_state", func(_n: String, _c: float, _m: float, _p: int) -> void: _seen.boss_bar = true)
	events.connect(&"boss_defeated", func(_id: StringName, _n: String, _r: int, _at: Vector3) -> void: _seen.boss_defeated = true)
	# O fantoche morre quando o host avisa (sai do grupo "zombies" ao morrer: conta pelo aviso).
	events.connect(&"zombie_killed", func(zombie: Node3D, _info: DamageInfo) -> void:
		if zombie is ZombieBase and (zombie as ZombieBase).puppet:
			_seen.puppet_died = true)
	events.connect(&"game_over", func(summary: Dictionary) -> void:
		_seen.game_over = true
		_seen.summary_players = int(summary.get("players", 0))
		_seen.summary_kills = int(summary.get("kills", 0)))
	# Cair e levantar pelos avisos (num quadro longo o estado pode ir e voltar sem ser visto).
	events.connect(&"player_downed", func(who: Node3D) -> void:
		if (who as Player).is_local:
			_seen.was_down = true)
	events.connect(&"player_revived", func(who: Node3D) -> void:
		if (who as Player).is_local and _seen.has("was_down"):
			_seen.revived = true)
	events.connect(&"interaction_prompt", func(text: String, _i: String, _p: float) -> void:
		if text.contains("CAÍDO"):
			_seen.down_prompt = true)
	var net := root.get_node("Net")
	net.call(&"join_local", "BETO", "", "127.0.0.1", port)
	var started := Time.get_ticks_msec()
	while Time.get_ticks_msec() - started < 90000 and not _seen.has("game_over"):
		await tree.process_frame
		_clock = (Time.get_ticks_msec() - started) / 1000.0
		_step(net)
	await tree.create_timer(0.5).timeout
	_finish(net)


func _step(net: Node) -> void:
	var state: int = net.get(&"state")
	if state == 2 and not _seen.has("joined"):
		_seen.joined = true
		net.call(&"set_ready", true)
	if not bool(net.get(&"live")) or tree.current_scene == null or tree.current_scene.name != "Main":
		return
	var main := tree.current_scene
	if not _seen.has("live"):
		_seen.live = true
		var host := main.get_node_or_null("Player") as Player
		_seen.host_puppet = host != null and host.net_puppet and not host.is_local and host.peer_id == 1
	var me := Players.local_player()
	if me == null:
		return
	_seen.own_local = me.is_local and not me.net_puppet and me.peer_id == int(net.call(&"my_id"))
	for node in tree.get_nodes_in_group(&"bosses"):
		if node is Boss and (node as Boss).puppet:
			_seen.boss_puppet = true
	if not tree.get_nodes_in_group(&"boss_orbs").is_empty():
		_seen.boss_fx = true
	var crates := tree.get_nodes_in_group(&"minimap_supply")
	if not crates.is_empty():
		_seen.crate_seen = true
	elif _seen.has("crate_seen"):
		_seen.crate_gone = true
	if not tree.get_nodes_in_group(&"minimap_golden").is_empty():
		_seen.golden_seen = true
	if main.find_child("Train", true, false) != null:
		_seen.train_seen = true
	var fuse := main.find_child("SignalFuse", true, false) as QuestSpot
	if fuse:
		_seen.fuse_seen = true
		if fuse.used:
			_seen.fuse_used = true
	if main.find_child("Padlock", true, false) != null:
		_seen.padlock_seen = true
	elif _seen.has("padlock_seen"):
		_seen.padlock_gone = true
	# Zumbis fantoches: mira no mais perto e atira (o host acerta de verdade).
	var target: ZombieBase = null
	for node in tree.get_nodes_in_group(&"zombies"):
		var zombie := node as ZombieBase
		if zombie and zombie.puppet and zombie.is_alive():
			_seen.puppet_seen = true
			if target == null or zombie.global_position.distance_to(me.global_position) < target.global_position.distance_to(me.global_position):
				target = zombie
	if target and me.is_standing():
		me.aim_point = target.global_position + Vector3.UP * 1.2
		me.fire()
	# A porta: vai até ela e pede para abrir (o host cobra da sua carteira).
	if not _door_asked and _clock > 3.0 and int(_seen.get("points_gained", 0)) > 0:
		for node in main.get_node("World").find_children("*", "Door", true, false):
			var door := node as Door
			if door and not door.is_open and door.kind == &"buy":
				_door_name = String(door.name)
				me.global_position = door.global_position + Vector3(0.0, 0.0, 1.0)
				_door_asked = true
				await tree.create_timer(0.4).timeout
				me.net.request(&"interact", [])
				break
	if _door_name != "":
		var door := main.get_node("World").find_child(_door_name, true, false) as Door
		if door == null or door.is_open:
			_seen.door_opened = true


func _finish(net: Node) -> void:
	var file := FileAccess.open(_out, FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify(_seen))
		file.close()
	net.call(&"leave")
	root.get_node("Save").call(&"reset")
	DirAccess.remove_absolute(ProjectSettings.globalize_path("user://test_save_peer.json"))
