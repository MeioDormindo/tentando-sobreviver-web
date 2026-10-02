class_name NetPlayer
extends Node
## Rede de um jogador (filho "Net" do Player numa partida em grupo):
## - o dono manda posição, mira e velocidade (20 por segundo) e pede as ações ao host (tiro,
##   recarga, troca, faca, E, lanterna) — o efeito sai na máquina dele na hora;
## - o host faz as ações de verdade, manda a vida e o estado (10 por segundo) e as armas, e
##   encaminha os avisos de HUD do personagem para a máquina do dono;
## - o host avisa os tiros, para as outras máquinas verem e ouvirem.

const SEND_EVERY := 0.05
const VITALS_EVERY := 0.1
const LOADOUT_EVERY := 0.25
## O texto de interação muda a cada quadro enquanto segura E: no máximo 10 por segundo.
const PROMPT_EVERY := 0.1
const ACTIONS: Array[StringName] = [&"fire", &"reload", &"switch", &"knife", &"interact", &"hold", &"flashlight"]

var player: Player
var owner_peer := 1

var _send_in := 0.0
var _vitals_in := 0.0
var _loadout_in := 0.0
var _last_loadout := ""
var _prompt_at := -INF
var _last_prompt: Array = []
var _clock := 0.0


func _physics_process(delta: float) -> void:
	_clock += delta
	if not Net.live:
		return
	if player.is_local:
		_send_in -= delta
		if _send_in <= 0.0:
			_send_in = SEND_EVERY
			_state.rpc(player.global_position, player.aim_point, Vector3(player.velocity.x, 0.0, player.velocity.z))
	if Net.is_host():
		_vitals_in -= delta
		if _vitals_in <= 0.0:
			_vitals_in = VITALS_EVERY
			_vitals.rpc(player.vitals())
		_loadout_in -= delta
		if _loadout_in <= 0.0:
			_loadout_in = LOADOUT_EVERY
			var list := player.loadout()
			var sig := str(list) + "/%d" % player.inventory.current_index
			if sig != _last_loadout:
				_last_loadout = sig
				_loadout.rpc(list, player.inventory.current_index)


# ───────────────────────── Dono → todos ─────────────────────────

@rpc("any_peer", "unreliable_ordered")
func _state(at: Vector3, aim: Vector3, moving: Vector3) -> void:
	if multiplayer.get_remote_sender_id() != owner_peer or player.is_local:
		return
	player.net_target(at, aim, moving)


## Colega: pede a ação ao host.
func request(action: StringName, args: Array) -> void:
	if Net.live:
		_act.rpc_id(1, action, args)


@rpc("any_peer", "reliable")
func _act(action: StringName, args: Array) -> void:
	if not Net.is_host() or multiplayer.get_remote_sender_id() != owner_peer or not action in ACTIONS:
		return
	player.net_action(action, args)


# ───────────────────────── Host → dono / todos ─────────────────────────

## Aviso de HUD do personagem: no host, para o próprio Events (o dele) ou para o dono.
func hud(signal_name: StringName, args: Array) -> void:
	if not Net.is_host():
		return
	if player.is_local:
		Net.relay_mute += 1
		Events.emit_signal.callv([signal_name] + args)
		Net.relay_mute -= 1
		return
	if not Net.live:
		return
	if signal_name == &"interaction_prompt":
		if args == _last_prompt:
			return
		var same_text: bool = not _last_prompt.is_empty() and args[0] == _last_prompt[0]
		if same_text and _clock - _prompt_at < PROMPT_EVERY:
			return
		_last_prompt = args.duplicate()
		_prompt_at = _clock
	_hud.rpc_id(owner_peer, signal_name, args)


@rpc("any_peer", "reliable")
func _hud(signal_name: StringName, args: Array) -> void:
	if multiplayer.get_remote_sender_id() != 1 or not Events.has_signal(signal_name):
		return
	if signal_name == &"ammo_changed" and args.size() == 4:
		player.mirror_ammo(int(args[1]), int(args[2]), bool(args[3]))
	Events.emit_signal.callv([signal_name] + args)


func hud_sound(sound: String, volume: float, rate: float) -> void:
	if not Net.is_host():
		return
	if player.is_local:
		Audio.play(sound, "ui", volume, 0.0, rate)
	elif Net.live:
		_sound.rpc_id(owner_peer, sound, volume, rate)


@rpc("any_peer", "reliable")
func _sound(sound: String, volume: float, rate: float) -> void:
	if multiplayer.get_remote_sender_id() == 1:
		Audio.play(sound, "ui", volume, 0.0, rate)


@rpc("any_peer", "unreliable_ordered")
func _vitals(v: Dictionary) -> void:
	if multiplayer.get_remote_sender_id() != 1 or Net.is_host():
		return
	player.mirror_vitals(v)


@rpc("any_peer", "reliable")
func _loadout(list: Array, current: int) -> void:
	if multiplayer.get_remote_sender_id() != 1 or Net.is_host():
		return
	player.mirror_loadout(list, current)


## O personagem atirou. No colega (o próprio, na hora): pede o tiro de verdade ao host. No host
## (o dele ou o de um colega, a pedido): as outras máquinas veem.
func on_fired(aim: Vector3) -> void:
	if not Net.live:
		return
	if Net.is_host():
		_shot.rpc(aim)
	elif player.is_local:
		request(&"fire", [aim])


@rpc("any_peer", "unreliable")
func _shot(aim: Vector3) -> void:
	if multiplayer.get_remote_sender_id() != 1 or player.is_local:
		return
	player.fire_visual(aim)


## Host: põe o colega num lugar (a posição é dele: só a máquina dele pode mudar).
func teleport(at: Vector3) -> void:
	if Net.live:
		_teleport.rpc_id(owner_peer, at)


@rpc("any_peer", "reliable")
func _teleport(at: Vector3) -> void:
	if multiplayer.get_remote_sender_id() == 1:
		player.global_position = at


## Host: a HUD inteira do colega no começo da partida (o que o personagem avisou antes de todos
## carregarem não foi pela rede).
func send_initial_hud(points: PointsManager) -> void:
	if not Net.is_host() or player.is_local:
		return
	hud(&"player_health_changed", [player.health.current, player.health.max_health])
	hud(&"player_armor_changed", [player.armor, player.data.max_armor])
	var current := player.weapon
	if current:
		var other := player.inventory.other()
		hud(&"weapon_changed", [current.data.display_name, other.data.display_name if other else ""])
		hud(&"ammo_changed", [current.data.display_name, current.magazine, current.reserve, current.reloading])
		player.announce_weapon()
	var ids: Array[StringName] = []
	for perk in player.perks.owned:
		ids.append(perk.id)
	hud(&"perks_changed", [ids])
	if points:
		hud(&"points_changed", [points.points_of(player), 0])
