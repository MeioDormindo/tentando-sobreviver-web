class_name CreditsSign
extends Node3D
## Placa de créditos (segredo, como no jogo web): E mostra o texto na HUD.

var interaction_radius: float = 1.4


func _ready() -> void:
	name = "CreditsSign"
	add_to_group(&"interactable")


func get_interaction_prompt(_player: Node3D) -> String:
	return "[E] LER A PLACA"


func interact(_player: Node3D) -> bool:
	Events.toast.emit(WorldEventData.shared().credits)
	return true
