class_name ReviveSpot
extends Node3D
## Jogador caído no cooperativo como interagível: o colega mais perto vê "segure E para
## reviver" e enche a barra segurando E. Filho do jogador; só fica no grupo "interactable"
## enquanto ele sangra.

var player: Player
var interaction_radius: float = Player.REVIVE_RADIUS


func get_interaction_prompt(by: Node3D) -> String:
	return player.revive_prompt(by)


func get_interaction_progress(by: Node3D) -> float:
	return player.revive_progress(by)


func interact(_by: Node3D) -> bool:
	return false


func hold_interact(by: Node3D, delta: float) -> bool:
	return player.help_revive(by, delta)
