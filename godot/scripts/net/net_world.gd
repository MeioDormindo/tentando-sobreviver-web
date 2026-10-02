class_name NetWorld
extends Node
## A partida em grupo pela rede (nó "NetWorld" da cena, só quando há sala). O host roda o jogo;
## os colegas só mostram e pedem ações:
## - começo: espera todos carregarem a cena (antes disso nada vai pela rede);
## - nos colegas, os sistemas que decidem (rounds, spawn, pontos, drops, anti-trapaça) ficam
##   parados — o que eles decidem chega daqui;
## - zumbis: nascimento, posição (20 por segundo), golpe, acerto e morte viram "fantoches";
## - avisos de todos (round, power-ups, score...) e o estado do mapa (portas, tábuas, energia,
##   Mystery Box, armas e power-ups no chão);
## - fim de jogo com o resumo de cada um; quem sai da partida some do mapa.

const SNAPSHOT_EVERY := 0.05
## Avisos que mudam a cada quadro: no máximo 5 por segundo.
const THROTTLED := {&"power_up_timers": 0.2, &"boss_state": 0.2, &"world_event_state": 0.2}
## Avisos de todos retransmitidos pelo host (os da HUD de cada jogador vão pelo NetPlayer).
const RELAYED: Array[StringName] = [
	&"round_started", &"round_remaining_changed", &"round_completed", &"toast",
	&"power_up_collected", &"power_up_timers", &"boss_incoming", &"boss_state", &"boss_phase",
	&"boss_defeated", &"score_changed", &"mystery_box_rolled", &"hound_round_changed",
	&"world_event_started", &"world_event_state", &"reward_multiplier_changed", &"quest_state",
	&"quest_completed", &"max_ammo", &"map_unlocked",
]

var main: Node
var _loaded: Dictionary = {}
var _clock := 0.0
var _snapshot_in := 0.0
var _sent_at: Dictionary = {}
var _next_zombie := 1
var _zombies: Dictionary = {}
var _next_drop := 1
## aviso → retransmissor ligado no Events (desligado ao sair da partida).
var _relays: Dictionary = {}
var _ready_in := 0.0


func _ready() -> void:
	Net.world = self
	main = get_parent()
	multiplayer.peer_disconnected.connect(_on_peer_left)
	for signal_name in RELAYED:
		var relay := _make_relay(signal_name)
		_relays[signal_name] = relay
		Events.connect(signal_name, relay)
	if Net.is_host():
		_setup_host.call_deferred()
		_loaded[1] = true
	else:
		_setup_client.call_deferred()


func _exit_tree() -> void:
	for signal_name: StringName in _relays:
		if Events.is_connected(signal_name, _relays[signal_name]):
			Events.disconnect(signal_name, _relays[signal_name])
	_relays.clear()
	if Net.world == self:
		Net.world = null
	Net.live = false


func _physics_process(delta: float) -> void:
	_clock += delta
	# Colega: avisa que carregou até o host responder (o aviso pode chegar antes de a cena do host
	# existir e se perder).
	if not Net.live and not Net.is_host():
		_ready_in -= delta
		if _ready_in <= 0.0:
			_ready_in = 0.5
			_ready_to_play.rpc_id(1)
		return
	if not Net.live or not Net.is_host():
		return
	_snapshot_in -= delta
	if _snapshot_in <= 0.0:
		_snapshot_in = SNAPSHOT_EVERY
		_send_snapshot()


# ───────────────────────── Começo ─────────────────────────

@rpc("any_peer", "reliable")
func _ready_to_play() -> void:
	if not Net.is_host():
		return
	_loaded[multiplayer.get_remote_sender_id()] = true
	_maybe_go()


func _maybe_go() -> void:
	if Net.live:
		return
	for entry: Dictionary in Session.roster:
		if not _loaded.has(int(entry.peer)):
			return
	_go.rpc()


@rpc("authority", "reliable", "call_local")
func _go() -> void:
	Net.live = true
	var rounds := main.get_node_or_null("RoundManager")
	if rounds and Net.is_host():
		rounds.process_mode = Node.PROCESS_MODE_INHERIT
	if Net.is_host():
		var points := main.get_node_or_null("PointsManager") as PointsManager
		for someone in Players.all():
			if someone.net:
				someone.net.send_initial_hud(points)


## Host: rounds esperam todos carregarem; chefes e eventos ficam para depois (Etapa 2); o estado
## do mapa vai para os colegas.
func _setup_host() -> void:
	var rounds := main.get_node_or_null("RoundManager") as RoundManager
	if rounds:
		rounds.boss_manager = null
		if not Net.live:
			rounds.process_mode = Node.PROCESS_MODE_DISABLED
	var container := main.get_node_or_null("Zombies")
	if container:
		container.child_entered_tree.connect(_on_zombie_added)
	Events.zombie_hit.connect(_on_zombie_hit)
	Events.zombie_attacked.connect(_on_zombie_attacked)
	Events.power_changed.connect(_on_power_changed)
	var world := main.get_node_or_null("World")
	if world:
		for node in world.find_children("*", "", true, false):
			if node is Door:
				(node as Door).opened.connect(func(door: Door) -> void:
					if Net.live:
						_door.rpc(String(door.name)))
			elif node is Barricade:
				var barricade := node as Barricade
				barricade.planks_changed.connect(func(count: int, _max: int) -> void:
					if Net.live:
						_planks.rpc(String(barricade.name), count))
	# Se todos já tinham avisado antes deste nó ficar pronto.
	_maybe_go()


## Colega: os sistemas que decidem ficam parados (o host manda o que acontece).
func _setup_client() -> void:
	var rounds := main.get_node_or_null("RoundManager") as RoundManager
	if rounds:
		rounds.stop()
		rounds.process_mode = Node.PROCESS_MODE_DISABLED
	for system in ["SpawnManager", "BossManager", "AntiCheat"]:
		var node := main.get_node_or_null(system)
		if node:
			node.process_mode = Node.PROCESS_MODE_DISABLED
	for node in main.find_children("*", "MysteryBox", true, false):
		(node as MysteryBox).remote = true


func _on_power_changed(on: bool) -> void:
	if on and Net.live and Net.is_host():
		_power.rpc()


# ───────────────────────── Avisos de todos ─────────────────────────

## Um retransmissor por aviso (os avisos têm de 0 a 4 valores).
func _make_relay(signal_name: StringName) -> Callable:
	var count := 0
	for info: Dictionary in Events.get_signal_list():
		if info.name == signal_name:
			count = (info.args as Array).size()
	return func(a: Variant = null, b: Variant = null, c: Variant = null, d: Variant = null) -> void:
		_relay(signal_name, [a, b, c, d].slice(0, count))


func _relay(signal_name: StringName, args: Array) -> void:
	if not Net.is_host() or not Net.live or Net.relay_mute > 0:
		return
	if THROTTLED.has(signal_name):
		if _clock - float(_sent_at.get(signal_name, -INF)) < float(THROTTLED[signal_name]):
			return
		_sent_at[signal_name] = _clock
	_event.rpc(signal_name, args)


@rpc("authority", "reliable")
func _event(signal_name: StringName, args: Array) -> void:
	if Events.has_signal(signal_name):
		Events.emit_signal.callv([signal_name] + args)


# ───────────────────────── Zumbis ─────────────────────────

func _on_zombie_added(node: Node) -> void:
	var zombie := node as ZombieBase
	if zombie == null or zombie.puppet:
		return
	var id := _next_zombie
	_next_zombie += 1
	zombie.set_meta(&"net_id", id)
	_zombies[id] = zombie
	zombie.died.connect(func(_c: CharacterBase, info: DamageInfo) -> void:
		_zombies.erase(id)
		if Net.live:
			_z_die.rpc(id, info.is_headshot, int(info.kind), info.hit_position))
	if Net.live:
		_z_spawn.rpc(id, String(zombie.data.id), zombie.global_position if zombie.is_inside_tree() else zombie.position)


func _send_snapshot() -> void:
	var pack := PackedFloat32Array()
	for id: int in _zombies:
		var zombie := _zombies[id] as ZombieBase
		if not is_instance_valid(zombie) or not zombie.is_inside_tree():
			continue
		var at := zombie.global_position
		pack.append_array([float(id), at.x, at.y, at.z, zombie.velocity.x, zombie.velocity.z, zombie.pivot.rotation.y])
	if not pack.is_empty():
		_z_snapshot.rpc(pack)


func _on_zombie_hit(node: Node3D, info: DamageInfo) -> void:
	if Net.live and node and node.has_meta(&"net_id"):
		_z_hit.rpc(int(node.get_meta(&"net_id")), info.hit_position, info.is_headshot, int(info.kind))


func _on_zombie_attacked(node: Node3D) -> void:
	if Net.live and node and node.has_meta(&"net_id") and not (node as ZombieBase).puppet:
		_z_attack.rpc(int(node.get_meta(&"net_id")))


func _puppet(id: int) -> ZombieBase:
	var zombie := _zombies.get(id) as ZombieBase
	return zombie if is_instance_valid(zombie) else null


@rpc("authority", "reliable")
func _z_spawn(id: int, type: String, at: Vector3) -> void:
	var spawn := main.get_node_or_null("SpawnManager") as SpawnManager
	var container := main.get_node_or_null("Zombies") as Node3D
	if spawn == null or container == null:
		return
	var zombie := ZombieFactory.create(spawn.type_data(StringName(type)), null, 1.0, 1.0, 1.0)
	if zombie == null:
		return
	zombie.make_puppet()
	zombie.name = "Z%d" % id
	zombie.set_meta(&"net_id", id)
	zombie.position = container.to_local(at)
	container.add_child(zombie)
	_zombies[id] = zombie


@rpc("authority", "unreliable_ordered")
func _z_snapshot(pack: PackedFloat32Array) -> void:
	for i in range(0, pack.size() - 6, 7):
		var zombie := _puppet(int(pack[i]))
		if zombie:
			zombie.net_state(Vector3(pack[i + 1], pack[i + 2], pack[i + 3]), Vector3(pack[i + 4], 0.0, pack[i + 5]), pack[i + 6])


@rpc("authority", "unreliable")
func _z_hit(id: int, at: Vector3, headshot: bool, kind: int) -> void:
	var zombie := _puppet(id)
	if zombie:
		zombie.net_hit(at, headshot, kind)


@rpc("authority", "unreliable")
func _z_attack(id: int) -> void:
	var zombie := _puppet(id)
	if zombie:
		zombie.net_attack()


@rpc("authority", "reliable")
func _z_die(id: int, headshot: bool, kind: int, at: Vector3) -> void:
	var zombie := _puppet(id)
	_zombies.erase(id)
	if zombie:
		zombie.net_die(headshot, kind, at)


# ───────────────────────── Mapa ─────────────────────────

@rpc("authority", "reliable")
func _door(door_name: String) -> void:
	var door := main.find_child(door_name, true, false) as Door
	if door and not door.is_open:
		door.open()


@rpc("authority", "reliable")
func _planks(barricade_name: String, count: int) -> void:
	var barricade := main.find_child(barricade_name, true, false) as Barricade
	if barricade:
		barricade.net_set_planks(count)


@rpc("authority", "reliable")
func _power() -> void:
	var power := get_tree().get_first_node_in_group(&"power_system") as PowerSystem
	if power:
		power.turn_on()


## Host: a Mystery Box mudou (sorteio, arma, fim, mudança de lugar).
func on_box(box: MysteryBox, kind: StringName, info: Dictionary) -> void:
	if Net.live and box.is_inside_tree():
		_box.rpc(String(main.get_path_to(box)), kind, info)


@rpc("authority", "reliable")
func _box(path: String, kind: StringName, info: Dictionary) -> void:
	var box := main.get_node_or_null(path) as MysteryBox
	if box:
		box.net_apply(kind, info)


## Host: uma arma caiu no chão.
func on_drop(drop: WeaponDrop) -> void:
	if drop == null or drop.weapon == null:
		return
	drop.name = "Drop%d" % _next_drop
	_next_drop += 1
	var drop_name := String(drop.name)
	drop.tree_exiting.connect(func() -> void:
		if Net.live:
			_drop_gone.rpc(drop_name))
	if Net.live:
		var w := drop.weapon
		_drop.rpc(drop_name, String(w.data.id), w.level, String(w.element), drop.global_position if drop.is_inside_tree() else drop.position)


@rpc("authority", "reliable")
func _drop(drop_name: String, weapon_id: String, level: int, element: String, at: Vector3) -> void:
	var base := load("res://data/weapons/%s.tres" % weapon_id) as WeaponData
	if base == null:
		return
	var holder := WeaponInventory.new()
	holder.rebuild([[base, level, StringName(element)]], 0, load("res://data/configs/weapon_lab.tres"))
	var weapon := holder.weapons[0]
	holder.remove_child(weapon)
	holder.free()
	var drop := WeaponDrop.spawn(get_tree(), weapon, at)
	drop.name = drop_name
	drop.position = at


@rpc("authority", "reliable")
func _drop_gone(drop_name: String) -> void:
	for node in get_tree().get_nodes_in_group(&"weapon_drops"):
		if String(node.name) == drop_name:
			node.queue_free()


## Host: power-up no chão (nasce e some).
func on_pickup(pickup: Node3D, id: StringName, at: Vector3) -> void:
	pickup.name = "PowerUp%d" % _next_drop
	_next_drop += 1
	if Net.live:
		_pickup.rpc(String(pickup.name), id, at)


func on_pickup_removed(pickup: Node3D) -> void:
	if Net.live:
		_pickup_gone.rpc(String(pickup.name))


@rpc("authority", "reliable")
func _pickup(pickup_name: String, id: StringName, at: Vector3) -> void:
	var power_ups := get_tree().get_first_node_in_group(&"power_ups") as PowerUpSystem
	if power_ups:
		var pickup := power_ups.spawn_drop(id, at)
		pickup.name = pickup_name


@rpc("authority", "reliable")
func _pickup_gone(pickup_name: String) -> void:
	var power_ups := get_tree().get_first_node_in_group(&"power_ups") as PowerUpSystem
	if power_ups:
		power_ups.remove_named(pickup_name)


# ───────────────────────── Fim e saída ─────────────────────────

## Host: fim de jogo do time — cada colega recebe o resumo dele.
func send_game_over(game: GameManager) -> void:
	if not Net.live:
		return
	for entry: Dictionary in Session.roster:
		var peer := int(entry.peer)
		if peer != 1 and multiplayer.get_peers().has(peer):
			_game_over.rpc_id(peer, game.summary_for(peer))


@rpc("authority", "reliable")
func _game_over(summary: Dictionary) -> void:
	var game := main.get_node_or_null("GameManager") as GameManager
	if game:
		game.net_game_over(summary)


## Alguém saiu: o personagem dele some (os zumbis vão atrás de outro).
func _on_peer_left(peer: int) -> void:
	var gone := Players.by_peer(peer)
	if gone:
		gone.remove_from_group(&"player")
		gone.queue_free()
	if Net.is_host():
		var game := main.get_node_or_null("GameManager") as GameManager
		if game:
			game.call_deferred(&"_check_team")
