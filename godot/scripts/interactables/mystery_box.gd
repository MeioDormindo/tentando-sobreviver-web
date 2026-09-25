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
## Elemento que veio junto com a arma sorteada ("" = nenhum): qualquer um dos seis, em qualquer
## arma, até nas que não têm elemento na parede e nas especiais.
var result_element: StringName = &""
## Chance de a arma da caixa já vir com um elemento.
const ELEMENT_CHANCE := 0.3
var uses: int = 0
var interaction_radius: float = 2.3
## Preço atual (o Fire Sale muda).
var price: int = 0
## Caixa extra do Fire Sale: some quando a liquidação acaba.
var temporary: bool = false
var spots: Array[Vector3] = []
var world: GameWorld
var _dismiss_pending := false

var _label: Label3D
var _mesh: MeshInstance3D
## Baú em pixel art 2.5D (tampa "lid" que abre no sorteio); fica dentro de _mesh, que sobe e
## some ao mudar de lugar.
var _model: Node3D
var _lid: Node3D
var _beam: Sprite3D
var _light: OmniLight3D
var _pulse := 0.0
var lid_open := false
## Desenho da arma sorteada, flutuando sobre a caixa.
var _icon: Sprite3D
var _timer := 0.0
var _cycle := 0.0


func setup(p_data: MysteryBoxData, p_catalog: WeaponCatalog, p_map_id: String, p_spots: Array[Vector3], p_world: GameWorld) -> void:
	data = p_data
	catalog = p_catalog
	map_id = p_map_id
	spots = p_spots
	world = p_world
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
	_model = PropFactory.create("mystery_box")
	if _model:
		_mesh.mesh = null
		_mesh.add_child(_model)
		_model.position.y = -SIZE.y * 0.5
		_lid = _model.get_node_or_null("lid") as Node3D
	_label = Label3D.new()
	_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	_label.pixel_size = 0.006
	_label.font_size = 56
	_label.outline_size = 12
	_label.position.y = 2.0
	# Parada, o "?" está desenhado no baú; o texto só aparece ao sortear.
	_label.text = ""
	add_child(_label)
	# Feixe de luz dourada subindo da caixa (como no CoD): dá para achá-la de longe.
	_beam = PixelFx.attach_loop(self, "box_beam", 1.4)
	if _beam:
		_beam.billboard = BaseMaterial3D.BILLBOARD_FIXED_Y
		_beam.alpha_cut = SpriteBase3D.ALPHA_CUT_DISABLED
		_beam.modulate = Color(1, 1, 1, 0.85)
		_beam.position.y = 0.9 + 2.8
		_beam.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var light := OmniLight3D.new()
	_light = light
	light.light_color = Color(1.0, 0.82, 0.48)
	light.light_energy = 1.4
	light.omni_range = 4.0
	light.position.y = 1.5
	add_child(light)
	add_to_group(&"interactable")
	add_to_group(&"mystery_box")


func _process(delta: float) -> void:
	_pulse += delta
	if _light:
		_light.light_energy = 1.3 + 0.45 * sin(_pulse * 3.0)
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
			var element := ("  " + ElementCatalog.shared().label(result_element)) if result_element != &"" else ""
			return "[E] PEGAR %s%s%s" % [result.display_name.to_upper(), element, " (MUNIÇÃO)" if owned else ""]
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
				Events.weapon_dropped.emit(dropped, p.global_position)
			# Veio com elemento: a arma (nova ou a que você já tinha) fica com ele.
			var taken := p.inventory.find(result.id)
			if taken and result_element != &"":
				taken.element = result_element
				Events.weapon_element_changed.emit(result.id, result_element)
			_reset()
			return true
	return false


## Elemento que acompanha a arma (função pura): com chance ELEMENT_CHANCE, um dos seis.
static func roll_element(roll: float, pick: int) -> StringName:
	if roll >= ELEMENT_CHANCE:
		return &""
	var ids := ElementCatalog.shared().elements.keys()
	return StringName(ids[posmod(pick, ids.size())])


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
	_set_lid(true)
	Events.mystery_box_rolled.emit(price < data.price)
	_timer = data.roll_time
	_cycle = 0.0


func _reveal() -> void:
	Audio.play_at("box_reveal", global_position, "ui", 1.0)
	state = State.READY
	_timer = data.take_time
	result_element = roll_element(randf(), randi())
	_label.text = result.display_name.to_upper() + (("  " + ElementCatalog.shared().label(result_element)) if result_element != &"" else "")
	_label.modulate = RARITY_COLORS.get(result.rarity, Color.WHITE)
	_show_icon(result)


## Abre (gira para trás pela dobradiça de trás) ou fecha a tampa.
func _set_lid(value: bool) -> void:
	lid_open = value
	if _lid == null:
		return
	var hinge_z := -SIZE.z * 0.5
	var angle := deg_to_rad(-70.0) if value else 0.0
	var rest := Vector3(0.0, 0.87, 0.0)
	# A tampa gira em torno da borda de trás: posição da dobradiça + o centro girado.
	var offset := Vector3(0.0, 0.0, -hinge_z).rotated(Vector3.RIGHT, angle)
	var target := Vector3(0.0, rest.y, hinge_z) + offset
	var tween := _lid.create_tween().set_parallel()
	tween.tween_property(_lid, "rotation:x", angle, 0.35)
	tween.tween_property(_lid, "position", target, 0.35)


func _show_icon(weapon: WeaponData) -> void:
	var path := "res://assets/sprites/icons/weapon_%s.png" % weapon.id if weapon else ""
	if weapon == null or not ResourceLoader.exists(path):
		if _icon:
			_icon.visible = false
		return
	if _icon == null:
		_icon = Sprite3D.new()
		_icon.name = "Icon"
		_icon.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		_icon.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
		_icon.pixel_size = 0.012
		_icon.shaded = false
		_icon.position.y = 1.45
		add_child(_icon)
	_icon.texture = load(path)
	_icon.visible = true


func _reset() -> void:
	_show_icon(null)
	_set_lid(false)
	state = State.IDLE
	result = null
	_label.text = ""
	_label.modulate = Color.WHITE
	if _dismiss_pending:
		queue_free()
	elif uses >= data.uses_before_move and not temporary and price >= data.price:
		_move_away()


## Caixa extra do Fire Sale: some agora (ou quando o sorteio em andamento acabar).
func dismiss() -> void:
	if state == State.IDLE:
		queue_free()
	else:
		_dismiss_pending = true


## Some e reaparece em outro ponto (qualquer um, mesmo em área fechada, como no jogo web).
func _move_away() -> void:
	var options := spots.filter(func(p: Vector3) -> bool: return p.distance_to(global_position) > 1.0)
	uses = 0
	if options.is_empty():
		return
	var spot: Vector3 = options.pick_random()
	Audio.play_at("box_move", global_position, "world", 1.0)
	state = State.MOVING
	remove_from_group(&"interactable")
	var tween := create_tween()
	tween.tween_property(_mesh, "position:y", SIZE.y * 0.5 + 1.5, data.move_out_time)
	tween.tween_callback(func() -> void:
		visible = false
		collision_layer = 0)
	tween.tween_interval(data.move_gap_time)
	tween.tween_callback(func() -> void: _appear_at(spot))
	var area := world.area_of(spot) if world else &""
	Events.toast.emit("A MYSTERY BOX MUDOU DE LUGAR — %s" % world.area_display_name(area).to_upper() if area != &"" else "A MYSTERY BOX MUDOU DE LUGAR")


func _appear_at(spot: Vector3) -> void:
	global_position = spot
	if world:
		rotation.y = world.facing_toward_open(spot)
	_mesh.position.y = SIZE.y * 0.5
	visible = true
	collision_layer = PhysicsLayers.WORLD
	state = State.IDLE
	add_to_group(&"interactable")
