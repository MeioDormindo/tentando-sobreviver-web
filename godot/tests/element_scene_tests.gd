extends RefCounted
## Elementos das armas, arsenal de cada mapa, visuais por mapa e a tela ARMAS (cena).

var _passed := 0
var _failed := 0
var _tree: SceneTree
var _main: Node
var _player: Player


func run(tree: SceneTree) -> int:
	_tree = tree
	if not String(Save.get("_path")).contains("test"):
		Save.load_from("user://test_save.json")
	var previous_map := Session.map_id
	print("Elementos (cena, Terminal)")
	await _load("terminal")
	await _element_purchase()
	await _starting_pistol_element()
	await _effects()
	_box()
	_main.queue_free()
	await _frames(2)
	print("Arsenal e personagem do Hospital (cena)")
	await _load("map2")
	_hospital()
	_main.queue_free()
	await _frames(2)
	_skins()
	await _armory()
	Session.map_id = previous_map
	print("\n%d ok, %d falharam (elementos)" % [_passed, _failed])
	return _failed


func check(condition: bool, description: String) -> void:
	if condition:
		_passed += 1
		print("  ok  ", description)
	else:
		_failed += 1
		printerr("  FALHOU  ", description)


func _frames(count: int) -> void:
	for i in count + 1:
		await _tree.physics_frame


func _load(map_id: String) -> void:
	Session.map_id = map_id
	_main = (load("res://scenes/main.tscn") as PackedScene).instantiate()
	_tree.root.add_child(_main)
	_player = _main.get_node("Player") as Player
	_player.controlled = false
	var events := _main.get_node("WorldEventSystem") as WorldEventSystem
	events.data = events.data.duplicate(true)
	events.data.schedule["chance_per_wave"] = 0.0
	await _tree.create_timer(0.5).timeout
	(_main.get_node("RoundManager") as RoundManager).stop()
	_player.health.reset(99999.0)


func _buy_at(id: StringName) -> WallBuy:
	for node in _tree.get_nodes_in_group(&"interactable"):
		var buy := node as WallBuy
		if buy and (buy.weapon_data.id if buy.weapon_data else &"") == id:
			return buy
	return null


## Segura E por `seconds` (como o jogador: aperta, depois segura a cada quadro).
func _press_and_hold(target: WallBuy, seconds: float) -> void:
	target.interact(_player)
	var left := seconds
	while left > 0.0:
		target.hold_interact(_player, 1.0 / 30.0)
		left -= 1.0 / 30.0
		await _tree.process_frame


func _element_purchase() -> void:
	var points := _main.get_node("PointsManager") as PointsManager
	points.add(20000, false)
	var glock_buy := _buy_at(&"glock")
	check(glock_buy != null and glock_buy.interact(_player) and _player.inventory.owns(&"glock"), "compra a Glock na parede")
	await _tree.create_timer(0.1).timeout
	var glock := _player.inventory.find(&"glock")
	_player.inventory.switch_to(_player.inventory.weapons.find(glock))
	glock.magazine = 3  # pente incompleto
	check(glock_buy.get_interaction_prompt(_player).contains("SEGURE E"), "a parede oferece o elemento (%s)" % glock_buy.get_interaction_prompt(_player))
	var before := points.points
	await _press_and_hold(glock_buy, 1.1)
	await _tree.create_timer(0.3).timeout
	var price := int(ElementCatalog.shared().info(&"shadow").price)
	check(glock.element == &"shadow" and glock.magazine == 3 and points.points == before - price,
		"pente incompleto + segurar E: compra só o elemento, não a munição (%d pontos)" % (before - points.points))
	check(glock_buy.get_interaction_prompt(_player).contains("✓"), "a parede mostra o elemento comprado")
	# Toque rápido (com elemento já comprado): munição na hora.
	glock.magazine = 2
	check(glock_buy.interact(_player) and glock.magazine == glock.data.magazine_size, "com o elemento comprado, o toque compra munição")
	# O elemento fica com a arma no Weapon Lab.
	glock.upgrade_to(WeaponUpgrade.mk2(glock.data, load("res://data/configs/weapon_lab.tres")))
	check(glock.element == &"shadow" and glock.level == 1, "o elemento continua depois do Weapon Lab")


func _starting_pistol_element() -> void:
	var m1911 := _player.inventory.find(&"m1911")
	_player.inventory.switch_to(_player.inventory.weapons.find(m1911))
	await _tree.create_timer(0.6).timeout
	var ammo := _buy_at(&"")
	m1911.magazine = 1
	# Toque rápido na munição (com elemento à venda): compra a munição ao soltar.
	ammo.interact(_player)
	await _tree.create_timer(0.4).timeout
	check(m1911.magazine == m1911.data.magazine_size and m1911.element == &"", "toque rápido na munição: só a munição")
	m1911.magazine = 1
	await _press_and_hold(ammo, 1.1)
	await _tree.create_timer(0.3).timeout
	check(m1911.element == &"light" and m1911.magazine == 1, "segurar E na munição com a pistola inicial: elemento luz")


func _walker(offset: Vector3) -> ZombieBase:
	var spawn := _main.get_node("SpawnManager") as SpawnManager
	var zombie := ZombieFactory.create(spawn.type_data(&"walker"), _player, 20.0, 0.0, 0.0)
	zombie.position = spawn.container.to_local(_player.global_position + offset)
	spawn.container.add_child(zombie)
	return zombie


func _hit(weapon: Weapon, zombie: ZombieBase, element: StringName) -> void:
	weapon.element = element
	var info := DamageInfo.new(40.0, DamageInfo.Kind.WEAPON, _player, false, zombie.global_position)
	info.target = zombie
	ElementEffects.apply(weapon, info, _player, 1.0)


func _effects() -> void:
	var weapon := _player.weapon
	var a := _walker(Vector3(0, 0, -3))
	var b := _walker(Vector3(1.2, 0, -3.5))
	var c := _walker(Vector3(-1.2, 0, -3.5))
	await _frames(3)
	_hit(weapon, a, &"fire")
	check(a._burn_left > 0.0, "fogo: queima")
	_hit(weapon, a, &"ice")
	check(a.is_chilled(), "gelo: fica lento")
	a._stun_left = 0.0
	_hit(weapon, a, &"light")
	check(a._stun_left > 0.0, "luz: atordoa")
	_player.health.current = _player.health.max_health - 50.0
	var hp := _player.health.current
	_hit(weapon, a, &"shadow")
	check(_player.health.current > hp, "sombra: cura o jogador")
	var b_hp := b.health.current
	var c_hp := c.health.current
	_hit(weapon, a, &"lightning")
	check(b.health.current < b_hp or c.health.current < c_hp, "raio: salta para zumbis próximos")
	b_hp = b.health.current
	_hit(weapon, a, &"explosive")
	check(b.health.current < b_hp, "explosivo: estoura e fere os vizinhos")
	weapon.element = &""
	for zombie in [a, b, c]:
		zombie.queue_free()


func _box() -> void:
	var catalog := load("res://data/weapons/catalog.tres") as WeaponCatalog
	var data := load("res://data/configs/mystery_box.tres") as MysteryBoxData
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	var seen := {}
	for i in 6000:
		seen[MysteryBox.roll_weapon(catalog, data.rarity_weights, "terminal", rng).id] = true
	check(seen.has(&"wind_cannon") and seen.has(&"p90") and seen.has(&"sawed_off"), "caixa do Terminal traz armas do Hospital e o Canhão de Vento")
	check(not catalog.weapons.any(func(w: WeaponData) -> bool: return w.id == &"conductor_lantern"), "a Lanterna nunca sai na caixa")
	check(MysteryBox.roll_element(0.1, 3) != &"" and MysteryBox.roll_element(0.95, 3) == &"", "a caixa às vezes dá um elemento junto")
	var any := {}
	for i in 12:
		any[MysteryBox.roll_element(0.0, i)] = true
	check(any.size() == 6, "qualquer um dos 6 elementos pode vir da caixa")


func _hospital() -> void:
	check(_player.weapon != null and _player.weapon.data.id == &"beretta" and _player.start_weapon_id() == &"beretta", "Hospital: começa com a Beretta 92")
	var terminal: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://data/maps/terminal.json"))
	var hospital: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://data/maps/map2.json"))
	var ids := func(data: Dictionary) -> Array: return data.stations.filter(func(s: Dictionary) -> bool: return s.type == "weapon").map(func(s: Dictionary) -> String: return s.weaponId)
	var shared: Array = ids.call(hospital).filter(func(id: String) -> bool: return id in ids.call(terminal))
	check(shared.is_empty() and ids.call(hospital).size() == 6, "paredes do Hospital sem nenhuma arma do Terminal (%s)" % str(ids.call(hospital)))
	check(_player.model != null and _player.model.sheet_name == "player_patient", "Hospital: o personagem é o paciente")
	var ammo := _buy_at(&"")
	check(ammo != null and ammo.element_target(_player) == _player.weapon, "a munição vende o elemento da Beretta")


func _skins() -> void:
	var catalog := load("res://data/configs/skins.tres") as SkinCatalog
	check(catalog.for_map("terminal").size() == 4 and catalog.for_map("map2").size() == 4, "4 visuais por mapa")
	check(catalog.chosen("terminal").id == "default" and catalog.chosen("map2").id == "patient", "padrões: Sobrevivente e Paciente")
	var locked: Array = catalog.for_map("map2").filter(func(k: Dictionary) -> bool: return String(k.unlock) != "" and not Save.has_achievement(k.unlock))
	if not locked.is_empty():
		Save.set_setting("skinHospital", locked[0].id)
		check(catalog.chosen("map2").id == "patient", "visual trancado volta ao padrão do mapa")
	Save.set_setting("skinHospital", "patient")
	for skin: Dictionary in catalog.skins:
		if not ResourceLoader.exists("res://assets/sprites/player_%s.png" % skin.id):
			check(false, "folha do visual %s" % skin.id)


func _armory() -> void:
	var screen := (load("res://scenes/ui/armory.tscn") as PackedScene).instantiate()
	_tree.root.add_child(screen)
	await _frames(2)
	var catalog := load("res://data/weapons/catalog.tres") as WeaponCatalog
	check(screen.weapons.size() == catalog.weapons.size() + 1, "ARMAS lista todas as armas (%d)" % screen.weapons.size())
	var toggle := screen.find_child("MkToggle", true, false) as Button
	check(toggle != null, "botão VER MK II")
	if toggle:
		toggle.pressed.emit()
		await _frames(1)
		check(screen.level == 1 and screen.shown().display_name != screen.weapons[screen.selected].display_name, "mostra o Mk II")
	check(screen.source_text(load("res://data/weapons/beretta.tres")).contains("Arma inicial do"), "onde achar: arma inicial do Hospital")
	screen.queue_free()
	await _frames(1)
