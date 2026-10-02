class_name DamageNumbers
extends Control
## Números de dano (configuração "damageNumbers", ligada por padrão): cada acerto seu mostra o
## dano saindo do ponto do acerto, sobe um pouco e some. Os acertos seguidos no mesmo alvo
## (menos de MERGE_TIME entre eles) somam no mesmo número, que dá um pulo. Branco no acerto,
## amarelo na cabeça, laranja e maior no abate, cinza quando a armadura ou o escudo seguram.
## Em 2D com a fonte pixel (nítida); a posição na tela acompanha o ponto no mundo.

const MERGE_TIME := 0.4
const LIFE := 0.75
const RISE := 28.0
const MAX_NUMBERS := 24
const COLORS := {
	&"hit": Color(0.97, 0.96, 0.9),
	&"headshot": Color(1.0, 0.84, 0.25),
	&"kill": Color(1.0, 0.55, 0.2),
	&"blocked": Color(0.62, 0.64, 0.66),
}

## Um número na tela: {key, at (mundo), amount, style, age, pop, label}.
var _numbers: Array[Dictionary] = []


func _ready() -> void:
	name = "DamageNumbers"
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)


## Estilo pelo tipo do acerto (o abate vence).
static func style_of(headshot: bool, kill: bool, blocked: bool) -> StringName:
	if kill:
		return &"kill"
	if headshot:
		return &"headshot"
	if blocked:
		return &"blocked"
	return &"hit"


## Soma (função pura): um acerto novo no alvo de um número ainda "aberto" (menos de MERGE_TIME
## desde o último acerto nele) entra nele; senão começa um número novo. Devolve o índice do
## número que recebeu (ou -1 = criar um novo).
static func merge(numbers: Array[Dictionary], key: int) -> int:
	for i in range(numbers.size() - 1, -1, -1):
		var n: Dictionary = numbers[i]
		if int(n.key) == key and float(n.since_hit) < MERGE_TIME:
			return i
	return -1


## Um acerto seu: soma no número aberto do alvo ou cria um novo.
func add_hit(key: int, at: Vector3, amount: float, headshot: bool, kill: bool, blocked: bool) -> void:
	if amount <= 0.0 and not kill:
		return
	var style := style_of(headshot, kill, blocked)
	var index := merge(_numbers, key)
	var number: Dictionary
	if index >= 0:
		number = _numbers[index]
		number.amount = float(number.amount) + amount
		number.since_hit = 0.0
		number.age = minf(float(number.age), LIFE * 0.35)
		number.at = at
		# O estilo só sobe (um headshot no meio deixa amarelo; o abate, laranja).
		if _rank(style) > _rank(StringName(number.style)):
			number.style = style
	else:
		if _numbers.size() >= MAX_NUMBERS:
			var oldest: Dictionary = _numbers.pop_front()
			(oldest.label as Label).queue_free()
		var label := Label.new()
		label.mouse_filter = Control.MOUSE_FILTER_IGNORE
		label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		add_child(label)
		number = {"key": key, "at": at, "amount": amount, "style": style, "age": 0.0, "since_hit": 0.0, "label": label,
			"drift": randf_range(-10.0, 10.0)}
		_numbers.append(number)
	number.pop = 1.0
	_style(number)
	# Já no lugar (o aviso chega no fim do quadro, depois do _process).
	var camera := get_viewport().get_camera_3d()
	if camera and not camera.is_position_behind(at):
		_place(number, camera)


func count() -> int:
	return _numbers.size()


## Texto do número mais novo de um alvo ("" se não houver): para os testes.
func text_of(key: int) -> String:
	for i in range(_numbers.size() - 1, -1, -1):
		if int(_numbers[i].key) == key:
			return (_numbers[i].label as Label).text
	return ""


func clear() -> void:
	for n in _numbers:
		(n.label as Label).queue_free()
	_numbers.clear()


static func _rank(style: StringName) -> int:
	return {&"hit": 0, &"blocked": 1, &"headshot": 2, &"kill": 3}.get(style, 0)


func _style(number: Dictionary) -> void:
	var label := number.label as Label
	label.text = str(maxi(1, roundi(float(number.amount))))
	var big := StringName(number.style) == &"kill"
	label.add_theme_font_size_override(&"font_size", MenuKit.px(26 if big else 20))
	label.add_theme_color_override(&"font_color", COLORS[StringName(number.style)])


func _process(delta: float) -> void:
	if _numbers.is_empty():
		return
	var camera := get_viewport().get_camera_3d()
	var i := 0
	while i < _numbers.size():
		var n := _numbers[i]
		n.age = float(n.age) + delta
		n.since_hit = float(n.since_hit) + delta
		n.pop = maxf(0.0, float(n.pop) - delta * 8.0)
		var label := n.label as Label
		if float(n.age) >= LIFE or camera == null or camera.is_position_behind(n.at):
			label.queue_free()
			_numbers.remove_at(i)
			continue
		_place(n, camera)
		i += 1


## Põe o número no ponto do acerto na tela: sobe, desvia um pouco, dá o pulo e some no fim.
func _place(n: Dictionary, camera: Camera3D) -> void:
	var label := n.label as Label
	var t := float(n.age) / LIFE
	var screen := camera.unproject_position(n.at)
	label.size = label.get_minimum_size()
	label.pivot_offset = label.size * 0.5
	label.scale = Vector2.ONE * (1.0 + 0.35 * float(n.pop))
	label.position = (screen + Vector2(float(n.drift) * t, -26.0 - RISE * t) - label.size * 0.5).round()
	label.modulate.a = 1.0 - clampf((t - 0.65) / 0.35, 0.0, 1.0)
