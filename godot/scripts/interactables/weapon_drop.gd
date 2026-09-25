class_name WeaponDrop
extends Node3D
## Arma largada no chão ao pegar outra com os dois espaços cheios (como no jogo web). Guarda o
## próprio objeto Weapon (munição, Mk); pegar de volta troca pela arma em mãos, que cai no
## lugar. Some em 60s, piscando nos últimos 10.

const LIFETIME := 60.0
const BLINK_AT := 50.0

var weapon: Weapon
var interaction_radius: float = 1.4
var age: float = 0.0

var _model: Node3D


## Cria a arma no chão perto de `at` (chamado por quem ouve Events.weapon_dropped).
static func spawn(tree: SceneTree, p_weapon: Weapon, at: Vector3) -> WeaponDrop:
	var drop := WeaponDrop.new()
	drop.weapon = p_weapon
	drop.name = "WeaponDrop_" + String(p_weapon.data.id)
	var angle := randf() * TAU
	drop.position = Vector3(at.x + cos(angle) * 0.7, 0.0, at.z + sin(angle) * 0.7)
	SpecialFire.world_root(tree).add_child(drop)
	return drop


func _ready() -> void:
	_model = Node3D.new()
	_model.rotation.y = randf_range(-0.6, 0.6)
	add_child(_model)
	# O ícone da arma em pixel art (com o acabamento do Mk), deitado no chão, com um anel
	# de brilho embaixo; sem o ícone, uma silhueta simples.
	var icon_path := "res://assets/sprites/icons/%s.png" % Player.gun_sheet(weapon.data.id, weapon.level) if weapon else ""
	if icon_path != "" and ResourceLoader.exists(icon_path):
		var icon := Sprite3D.new()
		icon.texture = load(icon_path)
		icon.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
		icon.axis = Vector3.AXIS_Y
		icon.double_sided = true
		icon.alpha_cut = SpriteBase3D.ALPHA_CUT_DISCARD
		icon.pixel_size = 0.9 / float(icon.texture.get_width())
		icon.position.y = 0.06
		_model.add_child(icon)
		var ring := PixelShapes.flat("ring", Color(1.0, 0.91, 0.66, 0.6), 0.6)
		add_child(ring)
	else:
		var material := StandardMaterial3D.new()
		material.albedo_color = Color(0.2, 0.2, 0.22)
		material.emission_enabled = true
		material.emission = Color(1.0, 0.91, 0.66) * 0.35
		for part: Array in [[Vector3(0.7, 0.12, 0.14), Vector3(0, 0.12, 0)], [Vector3(0.14, 0.2, 0.1), Vector3(-0.2, 0.06, 0)]]:
			var mesh := BoxMesh.new()
			mesh.size = part[0]
			mesh.material = material
			var piece := MeshInstance3D.new()
			piece.mesh = mesh
			piece.position = part[1]
			_model.add_child(piece)
	var light := OmniLight3D.new()
	light.light_color = Color(1.0, 0.91, 0.66)
	light.light_energy = 0.8
	light.omni_range = 1.8
	light.position.y = 0.5
	add_child(light)
	add_to_group(&"interactable")
	add_to_group(&"weapon_drops")


func _process(delta: float) -> void:
	age += delta
	if age >= LIFETIME:
		_remove(true)
		return
	if age >= BLINK_AT:
		_model.visible = int(age * 5.0) % 2 == 0


func get_interaction_prompt(player: Node3D) -> String:
	var p := player as Player
	if p == null or p.inventory.owns(weapon.data.id):
		return ""
	var left := ceili(LIFETIME - age)
	if p.inventory.weapons.size() < p.inventory.slots:
		return "[E] PEGAR %s  ·  %ds" % [weapon.data.display_name.to_upper(), left]
	return "[E] PEGAR %s (troca por %s)  ·  %ds" % [weapon.data.display_name.to_upper(), p.weapon.data.display_name.to_upper(), left]


func interact(player: Node3D) -> bool:
	var p := player as Player
	if p == null or p.inventory.owns(weapon.data.id) or is_queued_for_deletion():
		return false
	var taken := weapon
	_remove(false)
	var dropped := p.inventory.take_back(taken)
	if dropped:
		Events.weapon_dropped.emit(dropped, p.global_position)
	return true


func _remove(free_weapon: bool) -> void:
	remove_from_group(&"interactable")
	if free_weapon and weapon and not weapon.is_inside_tree():
		weapon.queue_free()
	weapon = null
	queue_free()
