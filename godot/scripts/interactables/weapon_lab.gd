class_name WeaponLab
extends StaticBody3D
## Weapon Lab (como no jogo web): melhora a arma em mãos para Mk II e depois Mk III.
## Precisa de energia (o PowerSystem entra no próximo bloco; sem ele, funciona sempre).

const SIZE := Vector3(1.6, 1.6, 1.0)
const COLOR := Color(0.61, 0.35, 0.82)

var data: WeaponLabData
var interaction_radius: float = 2.0


func setup(p_data: WeaponLabData) -> void:
	data = p_data
	name = "WeaponLab"
	collision_layer = PhysicsLayers.WORLD
	collision_mask = 0
	var shape := BoxShape3D.new()
	shape.size = SIZE
	var collision := CollisionShape3D.new()
	collision.shape = shape
	collision.position.y = SIZE.y * 0.5
	add_child(collision)
	var box := BoxMesh.new()
	box.size = SIZE
	var material := StandardMaterial3D.new()
	material.albedo_color = COLOR
	material.emission_enabled = true
	material.emission = COLOR * 0.35
	box.material = material
	var mesh := MeshInstance3D.new()
	mesh.mesh = box
	mesh.position.y = SIZE.y * 0.5
	add_child(mesh)
	var light := OmniLight3D.new()
	light.light_color = COLOR
	light.light_energy = 1.5
	light.omni_range = 4.5
	light.position.y = 2.0
	add_child(light)
	add_to_group(&"interactable")


func price_for(level: int) -> int:
	return data.price_mk2 if level == 0 else data.price_mk3


func get_interaction_prompt(player: Node3D) -> String:
	var p := player as Player
	if p == null:
		return ""
	if not _powered():
		return "SEM ENERGIA — ligue o disjuntor"
	var weapon := p.weapon
	if weapon.level >= WeaponUpgrade.MAX_LEVEL:
		return "%s  ·  NÍVEL MÁXIMO" % weapon.data.display_name.to_upper()
	var next := "Mk II" if weapon.level == 0 else "Mk III"
	return "[E] WEAPON LAB: %s → %s  ·  %d pontos" % [weapon.data.display_name.to_upper(), next, price_for(weapon.level)]


func interact(player: Node3D) -> bool:
	var p := player as Player
	if p == null or not _powered():
		return false
	var weapon := p.weapon
	var upgraded := WeaponUpgrade.next_level(weapon.data, weapon.level, data)
	if upgraded == null:
		return false
	var points := get_tree().get_first_node_in_group(&"points_manager") as PointsManager
	if points == null or not points.spend(price_for(weapon.level)):
		Events.purchase_denied.emit()
		return false
	weapon.upgrade_to(upgraded)
	Events.toast.emit("%s!" % upgraded.display_name.to_upper())
	return true


func _powered() -> bool:
	var power := get_tree().get_first_node_in_group(&"power_system")
	return power == null or bool(power.get(&"is_on"))
