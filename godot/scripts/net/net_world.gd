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
	&"quest_completed", &"max_ammo", &"map_unlocked", &"teddy_found", &"statue_lit", &"train_run_over", &"team_feed",
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
	_send_objective(delta)


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


## Host: rounds esperam todos carregarem; o estado do mapa vai para os colegas.
func _setup_host() -> void:
	var rounds := main.get_node_or_null("RoundManager") as RoundManager
	if rounds:
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
	var body := node as CharacterBase
	if body == null or bool(body.get(&"puppet")) or not (body is ZombieBase or body is Boss):
		return
	var id := _next_zombie
	_next_zombie += 1
	body.set_meta(&"net_id", id)
	_zombies[id] = body
	body.died.connect(func(_c: CharacterBase, info: DamageInfo) -> void:
		_zombies.erase(id)
		if Net.live:
			_z_die.rpc(id, info.is_headshot, int(info.kind), info.hit_position))
	if not Net.live:
		return
	var at := body.global_position if body.is_inside_tree() else body.position
	if body is Boss:
		_b_spawn.rpc(id, String((body as Boss).data.id), at)
	else:
		_z_spawn.rpc(id, String((body as ZombieBase).data.id), at)


## Posições compactadas: 13 bytes por zumbi (id; x, y, z em 1/64 m; velocidade em 1/8 m/s;
## direção em 256 passos; altura do corpo — voo da Harpia — em 1/32 m; estados visuais: olhar
## da Górgona, armadura caída, gelo), cerca de um terço do tamanho em números de 4 bytes.
const ZOMBIE_BYTES := 13


func _send_snapshot() -> void:
	var pack := PackedByteArray()
	pack.resize(_zombies.size() * ZOMBIE_BYTES)
	var at_byte := 0
	for id: int in _zombies:
		var node: Variant = _zombies[id]
		if not is_instance_valid(node) or not (node as Node).is_inside_tree():
			continue
		if node is Boss:
			var boss := node as Boss
			_b_state.rpc(id, boss.global_position, Vector3(boss.velocity.x, 0.0, boss.velocity.z), boss.pivot.rotation.y, int(boss.mode), boss.net_action(), boss.phase, boss._fury_active())
			continue
		var zombie := node as ZombieBase
		var at := zombie.global_position
		pack.encode_u16(at_byte, id & 0xFFFF)
		pack.encode_s16(at_byte + 2, clampi(roundi(at.x * 64.0), -32768, 32767))
		pack.encode_s16(at_byte + 4, clampi(roundi(at.y * 64.0), -32768, 32767))
		pack.encode_s16(at_byte + 6, clampi(roundi(at.z * 64.0), -32768, 32767))
		pack.encode_s8(at_byte + 8, clampi(roundi(zombie.velocity.x * 8.0), -128, 127))
		pack.encode_s8(at_byte + 9, clampi(roundi(zombie.velocity.z * 8.0), -128, 127))
		pack.encode_u8(at_byte + 10, posmod(roundi(zombie.pivot.rotation.y / TAU * 256.0), 256))
		pack.encode_u8(at_byte + 11, clampi(roundi(zombie.pivot.position.y * 32.0), 0, 255))
		pack.encode_u8(at_byte + 12, zombie.net_flags())
		at_byte += ZOMBIE_BYTES
	if at_byte > 0:
		pack.resize(at_byte)
		_z_snapshot.rpc(pack)


func _on_zombie_hit(node: Node3D, info: DamageInfo) -> void:
	if Net.live and node and node.has_meta(&"net_id"):
		_z_hit.rpc(int(node.get_meta(&"net_id")), info.hit_position, info.is_headshot, int(info.kind), info.amount)


func _on_zombie_attacked(node: Node3D) -> void:
	if Net.live and node and node.has_meta(&"net_id") and not (node as ZombieBase).puppet:
		_z_attack.rpc(int(node.get_meta(&"net_id")))


## Fantoche (zumbi ou chefe) pelo id do host.
func _puppet(id: int) -> Node3D:
	var node: Variant = _zombies.get(id)
	return node if is_instance_valid(node) else null


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
func _z_snapshot(pack: PackedByteArray) -> void:
	for i in range(0, pack.size() - ZOMBIE_BYTES + 1, ZOMBIE_BYTES):
		var zombie := _puppet_u16(pack.decode_u16(i))
		if zombie == null:
			continue
		var at := Vector3(pack.decode_s16(i + 2), pack.decode_s16(i + 4), pack.decode_s16(i + 6)) / 64.0
		var moving := Vector3(pack.decode_s8(i + 8), 0.0, pack.decode_s8(i + 9)) / 8.0
		zombie.net_state(at, moving, pack.decode_u8(i + 10) / 256.0 * TAU, pack.decode_u8(i + 11) / 32.0, pack.decode_u8(i + 12))


## Fantoche pelo id cortado em 16 bits (o snapshot só leva os 16 bits de baixo).
func _puppet_u16(short_id: int) -> ZombieBase:
	for id: int in _zombies:
		if id & 0xFFFF == short_id:
			return _puppet(id) as ZombieBase
	return null


@rpc("authority", "unreliable")
func _z_hit(id: int, at: Vector3, headshot: bool, kind: int, amount: float) -> void:
	var zombie := _puppet(id)
	if zombie and zombie.has_method(&"net_hit"):
		zombie.call(&"net_hit", at, headshot, kind, amount)


## Host: um clarão (o raio que traz um cão, a chegada do chefe) aparece também nos colegas.
func on_flash(at: Vector3, radius: float, color: Color) -> void:
	if Net.live:
		_flash.rpc(at, radius, color)


@rpc("authority", "unreliable")
func _flash(at: Vector3, radius: float, color: Color) -> void:
	SpecialFire.flash(get_tree(), at, radius, color)


## Host: um espírito aliado (Hades) surgiu.
func on_spirit(at: Vector3) -> void:
	if Net.live:
		_spirit.rpc(at)


@rpc("authority", "reliable")
func _spirit(at: Vector3) -> void:
	AllySpirit.summon(get_tree(), at, null)


## Host: um zumbi atirou (flecha, cuspe) — o colega vê o mesmo disparo (o dano é do host).
func on_zombie_shot(zombie: ZombieBase, kind: StringName, to_target: Vector3) -> void:
	if Net.live and zombie.has_meta(&"net_id"):
		_z_shot.rpc(int(zombie.get_meta(&"net_id")), kind, to_target)


@rpc("authority", "unreliable")
func _z_shot(id: int, kind: StringName, to_target: Vector3) -> void:
	var zombie := _puppet(id) as ZombieBase
	if zombie:
		zombie.net_shot(kind, to_target)


@rpc("authority", "unreliable")
func _z_attack(id: int) -> void:
	var zombie := _puppet(id) as ZombieBase
	if zombie:
		zombie.net_attack()


@rpc("authority", "reliable")
func _z_die(id: int, headshot: bool, kind: int, at: Vector3) -> void:
	var zombie := _puppet(id)
	_zombies.erase(id)
	if zombie and zombie.has_method(&"net_die"):
		zombie.call(&"net_die", headshot, kind, at)


# ───────────────────────── Chefe ─────────────────────────

@rpc("authority", "reliable")
func _b_spawn(id: int, boss_id: String, at: Vector3) -> void:
	var data := load("res://data/bosses/%s.tres" % boss_id) as BossData
	var container := main.get_node_or_null("Zombies") as Node3D
	if data == null or container == null:
		return
	var boss := data.scene.instantiate() as Boss
	boss.setup(data, null, 1.0, Callable())
	boss.make_puppet()
	boss.name = "B%d" % id
	boss.set_meta(&"net_id", id)
	boss.position = container.to_local(at + Vector3.UP * 0.1)
	container.add_child(boss)
	_zombies[id] = boss


@rpc("authority", "unreliable_ordered")
func _b_state(id: int, at: Vector3, moving: Vector3, yaw: float, mode: int, action: int, phase: int, fury: bool) -> void:
	var boss := _puppet(id) as Boss
	if boss:
		boss.net_state(at, moving, yaw, mode, action, phase, fury)


## Host: o chefe atacou (os parâmetros exatos vão para os colegas verem igual).
func on_boss_fx(boss: Boss, kind: StringName, args: Array) -> void:
	if Net.live and boss.has_meta(&"net_id"):
		_b_fx.rpc(int(boss.get_meta(&"net_id")), kind, args)


@rpc("authority", "reliable")
func _b_fx(id: int, kind: StringName, args: Array) -> void:
	var boss := _puppet(id) as Boss
	if boss:
		boss.net_fx(kind, args)


# ───────────────────────── Eventos do mapa ─────────────────────────

## Host: um evento começou, acabou ou teve um momento (com o que foi sorteado).
func on_world_event(id: StringName, kind: StringName, payload: Dictionary) -> void:
	if Net.live:
		_world_event.rpc(id, kind, payload)


@rpc("authority", "reliable")
func _world_event(id: StringName, kind: StringName, payload: Dictionary) -> void:
	var system := get_tree().get_first_node_in_group(&"world_events") as WorldEventSystem
	if system:
		system.net_apply(id, kind, payload)


# ───────────────────────── Missão ─────────────────────────

## Host: a missão avisou algo (avanço de etapa, cadeado, item...).
func on_quest(quest: Node, kind: StringName, payload: Dictionary) -> void:
	if Net.live and quest.is_inside_tree():
		_quest.rpc(String(main.get_path_to(quest)), kind, payload)


@rpc("authority", "reliable")
func _quest(path: String, kind: StringName, payload: Dictionary) -> void:
	var quest := main.get_node_or_null(path) as QuestSystem
	if quest:
		quest.net_apply(kind, payload)


## Host: um ponto da missão foi usado.
func on_quest_spot(spot: Node) -> void:
	if Net.live and spot.is_inside_tree():
		_quest_spot.rpc(String(main.get_path_to(spot)))


@rpc("authority", "reliable")
func _quest_spot(path: String) -> void:
	var spot := main.get_node_or_null(path) as QuestSpot
	if spot:
		spot.finish()


## Host: onde está o objetivo da missão (para o minimapa dos colegas), quando muda.
var _objective_sent: Variant = null
var _objective_in := 0.0
var _objective_marker: Node3D


func _send_objective(delta: float) -> void:
	_objective_in -= delta
	if _objective_in > 0.0:
		return
	_objective_in = 0.25
	var node := get_tree().get_first_node_in_group(&"minimap_objective") as Node3D
	var at: Variant = node.global_position if node else null
	var same: bool = (at == null and _objective_sent == null) or (at is Vector3 and _objective_sent is Vector3 and (at as Vector3).distance_to(_objective_sent) < 0.3)
	if not same:
		_objective_sent = at
		_objective.rpc(at)


@rpc("authority", "reliable")
func _objective(at: Variant) -> void:
	if _objective_marker == null:
		_objective_marker = Node3D.new()
		_objective_marker.name = "NetObjective"
		add_child(_objective_marker)
	if at is Vector3:
		_objective_marker.global_position = at
		if not _objective_marker.is_in_group(&"minimap_objective"):
			_objective_marker.add_to_group(&"minimap_objective")
	elif _objective_marker.is_in_group(&"minimap_objective"):
		_objective_marker.remove_from_group(&"minimap_objective")


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


## Host: Fire Sale — as caixas extras aparecem também nos colegas (o resto vai pelo on_box).
func on_fire_sale(main_box: MysteryBox, boxes: Array) -> void:
	if not Net.live:
		return
	var list: Array = []
	for box: MysteryBox in boxes:
		list.append([String(box.name), box.global_position if box.is_inside_tree() else box.position])
	_fire_sale.rpc(String(main.get_path_to(main_box)), list)


@rpc("authority", "reliable")
func _fire_sale(main_path: String, list: Array) -> void:
	var main_box := main.get_node_or_null(main_path) as MysteryBox
	var power_ups := get_tree().get_first_node_in_group(&"power_ups") as PowerUpSystem
	if main_box == null or power_ups == null:
		return
	for entry: Array in list:
		if main_box.get_parent().get_node_or_null(String(entry[0])) == null:
			power_ups.add_fire_sale_box(main_box, entry[1], String(entry[0]))


## Métodos que o host pode mandar os colegas chamarem num nó do mapa (só o visual).
const NODE_CALLS: Array[StringName] = [&"activate", &"net_taken", &"collapse", &"net_light"]


## Host: chama o mesmo método no mesmo nó das outras máquinas (armadilha ligada...).
func on_node_call(node: Node, method: StringName) -> void:
	if Net.live and method in NODE_CALLS and node.is_inside_tree():
		_node_call.rpc(String(main.get_path_to(node)), method)


@rpc("authority", "reliable")
func _node_call(path: String, method: StringName) -> void:
	var node := main.get_node_or_null(path)
	if node and method in NODE_CALLS and node.has_method(method):
		node.call(method)


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
