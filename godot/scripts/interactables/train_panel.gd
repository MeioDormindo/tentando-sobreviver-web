class_name TrainPanel
extends MapPanel
## Painel da Plataforma (como no jogo web): paga para o trem passar agora; depois recarrega.

var price: int
var cooldown: float

var _ready_in := 0.0


func setup() -> void:
	var cfg: Dictionary = WorldEventData.shared().interactions.get("train", {})
	price = int(cfg.get("price", 1500))
	cooldown = float(cfg.get("cooldown_time", 90.0))
	name = "TrainPanel"
	build("TREM", Color(1.0, 0.75, 0.29), "panel_train")


func _process(delta: float) -> void:
	_ready_in = maxf(0.0, _ready_in - delta)


func get_interaction_prompt(_player: Node3D) -> String:
	if _ready_in > 0.0:
		return "PAINEL DO TREM — DISPONÍVEL EM %ds" % ceili(_ready_in)
	return "[E] CHAMAR O TREM  ·  %d pontos" % price


func interact(_player: Node3D) -> bool:
	var events := world_events()
	if _ready_in > 0.0 or events == null or not pay(price):
		return false
	if not events.call_train():
		# Trem já passando (ou Plataforma fechada): devolve o dinheiro.
		points().add(price, false)
		Events.toast.emit("O TREM NÃO PODE VIR AGORA")
		return false
	_ready_in = cooldown
	return true
