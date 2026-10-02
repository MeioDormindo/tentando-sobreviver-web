class_name HitMarker
extends Control
## Marcador de acerto (como nos jogos do gênero): quatro tracinhos na diagonal em volta da mira
## que aparecem grandes, encolhem num instante e somem. Branco no acerto, amarelo na cabeça,
## vermelho (maior e mais grosso) no abate e cinza (menor) quando a armadura ou o escudo
## seguram o tiro. A HUD diz onde (na mira do mouse, ou no ponto do acerto no toque e no controle).

enum Kind { HIT, HEADSHOT, KILL, BLOCKED }

const COLORS := {
	Kind.HIT: Color(0.97, 0.96, 0.9),
	Kind.HEADSHOT: Color(1.0, 0.84, 0.25),
	Kind.KILL: Color(1.0, 0.27, 0.22),
	Kind.BLOCKED: Color(0.62, 0.64, 0.66),
}
const PRIORITY := {Kind.HIT: 0, Kind.BLOCKED: 1, Kind.HEADSHOT: 2, Kind.KILL: 3}
const OUTLINE := Color(0.0, 0.0, 0.0, 0.85)
## Duração total (s) e o "estouro" do começo (s).
const LIFE := 0.26
const POP := 0.08

var kind := Kind.HIT
var _age := LIFE


func _ready() -> void:
	name = "HitMarker"
	mouse_filter = Control.MOUSE_FILTER_IGNORE


## Prioridade quando vários chegam juntos (o abate vence).
static func kind_of(headshot: bool, kill: bool, blocked: bool) -> Kind:
	if kill:
		return Kind.KILL
	if headshot:
		return Kind.HEADSHOT
	if blocked:
		return Kind.BLOCKED
	return Kind.HIT


## Mostra o marcador (um mais forte não é trocado por um mais fraco enquanto aparece).
func show_hit(new_kind: Kind) -> void:
	if not (_age < LIFE * 0.5 and PRIORITY[new_kind] < PRIORITY[kind]):
		kind = new_kind
	_age = 0.0
	visible = true
	queue_redraw()


func is_showing() -> bool:
	return _age < LIFE


func _process(delta: float) -> void:
	if _age >= LIFE:
		return
	_age += delta
	if _age >= LIFE:
		visible = false
	queue_redraw()


func _draw() -> void:
	if _age >= LIFE:
		return
	var killed := kind == Kind.KILL
	var blocked := kind == Kind.BLOCKED
	# Começa afastado e maior; encolhe no estouro e some no fim.
	var pop := clampf(_age / POP, 0.0, 1.0)
	var fade := 1.0 - clampf((_age - LIFE * 0.55) / (LIFE * 0.45), 0.0, 1.0)
	var gap := lerpf(10.0, 6.0, pop) * (1.25 if killed else (0.8 if blocked else 1.0))
	var length := (10.0 if killed else (5.0 if blocked else 7.0)) * lerpf(1.3, 1.0, pop)
	var width := 3.0 if killed else 2.0
	var color: Color = COLORS[kind]
	color.a = fade
	var outline := Color(OUTLINE, OUTLINE.a * fade)
	for dir: Vector2 in [Vector2(1, 1), Vector2(-1, 1), Vector2(1, -1), Vector2(-1, -1)]:
		var n := dir.normalized()
		var from := (n * gap).round()
		var to := (n * (gap + length)).round()
		draw_line(from, to, outline, width + 2.0)
		draw_line(from, to, color, width)
