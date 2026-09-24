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
	&"pause": [["key", KEY_ESCAPE], ["key", KEY_P], ["joy_button", JOY_BUTTON_START]],
}


func _ready() -> void:
	apply_bindings(DEFAULT_BINDINGS)


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
