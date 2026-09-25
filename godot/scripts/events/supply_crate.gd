class_name SupplyCrate
extends Node3D
## Caixa de suprimentos (evento): desce de paraquedas e, no chão, segurar E abre (levar dano
## zera a abertura). Fica no grupo do minimapa enquanto espera.

signal opened

var interaction_radius: float = 1.6
var hold_time: float = 3.0
var interrupt_time: float = 0.5
var landed := false
var is_open := false

var _progress := 0.0
var _clock := 0.0
var _crate: MeshInstance3D
var _chute: MeshInstance3D
var _flare: OmniLight3D


func _ready() -> void:
	_crate = EventFx.box(Vector3(1.0, 0.7, 0.8), EventFx.glow(Color(0.33, 0.42, 0.24), 1.0, 0.05))
	_crate.position.y = 0.35
	add_child(_crate)
	var canopy := SphereMesh.new()
	canopy.radius = 1.1
	canopy.height = 0.9
	canopy.is_hemisphere = true
	canopy.material = EventFx.glow(Color(0.9, 0.9, 0.85), 1.0, 0.1)
	_chute = MeshInstance3D.new()
	_chute.mesh = canopy
	_chute.position.y = 2.2
	add_child(_chute)


## Cai de `height` até o chão em `time` segundos.
func fall(height: float, time: float) -> void:
	position.y = height
	var tween := create_tween()
	tween.tween_property(self, "position:y", 0.0, time).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN)
	tween.tween_callback(land)


func land() -> void:
	if landed:
		return
	landed = true
	position.y = 0.0
	add_to_group(&"interactable")
	add_to_group(&"minimap_supply")
	Audio.play_at("evt_crate_land", global_position, "world", 1.0)
	Events.screen_shake.emit(0.15, 0.1)
	var tween := _chute.create_tween()
	tween.tween_property(_chute, "scale", Vector3(1.4, 0.1, 1.4), 0.8)
	tween.tween_callback(_chute.hide)
	_flare = EventFx.light(Color(1.0, 0.29, 0.23), 1.5, 4.0)
	_flare.position = Vector3(0.45, 0.8, 0.0)
	add_child(_flare)


func _process(delta: float) -> void:
	_clock += delta
	if _flare:
		_flare.light_energy = 1.0 + 0.7 * absf(sin(_clock * 6.5))


func get_interaction_prompt(_player: Node3D) -> String:
	if not landed or is_open:
		return ""
	return "[SEGURE E] ABRIR SUPRIMENTOS%s" % MapPanel.progress_bar(_progress / hold_time)


func interact(_player: Node3D) -> bool:
	return false


func hold_interact(player: Node3D, delta: float) -> bool:
	if not landed or is_open:
		return false
	var p := player as Player
	if p and p.hurt_within(interrupt_time):
		_progress = 0.0
		return false
	_progress += delta
	if _progress < hold_time:
		return false
	is_open = true
	remove_from_group(&"interactable")
	remove_from_group(&"minimap_supply")
	opened.emit()
	return true


## Pisca nos últimos segundos antes de sumir.
func blink(on: bool) -> void:
	_crate.visible = on
