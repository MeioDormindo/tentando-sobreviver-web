class_name QuestSystem
extends Node
## Missão principal genérica (como no jogo web): uma lista de etapas em ordem. Envia o estado
## para a HUD (Events.quest_state) e marca o objetivo no minimapa (grupo "minimap_objective").

var title: String = ""
var steps: Array[QuestStep] = []
## Etapa atual (0 = primeira; -1 = não começou).
var index: int = -1
var done: bool = false

var _on_complete: Callable
var _last_text := ""
var _marker: Node3D


func begin(p_title: String, p_steps: Array[QuestStep], on_complete: Callable) -> void:
	title = p_title
	steps = p_steps
	_on_complete = on_complete
	_marker = Node3D.new()
	_marker.name = "QuestObjective"
	add_child(_marker)
	index = -1
	done = false
	_advance()


func _physics_process(delta: float) -> void:
	if done or index < 0:
		return
	var step := steps[index]
	if step.update.call(delta):
		if step.exit.is_valid():
			step.exit.call()
		_advance()
		return
	_emit()
	_update_marker()


func current_target() -> Variant:
	return null if done or index < 0 else steps[index].target.call()


func _advance() -> void:
	index += 1
	if index >= steps.size():
		done = true
		_marker.remove_from_group(&"minimap_objective")
		Events.quest_state.emit({})
		if _on_complete.is_valid():
			_on_complete.call()
		return
	if steps[index].enter.is_valid():
		steps[index].enter.call()
	_emit(true)
	_update_marker()


func _emit(force := false) -> void:
	var text: String = steps[index].objective.call()
	if not force and text == _last_text:
		return
	_last_text = text
	Events.quest_state.emit({"title": title, "objective": text, "step": index + 1, "total": steps.size()})


func _update_marker() -> void:
	var target: Variant = current_target()
	if target is Vector3:
		_marker.global_position = target
		if not _marker.is_in_group(&"minimap_objective"):
			_marker.add_to_group(&"minimap_objective")
	elif _marker.is_in_group(&"minimap_objective"):
		_marker.remove_from_group(&"minimap_objective")
