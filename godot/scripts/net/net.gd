extends Node
## Multiplayer cooperativo (autoload "Net"): cria ou entra numa sala por código, mantém a lista
## de jogadores (o host decide e manda para todos) e começa a partida em grupo. A conexão vem de
## um transporte trocável: WebRTC com sinalização pelo Supabase (o jogo) ou ENet local (testes).
## Fora de uma sala o jogo é solo e nada aqui roda.

enum State { OFFLINE, CONNECTING, ROOM, MATCH }

## A sala mudou (entrou/saiu alguém, pronto, visual, mapa).
signal room_changed()
## Progresso para a tela ("Criando sala...", "Conectando...").
signal status_changed(text: String)
## O host começou a partida (todos trocam para a cena do jogo).
signal match_starting(map_id: String)
## Saiu da sala por um motivo (host saiu, sala cheia, sem internet...).
signal disconnected(reason: String)

const MAX_PLAYERS := 4
## Tempo máximo para entrar numa sala (s).
const JOIN_TIMEOUT := 25.0
const MAIN_SCENE := "res://scenes/main.tscn"
const MENU_SCENE := "res://scenes/ui/main_menu.tscn"
const LOBBY_SCENE := "res://scenes/ui/lobby.tscn"
## Endereço do jogo publicado (o link do convite fora da Web).
const SITE_URL := "https://meiodormindo.github.io/tentando-sobreviver-web/"
## De quanto em quanto tempo o host mede a latência de cada colega (s).
const PING_EVERY := 2.0

## A latência mudou (a sala e a HUD mostram ao lado do nome).
signal pings_changed()

var state: State = State.OFFLINE
var code := ""
## peer → {name, skin, ready}. O host (1) sempre está.
var players: Dictionary = {}
var map_id := "terminal"
## Último motivo de saída (o menu mostra ao voltar).
var last_error := ""
var transport: RefCounted

## Partida em grupo rodando com todos carregados (antes disso, nada vai pela rede).
var live := false
## Menu de pausa aberto na partida em rede (o mundo não para; só o seu personagem fica parado).
var menu_open := false
## Avisos que não vão para os colegas (os da HUD do próprio host, por exemplo): enquanto > 0, o
## NetWorld não retransmite o que sai no Events.
var relay_mute := 0
## O NetWorld da partida em grupo (null fora dela).
var world: Node
## Latência de cada colega até o host (ms; o host não entra). O host mede e manda para todos.
var pings: Dictionary = {}
## Código de um convite aberto pelo link (?sala=ABCDE no endereço, na Web): o menu leva direto
## para a sala, que entra sozinha. Vazio depois de usado.
var invite_code := ""
var _ping_in := 0.0
var _join_left := 0.0
var _hello := {}


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	multiplayer.peer_connected.connect(_on_peer_connected)
	multiplayer.peer_disconnected.connect(_on_peer_disconnected)
	multiplayer.connected_to_server.connect(_on_connected_to_host)
	multiplayer.connection_failed.connect(func() -> void: _fail("Não foi possível conectar à sala"))
	multiplayer.server_disconnected.connect(func() -> void: _fail("O host saiu"))
	invite_code = _read_invite()


func _process(delta: float) -> void:
	if transport:
		transport.call(&"poll", delta)
	if state == State.CONNECTING and _join_left > 0.0:
		_join_left -= delta
		if _join_left <= 0.0:
			_fail("Tempo esgotado ao entrar na sala")
	if is_host() and players.size() > 1:
		_ping_in -= delta
		if _ping_in <= 0.0:
			_ping_in = PING_EVERY
			_ping.rpc(Time.get_ticks_msec())
			_pings.rpc(pings)


# ───────────────────────── Latência ─────────────────────────

## Host → colegas: a hora do host, que volta igual (a diferença é a ida e volta).
@rpc("authority", "unreliable")
func _ping(sent: int) -> void:
	_pong.rpc_id(1, sent)


@rpc("any_peer", "unreliable")
func _pong(sent: int) -> void:
	if is_host():
		pings[multiplayer.get_remote_sender_id()] = clampi(Time.get_ticks_msec() - sent, 0, 9999)
		pings_changed.emit()


@rpc("authority", "unreliable")
func _pings(table: Dictionary) -> void:
	pings = table
	pings_changed.emit()


## Latência de um jogador (ms), ou -1 se ainda não medida (o host é 0).
func ping_of(peer: int) -> int:
	return 0 if peer == 1 else int(pings.get(peer, -1))


## Cor da latência: verde até 80 ms, amarelo até 150, vermelho acima (cinza sem medida).
static func ping_color(ms: int) -> Color:
	if ms < 0:
		return Color(0.6, 0.6, 0.56)
	if ms < 80:
		return Color(0.45, 0.85, 0.4)
	return Color(0.95, 0.8, 0.3) if ms < 150 else Color(0.85, 0.25, 0.2)


# ───────────────────────── Convite ─────────────────────────

## Link do convite para a sala atual: o endereço deste site na Web; fora dela, o site publicado.
func invite_link() -> String:
	var base := SITE_URL
	if OS.has_feature("web"):
		var here: Variant = JavaScriptBridge.eval("window.location.origin + window.location.pathname", true)
		if here is String and String(here).begins_with("http"):
			base = here
	return "%s?sala=%s" % [base, code]


## Na Web, o código de um convite no endereço (?sala=ABCDE); some do endereço depois de lido
## (recarregar a página não entra de novo).
func _read_invite() -> String:
	if not OS.has_feature("web"):
		return ""
	var search: Variant = JavaScriptBridge.eval("window.location.search", true)
	if not search is String or String(search).findn("sala=") < 0:
		return ""
	JavaScriptBridge.eval("history.replaceState(null, '', window.location.pathname)", true)
	return code_from_text(search)


## Código de sala num texto colado (função pura): o código com espaços ou minúsculas, ou o link
## do convite inteiro (…?sala=ABCDE). Vazio se não achar.
static func code_from_text(text: String) -> String:
	var source := text.strip_edges()
	var at := source.findn("sala=")
	if at >= 0:
		source = source.substr(at + 5)
	var compact := source.replace(" ", "").replace("-", "").to_upper()
	if compact.length() == 5 and _is_code(compact):
		return compact
	# Dentro de uma frase: a palavra de 5 caracteres (a primeira depois de "sala=", senão a última).
	var words := RegEx.create_from_string("(?<![A-Za-z0-9])[A-Za-z0-9]{5}(?![A-Za-z0-9])").search_all(source)
	if words.is_empty():
		return ""
	var word := (words[0] if at >= 0 else words[-1]).get_string().to_upper()
	return word if _is_code(word) else ""


static func _is_code(text: String) -> bool:
	return RegEx.create_from_string("^[A-Z0-9]{5}$").search(text) != null


func is_online() -> bool:
	return state != State.OFFLINE


func is_host() -> bool:
	return is_online() and multiplayer.is_server()


func is_client() -> bool:
	return is_online() and not multiplayer.is_server()


func my_id() -> int:
	return multiplayer.get_unique_id() if is_online() else 1


# ───────────────────────── Entrar e sair ─────────────────────────

## Cria a sala pela internet e espera os colegas (código em `code`).
func create_room(player_name: String, skin: String) -> void:
	_set_status(State.CONNECTING, "Criando sala...")
	var result: Dictionary = await SupabaseSignaling.create_room(Online, _clean_name(player_name))
	if state != State.CONNECTING:
		return
	if not result.ok:
		_fail(Loc.fmt("Não foi possível criar a sala (%s)", [result.message]))
		return
	var webrtc := WebRTCTransport.new()
	webrtc.max_players = MAX_PLAYERS
	_open_host(webrtc, String(result.code), webrtc.host(SupabaseSignaling.new(Online, String(result.code), 1)), player_name, skin)


## Entra na sala de um amigo pelo código.
func join_room(room_code: String, player_name: String, skin: String) -> void:
	room_code = room_code.strip_edges().to_upper()
	_set_status(State.CONNECTING, Loc.fmt("Procurando a sala %s...", [room_code]))
	var found: Dictionary = await SupabaseSignaling.room_exists(Online, room_code)
	if state != State.CONNECTING:
		return
	if not found.ok:
		_fail(Loc.fmt("Sem conexão com o servidor (%s)", [found.message]))
		return
	if not found.exists:
		_fail(Loc.fmt("Sala %s não encontrada", [room_code]))
		return
	var webrtc := WebRTCTransport.new()
	webrtc.rejected.connect(_fail)
	var signaling := SupabaseSignaling.new(Online, room_code, 0)
	signaling.failed.connect(func(reason: String) -> void:
		if state == State.CONNECTING:
			_fail(Loc.fmt("Sem conexão com o servidor (%s)", [reason])))
	_open_client(webrtc, room_code, webrtc.join(signaling, {"name": _clean_name(player_name)}), player_name, skin)


## Sala local (ENet, mesmo PC ou rede local): testes e depuração.
func host_local(player_name: String, skin: String, port := ENetTransport.PORT) -> void:
	var enet := ENetTransport.new()
	enet.max_players = MAX_PLAYERS
	_open_host(enet, "LOCAL", enet.host(port), player_name, skin)


func join_local(player_name: String, skin: String, address := "127.0.0.1", port := ENetTransport.PORT) -> void:
	var enet := ENetTransport.new()
	_open_client(enet, "LOCAL", enet.join(address, port), player_name, skin)


func _open_host(p_transport: RefCounted, p_code: String, error: Error, player_name: String, skin: String) -> void:
	if error != OK:
		_fail(Loc.fmt("Não foi possível abrir a sala (%s)", [error_string(error)]))
		return
	transport = p_transport
	code = p_code
	multiplayer.multiplayer_peer = transport.get(&"peer")
	players = {1: _clean({"name": player_name, "skin": skin, "ready": true})}
	_set_status(State.ROOM, Loc.fmt("Sala %s aberta", [code]))
	room_changed.emit()


func _open_client(p_transport: RefCounted, p_code: String, error: Error, player_name: String, skin: String) -> void:
	if error != OK:
		_fail(Loc.fmt("Não foi possível entrar (%s)", [error_string(error)]))
		return
	transport = p_transport
	code = p_code
	_hello = _clean({"name": player_name, "skin": skin, "ready": false})
	multiplayer.multiplayer_peer = transport.get(&"peer")
	_join_left = JOIN_TIMEOUT
	_set_status(State.CONNECTING, Loc.fmt("Conectando à sala %s...", [code]))


## Sai da sala (ou da partida em grupo) e volta ao solo.
func leave() -> void:
	if transport:
		transport.call(&"close")
	transport = null
	multiplayer.multiplayer_peer = OfflineMultiplayerPeer.new()
	players.clear()
	code = ""
	_join_left = 0.0
	Session.roster.clear()
	Session.local_peer = 1
	live = false
	menu_open = false
	pings.clear()
	if state != State.OFFLINE:
		state = State.OFFLINE
		room_changed.emit()


func _fail(reason: String) -> void:
	var was_match := state == State.MATCH
	last_error = reason
	leave()
	status_changed.emit(reason)
	disconnected.emit(reason)
	# Na partida, a queda (host saiu, sem conexão) leva todo mundo de volta ao menu.
	if was_match and is_inside_tree():
		get_tree().paused = false
		get_tree().change_scene_to_file(MENU_SCENE)


func _set_status(new_state: State, text: String) -> void:
	state = new_state
	status_changed.emit(text)


# ───────────────────────── Sala ─────────────────────────

## Pronto (colegas) — o host começa quando todos estão prontos.
func set_ready(on: bool) -> void:
	_update_me({"ready": on})


## Visual escolhido para a partida em grupo.
func set_skin(skin: String) -> void:
	_update_me({"skin": skin})


## Host: mapa da partida.
func set_map(id: String) -> void:
	if is_host():
		map_id = id
		_broadcast()


## Todos os colegas prontos (o host está sempre)?
func everyone_ready() -> bool:
	return players.values().all(func(p: Dictionary) -> bool: return bool(p.get("ready", false)))


## Host: começa a partida em grupo (todos trocam para a cena do jogo ao mesmo tempo).
func start_match() -> bool:
	if not is_host() or state != State.ROOM or not everyone_ready():
		return false
	transport.set(&"accepting", false)
	var roster: Array = []
	var ids := players.keys()
	ids.sort()
	for id: int in ids:
		roster.append({"peer": id, "name": String(players[id].name), "skin": String(players[id].skin)})
	_begin.rpc(map_id, roster)
	return true


## Host: fim da partida em grupo — todos voltam para a sala (a mesma, com o mesmo código).
func return_to_room() -> void:
	if is_host() and state == State.MATCH:
		_to_room.rpc()


@rpc("authority", "reliable", "call_local")
func _to_room() -> void:
	live = false
	menu_open = false
	state = State.ROOM
	Session.roster.clear()
	Session.local_peer = 1
	if is_host():
		transport.set(&"accepting", true)
		for id: int in players:
			players[id].ready = id == 1
		_broadcast()
	if is_inside_tree():
		get_tree().paused = false
		get_tree().change_scene_to_file(LOBBY_SCENE)


func _update_me(changes: Dictionary) -> void:
	if not is_online():
		return
	if is_host():
		_apply_update(1, changes)
	else:
		_hello.merge(changes, true)
		_send_update.rpc_id(1, changes)


func _apply_update(id: int, changes: Dictionary) -> void:
	if not players.has(id):
		return
	var info: Dictionary = players[id].duplicate()
	info.merge(changes, true)
	players[id] = _clean(info)
	_broadcast()


func _broadcast() -> void:
	if is_host():
		_room_state.rpc(players, map_id)


func _on_connected_to_host() -> void:
	_join_left = 0.0
	_set_status(State.ROOM, Loc.fmt("Na sala %s", [code]))
	_send_hello.rpc_id(1, _hello)


func _on_peer_connected(_id: int) -> void:
	pass


func _on_peer_disconnected(id: int) -> void:
	if not is_host():
		return
	players.erase(id)
	pings.erase(id)
	if transport and transport.has_method(&"forget"):
		transport.call(&"forget", id)
	_broadcast()


@rpc("any_peer", "reliable")
func _send_hello(info: Dictionary) -> void:
	if not is_host():
		return
	var id := multiplayer.get_remote_sender_id()
	if state == State.MATCH or (players.size() >= MAX_PLAYERS and not players.has(id)):
		multiplayer.multiplayer_peer.disconnect_peer(id)
		return
	players[id] = _clean(info)
	_broadcast()


@rpc("any_peer", "reliable")
func _send_update(changes: Dictionary) -> void:
	if is_host():
		_apply_update(multiplayer.get_remote_sender_id(), changes)


@rpc("authority", "reliable", "call_local")
func _room_state(new_players: Dictionary, new_map: String) -> void:
	players = new_players
	map_id = new_map
	room_changed.emit()


@rpc("authority", "reliable", "call_local")
func _begin(p_map: String, roster: Array) -> void:
	Session.map_id = p_map
	Session.roster.assign(roster)
	Session.local_peer = multiplayer.get_unique_id()
	state = State.MATCH
	match_starting.emit(p_map)
	if is_inside_tree():
		get_tree().paused = false
		get_tree().change_scene_to_file(MAIN_SCENE)


static func _clean_name(text: String) -> String:
	var clean := text.strip_edges().substr(0, 14).to_upper()
	return clean if clean != "" else "JOGADOR"


static func _clean(info: Dictionary) -> Dictionary:
	return {
		"name": _clean_name(String(info.get("name", ""))),
		"skin": String(info.get("skin", "")).substr(0, 32),
		"ready": bool(info.get("ready", false)),
	}
