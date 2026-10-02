class_name SupabaseSignaling
extends Signaling
## Sinalização pelo Supabase (supabase/net.sql), só com REST e a chave publicável: cada envio é
## uma chamada a `net_send` (uma de cada vez, para chegarem na ordem) e a caixa de entrada é lida
## por `net_poll` a cada POLL_EVERY enquanto a sala está aberta.

const POLL_EVERY := 0.5

var online: Node
var _out: Array = []
var _sending := false
var _polling := false
var _poll_in := 0.0
var _after := 0
var _closed := false


func _init(p_online: Node, p_code: String, p_me: int) -> void:
	online = p_online
	code = p_code
	me = p_me


## Cria a sala no servidor. Devolve {ok, code} ou {ok: false, message}.
static func create_room(p_online: Node, host_name: String) -> Dictionary:
	var result: Dictionary = await p_online.call(&"request", HTTPClient.METHOD_POST, "/rest/v1/rpc/net_create_room", {"p_host_name": host_name})
	if not result.ok:
		return {"ok": false, "message": String(result.get("message", "erro"))}
	return {"ok": true, "code": String(result.data)}


## A sala existe? {ok, exists} ou {ok: false, message}.
static func room_exists(p_online: Node, p_code: String) -> Dictionary:
	var result: Dictionary = await p_online.call(&"request", HTTPClient.METHOD_POST, "/rest/v1/rpc/net_room_exists", {"p_code": p_code})
	if not result.ok:
		return {"ok": false, "message": String(result.get("message", "erro"))}
	return {"ok": true, "exists": bool(result.data)}


func send(to: int, kind: String, payload: Dictionary = {}) -> void:
	if _closed:
		return
	_out.append([to, kind, payload])
	_flush()


func _flush() -> void:
	if _sending or _out.is_empty() or _closed:
		return
	_sending = true
	var entry: Array = _out.pop_front()
	var result: Dictionary = await online.call(&"request", HTTPClient.METHOD_POST, "/rest/v1/rpc/net_send",
		{"p_code": code, "p_from": me, "p_to": entry[0], "p_kind": entry[1], "p_payload": entry[2]})
	_sending = false
	if not result.ok and not _closed:
		failed.emit(String(result.get("message", "sem conexão")))
		return
	_flush()


func poll(delta: float) -> void:
	_poll_in -= delta
	if _closed or _polling or _poll_in > 0.0:
		return
	_poll_in = POLL_EVERY
	_polling = true
	var result: Dictionary = await online.call(&"request", HTTPClient.METHOD_POST, "/rest/v1/rpc/net_poll",
		{"p_code": code, "p_to": me, "p_after": _after})
	_polling = false
	if _closed:
		return
	if not result.ok:
		failed.emit(String(result.get("message", "sem conexão")))
		return
	if not result.data is Array:
		return
	for row: Variant in result.data:
		if not row is Dictionary:
			continue
		_after = maxi(_after, int(row.get("id", 0)))
		var payload: Variant = row.get("payload", {})
		message.emit(int(row.get("from_peer", 0)), String(row.get("kind", "")), payload if payload is Dictionary else {})


func close() -> void:
	_closed = true
	_out.clear()
