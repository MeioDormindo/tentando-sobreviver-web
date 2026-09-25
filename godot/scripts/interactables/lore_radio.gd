class_name LoreRadio
extends Node3D
## Rádio velho / gravador (segredo, como no jogo web): segurar E sintoniza uma transmissão com
## a história do mapa; cada uso mostra a próxima mensagem.

const BUSY_TIME := 6.0

var interaction_radius: float = 1.5
var label: String = "SINTONIZAR O RÁDIO"
var hold_time: float = 0.9
var messages: PackedStringArray = []

var _next := 0
var _busy := 0.0
var _progress := 0.0


func setup(p_label: String, p_hold_time: float, p_messages: PackedStringArray) -> void:
	label = p_label
	hold_time = p_hold_time
	messages = p_messages
	name = "Radio"


func _ready() -> void:
	add_to_group(&"interactable")
	var dial := OmniLight3D.new()
	dial.light_color = Color(1.0, 0.7, 0.3)
	dial.light_energy = 0.4
	dial.omni_range = 1.2
	dial.position.y = 0.4
	add_child(dial)
	# Rádio velho (arte do jogo web, de frente); sem ela, uma caixa.
	var art := PixelShapes.standing("res://assets/web/props/radio.png", 64.0)
	if art:
		add_child(art)
		return
	var box := BoxMesh.new()
	box.size = Vector3(0.55, 0.32, 0.22)
	var material := StandardMaterial3D.new()
	material.albedo_color = Color(0.36, 0.26, 0.18)
	box.material = material
	var mesh := MeshInstance3D.new()
	mesh.mesh = box
	mesh.position.y = 0.16
	add_child(mesh)


func _process(delta: float) -> void:
	_busy = maxf(0.0, _busy - delta)


func get_interaction_prompt(_player: Node3D) -> String:
	if _busy > 0.0:
		return "RÁDIO — CHIADO..."
	return "[SEGURE E] %s%s" % [label, MapPanel.progress_bar(_progress / hold_time)]


func interact(_player: Node3D) -> bool:
	return false


func hold_interact(_player: Node3D, delta: float) -> bool:
	if _busy > 0.0 or messages.is_empty():
		return false
	_progress += delta
	if _progress < hold_time:
		return false
	_progress = 0.0
	_busy = BUSY_TIME
	Audio.play_at("radio_static", global_position, "world", 0.9, -1.0, 0.0)
	Events.toast.emit(messages[_next % messages.size()])
	_next += 1
	return true
