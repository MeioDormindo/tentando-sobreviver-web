class_name SettingsRows
extends RefCounted
## Configurações em 4 abas (tela CONFIGURAÇÕES e menu de pausa): JOGO, VÍDEO, ÁUDIO e
## CONTROLES. Tudo fica no save, vale na hora e avisa por Events.settings_changed. `rebuild`
## redesenha a tela (os textos dos botões mudam com o valor). Opções que não valem na plataforma
## (resolução e VSync na Web e no celular) não aparecem.

const TABS: Array[String] = ["game", "video", "audio", "controls"]
const TAB_NAMES := {"game": "JOGO", "video": "VÍDEO", "audio": "ÁUDIO", "controls": "CONTROLES"}
const MINIMAP_SIZES: Array[String] = ["small", "medium", "large"]
const MINIMAP_LABELS := {"small": "PEQUENO", "medium": "MÉDIO", "large": "GRANDE"}
## Controles de toque: auto (celular), sempre ou nunca (a mesma chave do jogo web).
const TOUCH_MODES: Array[String] = ["auto", "on", "off"]
const TOUCH_LABELS := {"auto": "AUTO", "on": "LIGADO", "off": "DESLIGADO"}
const WINDOW_MODES: Array[String] = ["windowed", "fullscreen", "exclusive"]
const WINDOW_LABELS := {"windowed": "JANELA", "fullscreen": "TELA CHEIA", "exclusive": "TELA CHEIA EXCLUSIVA"}
const RESOLUTIONS: Array[Vector2i] = [Vector2i(1280, 720), Vector2i(1366, 768), Vector2i(1600, 900), Vector2i(1920, 1080), Vector2i(2560, 1440), Vector2i(3840, 2160)]
const VSYNC_MODES: Array[String] = ["on", "off", "adaptive"]
const VSYNC_LABELS := {"on": "LIGADO", "off": "DESLIGADO", "adaptive": "ADAPTATIVO"}
## Limites de FPS (0 = sem limite). Em float: o save é JSON e devolve números como float.
const FPS_LIMITS: Array[float] = [30.0, 60.0, 90.0, 120.0, 144.0, 240.0, 0.0]
const UI_SCALES: Array[float] = [0.8, 0.9, 1.0, 1.15, 1.3, 1.5]


## A aba seguinte (ou anterior) — Q/E e LB/RB trocam.
static func next_tab(tab: String, step: int) -> String:
	return TABS[posmod(TABS.find(tab) + step, TABS.size())]


## Tecla de trocar de aba: -1 (Q, LB), +1 (E, RB) ou 0.
static func tab_step(event: InputEvent) -> int:
	if not event.is_pressed() or event.is_echo():
		return 0
	if event is InputEventKey:
		match (event as InputEventKey).keycode:
			KEY_Q:
				return -1
			KEY_E:
				return 1
	if event is InputEventJoypadButton:
		match (event as InputEventJoypadButton).button_index:
			JOY_BUTTON_LEFT_SHOULDER:
				return -1
			JOY_BUTTON_RIGHT_SHOULDER:
				return 1
	return 0


## Barra de abas e as linhas da aba; devolve o primeiro controle (para o foco). `in_game`: no
## menu de pausa (sem nome no ranking nem apagar progresso).
static func build(column: VBoxContainer, tab: String, on_tab: Callable, rebuild: Callable, button_size: int = 20, in_game := false) -> Control:
	var bar := HBoxContainer.new()
	bar.name = "Tabs"
	bar.alignment = BoxContainer.ALIGNMENT_CENTER
	bar.add_theme_constant_override(&"separation", 18)
	column.add_child(bar)
	for id in TABS:
		var button := MenuKit.button(bar, TAB_NAMES[id], on_tab.bind(id), button_size)
		button.name = "Tab_" + id
		if id == tab:
			button.add_theme_color_override(&"font_color", MenuKit.GOLD)
			button.add_theme_color_override(&"font_hover_color", MenuKit.GOLD)
	MenuKit.label(column, "Q / E: trocar de aba", 12, MenuKit.DIM, HORIZONTAL_ALIGNMENT_CENTER)
	match tab:
		"video":
			return video(column, rebuild, button_size)
		"audio":
			return audio(column, rebuild, button_size)
		"controls":
			return controls(column, rebuild, button_size)
	return game(column, rebuild, button_size, in_game)


# ───────────────────────── JOGO ─────────────────────────

static func game(column: VBoxContainer, rebuild: Callable, size: int, in_game: bool) -> Control:
	var language := _cycle(column, rebuild, size, "IDIOMA", "language", Loc.choices(), Loc.choice_label)
	language.name = "Language"
	if not in_game:
		MenuKit.label(column, "NOME NO RANKING", 16, MenuKit.DIM)
		var name_edit := LineEdit.new()
		name_edit.name = "PlayerName"
		MenuKit.style_edit(name_edit)
		name_edit.text = Save.player_name
		name_edit.max_length = Save.catalog.player_name_max
		name_edit.text_changed.connect(func(t: String) -> void: Save.set_setting("playerName", t.strip_edges().to_upper() if t.strip_edges() != "" else "SOBREVIVENTE"))
		column.add_child(name_edit)
	_toggle(column, rebuild, size, "TREMOR DE TELA", "screenShake")
	_toggle(column, rebuild, size, "SANGUE", "blood")
	_toggle(column, rebuild, size, "MIRA NO MOUSE", "crosshair")
	_toggle(column, rebuild, size, "MINIMAPA", "minimap")
	_cycle(column, rebuild, size, "TAMANHO DO MINIMAPA", "minimapSize", MINIMAP_SIZES, func(v: Variant) -> String: return MINIMAP_LABELS.get(v, "MÉDIO")).name = "MinimapSize"
	if Save.data.secrets.get("konami", false):
		_toggle(column, rebuild, size, "MODO CABEÇÃO", "bigHeads")
	return language


# ───────────────────────── VÍDEO ─────────────────────────

## Resoluções da lista que cabem na tela (função pura); a da tela entra se não estiver.
static func resolutions_for(screen: Vector2i) -> Array[Vector2i]:
	var list: Array[Vector2i] = []
	for r in RESOLUTIONS:
		if r.x <= screen.x and r.y <= screen.y:
			list.append(r)
	if screen.x > 0 and not list.has(screen):
		list.append(screen)
	return list


static func video(column: VBoxContainer, rebuild: Callable, size: int) -> Control:
	var desktop := not OS.has_feature("web") and not OS.has_feature("mobile")
	var first: Control
	if desktop:
		# Save antigo (só a chave fullscreen): mostra o modo de verdade.
		if String(Save.get_setting("windowMode")) == "":
			Save.set_setting("windowMode", Save.window_mode())
		first = _cycle(column, rebuild, size, "MODO DE TELA", "windowMode", WINDOW_MODES, func(v: Variant) -> String: return WINDOW_LABELS.get(v, "JANELA"))
		first.name = "WindowMode"
		if String(Save.get_setting("windowMode")) == "windowed":
			var screen := DisplayServer.screen_get_size() if DisplayServer.get_name() != "headless" else Vector2i(1920, 1080)
			var options: Array = resolutions_for(screen).map(func(r: Vector2i) -> String: return "%dx%d" % [r.x, r.y])
			_cycle(column, rebuild, size, "RESOLUÇÃO", "resolution", options, func(v: Variant) -> String: return String(v).replace("x", " × ")).name = "Resolution"
		_cycle(column, rebuild, size, "VSYNC", "vsync", VSYNC_MODES, func(v: Variant) -> String: return VSYNC_LABELS.get(v, "LIGADO")).name = "VSync"
	else:
		first = _toggle(column, rebuild, size, "TELA CHEIA", "fullscreen")
	var fps := _cycle(column, rebuild, size, "LIMITE DE FPS", "maxFps", FPS_LIMITS, func(v: Variant) -> String: return "SEM LIMITE" if int(v) == 0 else str(int(v)))
	fps.name = "MaxFps"
	_cycle(column, rebuild, size, "ESCALA DA INTERFACE", "uiScale", UI_SCALES, func(v: Variant) -> String: return "%d%%" % roundi(float(v) * 100.0)).name = "UiScale"
	_slider(column, "BRILHO", "brightness", 70, 140, 5, 100.0).name = "Brightness"
	_toggle(column, rebuild, size, "SOMBRAS", "shadows")
	_toggle(column, rebuild, size, "MOSTRAR FPS", "showFps")
	return first if first else fps


# ───────────────────────── ÁUDIO ─────────────────────────

static func audio(column: VBoxContainer, rebuild: Callable, size: int) -> Control:
	# Música desligada no jogo web (musicOn): a barra começa no zero.
	if not bool(Save.get_setting("musicOn")):
		Save.set_setting("musicVolume", 0.0)
	var master := _slider(column, "VOLUME GERAL", "volume", 0, 100, 5, 100.0)
	master.name = "Volume"
	_slider(column, "MÚSICA", "musicVolume", 0, 100, 5, 100.0).name = "MusicVolume"
	_slider(column, "EFEITOS", "sfxVolume", 0, 100, 5, 100.0).name = "SfxVolume"
	_slider(column, "INTERFACE", "uiVolume", 0, 100, 5, 100.0).name = "UiVolume"
	_slider(column, "VOZES", "voiceVolume", 0, 100, 5, 100.0).name = "VoiceVolume"
	_toggle(column, rebuild, size, "SOM", "muted", true)
	return master


# ───────────────────────── CONTROLES ─────────────────────────

static func controls(column: VBoxContainer, rebuild: Callable, size: int) -> Control:
	var touch := _cycle(column, rebuild, size, "CONTROLES DE TOQUE", "touchMode", TOUCH_MODES, func(v: Variant) -> String: return TOUCH_LABELS.get(v, "AUTO"))
	touch.name = "TouchMode"
	var head := HBoxContainer.new()
	column.add_child(head)
	MenuKit.label(head, "AÇÃO", 14, MenuKit.DIM).size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var widths := {
		InputBindings.KEYBOARD: _column_head(head, "TECLADO / MOUSE", 190.0),
		InputBindings.PAD: _column_head(head, "CONTROLE", 150.0),
	}
	var capture := KeyCapture.new()
	capture.rebuild = rebuild
	column.add_child(capture)
	for action: StringName in InputBindings.REBINDABLE:
		var row := HBoxContainer.new()
		row.name = "Bind_" + String(action)
		column.add_child(row)
		MenuKit.label(row, InputBindings.ACTION_NAMES[action], 16).size_flags_horizontal = Control.SIZE_EXPAND_FILL
		for slot: String in [InputBindings.KEYBOARD, InputBindings.PAD]:
			var label := InputBindings.binding_label(InputBindings.binding_of(action, slot))
			var button := MenuKit.button(row, label, capture.start.bind(action, slot), 16)
			button.name = slot
			button.custom_minimum_size.x = widths[slot]
	capture.status = MenuKit.label(column, "Clique numa tecla para trocar. ESC cancela.", 14, MenuKit.DIM, HORIZONTAL_ALIGNMENT_CENTER)
	MenuKit.button(column, "RESTAURAR PADRÕES", func() -> void:
		InputBindings.reset_bindings()
		rebuild.call_deferred(), size).name = "ResetBindings"
	return touch


## Título de uma coluna de atalhos numa linha só: a coluna alarga se o título traduzido não
## couber na largura mínima (os botões embaixo seguem a mesma largura).
static func _column_head(head: HBoxContainer, text: String, min_width: float) -> float:
	var label := MenuKit.label(head, text, 14, MenuKit.DIM, HORIZONTAL_ALIGNMENT_CENTER)
	label.autowrap_mode = TextServer.AUTOWRAP_OFF
	var font := label.get_theme_font(&"font")
	var width := maxf(min_width, font.get_string_size(Loc.t(text), HORIZONTAL_ALIGNMENT_LEFT, -1, label.get_theme_font_size(&"font_size")).x + 12.0)
	label.custom_minimum_size.x = width
	return width


## Espera a próxima tecla (ou botão do controle) para trocar o atalho de uma ação.
class KeyCapture extends Control:
	var rebuild: Callable
	var status: Label
	var _action := &""
	var _slot := ""

	func start(action: StringName, slot: String) -> void:
		_action = action
		_slot = slot
		if status:
			status.text = Loc.t("Aperte uma tecla para %s… (ESC cancela)" if slot == InputBindings.KEYBOARD else "Aperte um botão do controle para %s… (ESC cancela)") % Loc.t(InputBindings.ACTION_NAMES[action])
			status.add_theme_color_override(&"font_color", MenuKit.GOLD)

	func _input(event: InputEvent) -> void:
		if _action == &"" or not event.is_pressed() or event.is_echo():
			return
		if event is InputEventMouseMotion:
			return
		get_viewport().set_input_as_handled()
		if event is InputEventKey and (event as InputEventKey).keycode == KEY_ESCAPE:
			_action = &""
			rebuild.call_deferred()
			return
		if InputBindings.rebind(_action, _slot, event):
			_action = &""
			rebuild.call_deferred()


# ───────────────────────── Peças ─────────────────────────

## Botão liga/desliga. `inverted`: a chave guarda o contrário (som = não mudo).
static func _toggle(column: VBoxContainer, rebuild: Callable, button_size: int, text: String, key: String, inverted: bool = false) -> Button:
	var on := bool(Save.get_setting(key)) != inverted
	var button := MenuKit.button(column, Loc.t("%s: %s") % [Loc.t(text), Loc.t("LIGADO" if on else "DESLIGADO")], func() -> void:
		Save.set_setting(key, not bool(Save.get_setting(key)))
		_applied(rebuild), button_size)
	button.name = key
	button.alignment = HORIZONTAL_ALIGNMENT_LEFT
	return button


## Botão que percorre uma lista de valores (`label` diz como mostrar cada um).
static func _cycle(column: VBoxContainer, rebuild: Callable, button_size: int, text: String, key: String, values: Array, label: Callable) -> Button:
	var current: Variant = Save.get_setting(key)
	var button := MenuKit.button(column, Loc.t("%s: %s") % [Loc.t(text), Loc.t(String(label.call(current)))], func() -> void:
		var index := values.find(Save.get_setting(key))
		Save.set_setting(key, values[(index + 1) % values.size()])
		_applied(rebuild), button_size)
	button.name = key
	button.alignment = HORIZONTAL_ALIGNMENT_LEFT
	return button


## Rótulo e barra (0–100%): `scale` converte o valor da barra no salvo (100 → 1,0).
static func _slider(column: VBoxContainer, text: String, key: String, low: int, high: int, step: int, scale: float) -> HSlider:
	MenuKit.label(column, text, 16, MenuKit.DIM)
	var slider := HSlider.new()
	slider.min_value = low
	slider.max_value = high
	slider.step = step
	slider.value = float(Save.get_setting(key)) * scale
	slider.focus_mode = Control.FOCUS_ALL
	slider.value_changed.connect(func(v: float) -> void:
		Save.set_setting(key, v / scale)
		# Música no zero desliga a chave do jogo web também (e volta a ligar ao subir).
		if key == "musicVolume":
			Save.set_setting("musicOn", v > 0.0)
		Save.apply_audio()
		Save.apply_display()
		Events.settings_changed.emit())
	column.add_child(slider)
	return slider


static func _applied(rebuild: Callable) -> void:
	Save.apply_audio()
	Save.apply_display()
	Loc.apply()
	Events.settings_changed.emit()
	rebuild.call_deferred()
