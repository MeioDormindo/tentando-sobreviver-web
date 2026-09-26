extends Node
## Camada de input abstrata (autoload "InputBindings"). O jogo só conhece ações
## (move_*, aim_*, fire, reload...), nunca teclas. Os atalhos padrão de teclado + mouse e
## controle ficam aqui em dados; o remapeamento (futuro) troca os eventos das ações.
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


## Liga/desliga o modo toque (a HUD chama quando os controles de toque aparecem ou somem).
func set_touch_active(active: bool) -> void:
	if active == touch_active:
		return
	touch_active = active
	var bindings := {}
	for action: StringName in DEFAULT_BINDINGS:
		bindings[action] = (DEFAULT_BINDINGS[action] as Array).filter(func(b: Array) -> bool: return not active or b[0] != "mouse")
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
