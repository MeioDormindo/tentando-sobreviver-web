extends Control
## Configurações (seção 36): as de SettingsRows (volume, som, música, minimapa, tremor, tela
## cheia), nome no ranking e apagar progresso. Tudo fica no save e vale na hora.

const MENU := "res://scenes/ui/main_menu.tscn"

var _column: VBoxContainer
var _confirm_reset := false


func _ready() -> void:
	_build()


func _build() -> void:
	for child in get_children():
		child.queue_free()
	_column = MenuKit.screen(self, 620.0)
	MenuKit.spacer(_column, 30)
	MenuKit.title(_column, "CONFIGURAÇÕES", 48)
	var first := SettingsRows.add(_column, _build)
	MenuKit.label(_column, "NOME NO RANKING", 16, MenuKit.DIM)
	var name_edit := LineEdit.new()
	name_edit.text = Save.player_name
	name_edit.max_length = Save.catalog.player_name_max
	name_edit.text_changed.connect(func(t: String) -> void: Save.set_setting("playerName", t.strip_edges().to_upper() if t.strip_edges() != "" else "SOBREVIVENTE"))
	_column.add_child(name_edit)
	MenuKit.spacer(_column, 10)
	var reset_button := MenuKit.button(_column, "CONFIRMAR: APAGAR TUDO?" if _confirm_reset else "APAGAR PROGRESSO", _reset, 18)
	reset_button.add_theme_color_override(&"font_color", MenuKit.RED)
	MenuKit.spacer(_column, 10)
	MenuKit.button(_column, "VOLTAR", func() -> void: MenuKit.go(self, MENU))
	first.grab_focus.call_deferred()


func _reset() -> void:
	if not _confirm_reset:
		_confirm_reset = true
	else:
		_confirm_reset = false
		Save.reset()
		Save.apply_audio()
	_build.call_deferred()


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed(&"pause"):
		MenuKit.go(self, MENU)
