class_name EventSwitch
extends MapPanel
## Painel que encerra um evento pagando (como no jogo web): segurar E durante o Apagão religa a
## energia; durante o Alarme, desliga a sirene. Fora do evento só mostra o estado.

var event_id: StringName
var action_text: String
var idle_text: String
var price: int
var hold_time: float

var _progress := 0.0


## `kind`: "power" (Apagão) ou "alarm" (Alarme de emergência).
func setup(kind: String) -> void:
	var cfg: Dictionary = WorldEventData.shared().interactions.get(kind, {})
	price = int(cfg.get("price", 500))
	hold_time = float(cfg.get("hold_time", 1.0))
	if kind == "power":
		name = "PowerPanel"
		event_id = &"blackout"
		action_text = "RELIGAR A ENERGIA"
		idle_text = "PAINEL DE ENERGIA — FUNCIONANDO"
		build("ENERGIA", Color(1.0, 0.83, 0.35))
	else:
		name = "AlarmPanel"
		event_id = &"emergency_alarm"
		action_text = "DESLIGAR O ALARME"
		idle_text = "ALARME DE EMERGÊNCIA — DESLIGADO"
		build("ALARME", Color(1.0, 0.3, 0.25))


func _active() -> bool:
	var events := world_events()
	return events != null and events.active_id() == event_id


func get_interaction_prompt(_player: Node3D) -> String:
	if not _active():
		_progress = 0.0
		return idle_text
	return "[SEGURE E] %s  ·  %d pontos%s" % [action_text, price, progress_bar(_progress / hold_time)]


func hold_interact(_player: Node3D, delta: float) -> bool:
	if not _active():
		return false
	_progress += delta
	if _progress < hold_time:
		return false
	_progress = 0.0
	if not pay(price):
		return false
	world_events().end_event(event_id)
	SpecialFire.flash(get_tree(), global_position + Vector3.UP, 2.0, Color(0.91, 0.76, 0.29))
	return true
