extends Control
## JOGAR EM GRUPO: criar uma sala (o código aparece grande para passar aos amigos) ou entrar
## com o código de um amigo. Na sala: quem está, quem está pronto, e o host começa quando todos
## estiverem prontos. Até 4 jogadores; por enquanto só no Terminal.

const MENU := "res://scenes/ui/main_menu.tscn"
## Mapa da sala ao criar (o host troca na sala).
const COOP_MAP := "terminal"
const CharacterScreen := preload("res://scripts/ui/character_screen.gd")

var _column: VBoxContainer
var _status: Label
var _name_edit: LineEdit
var _code_edit: LineEdit
var _ip_edit: LineEdit
var _list: VBoxContainer
var _ready_button: Button
var _start_button: Button
## peer → rótulo da latência na lista (atualizado sem refazer a tela).
var _ping_labels: Dictionary = {}
var _skins: SkinCatalog
## O que foi copiado por último (os testes leem; a área de transferência pode não existir).
var last_copied := ""
## Botão que volta a ter o foco depois que a sala se refaz (trocar o visual pelo teclado).
var _refocus := ""


func _ready() -> void:
	_skins = load("res://data/configs/skins.tres") as SkinCatalog
	_column = MenuKit.screen(self, 620.0)
	# Métodos (não funções anônimas): o Net vive o jogo todo, e o Godot desliga sozinho a ligação
	# com um método quando a tela sai.
	Net.room_changed.connect(_rebuild)
	Net.status_changed.connect(_on_status)
	Net.disconnected.connect(_on_disconnected)
	Net.pings_changed.connect(_update_pings)
	_rebuild()


## Foco no próximo quadro, se o botão ainda estiver na tela (ela se refaz a cada mudança da sala).
func _focus(button: Button) -> void:
	(func() -> void:
		if is_instance_valid(button) and button.is_inside_tree():
			button.grab_focus()).call_deferred()


func _on_status(text: String) -> void:
	if is_instance_valid(_status):
		_status.text = Loc.text(text)


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
	_code_edit.placeholder_text = "ABCDE"
	MenuKit.style_edit(_code_edit, 32)
	# Aceita colar o código com espaços ou o link inteiro do convite (fica só o código).
	_code_edit.text_changed.connect(func(text: String) -> void:
		var caret := _code_edit.caret_column
		var found := Net.code_from_text(text)
		_code_edit.text = found if found != "" else text.to_upper().substr(0, 5)
		_code_edit.caret_column = mini(caret, _code_edit.text.length()))
	_code_edit.text_submitted.connect(func(_t: String) -> void: _join())
	_column.add_child(_code_edit)
	MenuKit.button(_column, "ENTRAR NA SALA", _join).name = "Join"
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
		MenuKit.button(lan, "ENTRAR NA SALA", func() -> void:
			Net.last_error = ""
			Net.join_local(_my_name(), _my_skin(), _ip_edit.text.strip_edges())
			_rebuild(), 18).name = "LanJoin"
		MenuKit.button(_column, "CRIAR SALA NA REDE LOCAL", func() -> void:
			Net.last_error = ""
			Net.map_id = COOP_MAP
			Net.host_local(_my_name(), _my_skin())
			_rebuild(), 18).name = "LanCreate"
	_status = MenuKit.label(_column, Loc.text(Net.last_error), 16, MenuKit.RED, HORIZONTAL_ALIGNMENT_CENTER)
	_status.name = "Status"
	MenuKit.spacer(_column, 10)
	MenuKit.button(_column, "VOLTAR", func() -> void: MenuKit.go(self, MENU)).name = "Back"
	_focus(create)
	# Convite pelo link (?sala=ABCDE): entra sozinho com o nome salvo; com o nome padrão, espera
	# a pessoa conferir o nome.
	if Net.invite_code != "":
		_code_edit.text = Net.invite_code
		Net.invite_code = ""
		if Save.player_name != "" and Save.player_name != "SOBREVIVENTE":
			_join.call_deferred()
		else:
			_status.text = Loc.t("Convite para a sala %s: digite seu nome e toque ENTRAR NA SALA") % _code_edit.text
			_status.add_theme_color_override(&"font_color", MenuKit.GOLD)
			_name_edit.grab_focus.call_deferred()


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


## Seu visual no personagem do mapa da sala (cada mapa tem o seu personagem).
func _my_skin() -> String:
	var catalog := load("res://data/configs/skins.tres") as SkinCatalog
	return String(catalog.chosen(Net.map_id if Net.is_online() else COOP_MAP).get("id", ""))


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

## Host: o próximo mapa liberado (no seu save).
func _next_map() -> void:
	var maps: Array = Array(Save.catalog.order).filter(func(id: String) -> bool: return Save.is_unlocked(id))
	if maps.is_empty():
		return
	Net.set_map(String(maps[(maps.find(Net.map_id) + 1) % maps.size()]))

func _build_room() -> void:
	MenuKit.spacer(_column, 20)
	MenuKit.label(_column, "CÓDIGO DA SALA", 16, MenuKit.DIM, HORIZONTAL_ALIGNMENT_CENTER)
	MenuKit.title(_column, Net.code if Net.code != "" else "...", 64, MenuKit.GOLD).name = "RoomCode"
	if Net.code == "LOCAL" and Net.is_host():
		MenuKit.label(_column, Loc.t("Na rede local: os amigos entram com o IP  %s") % _lan_ips(), 14, MenuKit.DIM, HORIZONTAL_ALIGNMENT_CENTER)
	elif Net.code != "" and Net.code != "LOCAL":
		# Passar o código: copiar só ele ou o link que já entra na sala.
		var share := HBoxContainer.new()
		share.alignment = BoxContainer.ALIGNMENT_CENTER
		share.add_theme_constant_override(&"separation", 16)
		_column.add_child(share)
		MenuKit.button(share, "COPIAR CÓDIGO", func() -> void: _copy(Net.code, Loc.t("Código %s copiado!") % Net.code), 16).name = "CopyCode"
		MenuKit.button(share, "COPIAR CONVITE", func() -> void: _copy(_invite_text(), "Convite copiado! Quem abrir o link entra direto na sala."), 16).name = "CopyInvite"
	var map_name := Loc.t(Save.catalog.display_name(Net.map_id)).to_upper()
	if Net.is_host():
		MenuKit.button(_column, Loc.t("MAPA: %s  →") % map_name, _next_map, 18).name = "Map"
	else:
		MenuKit.label(_column, Loc.t("MAPA: %s") % map_name, 16, MenuKit.TEXT, HORIZONTAL_ALIGNMENT_CENTER)
	# O mapa mudou: o seu visual passa a ser o do personagem dele.
	if Net.state == Net.State.ROOM and Net.players.has(Net.my_id()) and String(Net.players[Net.my_id()].skin) != _my_skin():
		Net.set_skin.call_deferred(_my_skin())
	if Net.state == Net.State.ROOM:
		_build_skin_picker()
	MenuKit.spacer(_column, 6)
	_list = VBoxContainer.new()
	_list.name = "Players"
	_list.add_theme_constant_override(&"separation", 6)
	_column.add_child(_list)
	_ping_labels.clear()
	var ids := Net.players.keys()
	ids.sort()
	for id: int in ids:
		var info: Dictionary = Net.players[id]
		var row := HBoxContainer.new()
		row.add_theme_constant_override(&"separation", 10)
		_list.add_child(row)
		var skin := _skins.find(String(info.get("skin", "")))
		if not skin.is_empty():
			row.add_child(CharacterScreen.portrait(skin, 0.5, Vector2(48, 60)))
		var who := MenuKit.label(row, String(info.name) + (Loc.t("  (VOCÊ)") if id == Net.my_id() else ""), 20)
		who.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		who.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		if id != 1:
			var ping := MenuKit.label(row, "", 14, MenuKit.DIM)
			ping.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
			ping.autowrap_mode = TextServer.AUTOWRAP_OFF
			_ping_labels[id] = ping
		var tag := "HOST" if id == 1 else ("PRONTO" if bool(info.ready) else "ESPERANDO")
		var tag_label := MenuKit.label(row, tag, 20, MenuKit.GOLD if id == 1 or bool(info.ready) else MenuKit.DIM)
		tag_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		tag_label.autowrap_mode = TextServer.AUTOWRAP_OFF
	_update_pings()
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
	var again: Button = _column.find_child(_refocus, true, false) as Button if _refocus != "" else null
	_refocus = ""
	if again:
		_focus(again)
	elif _start_button:
		_focus(_start_button)
	elif _ready_button:
		_focus(_ready_button)


## Seu visual na sala: o retrato e ← NOME →, só entre os liberados do personagem do mapa da sala.
func _build_skin_picker() -> void:
	var skin := _skins.find(_my_skin())
	var row := HBoxContainer.new()
	row.name = "Skin"
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override(&"separation", 12)
	_column.add_child(row)
	row.add_child(CharacterScreen.portrait(skin, 1.0, Vector2(72, 72)))
	MenuKit.button(row, "←", _cycle_skin.bind(-1), 22).name = "SkinPrev"
	var label := MenuKit.label(row, Loc.t("SEU VISUAL\n%s") % Loc.t(String(skin.get("name", ""))).to_upper(), 16, MenuKit.TEXT, HORIZONTAL_ALIGNMENT_CENTER)
	label.name = "SkinName"
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	label.custom_minimum_size.x = 200
	MenuKit.button(row, "→", _cycle_skin.bind(1), 22).name = "SkinNext"


## Próximo (ou anterior) visual liberado: fica salvo como o seu nesse mapa e vai para a sala.
func _cycle_skin(step: int) -> void:
	var list := _skins.for_map(Net.map_id).filter(func(s: Dictionary) -> bool: return CharacterScreen.is_unlocked(s))
	if list.is_empty():
		return
	var at := list.map(func(s: Dictionary) -> String: return String(s.id)).find(_my_skin())
	var next: Dictionary = list[posmod(at + step, list.size())]
	Save.set_setting(SkinCatalog.setting_key(Net.map_id), next.id)
	_refocus = "SkinNext" if step > 0 else "SkinPrev"
	Net.set_skin(String(next.id))


func _copy(text: String, message: String) -> void:
	DisplayServer.clipboard_set(text)
	last_copied = text
	if is_instance_valid(_status):
		_status.text = message
		_status.add_theme_color_override(&"font_color", MenuKit.GOLD)


## Convite para colar numa conversa: o código e o link que já entra na sala.
func _invite_text() -> String:
	return Loc.t("Bora jogar Tentando Sobreviver comigo! Sala %s: %s") % [Net.code, Net.invite_link()]


## Latência de cada colega ao lado do nome (verde, amarelo, vermelho).
func _update_pings() -> void:
	for id: int in _ping_labels:
		var label := _ping_labels[id] as Label
		if not is_instance_valid(label):
			continue
		var ms := Net.ping_of(id)
		label.text = (Loc.t("%d ms") % ms) if ms >= 0 else "— ms"
		label.add_theme_color_override(&"font_color", Net.ping_color(ms))
