extends Node
## Camada de input abstrata (autoload "InputBindings"). O jogo só conhece ações
## (move_*, aim_*, fire, reload...), nunca teclas. Os atalhos padrão de teclado + mouse e
## controle ficam aqui em dados; o jogador troca o primeiro atalho de teclado/mouse e o de controle
## de cada ação nas Configurações (CONTROLES), salvo na configuração "bindings".
## Toque (celular) virá como outra fonte que dispara as mesmas ações.

const DEADZONE := 0.2

## ação → lista de atalhos: [tipo, código, valor do eixo]. Tipos: key, mouse, joy_button, joy_axis.
const DEFAULT_BINDINGS: Dictionary = {
	&"move_left": [["key", KEY_A], ["key", KEY_LEFT], ["joy_axis", JOY_AXIS_LEFT_X, -1.0]],
	&"move_right": [["key", KEY_D], ["key", KEY_RIGHT], ["joy_axis", JOY_AXIS_LEFT_X, 1.0]],
	&"move_up": [["key", KEY_W], ["key", KEY_UP], ["joy_axis", JOY_AXIS_LEFT_Y, -1.0]],
	&"move_down": [["key", KEY_S], ["key", KEY_DOWN], ["joy_axis", JOY_AXIS_LEFT_Y, 1.0]],
	&"aim_left": [["joy_axis", JOY_AXIS_RIGHT_X, -1.0]],
	&"aim_right": [["joy_axis", JOY_AXIS_RIGHT_X, 1.0]],
	&"aim_up": [["joy_axis", JOY_AXIS_RIGHT_Y, -1.0]],
	&"aim_down": [["joy_axis", JOY_AXIS_RIGHT_Y, 1.0]],
	&"fire": [["mouse", MOUSE_BUTTON_LEFT], ["joy_axis", JOY_AXIS_TRIGGER_RIGHT, 1.0]],
	&"reload": [["key", KEY_R], ["joy_button", JOY_BUTTON_X]],
	&"interact": [["key", KEY_E], ["joy_button", JOY_BUTTON_A]],
	&"switch_weapon": [["key", KEY_Q], ["joy_button", JOY_BUTTON_Y]],
	&"weapon_1": [["key", KEY_1]],
	&"weapon_2": [["key", KEY_2]],
	&"weapon_next": [["mouse", MOUSE_BUTTON_WHEEL_DOWN]],
	&"weapon_prev": [["mouse", MOUSE_BUTTON_WHEEL_UP]],
	&"melee": [["key", KEY_V], ["mouse", MOUSE_BUTTON_RIGHT], ["joy_button", JOY_BUTTON_RIGHT_SHOULDER]],
	&"jump": [["key", KEY_SPACE], ["joy_button", JOY_BUTTON_B]],
	&"map": [["key", KEY_TAB], ["joy_button", JOY_BUTTON_BACK]],
	&"flashlight": [["key", KEY_F], ["joy_button", JOY_BUTTON_DPAD_UP]],
	&"pause": [["key", KEY_ESCAPE], ["key", KEY_P], ["joy_button", JOY_BUTTON_START]],
}


## Controles de toque ativos na partida: o toque também gera cliques de mouse (emulação), então
## os atalhos de mouse saem das ações (senão tocar no analógico atiraria) e a mira ignora o mouse.
var touch_active := false


func _ready() -> void:
	apply_bindings(DEFAULT_BINDINGS)


## Botão voltar do Android: age como ESC (pausa na partida, volta nas telas do menu).
func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_GO_BACK_REQUEST:
		press_back()


func press_back() -> void:
	for pressed in [true, false]:
		var event := InputEventAction.new()
		event.action = &"pause"
		event.pressed = pressed
		Input.parse_input_event(event)


## Liga/desliga o modo toque (a HUD chama quando os controles de toque aparecem ou somem).
func set_touch_active(active: bool) -> void:
	if active == touch_active:
		return
	touch_active = active
	var bindings := effective(_overrides())
	for action: StringName in bindings:
		bindings[action] = (bindings[action] as Array).filter(func(b: Array) -> bool: return not active or b[0] != "mouse")
	apply_bindings(bindings)


## Mostrar os controles de toque? "on"/"off" forçam; "auto" segue o aparelho (celular ou
## navegador de celular), como o device.ts do jogo web.
static func touch_wanted(mode: String, touch_device: bool) -> bool:
	return mode == "on" or (mode != "off" and touch_device)


## Aparelho de toque (Android, iOS ou navegador de celular). PC com tela de toque não conta.
static func is_touch_device() -> bool:
	return OS.has_feature("mobile") or OS.has_feature("web_android") or OS.has_feature("web_ios")


## Registra (ou substitui) os atalhos das ações no InputMap.
func apply_bindings(bindings: Dictionary) -> void:
	for action: StringName in bindings:
		if InputMap.has_action(action):
			InputMap.action_erase_events(action)
		else:
			InputMap.add_action(action, DEADZONE)
		for binding: Array in bindings[action]:
			var event := _make_event(binding)
			if event:
				InputMap.action_add_event(action, event)


func _make_event(binding: Array) -> InputEvent:
	match binding[0]:
		"key":
			var key := InputEventKey.new()
			key.physical_keycode = binding[1]
			return key
		"mouse":
			var mouse := InputEventMouseButton.new()
			mouse.button_index = binding[1]
			return mouse
		"joy_button":
			var button := InputEventJoypadButton.new()
			button.button_index = binding[1]
			return button
		"joy_axis":
			var axis := InputEventJoypadMotion.new()
			axis.axis = binding[1]
			axis.axis_value = binding[2]
			return axis
	push_warning("InputBindings: atalho desconhecido %s" % [binding])
	return null

## Ações que o jogador pode trocar (Configurações → CONTROLES), na ordem da lista. Os analógicos
## (mira e movimento no controle) ficam fixos.
const REBINDABLE: Array[StringName] = [&"move_up", &"move_down", &"move_left", &"move_right", &"fire", &"reload", &"interact",
	&"switch_weapon", &"weapon_1", &"weapon_2", &"melee", &"jump", &"map", &"flashlight", &"pause"]
## Nome de cada ação na lista (texto em português = chave da tradução).
const ACTION_NAMES := {
	&"move_up": "ANDAR PARA CIMA", &"move_down": "ANDAR PARA BAIXO", &"move_left": "ANDAR PARA A ESQUERDA",
	&"move_right": "ANDAR PARA A DIREITA", &"fire": "ATIRAR", &"reload": "RECARREGAR", &"interact": "USAR / COMPRAR",
	&"switch_weapon": "TROCAR DE ARMA", &"weapon_1": "ARMA 1", &"weapon_2": "ARMA 2", &"melee": "FACA",
	&"jump": "PULAR", &"map": "MAPA GRANDE", &"flashlight": "LANTERNA", &"pause": "PAUSA",
}
## Os dois lugares de cada ação: teclado/mouse e controle.
const KEYBOARD := "kb"
const PAD := "pad"


## Os atalhos de agora: os padrões com o primeiro de cada lugar trocado pelo que o jogador
## escolheu (o resto, como as setas, continua valendo).
static func effective(overrides: Dictionary) -> Dictionary:
	var result := {}
	for action: StringName in DEFAULT_BINDINGS:
		var list: Array = (DEFAULT_BINDINGS[action] as Array).duplicate(true)
		var chosen: Dictionary = overrides.get(String(action), {})
		for slot: String in [KEYBOARD, PAD]:
			if not chosen.has(slot):
				continue
			var index := _slot_index(list, slot)
			if index >= 0:
				list[index] = chosen[slot]
			else:
				list.append(chosen[slot])
		result[action] = list
	return result


## Primeiro atalho do lugar (teclado/mouse ou controle) numa lista, ou -1.
static func _slot_index(list: Array, slot: String) -> int:
	for i in list.size():
		if _slot_of(list[i]) == slot:
			return i
	return -1


static func _slot_of(binding: Array) -> String:
	return KEYBOARD if binding[0] in ["key", "mouse"] else PAD


## O atalho do lugar de uma ação agora (ou [] se não tem).
func binding_of(action: StringName, slot: String) -> Array:
	var list: Array = effective(_overrides()).get(action, [])
	var index := _slot_index(list, slot)
	return list[index] if index >= 0 else []


## Os atalhos trocados pelo jogador, como estão no save (o JSON devolve números como float: os
## códigos voltam a ser inteiros).
func _overrides() -> Dictionary:
	var saved: Variant = Save.get_setting("bindings") if Save else null
	if not saved is Dictionary:
		return {}
	var clean := {}
	for action: String in saved:
		var slots: Variant = saved[action]
		if not slots is Dictionary:
			continue
		clean[action] = {}
		for slot: String in slots:
			var b: Variant = slots[slot]
			if b is Array and b.size() >= 2:
				clean[action][slot] = [String(b[0]), int(b[1])] + ([float(b[2])] if b.size() > 2 else [])
	return clean


## Liga os atalhos salvos (ao abrir o jogo e depois de cada troca).
func apply_saved() -> void:
	apply_bindings(effective(_overrides()))


## Troca o atalho do lugar de uma ação. Se outra ação já usava esse atalho no mesmo lugar, ela
## fica com o antigo desta (troca as duas). Devolve false se o evento não serve para o lugar.
func rebind(action: StringName, slot: String, event: InputEvent) -> bool:
	var binding := binding_from_event(event)
	if binding.is_empty() or _slot_of(binding) != slot:
		return false
	var overrides := _overrides().duplicate(true)
	var old := binding_of(action, slot)
	for other: StringName in REBINDABLE:
		if other != action and binding_of(other, slot) == binding:
			var entry: Dictionary = overrides.get(String(other), {})
			entry[slot] = old
			overrides[String(other)] = entry
	var mine: Dictionary = overrides.get(String(action), {})
	mine[slot] = binding
	overrides[String(action)] = mine
	Save.set_setting("bindings", overrides)
	apply_saved()
	return true


## Volta aos atalhos padrão.
func reset_bindings() -> void:
	Save.set_setting("bindings", {})
	apply_saved()


## O atalho (formato dos dados) de um evento de tecla, mouse ou controle; [] se não serve.
static func binding_from_event(event: InputEvent) -> Array:
	if event is InputEventKey:
		var key := event as InputEventKey
		return ["key", key.physical_keycode if key.physical_keycode != KEY_NONE else key.keycode]
	if event is InputEventMouseButton:
		return ["mouse", (event as InputEventMouseButton).button_index]
	if event is InputEventJoypadButton:
		return ["joy_button", (event as InputEventJoypadButton).button_index]
	if event is InputEventJoypadMotion and absf((event as InputEventJoypadMotion).axis_value) > 0.6:
		var motion := event as InputEventJoypadMotion
		return ["joy_axis", motion.axis, signf(motion.axis_value)]
	return []


## Nome curto de um atalho para mostrar ("E", "ESPAÇO", "MOUSE ESQ.", "A", "RB").
static func binding_label(binding: Array) -> String:
	if binding.is_empty():
		return "—"
	match binding[0]:
		"key":
			var code: int = DisplayServer.keyboard_get_keycode_from_physical(binding[1]) if DisplayServer.get_name() != "headless" else int(binding[1])
			return Loc.t(KEY_NAMES[binding[1]]) if KEY_NAMES.has(binding[1]) else OS.get_keycode_string(code).to_upper()
		"mouse":
			return Loc.t(MOUSE_NAMES[binding[1]]) if MOUSE_NAMES.has(binding[1]) else Loc.t("MOUSE %d") % binding[1]
		"joy_button":
			return PAD_NAMES.get(binding[1], Loc.t("BOTÃO %d") % binding[1])
		"joy_axis":
			return AXIS_NAMES.get(binding[1], Loc.t("EIXO %d") % binding[1])
	return "?"


## Nomes das teclas que o sistema não dá bem curtos (o resto vem de OS.get_keycode_string).
const KEY_NAMES := {KEY_SPACE: "ESPAÇO", KEY_ESCAPE: "ESC", KEY_TAB: "TAB", KEY_ENTER: "ENTER", KEY_SHIFT: "SHIFT",
	KEY_CTRL: "CTRL", KEY_ALT: "ALT", KEY_BACKSPACE: "BACKSPACE", KEY_UP: "↑", KEY_DOWN: "↓", KEY_LEFT: "←", KEY_RIGHT: "→"}
const MOUSE_NAMES := {MOUSE_BUTTON_LEFT: "MOUSE ESQ.", MOUSE_BUTTON_RIGHT: "MOUSE DIR.", MOUSE_BUTTON_MIDDLE: "MOUSE MEIO",
	MOUSE_BUTTON_WHEEL_UP: "RODA ↑", MOUSE_BUTTON_WHEEL_DOWN: "RODA ↓", MOUSE_BUTTON_XBUTTON1: "MOUSE 4", MOUSE_BUTTON_XBUTTON2: "MOUSE 5"}
const PAD_NAMES := {JOY_BUTTON_A: "A", JOY_BUTTON_B: "B", JOY_BUTTON_X: "X", JOY_BUTTON_Y: "Y", JOY_BUTTON_LEFT_SHOULDER: "LB",
	JOY_BUTTON_RIGHT_SHOULDER: "RB", JOY_BUTTON_BACK: "SELECT", JOY_BUTTON_START: "START", JOY_BUTTON_LEFT_STICK: "L3",
	JOY_BUTTON_RIGHT_STICK: "R3", JOY_BUTTON_DPAD_UP: "↑", JOY_BUTTON_DPAD_DOWN: "↓", JOY_BUTTON_DPAD_LEFT: "←", JOY_BUTTON_DPAD_RIGHT: "→"}
const AXIS_NAMES := {JOY_AXIS_TRIGGER_LEFT: "LT", JOY_AXIS_TRIGGER_RIGHT: "RT"}


## A tecla de uma ação para as dicas na tela ("E", "ESPAÇO").
func hint_label(action: StringName) -> String:
	return binding_label(binding_of(action, KEYBOARD))
