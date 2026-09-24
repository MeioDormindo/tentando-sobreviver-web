class_name HazardPool
extends Node3D
## Poça de ácido (Cuspidor) ou nuvem de gás (Rastejante), como no jogo web: fere o jogador
## enquanto ele estiver dentro e some depois de um tempo.

var radius: float = 1.4
var dps: float = 12.0
var duration: float = 3.5

var _left := 0.0
var _material: StandardMaterial3D


## `params`: radius, duration_time, dps (como exportado do jogo web).
func setup(params: Dictionary, color: Color) -> void:
	radius = float(params.get("radius", radius))
	dps = float(params.get("dps", dps))
	duration = float(params.get("duration_time", duration))
	_left = duration
	var mesh := CylinderMesh.new()
	mesh.top_radius = radius
	mesh.bottom_radius = radius
	mesh.height = 0.05
	_material = StandardMaterial3D.new()
	_material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_material.albedo_color = Color(color, 0.45)
	mesh.material = _material
	var visual := MeshInstance3D.new()
	visual.mesh = mesh
	visual.position.y = 0.04
	add_child(visual)
	add_to_group(&"hazards")


func _physics_process(delta: float) -> void:
	_left -= delta
	if _left <= 0.0:
		queue_free()
		return
	_material.albedo_color.a = 0.45 * clampf(_left / 0.8, 0.0, 1.0)
	for node in get_tree().get_nodes_in_group(&"player"):
		var player := node as CharacterBase
		if player == null or not player.is_alive():
			continue
		var offset := player.global_position - global_position
		offset.y = 0.0
		if offset.length() <= radius:
			player.take_damage(DamageInfo.new(dps * delta, DamageInfo.Kind.ENVIRONMENT, self, false, global_position))
