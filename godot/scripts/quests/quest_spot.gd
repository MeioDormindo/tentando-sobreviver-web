class_name QuestSpot
extends Node3D
## Ponto da missão (como no jogo web): tocar ou segurar E para concluir. Um anel amarelo
## pulsando marca o objetivo enquanto ele está disponível.

const GOLD := Color(1.0, 0.83, 0.35)

## Texto quando está disponível (sem o "[E]"/"[SEGURE E]").
var label: String = ""
## Texto quando ainda não pode ser usado ("" = nada na HUD).
var locked_label: String = ""
## () -> bool: pode ser usado agora? (inválido = sempre)
var enabled: Callable
## Segurar E por este tempo (s); 0 = tocar E.
var hold_time: float = 0.0
var on_done: Callable
## Some ao ser usado (item que se pega: fragmento, chave).
var vanish_on_done := false
var interaction_radius: float = 1.6
var used := false

var _progress := 0.0
var _ring: Sprite3D
var _clock := 0.0


static func create(p_label: String, at: Vector3, p_on_done: Callable, p_hold_time := 0.0) -> QuestSpot:
	var spot := QuestSpot.new()
	spot.label = p_label
	spot.on_done = p_on_done
	spot.hold_time = p_hold_time
	spot.position = at
	return spot


func _ready() -> void:
	add_to_group(&"interactable")
	add_to_group(&"quest_spots")
	_ring = EventFx.disc(GOLD, 0.7, 0.35)
	add_child(_ring)


## Objeto no lugar (geladeira, cartão, frasco...): a arte em pixel quando houver (art), senão
## uma caixa na cor dada.
func add_prop(size: Vector3, color: Color, glow := 0.1, art: Node3D = null) -> Node3D:
	if art:
		add_child(art)
		return art
	var prop := EventFx.box(size, EventFx.glow(color, 1.0, glow))
	prop.position.y = size.y * 0.5
	add_child(prop)
	return prop


func available() -> bool:
	return not used and (not enabled.is_valid() or bool(enabled.call()))


func _process(delta: float) -> void:
	_clock += delta
	_ring.visible = available()
	_ring.scale = Vector3.ONE * (1.0 + 0.2 * sin(_clock * 4.0))


func get_interaction_prompt(_player: Node3D) -> String:
	if used:
		return ""
	if not available():
		return locked_label
	if hold_time > 0.0:
		return "[SEGURE E] %s%s" % [label, MapPanel.progress_bar(_progress / hold_time)]
	return "[E] " + label


func interact(_player: Node3D) -> bool:
	if hold_time > 0.0 or not available():
		return false
	finish()
	return true


func hold_interact(_player: Node3D, delta: float) -> bool:
	if hold_time <= 0.0 or not available():
		return false
	_progress += delta
	if _progress < hold_time:
		return false
	finish()
	return true


func finish() -> void:
	if used:
		return
	used = true
	remove_from_group(&"interactable")
	if on_done.is_valid():
		on_done.call()
	if vanish_on_done and is_inside_tree():
		SpecialFire.flash(get_tree(), global_position + Vector3.UP * 0.8, 1.0, Color(0.7, 0.6, 1.0))
		var tween := create_tween()
		tween.tween_property(self, "scale", Vector3.ONE * 0.05, 0.25)
		tween.tween_callback(queue_free)
