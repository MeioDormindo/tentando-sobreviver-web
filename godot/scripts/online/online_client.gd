extends Node
## Cliente do Supabase (autoload "Online"), sem SDK: requisições REST com HTTPRequest (funciona
## também na exportação Web). Nunca lança erro: devolve {ok, status, data, message}.
## Os filtros vão na URL já codificados (uri_encode) — nada de SQL montado no cliente.

var data: OnlineData
## Motivo técnico da última falha de rede ("" se a última requisição chegou ao servidor).
var last_error := ""

## Motivos das falhas de rede (HTTPRequest.Result), para a tela da conta.
const RESULT_TEXT := {
	HTTPRequest.RESULT_CHUNKED_BODY_SIZE_MISMATCH: "resposta incompleta",
	HTTPRequest.RESULT_CANT_CONNECT: "não conectou ao servidor",
	HTTPRequest.RESULT_CANT_RESOLVE: "endereço não encontrado",
	HTTPRequest.RESULT_CONNECTION_ERROR: "conexão caiu",
	HTTPRequest.RESULT_TLS_HANDSHAKE_ERROR: "falha de TLS",
	HTTPRequest.RESULT_NO_RESPONSE: "sem resposta",
	HTTPRequest.RESULT_BODY_SIZE_LIMIT_EXCEEDED: "resposta grande demais",
	HTTPRequest.RESULT_BODY_DECOMPRESS_FAILED: "falha ao descompactar a resposta",
	HTTPRequest.RESULT_REQUEST_FAILED: "requisição falhou",
	HTTPRequest.RESULT_REDIRECT_LIMIT_REACHED: "redirecionamentos demais",
	HTTPRequest.RESULT_TIMEOUT: "tempo esgotado",
}


func _ready() -> void:
	data = load("res://data/configs/online.tres") as OnlineData


func is_configured() -> bool:
	return data != null and data.is_configured()


## `path` começa com /rest/v1 ou /auth/v1. `body` é convertido para JSON.
func request(method: HTTPClient.Method, path: String, body: Variant = null, token: String = "", extra_headers: PackedStringArray = PackedStringArray()) -> Dictionary:
	if not is_configured():
		return {"ok": false, "status": 0, "message": "offline"}
	var http := make_http(data.timeout)
	add_child(http)
	var headers := PackedStringArray(["apikey: " + data.publishable_key, "Content-Type: application/json"])
	if token != "":
		headers.append("Authorization: Bearer " + token)
	headers.append_array(extra_headers)
	var error := http.request(data.url + path, headers, method, "" if body == null else JSON.stringify(body))
	if error != OK:
		http.queue_free()
		last_error = "requisição recusada (%s)" % error_string(error)
		return {"ok": false, "status": 0, "message": "sem conexão"}
	var result: Array = await http.request_completed
	http.queue_free()
	if int(result[0]) != HTTPRequest.RESULT_SUCCESS:
		last_error = result_text(int(result[0]))
		return {"ok": false, "status": 0, "message": "sem conexão"}
	last_error = ""
	var status := int(result[1])
	var text := (result[3] as PackedByteArray).get_string_from_utf8()
	var parsed: Variant = JSON.parse_string(text) if text != "" else null
	if status < 200 or status >= 300:
		return {"ok": false, "status": status, "message": _message(parsed, text)}
	return {"ok": true, "status": status, "data": parsed}


## HTTPRequest de uma requisição. Na Web o navegador já descompacta a resposta (fetch): se o
## Godot também pedisse gzip, veria o cabeçalho Content-Encoding e tentaria descompactar de novo
## (RESULT_BODY_DECOMPRESS_FAILED, "sem conexão" no sync da conta).
static func make_http(timeout: float) -> HTTPRequest:
	var http := HTTPRequest.new()
	http.timeout = timeout
	http.accept_gzip = not OS.has_feature("web")
	return http


static func result_text(result: int) -> String:
	return String(RESULT_TEXT.get(result, "erro de rede %d" % result))


func _message(parsed: Variant, text: String) -> String:
	if parsed is Dictionary:
		for key in ["message", "msg", "error_description", "error"]:
			if parsed.get(key) is String:
				return parsed[key]
	return text if text != "" else "erro"
