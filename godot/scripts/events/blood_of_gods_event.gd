class_name BloodOfGodsEvent
extends WorldEvent
## Sangue dos Deuses (Templo): durante este round os altares de bênção dão a bênção de graça.


func _init() -> void:
	id = &"blood_of_gods"
	at_round_start = true
	ends_with_round = true


func can_start() -> bool:
	return TempleEvents.in_temple(system) and not system.get_tree().get_nodes_in_group(&"blessing_altars").is_empty()


func start() -> void:
	var number := system.round_manager.round_number if system.round_manager else 0
	BlessingAltar.current_round = number
	BlessingAltar.free_round = number
	for altar in system.get_tree().get_nodes_in_group(&"blessing_altars"):
		SpecialFire.flash(system.get_tree(), (altar as Node3D).global_position + Vector3.UP * 1.5, 2.0, Color(1.0, 0.3, 0.25))


func end() -> void:
	BlessingAltar.free_round = -1
