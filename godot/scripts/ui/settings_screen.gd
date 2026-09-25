extends Control
## Configurações (seção 36): volume, som, música, tremor de tela, tela cheia, nome no ranking
## e apagar progresso. Tudo fica no save e vale na hora.

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
	MenuKit.label(_column, "VOLUME", 16, MenuKit.DIM)
	var volume := HSlider.new()
	volume.min_value = 0
	volume.max_value = 100
	volume.value = float(Save.get_setting("volume")) * 100.0
	volume.focus_mode = Control.FOCUS_ALL
	volume.value_changed.connect(func(v: float) -> void:
		Save.set_setting("volume", v / 100.0)
		Save.apply_audio())
	_column.add_child(volume)
	var first := _toggle("SOM", "muted", true)
	_toggle("MÚSICA", "musicOn")
	_toggle("TREMOR DE TELA", "screenShake")
	_toggle("TELA CHEIA", "fullscreen")
	if Save.data.secrets.get("konami", false):
		_toggle("MODO CABEÇÃO", "bigHeads")
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


## Botão liga/desliga. `inverted`: a chave guarda o contrário (som = não mudo).
func _toggle(text: String, key: String, inverted: bool = false) -> Button:
	var on := bool(Save.get_setting(key)) != inverted
	var button := MenuKit.button(_column, "%s: %s" % [text, "LIGADO" if on else "DESLIGADO"], func() -> void:
		Save.set_setting(key, not bool(Save.get_setting(key)))
		Save.apply_audio()
		Save.apply_display()
		_build.call_deferred(), 20)
	button.alignment = HORIZONTAL_ALIGNMENT_LEFT
	return button


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
