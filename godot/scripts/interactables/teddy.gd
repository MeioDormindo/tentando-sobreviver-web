class_name Teddy
extends Node3D
## Ursinho escondido (segredo, como no jogo web): pegar todos na mesma partida solta um Golden
## Drop e libera a conquista "Ursinhos" (e o segredo fica salvo).

const GLOW := Color(1.0, 0.78, 0.88)

var interaction_radius: float = 1.3


func _ready() -> void:
	add_to_group(&"interactable")
	add_to_group(&"teddies")
	var fur := StandardMaterial3D.new()
	fur.albedo_color = Color(0.55, 0.38, 0.24)
	fur.emission_enabled = true
	fur.emission = GLOW * 0.08
	for part: Array in [[0.22, Vector3(0, 0.22, 0)], [0.16, Vector3(0, 0.5, 0)], [0.06, Vector3(-0.12, 0.64, 0)], [0.06, Vector3(0.12, 0.64, 0)]]:
		var sphere := SphereMesh.new()
		sphere.radius = part[0]
		sphere.height = part[0] * 2.0
		sphere.material = fur
		var mesh := MeshInstance3D.new()
		mesh.mesh = sphere
		mesh.position = part[1]
		add_child(mesh)
	rotation.y = randf_range(-0.6, 0.6)


func get_interaction_prompt(_player: Node3D) -> String:
	return "[E] PEGAR O URSINHO"


func interact(player: Node3D) -> bool:
	if is_queued_for_deletion():
		return false
	var total: int = get_meta(&"total", 3)
	remove_from_group(&"interactable")
	remove_from_group(&"teddies")
	var left := get_tree().get_nodes_in_group(&"teddies").size()
	var found := total - left
	Events.teddy_found.emit(found, total)
	if left > 0:
		Events.toast.emit("URSINHO %d/%d" % [found, total])
	else:
		var first := not bool(Save.data.secrets.get("teddies", false))
		Save.discover("teddies")
		var power_ups := get_tree().get_first_node_in_group(&"power_ups") as PowerUpSystem
		if power_ups:
			power_ups.spawn_drop(&"golden", player.global_position - player.global_basis.z * 1.3)
		Events.power_up_collected.emit(&"teddies", "SEGREDO DOS URSINHOS", GLOW,
			"Você achou todos! Segredo salvo." if first else "Todos os ursinhos de novo!")
	var tween := create_tween()
	tween.tween_property(self, "scale", Vector3.ONE * 1.6, 0.3)
	tween.parallel().tween_property(self, "rotation:y", rotation.y + 3.5, 0.3)
	tween.tween_callback(queue_free)
	return true
