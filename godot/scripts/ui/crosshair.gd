class_name Crosshair
extends Control
## Mini mira do PC (como nos jogos do gênero): quatro tracinhos e um ponto na posição do mouse.
## Abre com o espalhamento da arma (coice e Ofuscar) e fica vermelha com um inimigo sob a mira.
## A HUD decide quando aparece (não no toque nem com o analógico, nem na pausa ou no fim de jogo).

const COLOR := Color(0.96, 0.95, 0.88)
const ENEMY := Color(1.0, 0.32, 0.25)
const OUTLINE := Color(0.0, 0.0, 0.0, 0.85)
## Pixels de abertura por grau de espalhamento.
const GAP_PER_DEGREE := 2.2

## Espalhamento atual da arma (graus).
var spread := 0.0
## O mouse está sobre um inimigo.
var on_enemy := false


func _ready() -> void:
	name = "Crosshair"
	mouse_filter = Control.MOUSE_FILTER_IGNORE


## Atualiza e redesenha só quando mudou.
func show_state(new_spread: float, enemy: bool) -> void:
	new_spread = snappedf(new_spread, 0.25)
	if new_spread == spread and enemy == on_enemy:
		return
	spread = new_spread
	on_enemy = enemy
	queue_redraw()


func _draw() -> void:
	var gap := 4.0 + spread * GAP_PER_DEGREE
	var length := 7.0
	var color := ENEMY if on_enemy else COLOR
	for dir: Vector2 in [Vector2.RIGHT, Vector2.LEFT, Vector2.UP, Vector2.DOWN]:
		var from := (dir * gap).round()
		var to := (dir * (gap + length)).round()
		draw_line(from, to, OUTLINE, 4.0)
		draw_line(from, to, color, 2.0)
	draw_rect(Rect2(-2.0, -2.0, 4.0, 4.0), OUTLINE)
	draw_rect(Rect2(-1.0, -1.0, 2.0, 2.0), color)
