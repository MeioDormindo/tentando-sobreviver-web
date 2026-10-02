class_name CreditsSign
extends Node3D
## Placa de créditos (segredo, como no jogo web): E mostra o texto na HUD.

var interaction_radius: float = 1.4


func _ready() -> void:
	name = "CreditsSign"
	add_to_group(&"interactable")


func get_interaction_prompt(_player: Node3D) -> String:
	return "[E] LER A PLACA"


func interact(player: Node3D) -> bool:
	# Só para quem leu (em rede, na máquina dele).
	if player is Player:
		(player as Player).hud(&"toast", [WorldEventData.shared().credits])
	else:
		Events.toast.emit(WorldEventData.shared().credits)
	return true
