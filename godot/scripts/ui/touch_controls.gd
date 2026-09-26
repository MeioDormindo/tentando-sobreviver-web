class_name TouchControls
extends Control
## Controles de toque (celular), como no jogo web (src/ui/TouchControls.ts):
## - analógico esquerdo (metade esquerda da tela) move;
## - analógico direito (metade direita) mira; o tiro sai para onde o jogador aponta;
## - ATIRAR (segurar) atira, com mira assistida no zumbi mais perto do cone da mira;
## - USAR (segurar conserta), RECARR., TROCAR, FACA, MAPA (segurar) e pausa.
## Não conhece o jogador: só aciona as mesmas ações do teclado/controle (InputEventAction).

## Zona morta dos analógicos (fração do raio).
const DEAD_ZONE := 0.12
## Toques no topo da tela ficam para a HUD (não viram analógico).
const TOP_RESERVED := 0.18
const LIGHT := Color(0.91, 0.89, 0.78)

## Analógico: dedo (-1 = solto), base e posição atual do dedo.
class Stick:
	var finger := -1
	var base := Vector2.ZERO
	var at := Vector2.ZERO

## [ação, texto, cor]. O botão fica apertado enquanto o dedo estiver nele (apertar e soltar
## no mesmo frame perderia o is_action_just_pressed).
const BUTTONS := [
	[&"fire", "ATIRAR", Color(0.88, 0.31, 0.24)],
	[&"interact", "USAR", Color(0.79, 0.64, 0.36)],
	[&"reload", "RECARR.", Color(0.56, 0.64, 0.72)],
	[&"switch_weapon", "TROCAR", Color(0.56, 0.64, 0.72)],
	[&"melee", "FACA", Color(0.72, 0.72, 0.72)],
	[&"map", "MAPA", Color(0.48, 0.49, 0.47)],
	[&"pause", "II", Color(0.48, 0.49, 0.47)],
]

var move := Stick.new()
var aim := Stick.new()
## ação → {pos, r, finger}
var buttons := {}
var radius := 60.0
## Estado já enviado de cada ação de eixo (para não repetir eventos iguais).
var _sent := {}


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	for def in BUTTONS:
		buttons[def[0]] = {"pos": Vector2.ZERO, "r": 30.0, "finger": -1}
	resized.connect(_layout)
	visibility_changed.connect(func() -> void:
		if not is_visible_in_tree():
			release_all())
	_layout()


func _exit_tree() -> void:
	release_all()


## Posições pelo tamanho da tela (mesma conta do jogo web): ATIRAR grande no canto inferior
## direito, onde o polegar descansa, e os outros em volta.
func _layout() -> void:
	var w := size.x
	var h := size.y
	radius = clampf(minf(w, h) * 0.13, 44.0, 80.0)
	var br := clampf(radius * 0.48, 24.0, 36.0)
	var fire_r := br * 1.75
	var f := Vector2(w - fire_r - 16.0, h - fire_r - 16.0)
	var place := {
		&"fire": [f, fire_r],
		&"interact": [f + Vector2(-fire_r - br * 1.6, fire_r * 0.2), br * 1.1],
		&"reload": [f + Vector2(fire_r * 0.25, -fire_r - br * 1.2), br],
		&"switch_weapon": [f + Vector2(-fire_r * 0.95, -fire_r - br * 0.6), br],
		&"melee": [f + Vector2(-fire_r - br * 2.4, -fire_r * 1.05), br],
		&"map": [Vector2(w - br * 0.9 - 8.0, h * TOP_RESERVED + br), br * 0.7],
		&"pause": [Vector2(w * 0.5, br * 0.9 + 4.0), br * 0.7],
	}
	for action: StringName in place:
		buttons[action].pos = place[action][0]
		buttons[action].r = place[action][1]
	_reset(move, _move_home())
	_reset(aim, _aim_home())
	queue_redraw()


## Topo do bloco de botões da direita (a HUD sobe o painel de munição até aqui).
func buttons_top() -> float:
	var top := size.y
	for action: StringName in [&"fire", &"reload", &"switch_weapon", &"melee"]:
		top = minf(top, buttons[action].pos.y - buttons[action].r)
	return top


func _move_home() -> Vector2:
	return Vector2(radius * 1.7, size.y - radius * 1.7)


func _aim_home() -> Vector2:
	return Vector2(size.x * 0.62, size.y - radius * 1.5)


func _input(event: InputEvent) -> void:
	if not is_visible_in_tree():
		return
	if event is InputEventScreenTouch:
		var touch := event as InputEventScreenTouch
		if touch.pressed:
			_on_down(touch.index, touch.position)
		else:
			_on_up(touch.index)
	elif event is InputEventScreenDrag:
		var drag := event as InputEventScreenDrag
		for stick: Stick in [move, aim]:
			if stick.finger == drag.index:
				stick.at = drag.position
				_apply()


func _on_down(finger: int, at: Vector2) -> void:
	for action: StringName in buttons:
		var b: Dictionary = buttons[action]
		if b.finger == -1 and at.distance_to(b.pos) <= b.r * 1.15:
			b.finger = finger
			_send(action, 1.0)
			queue_redraw()
			return
	if at.y < size.y * TOP_RESERVED:
		return
	var stick := move if at.x < size.x * 0.5 else aim
	if stick.finger != -1:
		return
	stick.finger = finger
	stick.base = at
	stick.at = at
	_apply()


func _on_up(finger: int) -> void:
	for action: StringName in buttons:
		var b: Dictionary = buttons[action]
		if b.finger == finger:
			b.finger = -1
			_send(action, 0.0)
	if move.finger == finger:
		_reset(move, _move_home())
	if aim.finger == finger:
		_reset(aim, _aim_home())
	_apply()


## Solta tudo (pausa, morte, troca de cena, controles escondidos).
func release_all() -> void:
	for action: StringName in buttons:
		if buttons[action].finger != -1:
			_send(action, 0.0)
		buttons[action].finger = -1
	_reset(move, _move_home())
	_reset(aim, _aim_home())
	_apply()


func _reset(stick: Stick, home: Vector2) -> void:
	stick.finger = -1
	stick.base = home
	stick.at = home


## Vetor do analógico (comprimento 0..1, com zona morta).
func vector(stick: Stick) -> Vector2:
	if stick.finger == -1:
		return Vector2.ZERO
	var v := (stick.at - stick.base) / radius
	if v.length() < DEAD_ZONE:
		return Vector2.ZERO
	return v.limit_length(1.0)


## Converte os analógicos nas ações de eixo (as mesmas do controle).
func _apply() -> void:
	var m := vector(move)
	_axis(&"move_left", &"move_right", m.x)
	_axis(&"move_up", &"move_down", m.y)
	var a := vector(aim)
	if a != Vector2.ZERO:
		a = a.normalized()  # mira: só a direção importa
	_axis(&"aim_left", &"aim_right", a.x)
	_axis(&"aim_up", &"aim_down", a.y)
	queue_redraw()


func _axis(negative: StringName, positive: StringName, value: float) -> void:
	_send(negative, maxf(0.0, -value))
	_send(positive, maxf(0.0, value))


## Aciona a ação como se viesse de um controle (Input.is_action_* e _unhandled_input).
func _send(action: StringName, strength: float) -> void:
	var pressed := strength > 0.0
	if _sent.get(action, 0.0) == strength and pressed:
		return
	if not pressed and _sent.get(action, 0.0) == 0.0 and not Input.is_action_pressed(action):
		return
	_sent[action] = strength
	var event := InputEventAction.new()
	event.action = action
	event.pressed = pressed
	event.strength = strength
	Input.parse_input_event(event)


func _draw() -> void:
	var font := get_theme_default_font()
	for stick: Stick in [move, aim]:
		var active := stick.finger != -1
		# O analógico de mira só aparece enquanto está sendo usado.
		if stick == aim and not active:
			continue
		var v := vector(stick)
		draw_circle(stick.base, radius, Color(0, 0, 0, 0.3 if active else 0.15))
		draw_arc(stick.base, radius, 0.0, TAU, 48, Color(LIGHT, 0.55 if active else 0.25), 2.0)
		draw_circle(stick.base + v * radius, radius * 0.42, Color(LIGHT, 0.6 if active else 0.3))
	for def in BUTTONS:
		var b: Dictionary = buttons[def[0]]
		var color: Color = def[2]
		var held: bool = b.finger != -1
		var is_fire: bool = def[0] == &"fire"
		draw_circle(b.pos, b.r, Color(color, 0.6 if held else (0.35 if is_fire else 0.25)))
		draw_arc(b.pos, b.r, 0.0, TAU, 40, Color(color, 0.95 if held else 0.6), 3.0 if is_fire else 2.0)
		var font_size := MenuKit.px(roundi(b.r * (0.3 if is_fire else 0.42)))
		var text: String = def[1]
		var text_size := font.get_string_size(text, HORIZONTAL_ALIGNMENT_CENTER, -1, font_size)
		draw_string(font, b.pos + Vector2(-text_size.x * 0.5, font.get_ascent(font_size) * 0.5 - 2.0), text,
			HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, LIGHT)
