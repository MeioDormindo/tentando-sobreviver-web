class_name GasValve
extends Node3D
## Válvula do cano rompido (vazamento de gás): segurar E fecha o gás (grátis).

var interaction_radius: float = 1.9
var hold_time: float = 1.5
var closed := false

var _progress := 0.0


func _ready() -> void:
	add_to_group(&"interactable")
	# Cano rompido com a válvula vermelha (PropFactory); sem a arte, caixas.
	var art := PropFactory.create("gas_pipe")
	if art:
		add_child(art)
		return
	add_child(EventFx.box(Vector3(1.4, 0.3, 0.3), EventFx.glow(Color(0.35, 0.38, 0.33), 1.0, 0.0)))
	var wheel := EventFx.box(Vector3(0.1, 0.45, 0.45), EventFx.glow(Color(0.8, 0.2, 0.15), 1.0, 0.2))
	wheel.position = Vector3(0.0, 0.35, 0.0)
	add_child(wheel)


func get_interaction_prompt(_player: Node3D) -> String:
	return "" if closed else "[SEGURE E] FECHAR A VÁLVULA"


func get_interaction_progress(_player: Node3D) -> float:
	return -1.0 if closed else _progress / hold_time


func interact(_player: Node3D) -> bool:
	return false


func hold_interact(_player: Node3D, delta: float) -> bool:
	if closed:
		return false
	_progress += delta
	if _progress < hold_time:
		return false
	closed = true
	remove_from_group(&"interactable")
	return true
