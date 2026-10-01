class_name EventSwitch
extends MapPanel
## Painel que encerra um evento pagando (como no jogo web): segurar E durante o Apagão religa a
## energia; durante o Alarme, desliga a sirene. Fora do evento só mostra o estado.

var event_id: StringName
var action_text: String
var idle_text: String
var price: int
var hold_time: float

var _progress := HoldProgress.new()


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
		build("ENERGIA", Color(1.0, 0.83, 0.35), "panel_power")
	else:
		name = "AlarmPanel"
		event_id = &"emergency_alarm"
		action_text = "DESLIGAR O ALARME"
		idle_text = "ALARME DE EMERGÊNCIA — DESLIGADO"
		build("ALARME", Color(1.0, 0.3, 0.25), "panel_alarm")


func _active() -> bool:
	var events := world_events()
	return events != null and events.is_running(event_id)


func get_interaction_prompt(_player: Node3D) -> String:
	if not _active():
		_progress.reset()
		return idle_text
	return "[SEGURE E] %s  ·  %d pontos" % [action_text, price]


func get_interaction_progress(player: Node3D) -> float:
	return _progress.of(player) / hold_time if _active() else -1.0


func hold_interact(player: Node3D, delta: float) -> bool:
	if not _active():
		return false
	if _progress.add(player, delta) < hold_time:
		return false
	_progress.reset()
	if not pay(price, player):
		return false
	world_events().end_event(event_id)
	SpecialFire.flash(get_tree(), global_position + Vector3.UP, 2.0, Color(0.91, 0.76, 0.29))
	return true
