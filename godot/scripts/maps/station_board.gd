class_name StationBoard
extends Node3D
## Detalhes vivos da estação (como no jogo web): bocas de túnel nas pontas dos trilhos,
## semáforos (verde; vermelho piscando no aviso e aceso com o trem passando) e o painel de
## horários com a contagem do próximo trem.

const RED := Color(1.0, 0.2, 0.13)
const GREEN := Color(0.24, 1.0, 0.42)
const AMBER := Color(1.0, 0.69, 0.19)
const BLINK := 0.26

var countdown_from: float = 30.0

var _signals: Array[Dictionary] = []
var _board: Label3D
var _clock := 0.0


## `station`: dicionário do mapa (lane, span, tunnels, signals, board), em tiles = m.
func setup(station: Dictionary) -> void:
	name = "StationBoard"
	countdown_from = float(WorldEventData.shared().config(&"station").get("countdown_from_time", 30.0))
	var dark := EventFx.glow(Color(0.02, 0.02, 0.025), 1.0, 0.0)
	for tunnel: Dictionary in station.get("tunnels", []):
		for x: float in [float(station.span.from) - 1.0, float(station.span.to) + 1.0]:
			var mouth := EventFx.box(Vector3(2.0, 3.2, float(tunnel.h)), dark)
			mouth.position = Vector3(x, 1.6, float(tunnel.y) + float(tunnel.h) * 0.5)
			add_child(mouth)
	for spot: Dictionary in station.get("signals", []):
		var pole := Node3D.new()
		pole.position = Vector3(float(spot.tx), 0.0, float(spot.ty))
		add_child(pole)
		pole.add_child(EventFx.box(Vector3(0.12, 2.2, 0.12), EventFx.glow(Color(0.2, 0.2, 0.2), 1.0, 0.0)))
		(pole.get_child(0) as Node3D).position.y = 1.1
		var red := _lens(RED, 2.35)
		var green := _lens(GREEN, 2.05)
		pole.add_child(red)
		pole.add_child(green)
		var light := EventFx.light(GREEN, 0.8, 2.5)
		light.position.y = 2.2
		pole.add_child(light)
		_signals.append({"red": red, "green": green, "light": light})
	var board: Dictionary = station.get("board", {})
	if not board.is_empty():
		var panel := EventFx.box(Vector3(2.4, 0.6, 0.12), dark)
		panel.position = Vector3(float(board.tx), 2.4, float(board.ty))
		add_child(panel)
		_board = Label3D.new()
		_board.name = "Departures"
		_board.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		_board.pixel_size = 0.004
		_board.font_size = 40
		_board.outline_size = 6
		_board.modulate = AMBER
		_board.position = panel.position + Vector3(0, 0.05, 0.1)
		add_child(_board)


func _lens(color: Color, height: float) -> MeshInstance3D:
	var sphere := SphereMesh.new()
	sphere.radius = 0.1
	sphere.height = 0.2
	sphere.material = EventFx.glow(color, 1.0, 2.0)
	var lens := MeshInstance3D.new()
	lens.mesh = sphere
	lens.position.y = height
	return lens


func _process(delta: float) -> void:
	_clock += delta
	var events := get_tree().get_first_node_in_group(&"world_events") as WorldEventSystem
	var status := events.train_status() if events else {"state": "none", "time": 0.0}
	var state := String(status.state)
	var blink_on := int(_clock / BLINK) % 2 == 0
	var red := state == "passing" or (state == "warning" and blink_on)
	for s in _signals:
		(s.red as Node3D).visible = red
		(s.green as Node3D).visible = state == "none" or state == "scheduled"
		(s.light as OmniLight3D).light_color = RED if red or state == "warning" else GREEN
		(s.light as OmniLight3D).light_energy = 0.2 if state == "warning" and not blink_on else 0.8
	if _board:
		_board.text = board_text(state, float(status.time), blink_on)


func board_text(state: String, time: float, blink_on: bool) -> String:
	match state:
		"passing":
			return "TREM PASSANDO"
		"warning":
			return "⚠ TREM CHEGANDO" if blink_on else ""
		"scheduled":
			return "PRÓXIMO TREM %ds" % ceili(time) if time <= countdown_from else "PRÓXIMO TREM EM BREVE"
	return "SEM PREVISÃO"
