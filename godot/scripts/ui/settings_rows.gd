class_name SettingsRows
extends RefCounted
## Configurações que valem no menu e no jogo (tela CONFIGURAÇÕES e menu de pausa, como no
## jogo web): volume, som, música, minimapa e tamanho, tremor de tela, tela cheia e o modo
## cabeção (depois do código Konami). Tudo fica no save, vale na hora e avisa por
## Events.settings_changed. `rebuild` redesenha a tela (para os textos dos botões).

const MINIMAP_SIZES: Array[String] = ["small", "medium", "large"]
const MINIMAP_LABELS := {"small": "PEQUENO", "medium": "MÉDIO", "large": "GRANDE"}


## Adiciona as linhas à coluna; devolve o primeiro controle (para o foco).
static func add(column: VBoxContainer, rebuild: Callable, button_size: int = 20) -> Control:
	MenuKit.label(column, "VOLUME", 16, MenuKit.DIM)
	var volume := HSlider.new()
	volume.name = "Volume"
	volume.min_value = 0
	volume.max_value = 100
	volume.step = 5
	volume.value = float(Save.get_setting("volume")) * 100.0
	volume.focus_mode = Control.FOCUS_ALL
	volume.value_changed.connect(func(v: float) -> void:
		Save.set_setting("volume", v / 100.0)
		Save.apply_audio()
		Events.settings_changed.emit())
	column.add_child(volume)
	_toggle(column, rebuild, button_size, "SOM", "muted", true)
	_toggle(column, rebuild, button_size, "MÚSICA", "musicOn")
	_toggle(column, rebuild, button_size, "MINIMAPA", "minimap")
	var size_key := String(Save.get_setting("minimapSize"))
	var size_button := MenuKit.button(column, "TAMANHO DO MINIMAPA: %s" % MINIMAP_LABELS.get(size_key, "MÉDIO"), func() -> void:
		var index := MINIMAP_SIZES.find(String(Save.get_setting("minimapSize")))
		Save.set_setting("minimapSize", MINIMAP_SIZES[(index + 1) % MINIMAP_SIZES.size()])
		Events.settings_changed.emit()
		rebuild.call_deferred(), button_size)
	size_button.name = "MinimapSize"
	size_button.alignment = HORIZONTAL_ALIGNMENT_LEFT
	_toggle(column, rebuild, button_size, "TREMOR DE TELA", "screenShake")
	_toggle(column, rebuild, button_size, "TELA CHEIA", "fullscreen")
	if Save.data.secrets.get("konami", false):
		_toggle(column, rebuild, button_size, "MODO CABEÇÃO", "bigHeads")
	return volume


## Botão liga/desliga. `inverted`: a chave guarda o contrário (som = não mudo).
static func _toggle(column: VBoxContainer, rebuild: Callable, button_size: int, text: String, key: String, inverted: bool = false) -> Button:
	var on := bool(Save.get_setting(key)) != inverted
	var button := MenuKit.button(column, "%s: %s" % [text, "LIGADO" if on else "DESLIGADO"], func() -> void:
		Save.set_setting(key, not bool(Save.get_setting(key)))
		Save.apply_audio()
		Save.apply_display()
		Events.settings_changed.emit()
		rebuild.call_deferred(), button_size)
	button.name = key
	button.alignment = HORIZONTAL_ALIGNMENT_LEFT
	return button
