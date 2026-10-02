class_name ENetTransport
extends RefCounted
## Conexão local (ENet, mesmo PC ou rede local): para os testes automáticos e depuração, sem
## internet nem sinalização. Mesma interface do WebRTCTransport para o Net.

signal rejected(reason: String)

const PORT := 24680

var peer := ENetMultiplayerPeer.new()
var is_host := false
var accepting := true
var max_players := 4


func host(port := PORT) -> Error:
	is_host = true
	return peer.create_server(port, max_players - 1)


func join(address := "127.0.0.1", port := PORT) -> Error:
	is_host = false
	return peer.create_client(address, port)


func poll(_delta: float) -> void:
	pass


func close() -> void:
	peer.close()


## Um colega saiu: o ENet já fechou a conexão dele (nada a liberar).
func forget(_id: int) -> void:
	pass
