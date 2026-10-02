extends Control
## JOGAR EM GRUPO: criar uma sala (o código aparece grande para passar aos amigos) ou entrar
## com o código de um amigo. Na sala: quem está, quem está pronto, e o host começa quando todos
## estiverem prontos. Até 4 jogadores; por enquanto só no Terminal.

const MENU := "res://scenes/ui/main_menu.tscn"
## Mapa das partidas em grupo nesta etapa.
const COOP_MAP := "terminal"

var _column: VBoxContainer
var _status: Label
var _name_edit: LineEdit
var _code_edit: LineEdit
var _ip_edit: LineEdit
var _list: VBoxContainer
var _ready_button: Button
var _start_button: Button


func _ready() -> void:
	_column = MenuKit.screen(self, 620.0)
	# Métodos (não funções anônimas): o Net vive o jogo todo, e o Godot desliga sozinho a ligação
	# com um método quando a tela sai.
	Net.room_changed.connect(_rebuild)
	Net.status_changed.connect(_on_status)
	Net.disconnected.connect(_on_disconnected)
	_rebuild()


func _on_status(text: String) -> void:
	if is_instance_valid(_status):
		_status.text = text


func _on_disconnected(_reason: String) -> void:
	_rebuild()


func _exit_tree() -> void:
	# Saiu da tela sem começar a partida: sai da sala.
	if Net.state in [Net.State.CONNECTING, Net.State.ROOM]:
		Net.leave()


func _rebuild() -> void:
	for child in _column.get_children():
		_column.remove_child(child)
		child.queue_free()
	_start_button = null
	_ready_button = null
	if Net.state in [Net.State.ROOM] or (Net.state == Net.State.CONNECTING and Net.code != ""):
		_build_room()
	else:
		_build_entry()


# ───────────────────────── Fora da sala ─────────────────────────

func _build_entry() -> void:
	MenuKit.spacer(_column, 30)
	MenuKit.title(_column, "JOGAR EM GRUPO", 48)
	MenuKit.label(_column, "Até 4 jogadores pela internet. Crie uma sala e passe o código, ou entre com o código de um amigo.", 16, MenuKit.DIM, HORIZONTAL_ALIGNMENT_CENTER)
	MenuKit.spacer(_column, 10)
	MenuKit.label(_column, "SEU NOME", 16, MenuKit.GOLD)
	_name_edit = LineEdit.new()
	_name_edit.name = "PlayerName"
	_name_edit.max_length = 14
	_name_edit.placeholder_text = "NOME"
	_name_edit.text = Save.player_name
	MenuKit.style_edit(_name_edit)
	_column.add_child(_name_edit)
	var create := MenuKit.button(_column, "CRIAR SALA", _create)
	create.name = "Create"
	MenuKit.spacer(_column, 6)
	MenuKit.label(_column, "CÓDIGO DA SALA", 16, MenuKit.GOLD)
	_code_edit = LineEdit.new()
	_code_edit.name = "Code"
	_code_edit.max_length = 5
	_code_edit.placeholder_text = "ABCDE"
	MenuKit.style_edit(_code_edit, 32)
	_code_edit.text_changed.connect(func(text: String) -> void:
		var caret := _code_edit.caret_column
		_code_edit.text = text.to_upper()
		_code_edit.caret_column = caret)
	_code_edit.text_submitted.connect(func(_t: String) -> void: _join())
	_column.add_child(_code_edit)
	MenuKit.button(_column, "ENTRAR", _join).name = "Join"
	# Rede local (mesmo PC ou mesmo Wi-Fi), sem servidor. O navegador não tem ENet.
	if not OS.has_feature("web"):
		MenuKit.spacer(_column, 6)
		MenuKit.label(_column, "REDE LOCAL (MESMO WI-FI) — IP DO HOST", 14, MenuKit.DIM)
		var lan := HBoxContainer.new()
		lan.add_theme_constant_override(&"separation", 10)
		_column.add_child(lan)
		_ip_edit = LineEdit.new()
		_ip_edit.name = "LanIp"
		_ip_edit.text = "127.0.0.1"
		_ip_edit.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		MenuKit.style_edit(_ip_edit, 20)
		lan.add_child(_ip_edit)
		MenuKit.button(lan, "ENTRAR", func() -> void:
			Net.last_error = ""
			Net.join_local(_my_name(), _my_skin(), _ip_edit.text.strip_edges())
			_rebuild(), 18).name = "LanJoin"
		MenuKit.button(_column, "CRIAR SALA NA REDE LOCAL", func() -> void:
			Net.last_error = ""
			Net.map_id = COOP_MAP
			Net.host_local(_my_name(), _my_skin())
			_rebuild(), 18).name = "LanCreate"
	_status = MenuKit.label(_column, Net.last_error, 16, MenuKit.RED, HORIZONTAL_ALIGNMENT_CENTER)
	_status.name = "Status"
	MenuKit.spacer(_column, 10)
	MenuKit.button(_column, "VOLTAR", func() -> void: MenuKit.go(self, MENU)).name = "Back"
	create.grab_focus.call_deferred()


func _my_name() -> String:
	var typed := _name_edit.text.strip_edges() if is_instance_valid(_name_edit) else ""
	if typed != "":
		Save.set_setting("playerName", typed.to_upper())
	return typed if typed != "" else Save.player_name


## IPs deste aparelho na rede local (para os amigos no mesmo Wi-Fi).
static func _lan_ips() -> String:
	var ips := PackedStringArray()
	for address in IP.get_local_addresses():
		if address.begins_with("192.168.") or address.begins_with("10.") or address.begins_with("172."):
			ips.append(address)
	return "  /  ".join(ips) if not ips.is_empty() else "127.0.0.1"


func _my_skin() -> String:
	var catalog := load("res://data/configs/skins.tres") as SkinCatalog
	return String(catalog.chosen(COOP_MAP).get("id", ""))


func _create() -> void:
	Net.last_error = ""
	Net.map_id = COOP_MAP
	Net.create_room(_my_name(), _my_skin())
	_status.text = "Criando sala..."


func _join() -> void:
	var room_code := _code_edit.text.strip_edges().to_upper()
	if room_code.length() != 5:
		_status.text = "O código tem 5 letras"
		return
	Net.last_error = ""
	Net.join_room(room_code, _my_name(), _my_skin())
	_status.text = "Procurando a sala..."


# ───────────────────────── Na sala ─────────────────────────

func _build_room() -> void:
	MenuKit.spacer(_column, 20)
	MenuKit.label(_column, "CÓDIGO DA SALA", 16, MenuKit.DIM, HORIZONTAL_ALIGNMENT_CENTER)
	MenuKit.title(_column, Net.code if Net.code != "" else "...", 64, MenuKit.GOLD).name = "RoomCode"
	if Net.code == "LOCAL" and Net.is_host():
		MenuKit.label(_column, "Na rede local: os amigos entram com o IP  %s" % _lan_ips(), 14, MenuKit.DIM, HORIZONTAL_ALIGNMENT_CENTER)
	MenuKit.label(_column, "MAPA: TERMINAL", 16, MenuKit.TEXT, HORIZONTAL_ALIGNMENT_CENTER)
	MenuKit.spacer(_column, 6)
	_list = VBoxContainer.new()
	_list.name = "Players"
	_list.add_theme_constant_override(&"separation", 6)
	_column.add_child(_list)
	var ids := Net.players.keys()
	ids.sort()
	for id: int in ids:
		var info: Dictionary = Net.players[id]
		var row := HBoxContainer.new()
		_list.add_child(row)
		var who := MenuKit.label(row, String(info.name) + ("  (VOCÊ)" if id == Net.my_id() else ""), 20)
		who.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var tag := "HOST" if id == 1 else ("PRONTO" if bool(info.ready) else "ESPERANDO")
		MenuKit.label(row, tag, 20, MenuKit.GOLD if id == 1 or bool(info.ready) else MenuKit.DIM)
	for i in range(ids.size(), Net.MAX_PLAYERS):
		MenuKit.label(_list, "· vaga livre", 16, MenuKit.DIM)
	MenuKit.spacer(_column, 6)
	if Net.is_host():
		_start_button = MenuKit.button(_column, "COMEÇAR", func() -> void: Net.start_match())
		_start_button.name = "Start"
		_start_button.disabled = Net.players.size() < 2 or not Net.everyone_ready()
		MenuKit.label(_column, "Começa quando todos estiverem prontos." if Net.players.size() >= 2 else "Esperando os amigos entrarem com o código.", 14, MenuKit.DIM, HORIZONTAL_ALIGNMENT_CENTER)
	elif Net.state == Net.State.ROOM and Net.players.has(Net.my_id()):
		var ready_now := bool(Net.players[Net.my_id()].ready)
		_ready_button = MenuKit.button(_column, "CANCELAR PRONTO" if ready_now else "PRONTO", func() -> void: Net.set_ready(not ready_now))
		_ready_button.name = "Ready"
	_status = MenuKit.label(_column, "", 16, MenuKit.DIM, HORIZONTAL_ALIGNMENT_CENTER)
	_status.name = "Status"
	if Net.state == Net.State.CONNECTING:
		_status.text = "Conectando..."
	MenuKit.button(_column, "SAIR DA SALA", func() -> void:
		Net.leave()
		_rebuild()).name = "Leave"
	if _start_button:
		_start_button.grab_focus.call_deferred()
	elif _ready_button:
		_ready_button.grab_focus.call_deferred()
