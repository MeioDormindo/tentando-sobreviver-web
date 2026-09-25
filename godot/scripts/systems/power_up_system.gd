class_name PowerUpSystem
extends Node
## Power-ups (como no jogo web): zumbis abatidos pelo jogador às vezes soltam um power-up, que
## fica no chão brilhando (pisca antes de sumir) até o jogador passar por cima. Efeitos:
## Max Ammo, Double Cash, Instant Kill, Nuke, Full Heal, Armor, Speed Boost, Carpenter,
## Golden Drop (arma especial, dinheiro, perk grátis ou Fúria) e Fire Sale.

@export var data: PowerUpData
@export var player: Player
@export var points_manager: PointsManager
@export var weapon_catalog: WeaponCatalog
@export_dir var perks_dir: String = "res://data/perks"

## Efeitos com tempo ativos: id → segundos restantes.
var active: Dictionary = {}

var _drops_this_round := 0
var _pickups: Array[Node3D] = []
var _fire_sale_boxes: Array[MysteryBox] = []


func _ready() -> void:
	add_to_group(&"power_ups")
	Events.zombie_killed.connect(_on_kill)
	Events.round_started.connect(func(_n: int, _t: int) -> void: _drops_this_round = 0)


func _physics_process(delta: float) -> void:
	# Um drop pode ter sido apagado por fora (fim da partida, testes).
	_pickups.assign(_pickups.filter(func(item: Variant) -> bool: return is_instance_valid(item)))
	for pickup: Node3D in _pickups.duplicate():
		var age: float = pickup.get_meta(&"age") + delta
		pickup.set_meta(&"age", age)
		if age >= data.lifetime:
			_remove(pickup)
			continue
		if age >= data.blink_at:
			pickup.visible = int(age * (8.0 if age > data.lifetime - 3.0 else 4.0)) % 2 == 0
		var offset := player.global_position - pickup.global_position
		offset.y = 0.0
		if player.is_alive() and offset.length() <= data.pickup_radius + 0.4:
			var id: StringName = pickup.get_meta(&"id")
			_remove(pickup)
			apply(id)
	var changed := false
	for id: StringName in active.keys():
		active[id] = float(active[id]) - delta
		if active[id] <= 0.0:
			active.erase(id)
			_end(id)
			changed = true
	if changed or not active.is_empty():
		Events.power_up_timers.emit(active.duplicate(), data.power_ups)


## Cria um power-up no chão (também usado por eventos, bosses e testes).
func spawn_drop(id: StringName, at: Vector3) -> Node3D:
	var info: Dictionary = data.power_ups.get(id, {})
	var color: Color = info.get("color", Color.WHITE)
	var pickup := Node3D.new()
	pickup.name = "PowerUp_" + String(id)
	pickup.set_meta(&"id", id)
	pickup.set_meta(&"age", 0.0)
	# Ícone do jogo web em pixel art (40 px, filtro nearest), voltado para a câmera; sem o
	# ícone, uma esfera na cor do power-up.
	var icon_path := "res://assets/web/powerups/%s.png" % id
	var orb: Node3D
	if ResourceLoader.exists(icon_path):
		var sprite := Sprite3D.new()
		sprite.texture = load(icon_path)
		sprite.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
		sprite.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		sprite.shaded = false
		sprite.alpha_cut = SpriteBase3D.ALPHA_CUT_DISCARD
		sprite.pixel_size = (0.95 if id == &"golden" else 0.75) / float(sprite.texture.get_width())
		sprite.no_depth_test = false
		orb = sprite
		var halo := Sprite3D.new()
		halo.texture = _halo_texture(color)
		halo.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
		halo.axis = Vector3.AXIS_Y
		halo.shaded = false
		halo.pixel_size = 1.4 / 24.0
		halo.modulate = Color(color, 0.7)
		halo.position.y = 0.03
		pickup.add_child(halo)
	else:
		var sphere := MeshInstance3D.new()
		var mesh := SphereMesh.new()
		mesh.radius = 0.32 if id != &"golden" else 0.42
		mesh.height = mesh.radius * 2.0
		var material := StandardMaterial3D.new()
		material.albedo_color = color
		material.emission_enabled = true
		material.emission = color * 0.8
		mesh.material = material
		sphere.mesh = mesh
		orb = sphere
	orb.position.y = 0.9
	pickup.add_child(orb)
	var label := Label3D.new()
	label.outline_size = 0  # a fonte pixel já tem o contorno embutido
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.text = String(info.get("name", id)).to_upper()
	label.font_size = 40
	label.pixel_size = 0.005
	label.modulate = color.lightened(0.3)
	label.position.y = 1.6
	pickup.add_child(label)
	var light := OmniLight3D.new()
	light.light_color = color
	light.light_energy = 1.6
	light.omni_range = 3.0
	light.position.y = 1.0
	pickup.add_child(light)
	SpecialFire.world_root(get_tree()).add_child(pickup)
	pickup.global_position = Vector3(at.x, 0.0, at.z)
	var tween := orb.create_tween().set_loops()
	tween.tween_property(orb, "position:y", 1.15, 0.7).set_trans(Tween.TRANS_SINE)
	tween.tween_property(orb, "position:y", 0.9, 0.7).set_trans(Tween.TRANS_SINE)
	_pickups.append(pickup)
	return pickup


## Brilho no chão embaixo do drop: anel pixelado (24 px) em pontilhado, branco (a cor entra
## pelo modulate).
static var _halo: ImageTexture


static func _halo_texture(_color: Color) -> ImageTexture:
	if _halo:
		return _halo
	var image := Image.create(24, 24, false, Image.FORMAT_RGBA8)
	for y in 24:
		for x in 24:
			var d := Vector2(x + 0.5 - 12.0, y + 0.5 - 12.0).length() / 12.0
			var alpha := 0.0
			if d < 1.0:
				alpha = 0.85 if d > 0.78 else (0.35 if (x + y) % 2 == 0 and d < 0.6 else 0.0)
			image.set_pixel(x, y, Color(1, 1, 1, alpha))
	_halo = ImageTexture.create_from_image(image)
	return _halo


## Aplica o efeito (ao pegar). Devolve o detalhe mostrado na HUD.
func apply(id: StringName) -> String:
	var info: Dictionary = data.power_ups.get(id, {})
	var detail := ""
	match id:
		&"max_ammo":
			Events.max_ammo.emit(player.global_position)
		&"double_cash":
			points_manager.multiplier = data.cash_multiplier
		&"insta_kill":
			Hurtbox.insta_kill = true
		&"nuke":
			detail = "+%d" % _nuke()
		&"full_heal":
			player.health.heal(player.health.max_health)
		&"armor":
			player.refill_armor()
		&"speed_boost":
			player.speed_buff = data.speed_multiplier
		&"carpenter":
			var planks := 0
			for node in get_tree().get_nodes_in_group(&"barricades"):
				var barricade := node as Barricade
				planks += barricade.data.max_planks - barricade.planks
				barricade.planks = barricade.data.max_planks
				barricade.take_hit(0)
			detail = "Barricadas consertadas (%d tábuas) · +%d" % [planks, points_manager.add(data.carpenter_reward)]
		&"golden":
			detail = _golden()
		&"fire_sale":
			_start_fire_sale()
	var duration := float(info.get("duration", 0))
	if duration > 0.0:
		active[id] = duration  # pegar de novo renova
	Events.power_up_collected.emit(id, String(info.get("name", id)), info.get("color", Color.WHITE), detail)
	return detail


func _end(id: StringName) -> void:
	match id:
		&"double_cash":
			points_manager.multiplier = 1.0
		&"insta_kill":
			Hurtbox.insta_kill = false
		&"speed_boost":
			player.speed_buff = 1.0
		&"fury":
			player.fury_multiplier = 1.0
		&"fire_sale":
			_end_fire_sale()


func _on_kill(zombie: Node3D, info: DamageInfo) -> void:
	if not info.kind in [DamageInfo.Kind.WEAPON, DamageInfo.Kind.MELEE] or _drops_this_round >= data.max_per_round:
		return
	var roll := randf()
	if roll < data.golden_chance:
		_drops_this_round += 1
		spawn_drop(&"golden", zombie.global_position)
	elif roll < data.golden_chance + data.drop_chance:
		_drops_this_round += 1
		spawn_drop(_pick_from_table(), zombie.global_position)


func _pick_from_table() -> StringName:
	var total := 0.0
	for id: StringName in data.drop_table:
		total += float(data.drop_table[id])
	var pick := randf() * total
	for id: StringName in data.drop_table:
		pick -= float(data.drop_table[id])
		if pick < 0.0:
			return id
	return data.drop_table.keys()[0]


func _remove(pickup: Node3D) -> void:
	_pickups.erase(pickup)
	pickup.queue_free()


## Nuke: mata todos os zumbis vivos (não o boss); paga um valor fixo.
func _nuke() -> int:
	for node in get_tree().get_nodes_in_group(&"zombies"):
		var zombie := node as ZombieBase
		if zombie and zombie.is_alive():
			zombie.take_damage(DamageInfo.new(zombie.health.current + 1.0, DamageInfo.Kind.ENVIRONMENT, player, false, zombie.global_position))
	SpecialFire.flash(get_tree(), player.global_position, 12.0, Color(1.0, 0.6, 0.3))
	return points_manager.add(data.nuke_reward)


## Golden Drop: arma especial, dinheiro alto, perk grátis ou Fúria (dano em dobro).
func _golden() -> String:
	var total := 0.0
	for key: StringName in data.golden_outcomes:
		total += float(data.golden_outcomes[key])
	var pick := randf() * total
	var outcome := &"money"
	for key: StringName in data.golden_outcomes:
		pick -= float(data.golden_outcomes[key])
		if pick < 0.0:
			outcome = key
			break
	if outcome == &"weapon":
		var weapon := weapon_catalog.find(StringName(Array(data.golden_weapons).pick_random()))
		if weapon:
			if player.inventory.owns(weapon.id):
				for w in player.inventory.weapons:
					w.reset_ammo()
			else:
				var dropped := player.give_weapon(weapon)
				if dropped:
					Events.weapon_dropped.emit(dropped, player.global_position)
			return weapon.display_name
	if outcome == &"perk":
		var options: Array[PerkData] = []
		for file in DirAccess.get_files_at(perks_dir):
			if file.ends_with(".tres") or file.ends_with(".tres.remap"):
				var perk := load("%s/%s" % [perks_dir, file.trim_suffix(".remap")]) as PerkData
				if perk and player.perks.can_buy(perk):
					options.append(perk)
		if not options.is_empty():
			var perk: PerkData = options.pick_random()
			player.perks.grant(perk)
			return "Perk grátis: " + perk.display_name
	if outcome == &"fury":
		player.fury_multiplier = data.fury_damage_multiplier
		active[&"fury"] = data.fury_duration
		return "Fúria: dano x%d" % roundi(data.fury_damage_multiplier)
	# Dinheiro (também o prêmio quando não há perk para dar); não passa pelo Double Cash.
	points_manager.add(data.golden_money, false)
	return "+%d" % data.golden_money


## Fire Sale: a caixa custa 10 e aparece em todos os locais das áreas abertas.
func _start_fire_sale() -> void:
	var main := get_tree().get_first_node_in_group(&"mystery_box") as MysteryBox
	if main == null:
		return
	for node in get_tree().get_nodes_in_group(&"mystery_box"):
		(node as MysteryBox).price = main.data.fire_sale_price
	if not _fire_sale_boxes.is_empty():
		return
	for spot in main.spots:
		if spot.distance_to(main.global_position) < 1.5 or not main.world.is_area_open(main.world.area_of(spot)):
			continue
		var extra := (load(main.scene_file_path) as PackedScene).instantiate() as MysteryBox if main.scene_file_path != "" else MysteryBox.new()
		extra.setup(main.data, main.catalog, main.map_id, main.spots, main.world)
		extra.temporary = true
		extra.price = main.data.fire_sale_price
		extra.position = main.get_parent().to_local(spot)
		main.get_parent().add_child(extra)
		_fire_sale_boxes.append(extra)
	Events.toast.emit("FIRE SALE! MYSTERY BOX A %d · +%d CAIXAS NO MAPA" % [main.data.fire_sale_price, _fire_sale_boxes.size()])


func _end_fire_sale() -> void:
	for node in get_tree().get_nodes_in_group(&"mystery_box"):
		var box := node as MysteryBox
		box.price = box.data.price
	for box in _fire_sale_boxes:
		if is_instance_valid(box):
			box.dismiss()
	_fire_sale_boxes.clear()
