class_name WallBuy
extends Node3D
## Compra na parede (como no jogo web / CoD): desenho de giz com o nome e o preço.
## Com uma arma: compra a arma (ou a munição dela, se o jogador já a tiver).
## Sem arma (`weapon_data` nulo): munição da arma em mãos.

const CHALK := Color(0.93, 0.9, 0.82)

var weapon_data: WeaponData
var interaction_radius: float = 1.7

var _label: Label3D


## `wall_normal`: direção da parede para o chão onde o jogador fica.
func setup(p_weapon: WeaponData, wall_normal: Vector3) -> void:
	weapon_data = p_weapon
	name = String(p_weapon.id) if p_weapon else "ammo"
	_label = Label3D.new()
	_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	_label.pixel_size = 0.006
	_label.font_size = 64
	_label.outline_size = 12
	_label.modulate = CHALK
	_label.text = ("%s\n%d" % [p_weapon.display_name.to_upper(), p_weapon.price]) if p_weapon else "MUNIÇÃO"
	# Encostado na parede, na altura dos olhos.
	_label.position = -wall_normal * 0.45 + Vector3.UP * 2.1
	add_child(_label)
	var board := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = Vector3(1.4, 0.9, 0.04)
	board.mesh = mesh
	var material := StandardMaterial3D.new()
	material.albedo_color = Color(CHALK, 0.25)
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	board.material_override = material
	board.position = -wall_normal * 0.52 + Vector3.UP * 1.5
	add_child(board)
	# A face larga do quadro fica voltada para o chão onde o jogador está.
	board.rotation.y = atan2(wall_normal.x, wall_normal.z)
	add_to_group(&"interactable")


func get_interaction_prompt(player: Node3D) -> String:
	var p := player as Player
	if p == null:
		return ""
	if weapon_data == null:
		var current := p.weapon
		if current.is_ammo_full():
			return "MUNIÇÃO CHEIA"
		return "[E] MUNIÇÃO %s  ·  %d pontos" % [current.data.display_name.to_upper(), current.data.ammo_price]
	var owned := p.inventory.find(weapon_data.id)
	if owned:
		if owned.is_ammo_full():
			return "%s  ·  MUNIÇÃO CHEIA" % weapon_data.display_name.to_upper()
		return "[E] MUNIÇÃO %s  ·  %d pontos" % [weapon_data.display_name.to_upper(), weapon_data.ammo_price]
	return "[E] COMPRAR %s  ·  %d pontos" % [weapon_data.display_name.to_upper(), weapon_data.price]


func interact(player: Node3D) -> bool:
	var p := player as Player
	var points := get_tree().get_first_node_in_group(&"points_manager") as PointsManager
	if p == null or points == null:
		return false
	var target: Weapon = p.weapon if weapon_data == null else p.inventory.find(weapon_data.id)
	if target:
		if target.is_ammo_full():
			return false
		if not _pay(points, target.data.ammo_price):
			return false
		target.reset_ammo()
		return true
	if not _pay(points, weapon_data.price):
		return false
	var dropped := p.give_weapon(weapon_data)
	if dropped:
		dropped.queue_free()
	return true


func _pay(points: PointsManager, amount: int) -> bool:
	if points.spend(amount):
		return true
	Events.purchase_denied.emit()
	return false
