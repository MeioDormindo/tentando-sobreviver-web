class_name MysteryBox
extends StaticBody3D
## Mystery Box (como no jogo web): paga, a roleta gira e a arma sorteada fica disponível
## por alguns segundos. Depois de alguns usos no mesmo lugar, some e reaparece em outro
## ponto do mapa. Sorteio: primeiro a raridade (pelos pesos), depois uma arma dela.

enum State { IDLE, ROLLING, READY, MOVING }

const SIZE := Vector3(2.0, 0.9, 1.1)
const COLOR := Color(0.62, 0.47, 0.16)
const RARITY_ORDER: Array[StringName] = [&"common", &"uncommon", &"rare", &"epic", &"legendary"]
const RARITY_COLORS := {
	&"common": Color(0.84, 0.84, 0.82), &"uncommon": Color(0.48, 0.84, 0.48), &"rare": Color(0.35, 0.66, 1.0),
	&"epic": Color(0.73, 0.55, 1.0), &"legendary": Color(1.0, 0.7, 0.28),
}

var data: MysteryBoxData
var catalog: WeaponCatalog
var map_id: String = ""
var state: State = State.IDLE
var result: WeaponData
var uses: int = 0
var interaction_radius: float = 2.3
## Preço atual (o Fire Sale muda).
var price: int = 0

var _spots: Array[Vector3] = []
var _world: GameWorld
var _label: Label3D
var _mesh: MeshInstance3D
var _timer := 0.0
var _cycle := 0.0


func setup(p_data: MysteryBoxData, p_catalog: WeaponCatalog, p_map_id: String, spots: Array[Vector3], world: GameWorld) -> void:
	data = p_data
	catalog = p_catalog
	map_id = p_map_id
	_spots = spots
	_world = world
	price = data.price
	name = "MysteryBox"
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
	material.emission = COLOR * 0.25
	box.material = material
	_mesh = MeshInstance3D.new()
	_mesh.mesh = box
	_mesh.position.y = SIZE.y * 0.5
	add_child(_mesh)
	_label = Label3D.new()
	_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	_label.pixel_size = 0.006
	_label.font_size = 56
	_label.outline_size = 12
	_label.position.y = 2.0
	_label.text = "?"
	add_child(_label)
	var light := OmniLight3D.new()
	light.light_color = Color(1.0, 0.82, 0.48)
	light.light_energy = 1.4
	light.omni_range = 4.0
	light.position.y = 1.5
	add_child(light)
	add_to_group(&"interactable")


func _process(delta: float) -> void:
	match state:
		State.ROLLING:
			_timer -= delta
			_cycle -= delta
			if _cycle <= 0.0:
				_cycle = 0.08 + (data.roll_time - _timer) * 0.05  # desacelera
				var any := catalog.weapons.pick_random() as WeaponData
				_label.text = any.display_name.to_upper()
				_label.modulate = Color.WHITE
			if _timer <= 0.0:
				_reveal()
		State.READY:
			_timer -= delta
			if _timer <= 0.0:
				_reset()


func get_interaction_prompt(player: Node3D) -> String:
	match state:
		State.IDLE:
			return "[E] MYSTERY BOX  ·  %d pontos" % price
		State.READY:
			var p := player as Player
			var owned := p != null and p.inventory.owns(result.id)
			return "[E] PEGAR %s%s" % [result.display_name.to_upper(), " (MUNIÇÃO)" if owned else ""]
	return ""


func interact(player: Node3D) -> bool:
	var p := player as Player
	if p == null:
		return false
	match state:
		State.IDLE:
			var points := get_tree().get_first_node_in_group(&"points_manager") as PointsManager
			if points == null or not points.spend(price):
				Events.purchase_denied.emit()
				return false
			_roll()
			return true
		State.READY:
			var dropped := p.give_weapon(result)
			if dropped:
				dropped.queue_free()
			_reset()
			return true
	return false


## Sorteio (função pura): raridade pelos pesos, depois uma arma dela que possa sair neste
## mapa. Se a raridade não tiver arma, desce até achar.
static func roll_weapon(p_catalog: WeaponCatalog, weights: Dictionary, p_map_id: String, rng: RandomNumberGenerator) -> WeaponData:
	var total := 0.0
	for rarity in RARITY_ORDER:
		total += float(weights.get(rarity, 0))
	var pick := rng.randf() * total
	var chosen := 0
	for i in RARITY_ORDER.size():
		pick -= float(weights.get(RARITY_ORDER[i], 0))
		if pick < 0.0:
			chosen = i
			break
	for i in range(chosen, -1, -1):
		var pool: Array[WeaponData] = []
		for weapon: WeaponData in p_catalog.weapons:
			if weapon.rarity == RARITY_ORDER[i] and (weapon.maps.is_empty() or weapon.maps.has(p_map_id)):
				pool.append(weapon)
		if not pool.is_empty():
			return pool[rng.randi_range(0, pool.size() - 1)]
	return p_catalog.weapons[0]


func _roll() -> void:
	state = State.ROLLING
	uses += 1
	var rng := RandomNumberGenerator.new()
	rng.randomize()
	result = roll_weapon(catalog, data.rarity_weights, map_id, rng)
	_timer = data.roll_time
	_cycle = 0.0


func _reveal() -> void:
	state = State.READY
	_timer = data.take_time
	_label.text = result.display_name.to_upper()
	_label.modulate = RARITY_COLORS.get(result.rarity, Color.WHITE)


func _reset() -> void:
	state = State.IDLE
	result = null
	_label.text = "?"
	_label.modulate = Color.WHITE
	if uses >= data.uses_before_move:
		_move_away()


## Some e reaparece em outro ponto (qualquer um, mesmo em área fechada, como no jogo web).
func _move_away() -> void:
	var options := _spots.filter(func(p: Vector3) -> bool: return p.distance_to(global_position) > 1.0)
	uses = 0
	if options.is_empty():
		return
	var spot: Vector3 = options.pick_random()
	state = State.MOVING
	remove_from_group(&"interactable")
	var tween := create_tween()
	tween.tween_property(_mesh, "position:y", SIZE.y * 0.5 + 1.5, data.move_out_time)
	tween.tween_callback(func() -> void:
		visible = false
		collision_layer = 0)
	tween.tween_interval(data.move_gap_time)
	tween.tween_callback(func() -> void: _appear_at(spot))
	var area := _world.area_of(spot) if _world else &""
	Events.toast.emit("A MYSTERY BOX MUDOU DE LUGAR — %s" % _world.area_display_name(area).to_upper() if area != &"" else "A MYSTERY BOX MUDOU DE LUGAR")


func _appear_at(spot: Vector3) -> void:
	global_position = spot
	_mesh.position.y = SIZE.y * 0.5
	visible = true
	collision_layer = PhysicsLayers.WORLD
	state = State.IDLE
	add_to_group(&"interactable")
