extends Control
## Configurações (seção 36) em 4 abas — JOGO, VÍDEO, ÁUDIO e CONTROLES (SettingsRows) — e, na
## aba JOGO, apagar o progresso. Tudo fica no save e vale na hora. Q/E (ou LB/RB) trocam de aba.

const MENU := "res://scenes/ui/main_menu.tscn"

var _column: VBoxContainer
var _confirm_reset := false
var _tab := "game"


func _ready() -> void:
	Events.language_changed.connect(_on_language_changed)
	_build()


func _on_language_changed(_code: String) -> void:
	_build.call_deferred()


func _build() -> void:
	for child in get_children():
		child.queue_free()
	_column = MenuKit.screen(self, 680.0)
	MenuKit.spacer(_column, 24)
	MenuKit.title(_column, "CONFIGURAÇÕES", 48)
	var first := SettingsRows.build(_column, _tab, _set_tab, _build, 20)
	if _tab == "game":
		MenuKit.spacer(_column, 10)
		var reset_button := MenuKit.button(_column, "CONFIRMAR: APAGAR TUDO?" if _confirm_reset else "APAGAR PROGRESSO", _reset, 18)
		reset_button.name = "Reset"
		reset_button.add_theme_color_override(&"font_color", MenuKit.RED)
	MenuKit.spacer(_column, 10)
	MenuKit.button(_column, "VOLTAR", func() -> void: MenuKit.go(self, MENU)).name = "Back"
	if first:
		first.grab_focus.call_deferred()


func _set_tab(tab: String) -> void:
	_tab = tab
	_confirm_reset = false
	_build.call_deferred()


func _reset() -> void:
	if not _confirm_reset:
		_confirm_reset = true
	else:
		_confirm_reset = false
		Save.reset()
		Save.apply_audio()
		Save.apply_display()
		InputBindings.apply_saved()
		Loc.apply()
	_build.call_deferred()


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed(&"pause"):
		MenuKit.go(self, MENU)
		return
	var step := SettingsRows.tab_step(event)
	if step != 0:
		get_viewport().set_input_as_handled()
		_set_tab(SettingsRows.next_tab(_tab, step))
