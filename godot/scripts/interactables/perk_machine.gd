class_name PerkMachine
extends StaticBody3D
## Máquina de perk (como no jogo web): vende um perk. Precisa de energia, exceto os que
## funcionam sem ela (Quick Revive).

const SIZE := Vector3(1.2, 2.0, 0.9)

var perk: PerkData
var interaction_radius: float = 1.9

var _light: OmniLight3D


func setup(p_perk: PerkData) -> void:
	perk = p_perk
	name = "Perk_" + String(p_perk.id)
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
	material.albedo_color = perk.color
	material.emission_enabled = true
	material.emission = perk.color * 0.3
	box.material = material
	# Máquina em pixel art 2.5D, pintada na cor do perk.
	var model := PropFactory.create("perk_machine", perk.color)
	if model:
		add_child(model)
	else:
		var mesh := MeshInstance3D.new()
		mesh.mesh = box
		mesh.position.y = SIZE.y * 0.5
		add_child(mesh)
	# Logo do perk na vitrine de cima e o nome no letreiro, chapados na frente (-Z).
	var logo_path := "res://assets/web/perks/%s.png" % perk.id
	if ResourceLoader.exists(logo_path):
		var logo := Sprite3D.new()
		logo.texture = load(logo_path)
		logo.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
		logo.pixel_size = 0.5 / float(logo.texture.get_width())
		logo.shaded = false
		logo.alpha_cut = SpriteBase3D.ALPHA_CUT_DISCARD
		logo.position = Vector3(0.0, 1.38, -0.44)
		logo.rotation.y = PI
		add_child(logo)
	var label := Label3D.new()
	label.outline_size = 0  # a fonte pixel já tem o contorno embutido
	label.pixel_size = 0.0034
	label.font_size = 26
	label.modulate = perk.color.lightened(0.5)
	label.text = perk.display_name.to_upper()
	label.position = Vector3(0.0, 2.08, -0.47)
	label.rotation.y = PI
	label.double_sided = false
	add_child(label)
	_light = OmniLight3D.new()
	_light.light_color = perk.color
	_light.light_energy = 1.3
	_light.omni_range = 4.0
	_light.position.y = SIZE.y + 0.3
	add_child(_light)
	add_to_group(&"interactable")


## Luz da máquina (o mapa entrega ao PowerSystem, que a deixa fraca sem energia).
func get_light() -> OmniLight3D:
	return _light


func get_interaction_prompt(player: Node3D) -> String:
	var p := player as Player
	if p == null:
		return ""
	if not _powered():
		return "SEM ENERGIA — ligue o disjuntor"
	if p.perks.has_perk(perk.id):
		return "%s  ·  JÁ ATIVO" % perk.display_name.to_upper()
	if not p.perks.can_buy(perk):
		return "%s  ·  ESGOTADO NESTA PARTIDA" % perk.display_name.to_upper()
	return "[E] %s — %s  ·  %d pontos" % [perk.display_name.to_upper(), perk.description, perk.price]


func interact(player: Node3D) -> bool:
	var p := player as Player
	if p == null or not _powered() or not p.perks.can_buy(perk):
		return false
	var points := get_tree().get_first_node_in_group(&"points_manager") as PointsManager
	if points == null or not points.spend(perk.price):
		Events.purchase_denied.emit()
		return false
	p.perks.grant(perk)
	Events.toast.emit(perk.display_name.to_upper())
	return true


func _powered() -> bool:
	if perk.works_without_power:
		return true
	var power := get_tree().get_first_node_in_group(&"power_system")
	return power == null or bool(power.get(&"is_on"))
