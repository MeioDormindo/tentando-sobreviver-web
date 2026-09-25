extends Control
## Conta na nuvem: entrar ou criar conta com usuário e senha para levar o progresso para
## outros aparelhos — inclusive a versão web. A senha vai direto para o servidor e nunca é
## guardada no aparelho.

const MENU := "res://scenes/ui/main_menu.tscn"

var _column: VBoxContainer
var _message: Label
var _busy := false


func _ready() -> void:
	Account.status_changed.connect(_refresh_status)
	_build()


func _build() -> void:
	for child in get_children():
		child.queue_free()
	_column = MenuKit.screen(self, 560.0)
	MenuKit.spacer(_column, 40)
	MenuKit.title(_column, "CONTA", 52)
	if not Online.is_configured():
		MenuKit.label(_column, "Contas online indisponíveis nesta versão.", 16, MenuKit.DIM, HORIZONTAL_ALIGNMENT_CENTER)
	elif Account.current_user() != "":
		_logged_in()
	else:
		_login_form()
	_message = MenuKit.label(_column, "", 15, MenuKit.DIM, HORIZONTAL_ALIGNMENT_CENTER)
	_refresh_status()
	MenuKit.spacer(_column, 16)
	var back := MenuKit.button(_column, "VOLTAR", func() -> void: MenuKit.go(self, MENU))
	if Account.current_user() == "" and Online.is_configured():
		(_column.find_child("User", true, false) as LineEdit).grab_focus.call_deferred()
	else:
		back.grab_focus.call_deferred()


func _logged_in() -> void:
	MenuKit.label(_column, "LOGADO COMO %s" % Account.current_user().to_upper(), 22, MenuKit.GOLD, HORIZONTAL_ALIGNMENT_CENTER)
	MenuKit.button(_column, "SINCRONIZAR AGORA", func() -> void: Account.sync_now(), 20)
	MenuKit.button(_column, "SAIR DA CONTA", func() -> void:
		await Account.sign_out()
		_build(), 20)


func _login_form() -> void:
	MenuKit.label(_column, "USUÁRIO", 15, MenuKit.DIM)
	var user := LineEdit.new()
	user.name = "User"
	user.max_length = 16
	_column.add_child(user)
	MenuKit.label(_column, "SENHA", 15, MenuKit.DIM)
	var password := LineEdit.new()
	password.name = "Password"
	password.secret = true
	password.max_length = Online.data.password_max
	_column.add_child(password)
	var run := func(create: bool) -> void:
		if _busy:
			return
		_busy = true
		_message.text = "Conectando..."
		var error_text: String
		if create:
			error_text = await Account.sign_up(user.text, password.text)
		else:
			error_text = await Account.sign_in(user.text, password.text)
		password.text = ""
		_busy = false
		if error_text != "":
			_message.text = error_text
			_message.add_theme_color_override(&"font_color", MenuKit.RED)
			return
		_message.text = "Sincronizando o progresso..."
		await Account.sync_now(true)
		_build()
	password.text_submitted.connect(func(_t: String) -> void: run.call(false))
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override(&"separation", 30)
	_column.add_child(row)
	MenuKit.button(row, "ENTRAR", func() -> void: run.call(false), 20)
	MenuKit.button(row, "CRIAR CONTA", func() -> void: run.call(true), 20)
	MenuKit.label(_column, "Entre para salvar o progresso na nuvem e jogar em qualquer aparelho (inclusive no navegador).\nNão há recuperação por e-mail: guarde bem a sua senha.",
		13, MenuKit.DIM, HORIZONTAL_ALIGNMENT_CENTER)


func _refresh_status() -> void:
	if _message == null or not is_instance_valid(_message) or Account.current_user() == "":
		return
	if Account.busy:
		_message.text = "Sincronizando..."
	elif Account.error != "":
		_message.text = Account.error
	elif Account.last_sync > 0.0:
		_message.text = "Progresso salvo na nuvem · %s" % Time.get_time_string_from_unix_time(int(Account.last_sync))
	else:
		_message.text = "O progresso é salvo na nuvem automaticamente"


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed(&"pause"):
		MenuKit.go(self, MENU)
