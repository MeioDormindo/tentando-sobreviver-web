class_name WebRTCTransport
extends RefCounted
## Conexão pela internet: WebRTC em estrela (o host é o peer 1 e cada colega se liga só a ele).
## A combinação de cada ligação (entrar, oferta, resposta, candidatos de rede) passa pela
## sinalização; depois disso tudo vai direto entre os jogadores. STUN do Google, sem TURN: redes
## muito fechadas (algumas operadoras de celular) podem não conectar.

## O host recusou a entrada (sala cheia, partida começada).
signal rejected(reason: String)

const ICE := {"iceServers": [{"urls": ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"]}]}

var peer := WebRTCMultiplayerPeer.new()
var signaling: Signaling
var is_host := false
var my_id := 1
## Host: aceita gente nova? (falso com a sala cheia ou a partida começada)
var accepting := true
var max_players := 4

## peer → WebRTCPeerConnection.
var _connections: Dictionary = {}
## peer → candidatos ainda não enviados (vão juntos, em lote, a cada quadro).
var _candidates: Dictionary = {}


## Abre a sala como host.
func host(p_signaling: Signaling) -> Error:
	is_host = true
	my_id = 1
	_attach(p_signaling)
	return peer.create_server()


## Entra na sala de um host, com o que ele precisa saber de você (nome, visual).
func join(p_signaling: Signaling, hello: Dictionary) -> Error:
	is_host = false
	my_id = randi_range(2, 2147483646)
	_attach(p_signaling)
	var error := peer.create_client(my_id)
	if error == OK:
		signaling.send(1, "join", hello)
	return error


func _attach(p_signaling: Signaling) -> void:
	signaling = p_signaling
	signaling.me = my_id
	signaling.message.connect(_on_message)


## A cada quadro: lê a sinalização e manda os candidatos acumulados.
func poll(delta: float) -> void:
	if signaling == null:
		return
	signaling.poll(delta)
	for id: int in _candidates.keys():
		var list: Array = _candidates[id]
		if not list.is_empty():
			signaling.send(id, "candidate", {"list": list.duplicate()})
			list.clear()


func close() -> void:
	if signaling:
		signaling.close()
	for connection: WebRTCPeerConnection in _connections.values():
		connection.close()
	_connections.clear()
	peer.close()


## Quantos colegas estão ligados ou ligando (host).
func connection_count() -> int:
	return _connections.size()


## Host: um colega saiu (libera a vaga).
func forget(id: int) -> void:
	var connection := _connections.get(id) as WebRTCPeerConnection
	if connection:
		connection.close()
	_connections.erase(id)
	_candidates.erase(id)
	if peer.has_peer(id):
		peer.remove_peer(id)


func _on_message(from: int, kind: String, payload: Dictionary) -> void:
	match kind:
		"join":
			if not is_host:
				return
			if not accepting:
				signaling.send(from, "reject", {"reason": "A partida já começou"})
			elif _connections.size() + 1 >= max_players and not _connections.has(from):
				signaling.send(from, "reject", {"reason": "Sala cheia (%d jogadores)" % max_players})
			elif not _connections.has(from):
				signaling.send(from, "accept", {})
				_connect(from, true)
		"reject":
			rejected.emit(String(payload.get("reason", "Entrada recusada")))
		"offer":
			if is_host or from != 1:
				return
			var connection := _connect(1, false)
			connection.set_remote_description("offer", String(payload.get("sdp", "")))
		"answer":
			var connection := _connections.get(from) as WebRTCPeerConnection
			if connection and is_host:
				connection.set_remote_description("answer", String(payload.get("sdp", "")))
		"candidate":
			var connection := _connections.get(from) as WebRTCPeerConnection
			if connection == null:
				return
			for candidate: Variant in payload.get("list", []):
				if candidate is Array and (candidate as Array).size() == 3:
					connection.add_ice_candidate(String(candidate[0]), int(candidate[1]), String(candidate[2]))


## Liga a `id` (host: faz a oferta; colega: espera a oferta do host e responde).
func _connect(id: int, make_offer: bool) -> WebRTCPeerConnection:
	if _connections.has(id):
		return _connections[id]
	# Métodos ligados (não funções anônimas): uma função anônima que guarda a conexão faria um
	# ciclo com ela, e a conexão (com as threads dela) nunca seria liberada.
	var connection := WebRTCPeerConnection.new()
	connection.initialize(ICE)
	connection.session_description_created.connect(_on_description.bind(id))
	connection.ice_candidate_created.connect(_on_candidate.bind(id))
	peer.add_peer(connection, id)
	_connections[id] = connection
	if make_offer:
		connection.create_offer()
	return connection


func _on_description(type: String, sdp: String, id: int) -> void:
	var connection := _connections.get(id) as WebRTCPeerConnection
	if connection == null:
		return
	connection.set_local_description(type, sdp)
	signaling.send(id, type, {"sdp": sdp})


func _on_candidate(media: String, index: int, candidate: String, id: int) -> void:
	if not _candidates.has(id):
		_candidates[id] = []
	(_candidates[id] as Array).append([media, index, candidate])
