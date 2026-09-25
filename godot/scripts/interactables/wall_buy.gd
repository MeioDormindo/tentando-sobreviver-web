class_name WallBuy
extends Node3D
## Compra na parede (como no jogo web / CoD): desenho de giz com o nome e o preço.
## Com uma arma: compra a arma (ou a munição dela, se o jogador já a tiver).
## Sem arma (`weapon_data` nulo): munição da arma em mãos.

const CHALK := Color(0.93, 0.9, 0.82)

var weapon_data: WeaponData
var interaction_radius: float = 1.7

var _label: Label3D


## `wall_normal`: direção da parede para o chão onde o jogador fica. Tudo fica chapado na face
## da parede (quadro-negro, desenho de giz da arma e o nome com o preço), com o shader da
## decoração: some junto com o recorte da parede quando o jogador passa atrás.
func setup(p_weapon: WeaponData, wall_normal: Vector3) -> void:
	weapon_data = p_weapon
	name = String(p_weapon.id) if p_weapon else "ammo"
	# Face da parede: o nó fica no centro do tile do chão, a meio metro dela.
	var face := -wall_normal * 0.5
	var turn := atan2(wall_normal.x, wall_normal.z)
	_flat_quad("res://assets/sprites/chalk/chalkboard.png", face + wall_normal * 0.012 + Vector3.UP * 1.55, turn, 1.0 / 48.0)
	var drawing := "res://assets/sprites/chalk/chalk_%s.png" % (p_weapon.id if p_weapon else &"ammo")
	_flat_quad(drawing, face + wall_normal * 0.02 + Vector3.UP * 1.75, turn, 1.0 / 44.0 if p_weapon else 1.0 / 40.0)
	_label = Label3D.new()
	_label.billboard = BaseMaterial3D.BILLBOARD_DISABLED
	_label.double_sided = false
	_label.pixel_size = 0.0045
	_label.font_size = 26
	_label.modulate = CHALK
	_label.text = ("%s  %d" % [p_weapon.display_name.to_upper(), p_weapon.price]) if p_weapon else "MUNIÇÃO"
	_label.position = face + wall_normal * 0.025 + Vector3.UP * 1.26
	_label.rotation.y = turn
	add_child(_label)
	add_to_group(&"interactable")


## Quadro chapado na parede com o shader da decoração (pixels nítidos e o recorte da parede).
func _flat_quad(path: String, at: Vector3, turn: float, pixel_size: float) -> void:
	if not ResourceLoader.exists(path):
		return
	var texture := load(path) as Texture2D
	var quad := QuadMesh.new()
	quad.size = Vector2(texture.get_width(), texture.get_height()) * pixel_size
	var node := MeshInstance3D.new()
	node.mesh = quad
	node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var material := ShaderMaterial.new()
	material.shader = load("res://shaders/decor.gdshader")
	material.set_shader_parameter(&"tex", texture)
	node.material_override = material
	add_child(node)
	node.position = at
	node.rotation.y = turn


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
		Events.weapon_dropped.emit(dropped, p.global_position)
	return true


func _pay(points: PointsManager, amount: int) -> bool:
	if points.spend(amount):
		return true
	Events.purchase_denied.emit()
	return false
