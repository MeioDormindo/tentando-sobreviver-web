extends Node
## Cliente do Supabase (autoload "Online"), sem SDK: requisições REST com HTTPRequest (funciona
## também na exportação Web). Nunca lança erro: devolve {ok, status, data, message}.
## Os filtros vão na URL já codificados (uri_encode) — nada de SQL montado no cliente.

var data: OnlineData


func _ready() -> void:
	data = load("res://data/configs/online.tres") as OnlineData


func is_configured() -> bool:
	return data != null and data.is_configured()


## `path` começa com /rest/v1 ou /auth/v1. `body` é convertido para JSON.
func request(method: HTTPClient.Method, path: String, body: Variant = null, token: String = "", extra_headers: PackedStringArray = PackedStringArray()) -> Dictionary:
	if not is_configured():
		return {"ok": false, "status": 0, "message": "offline"}
	var http := HTTPRequest.new()
	http.timeout = data.timeout
	add_child(http)
	var headers := PackedStringArray(["apikey: " + data.publishable_key, "Content-Type: application/json"])
	if token != "":
		headers.append("Authorization: Bearer " + token)
	headers.append_array(extra_headers)
	var error := http.request(data.url + path, headers, method, "" if body == null else JSON.stringify(body))
	if error != OK:
		http.queue_free()
		return {"ok": false, "status": 0, "message": "sem conexão"}
	var result: Array = await http.request_completed
	http.queue_free()
	if int(result[0]) != HTTPRequest.RESULT_SUCCESS:
		return {"ok": false, "status": 0, "message": "sem conexão"}
	var status := int(result[1])
	var text := (result[3] as PackedByteArray).get_string_from_utf8()
	var parsed: Variant = JSON.parse_string(text) if text != "" else null
	if status < 200 or status >= 300:
		return {"ok": false, "status": status, "message": _message(parsed, text)}
	return {"ok": true, "status": status, "data": parsed}


func _message(parsed: Variant, text: String) -> String:
	if parsed is Dictionary:
		for key in ["message", "msg", "error_description", "error"]:
			if parsed.get(key) is String:
				return parsed[key]
	return text if text != "" else "erro"
