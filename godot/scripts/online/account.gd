extends Node
## Conta na nuvem (autoload "Account"), a mesma do jogo web: usuário e senha no Supabase Auth.
## A senha só vai ao servidor no login/cadastro (HTTPS) e lá fica só como hash bcrypt; no
## aparelho fica apenas a sessão (tokens), nunca a senha. O save (mesmo formato do jogo web)
## é mesclado com o da nuvem ao entrar e enviado a cada mudança.

signal status_changed()

const SESSION_PATH := "user://session.json"
const NO_SESSION := "sem sessão"

## Última sincronização concluída (unix), erro e se está sincronizando.
var last_sync: float = 0.0
var error: String = ""
var busy: bool = false

var _session: Dictionary = {}
var _push_timer: Timer


func _ready() -> void:
	_session = _load_session()
	_push_timer = Timer.new()
	_push_timer.one_shot = true
	_push_timer.timeout.connect(_push_later)
	add_child(_push_timer)
	Save.changed.connect(func() -> void:
		if current_user() != "":
			_push_timer.start(Online.data.sync_debounce))
	if current_user() != "":
		sync_now.call_deferred()


## Nome do usuário logado ("" se ninguém).
func current_user() -> String:
	return String(_session.get("username", ""))


static func normalize(raw: String) -> String:
	return raw.strip_edges().to_lower()


func username_error(username: String) -> String:
	var regex := RegEx.create_from_string(Online.data.username_pattern)
	return "" if regex.search(username) else "Usuário: 3 a 16 letras minúsculas, números ou _"


func password_error(password: String) -> String:
	if password.length() < Online.data.password_min:
		return "Senha: mínimo de %d caracteres" % Online.data.password_min
	if password.length() > Online.data.password_max:
		return "Senha: máximo de %d caracteres" % Online.data.password_max
	return ""


## Cria a conta e já entra. Devolve "" se deu certo, ou a mensagem do erro.
func sign_up(raw_user: String, password: String) -> String:
	var error_text: String = await _credentials("/auth/v1/signup", raw_user, password)
	if error_text == NO_SESSION:
		return await sign_in(raw_user, password)
	return error_text


func sign_in(raw_user: String, password: String) -> String:
	var error_text: String = await _credentials("/auth/v1/token?grant_type=password", raw_user, password)
	return "Não foi possível entrar — tente de novo" if error_text == NO_SESSION else error_text


func sign_out() -> void:
	var token := String(_session.get("access_token", ""))
	_store_session({})
	if token != "":
		await Online.request(HTTPClient.METHOD_POST, "/auth/v1/logout", {}, token)


## Token de acesso válido (renova se estiver para expirar); "" se não estiver logado.
func access_token() -> String:
	if _session.is_empty():
		return ""
	if float(_session.expires_at) - Time.get_unix_time_from_system() > Online.data.refresh_margin:
		return _session.access_token
	var result: Dictionary = await Online.request(HTTPClient.METHOD_POST, "/auth/v1/token?grant_type=refresh_token", {"refresh_token": _session.refresh_token})
	if result.ok and _accept(String(_session.username), result.data):
		return _session.access_token
	if int(result.status) == 400 or int(result.status) == 401:
		_store_session({})  # sessão revogada ou expirada
	return ""


## Baixa o save da nuvem, mescla com o local e envia o resultado.
## `take_settings`: ao entrar numa conta, as configurações da nuvem valem.
func sync_now(take_settings: bool = false) -> bool:
	if busy:
		return false
	_set_status(true, "")
	var token: String = await access_token()
	if token == "":
		_set_status(false, "Sem conexão" if current_user() != "" else "Sessão expirada — entre de novo")
		return false
	var pulled: Dictionary = await Online.request(HTTPClient.METHOD_GET, "/rest/v1/cloud_saves?select=data", null, token)
	if not pulled.ok:
		_set_status(false, "Sem conexão" if int(pulled.status) == 0 else "Falha ao ler da nuvem")
		return false
	if pulled.data is Array and not (pulled.data as Array).is_empty():
		Save.merge_from(pulled.data[0].get("data"), take_settings)
	var ok: bool = await _push(token)
	if ok:
		last_sync = Time.get_unix_time_from_system()
	_set_status(false, error)
	return ok


# ───────────────────────── Interno ─────────────────────────

func _credentials(path: String, raw_user: String, password: String) -> String:
	if not Online.is_configured():
		return "Contas online indisponíveis"
	var username := normalize(raw_user)
	var invalid := username_error(username)
	if invalid == "":
		invalid = password_error(password)
	if invalid != "":
		return invalid
	var email := "%s@%s" % [username, Online.data.email_domain]
	var result: Dictionary = await Online.request(HTTPClient.METHOD_POST, path, {"email": email, "password": password})
	if not result.ok:
		return _translate(int(result.status), String(result.message))
	return "" if _accept(username, result.data) else NO_SESSION


func _accept(username: String, response: Variant) -> bool:
	if not response is Dictionary or not response.get("access_token") is String or not response.get("refresh_token") is String:
		return false
	_store_session({
		"access_token": response.access_token,
		"refresh_token": response.refresh_token,
		"expires_at": Time.get_unix_time_from_system() + float(response.get("expires_in", 3600)),
		"username": username,
	})
	return true


func _push(token: String) -> bool:
	var result: Dictionary = await Online.request(HTTPClient.METHOD_POST, "/rest/v1/cloud_saves", {"data": Save.export_data()}, token,
		PackedStringArray(["Prefer: resolution=merge-duplicates,return=minimal"]))
	if not result.ok:
		error = "Sem conexão" if int(result.status) == 0 else "Falha ao salvar na nuvem"
	else:
		error = ""
	return result.ok


func _push_later() -> void:
	if busy or current_user() == "":
		return
	var token: String = await access_token()
	if token != "" and await _push(token):
		last_sync = Time.get_unix_time_from_system()
	status_changed.emit()


func _translate(status: int, message: String) -> String:
	if status == 0:
		return "Sem conexão com o servidor"
	if status == 429 or message.containsn("rate limit") or message.containsn("too many"):
		return "Muitas tentativas — aguarde um pouco"
	if message.containsn("already registered") or message.containsn("already exists"):
		return "Esse usuário já existe"
	if message.containsn("invalid login credentials"):
		return "Usuário ou senha incorretos"
	if message.containsn("weak"):
		return "Senha fraca demais"
	if message.containsn("inválido") or message.containsn("invalid") or status == 403:
		return "Usuário inválido"
	return "Não foi possível concluir — tente de novo"


func _set_status(p_busy: bool, p_error: String) -> void:
	busy = p_busy
	error = p_error
	status_changed.emit()


func _load_session() -> Dictionary:
	if not FileAccess.file_exists(SESSION_PATH):
		return {}
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(SESSION_PATH))
	if parsed is Dictionary and parsed.get("access_token") is String and parsed.get("refresh_token") is String and parsed.get("username") is String:
		return parsed
	return {}


func _store_session(session: Dictionary) -> void:
	_session = session
	if session.is_empty():
		DirAccess.remove_absolute(ProjectSettings.globalize_path(SESSION_PATH))
		return
	var file := FileAccess.open(SESSION_PATH, FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify(session))
