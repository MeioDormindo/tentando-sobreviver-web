class_name TargetMark
extends Control
## Marcador do alvo da mira automática (celular): quatro cantoneiras em pixel em volta do zumbi
## travado, que fecham um pouco ao travar num alvo novo e ficam vermelhas enquanto se atira nele.
## A HUD posiciona e decide quando aparece (só no toque).

const COLOR := Color(0.96, 0.95, 0.88)
const FIRING := Color(1.0, 0.32, 0.25)
const OUTLINE := Color(0.0, 0.0, 0.0, 0.85)
## Meia largura do quadrado das cantoneiras (px) e o comprimento de cada perna.
const HALF := 18.0
const ARM := 7.0

var firing := false
var _target: Object
## 0..1: a "batida" ao trocar de alvo (as cantoneiras abrem e voltam).
var _snap := 0.0


func _ready() -> void:
	name = "TargetMark"
	mouse_filter = Control.MOUSE_FILTER_IGNORE


func _process(delta: float) -> void:
	if _snap > 0.0:
		_snap = maxf(0.0, _snap - delta * 5.0)
		queue_redraw()


## Atualiza o alvo e o estado (redesenha só quando mudou).
func show_target(target: Object, now_firing: bool) -> void:
	if target != _target:
		_target = target
		_snap = 1.0
	if now_firing != firing:
		firing = now_firing
		queue_redraw()


func _draw() -> void:
	var half := HALF + _snap * 10.0
	var color := FIRING if firing else COLOR
	for corner: Vector2 in [Vector2(-1, -1), Vector2(1, -1), Vector2(1, 1), Vector2(-1, 1)]:
		var at := (corner * half).round()
		for leg: Vector2 in [Vector2(-corner.x, 0.0), Vector2(0.0, -corner.y)]:
			var to := (at + leg * ARM).round()
			draw_line(at, to, OUTLINE, 4.0)
			draw_line(at, to, color, 2.0)
