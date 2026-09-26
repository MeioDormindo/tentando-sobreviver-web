extends RefCounted
## Testes dos sistemas isolados (seção 42). Executados por run_tests.gd.

var _passed := 0
var _failed := 0


var _tree_root: Node


## Roda tudo e devolve o número de falhas.
func run(tree: SceneTree) -> int:
	_tree_root = tree.root
	_test_health()
	_test_hurtbox()
	_test_weapon_ammo_and_reload()
	_test_round_formulas()
	_test_spawn_pick()
	_test_points_data()
	_test_inventory()
	_test_spin_up()
	_test_migrated_data()
	_test_maps(tree)
	_test_barricade(tree)
	_test_mystery_box()
	_test_weapon_lab()
	_test_pixel_font()
	_test_perks()
	_test_composition()
	_test_save()
	_test_score()
	_test_anti_cheat()
	_test_achievements()
	print("\n%d ok, %d falharam" % [_passed, _failed])
	return _failed


func check(condition: bool, description: String) -> void:
	if condition:
		_passed += 1
		print("  ok  ", description)
	else:
		_failed += 1
		printerr("  FALHOU  ", description)


func _test_health() -> void:
	print("HealthComponent")
	var health := HealthComponent.new()
	health.reset(100.0)
	var deaths := [0]
	health.died.connect(func(_info: DamageInfo) -> void: deaths[0] += 1)
	check(is_equal_approx(health.apply_damage(DamageInfo.new(60.0)), 60.0), "tira 60 de 100")
	check(is_equal_approx(health.current, 40.0), "fica com 40")
	check(is_equal_approx(health.apply_damage(DamageInfo.new(60.0)), 40.0), "o golpe que mata só tira o que restava")
	check(health.is_dead and deaths[0] == 1, "morre uma vez ao chegar a 0")
	check(health.apply_damage(DamageInfo.new(10.0)) == 0.0 and deaths[0] == 1, "morto não leva mais dano")
	health.reset()
	health.invulnerable = true
	check(health.apply_damage(DamageInfo.new(999.0)) == 0.0, "invulnerável ignora dano")
	health.free()


func _test_hurtbox() -> void:
	print("Hurtbox / headshot")
	check(is_equal_approx(Hurtbox.compute_damage(35.0, true, 1.5), 52.5), "cabeça: 35 × 1.5 = 52.5")
	check(is_equal_approx(Hurtbox.compute_damage(35.0, false, 1.5), 35.0), "corpo: dano normal")
	# Walker (100 de vida) com a M1911: 3 tiros no corpo, 2 na cabeça.
	check(ceili(100.0 / 35.0) == 3 and ceili(100.0 / 52.5) == 2, "headshot mata com menos tiros")


func _test_weapon_ammo_and_reload() -> void:
	print("Weapon (munição e recarga)")
	var weapon := Weapon.new()
	weapon.data = load("res://data/weapons/m1911.tres") as WeaponData
	weapon.reset_ammo()
	check(weapon.magazine == 8 and weapon.reserve == 80, "começa com 8 / 80")
	check(weapon.consume_shot(), "atira")
	check(not weapon.consume_shot(), "respeita a cadência (4 tiros/s)")
	for i in 7:
		weapon.tick(0.3)
		weapon.consume_shot()
	check(weapon.magazine == 0 and weapon.reloading, "pente vazio começa a recarga sozinho")
	check(not weapon.consume_shot(), "não atira recarregando")
	weapon.tick(1.0)
	check(weapon.reloading, "recarga ainda não terminou em 1s (leva 1.4s)")
	weapon.tick(0.5)
	check(weapon.magazine == 8 and weapon.reserve == 72 and not weapon.reloading, "recarregou: 8 / 72")
	weapon.consume_shot()
	check(weapon.start_reload(), "recarga manual com o pente incompleto")
	weapon.tick(1.5)
	check(weapon.magazine == 8 and weapon.reserve == 71, "recarga manual repõe só o que faltava")
	weapon.magazine = 3
	weapon.reserve = 2
	weapon.start_reload()
	weapon.tick(1.5)
	check(weapon.magazine == 5 and weapon.reserve == 0, "recarga limitada pela reserva")
	weapon.free()


func _test_round_formulas() -> void:
	print("RoundData (fórmulas do jogo TS)")
	var data := load("res://data/configs/rounds.tres") as RoundData
	check(data.total_zombies(1) == 9, "round 1: 9 zumbis")
	check(data.total_zombies(2) == 12, "round 2: 12 zumbis")
	check(is_equal_approx(data.health_multiplier(1), 1.0), "round 1: vida base")
	check(is_equal_approx(data.health_multiplier(11), 2.26), "round 11: vida × 2.26 (inclui o bônus tardio)")
	check(is_equal_approx(data.spawn_interval(1), 1.8), "round 1: spawn a cada 1.8s")
	check(is_equal_approx(data.spawn_interval(20), 0.4), "round 20: spawn no mínimo (0.4s)")
	check(data.max_alive(1) == 8 and data.max_alive(20) == 30, "máximo de vivos: 8 no round 1, teto 30")
	check(data.total_zombies(0) == 9, "round inválido vira round 1")


func _test_spawn_pick() -> void:
	print("SpawnManager (escolha do ponto)")
	var points: Array[Vector3] = [Vector3(2, 0, 0), Vector3(20, 0, 0), Vector3(0, 0, 3)]
	var always_far := true
	for i in 20:
		always_far = always_far and SpawnManager.pick_spawn_index(points, Vector3.ZERO, 8.0) == 1
	check(always_far, "escolhe só o ponto longe do jogador (20 sorteios)")
	var near: Array[Vector3] = [Vector3(1, 0, 0), Vector3(3, 0, 0)]
	check(SpawnManager.pick_spawn_index(near, Vector3.ZERO, 8.0) == 1, "todos perto: usa o mais longe")
	var none: Array[Vector3] = []
	check(SpawnManager.pick_spawn_index(none, Vector3.ZERO, 8.0) == -1, "sem pontos: -1")


func _test_points_data() -> void:
	print("PointsData")
	var data := load("res://data/configs/points.tres") as PointsData
	check(data.start_points == 500, "começa com 500")
	check(data.round_bonus(1) == 350 and data.round_bonus(4) == 500, "bônus do round: 300 + 50 × round")


func _test_inventory() -> void:
	print("WeaponInventory (2 espaços, troca)")
	var inventory := WeaponInventory.new()
	var m1911 := load("res://data/weapons/m1911.tres") as WeaponData
	var glock := load("res://data/weapons/glock.tres") as WeaponData
	var mp5 := load("res://data/weapons/mp5.tres") as WeaponData
	check(inventory.give(m1911) == null and inventory.weapons.size() == 1, "pega a arma inicial")
	check(not inventory.current.busy, "a primeira arma já vem pronta")
	inventory.give(glock)
	check(inventory.weapons.size() == 2 and inventory.current.data.id == &"glock", "segunda arma vai para a mão")
	check(inventory.is_switching() and not inventory.current.can_fire(), "trocando: não atira")
	inventory._process(0.4)
	check(not inventory.is_switching() and inventory.current.can_fire(), "depois de 0.35s pode atirar")
	var dropped := inventory.give(mp5)
	check(dropped != null and dropped.data.id == &"glock" and inventory.current.data.id == &"mp5", "com 2 armas, a nova substitui a da mão")
	dropped.free()
	check(inventory.owns(&"m1911") and not inventory.owns(&"glock"), "owns() confere o inventário")
	inventory.current.magazine = 0
	inventory.give(mp5)
	check(inventory.current.magazine == mp5.magazine_size, "pegar arma repetida só enche a munição")
	check(inventory.switch_next() and inventory.current.data.id == &"m1911", "troca para a outra arma")
	inventory.free()


func _test_spin_up() -> void:
	print("Minigun (giro do cano)")
	var weapon := Weapon.new()
	weapon.data = load("res://data/weapons/minigun.tres") as WeaponData
	weapon.reset_ammo()
	check(weapon.data.spin_up_time > 0.0, "minigun tem tempo de giro (%.1fs)" % weapon.data.spin_up_time)
	check(not weapon.consume_shot(), "não atira sem girar")
	var fired_at := -1.0
	var t := 0.0
	while t < 2.0 and fired_at < 0.0:
		weapon.tick(0.05)
		t += 0.05
		if weapon.consume_shot():
			fired_at = t
	check(fired_at >= weapon.data.spin_up_time - 0.06, "atira depois de girar (%.2fs)" % fired_at)
	weapon.tick(0.05)
	weapon.tick(0.05)
	check(not weapon.is_spun_up(), "soltar o gatilho para o giro")
	weapon.free()


func _test_migrated_data() -> void:
	print("Dados migrados do jogo web")
	var player := load("res://data/configs/player.tres") as PlayerData
	check(is_equal_approx(player.move_speed, 6.25) and player.starting_weapon.id == &"m1911", "jogador: 200 px/s = 6.25 m/s, começa com a M1911")
	check(is_equal_approx(player.knife.damage, 150.0) and is_equal_approx(player.knife.cooldown, 1.0), "faca: 150 de dano, 1 golpe/s")
	var pump := load("res://data/weapons/pump.tres") as WeaponData
	check(pump.pellets > 1, "pump dispara %d chumbos" % pump.pellets)
	var launcher := load("res://data/weapons/grenade_launcher.tres") as WeaponData
	check(launcher.special_type == &"grenade" and launcher.box_only, "lança-granadas: especial e só na Mystery Box")
	var catalog := load("res://data/weapons/catalog.tres") as WeaponCatalog
	check(catalog.weapons.size() == 32, "19 armas do jogo web + 4 do Hospital + 9 do Templo no catálogo (%d)" % catalog.weapons.size())


func _test_maps(tree: SceneTree) -> void:
	print("Mapas redesenhados (Terminal e Hospital)")
	for info in [["res://scenes/maps/terminal.tscn", 100, 104, 7, &"hall"], ["res://scenes/maps/hospital.tscn", 104, 100, 12, &"reception"]]:
		var map := (load(info[0]) as PackedScene).instantiate() as LayoutMap
		tree.root.add_child(map)
		check(map.width == info[1] and map.height == info[2], "%s: %d×%d tiles" % [map.name, map.width, map.height])
		var doors := tree.get_nodes_in_group(&"interactable").filter(func(n: Node) -> bool: return n is Door and map.is_ancestor_of(n)).size()
		check(doors == info[3], "%s: %d portas compráveis" % [map.name, doors])
		check(map.is_area_open(StringName(map.data.start_area)), "%s: começa com a área inicial aberta (%s)" % [map.name, map.data.start_area])
		var spawns := map.active_spawn_points(1).size()
		check(spawns > 0 and spawns < map.data.spawns.size(), "%s: só os spawns da área inicial valem (%d de %d)" % [map.name, spawns, map.data.spawns.size()])
		var barricades := map.find_children("*", "StaticBody3D", true, false).filter(func(n: Node) -> bool: return n is Barricade)
		check(barricades.size() == map.data.windows.size(), "%s: uma barricada por janela (%d)" % [map.name, barricades.size()])
		var buys := map.get_children().filter(func(n: Node) -> bool: return n is WallBuy)
		check(buys.size() == map.data.stations.size(), "%s: todas as compras na parede (%d)" % [map.name, buys.size()])
		var on_wall := buys.all(func(b: WallBuy) -> bool:
			var t := Vector2i(floori(b.position.x), floori(b.position.z))
			return [Vector2i.UP, Vector2i.LEFT, Vector2i.RIGHT, Vector2i.DOWN].any(func(d: Vector2i) -> bool: return "#T".contains(map.cell(t.x + d.x, t.y + d.y))))
		check(on_wall, "%s: cada compra fica encostada numa parede" % map.name)
		var flat := buys.all(func(b: WallBuy) -> bool:
			var parts := b.get_children().filter(func(n: Node) -> bool: return n is Label3D or n is MeshInstance3D)
			return parts.size() >= 3 and parts.all(func(n: Node3D) -> bool: return (not (n is Label3D) or (n as Label3D).billboard == BaseMaterial3D.BILLBOARD_DISABLED) and absf(Vector2(n.position.x, n.position.z).length() - 0.5) < 0.05))
		check(flat, "%s: quadro, giz e preço chapados na face da parede (nada flutuando)" % map.name)
		var perk_count: int = map.data.machines.filter(func(m: Dictionary) -> bool: return m.type == "perk").size()
		var machines := map.find_children("*", "StaticBody3D", true, false).filter(func(n: Node) -> bool: return n is PerkMachine)
		check(machines.size() == perk_count and perk_count > 0, "%s: %d máquinas de perk" % [map.name, machines.size()])
		var breaker := map.find_children("*", "StaticBody3D", true, false).filter(func(n: Node) -> bool: return n is Breaker)
		check(breaker.size() == 1 and not map.power.is_on, "%s: disjuntor no mapa, energia começa desligada" % map.name)
		var nav_polys := map.nav_region.navigation_mesh.get_polygon_count()
		check(nav_polys > 0, "%s: malha de navegação gerada (%d polígonos)" % [map.name, nav_polys])
		var lit: Array = map.data.areas.filter(func(a: Dictionary) -> bool: return map.area_lighting(StringName(a.id)) == "lit")
		check(map.data.areas.all(func(a: Dictionary) -> bool: return String(a.get("lighting", "")) in ["lit", "dim", "dark"]) and not lit.is_empty(),
			"%s: luz por área, %d bem iluminadas" % [map.name, lit.size()])
		check(map.find_child("Decor", false, false) != null and map.find_child("Decor", false, false).get_child_count() > 50, "%s: decoração espalhada" % map.name)
		# Portas pelo ambiente: arte do vão (uma porta só, não portões repetidos), placa com o
		# nome da área do outro lado nos dois lados, textos sem o contorno extra do Godot.
		var door_nodes: Array = tree.get_nodes_in_group(&"interactable").filter(func(n: Node) -> bool: return n is Door and map.is_ancestor_of(n))
		var styles := {}
		var dressed := door_nodes.all(func(d: Door) -> bool:
			d._dress()
			styles[d.style] = true
			var width := d._size.x if d.across.z != 0.0 else d._size.y
			var signs: Array = d.get_children().filter(func(n: Node) -> bool: return n is Label3D)
			return ResourceLoader.exists(Door.art_path(d.style, false, width)) and ResourceLoader.exists(Door.art_path(d.style, true)) and signs.size() == 2 and signs.all(func(l: Label3D) -> bool: return l.outline_size == 0 and l.text != ""))
		check(dressed, "%s: cada porta com a arte do seu ambiente e placa dos dois lados" % map.name)
		check(styles.size() >= (4 if map.map_id() == "terminal" else 6), "%s: portas diferentes por ambiente (%s)" % [map.name, ", ".join(styles.keys())])
		var outlined := map.find_children("*", "Label3D", true, false).filter(func(l: Label3D) -> bool: return l.outline_size > 0)
		check(outlined.is_empty(), "%s: nenhum texto no mundo com contorno extra (%d)" % [map.name, outlined.size()])
		if map.map_id() == "map2":
			var spots: Dictionary = map.data.quest.serum
			var on_floor := spots.values().all(func(s: Dictionary) -> bool: return not "#TDW".contains(map.cell(floori(float(s.tx) + 0.5), floori(float(s.ty) + 0.5))))
			check(spots.size() == 4 and on_floor, "%s: as 4 peças da missão do Soro no chão do mapa" % map.name)
			check(map.area_of(Vector3(float(spots.fridge.tx), 0, float(spots.fridge.ty) + 0.5)) == &"icu" and map.area_of(Vector3(float(spots.centrifuge.tx), 0, float(spots.centrifuge.ty))) == &"lab",
				"%s: geladeira na UTI, centrífuga no Laboratório" % map.name)
		map.free()


func _test_barricade(tree: SceneTree) -> void:
	print("Barricada")
	var barricade := Barricade.new()
	var data := load("res://data/configs/barricade.tres") as BarricadeData
	barricade.setup(&"w", Vector2(1, 2), Vector3.RIGHT, data)
	tree.root.add_child(barricade)
	check(barricade.planks == 5 and barricade.collision_layer & PhysicsLayers.BARRICADES, "começa com 5 tábuas e bloqueia os zumbis")
	check(barricade.is_outside(Vector3(-2, 0, 0)) and not barricade.is_outside(Vector3(2, 0, 0)), "sabe o lado de fora")
	for i in 5:
		barricade.take_hit(1)
	check(not barricade.is_intact() and not (barricade.collision_layer & PhysicsLayers.BARRICADES), "sem tábuas: zumbis passam")
	check(barricade.collision_layer & PhysicsLayers.PLAYER_ONLY, "o jogador nunca passa pela janela")
	var fake_player := Node3D.new()
	check(not barricade.hold_interact(fake_player, 0.5) and barricade.hold_interact(fake_player, 0.6), "segurar E por 1s repõe uma tábua")
	check(barricade.planks == 1 and barricade.collision_layer & PhysicsLayers.BARRICADES, "com tábua volta a bloquear")
	fake_player.free()
	barricade.free()


func _test_mystery_box() -> void:
	print("Mystery Box (sorteio)")
	var catalog := load("res://data/weapons/catalog.tres") as WeaponCatalog
	var data := load("res://data/configs/mystery_box.tres") as MysteryBoxData
	var rng := RandomNumberGenerator.new()
	rng.seed = 42
	var counts := {}
	var wind_on_terminal := 0
	for i in 2000:
		var weapon := MysteryBox.roll_weapon(catalog, data.rarity_weights, "terminal", rng)
		counts[weapon.rarity] = counts.get(weapon.rarity, 0) + 1
		if weapon.id == &"wind_cannon":
			wind_on_terminal += 1
	check(wind_on_terminal > 0, "a caixa traz armas dos dois mapas: Canhão de Vento também no Terminal (%d)" % wind_on_terminal)
	var legendary := float(counts.get(&"legendary", 0)) / 2000.0
	check(legendary > 0.04 and legendary < 0.13, "lendárias perto do peso do jogo web (8%%): %.1f%%" % (legendary * 100.0))
	var wind_on_hospital := false
	for i in 3000:
		if MysteryBox.roll_weapon(catalog, data.rarity_weights, "map2", rng).id == &"wind_cannon":
			wind_on_hospital = true
			break
	check(wind_on_hospital, "Canhão de Vento pode sair no Hospital")


func _test_pixel_font() -> void:
	print("Fonte pixel e molduras")
	var font := load("res://assets/fonts/pixel.fnt") as FontFile
	check(font != null and ProjectSettings.get_setting("gui/theme/custom_font") == "res://assets/fonts/pixel.fnt", "fonte pixel é a padrão do projeto")
	var needed := "ABCXYZabcxyz0123456789ÁÃÂÇÉÊÍÓÔÕÚáãâçéêíóôõú·—◆×←↑→↓⚠✕📻📼[]%/:!?"
	var missing := []
	for i in needed.length():
		if not font.has_char(needed.unicode_at(i)):
			missing.append(needed[i])
	check(missing.is_empty(), "todos os caracteres da interface na fonte (faltam: %s)" % str(missing))
	check(MenuKit.px(16) == 26 and MenuKit.px(40) == 39 and MenuKit.px(54) == 52, "tamanhos em múltiplos inteiros da célula (2×, 3×, 4×)")
	check(PixelSkin.panel() is StyleBoxTexture and ResourceLoader.exists("res://assets/ui/bar_segment.png"), "molduras pixel geradas")


func _test_weapon_lab() -> void:
	print("Weapon Lab (Mk II e Mk III)")
	var lab := load("res://data/configs/weapon_lab.tres") as WeaponLabData
	var m4 := load("res://data/weapons/m4.tres") as WeaponData
	var original_damage := m4.damage
	var original_magazine := m4.magazine_size
	var mk2 := WeaponUpgrade.mk2(m4, lab)
	check(is_equal_approx(mk2.damage, roundf(m4.damage * 1.8)) and mk2.magazine_size == roundi(m4.magazine_size * 1.5), "Mk II: dano ×1.8 e pente ×1.5")
	check(mk2.pierce == m4.pierce + 1 and mk2.display_name == "M4 Mk II", "Mk II: atravessa +1 zumbi e muda o nome")
	check(m4.damage == original_damage and m4.magazine_size == original_magazine and m4.display_name == "M4", "os dados originais (compartilhados) não mudam")
	var mk3 := WeaponUpgrade.mk3(mk2, lab)
	check(mk3.pellets == mk2.pellets * 2 and mk3.display_name == "M4 Mk III", "Mk III: projéteis em dobro")
	var wind := load("res://data/weapons/wind_cannon.tres") as WeaponData
	check(WeaponUpgrade.mk2(wind, lab).display_name == "Tornado", "Canhão de Vento vira Tornado")
	var weapon := Weapon.new()
	weapon.data = m4
	weapon.reset_ammo()
	weapon.upgrade_to(mk2)
	check(weapon.level == 1 and weapon.magazine == mk2.magazine_size, "arma sobe de nível com munição cheia")
	check(WeaponUpgrade.next_level(mk3, 2, lab) == null, "Mk III é o máximo")
	weapon.free()


func _test_perks() -> void:
	print("Perks")
	var perks := PerkSystem.new()
	var fortify := load("res://data/perks/fortify.tres") as PerkData
	var sprint := load("res://data/perks/sprint.tres") as PerkData
	var deadeye := load("res://data/perks/deadeye.tres") as PerkData
	var revive := load("res://data/perks/quick_revive.tres") as PerkData
	check(perks.grant(fortify) and is_equal_approx(perks.max_health_bonus, 50.0), "Fortify: +50 de vida")
	check(not perks.grant(fortify), "não compra o mesmo perk duas vezes")
	perks.grant(sprint)
	perks.grant(deadeye)
	check(is_equal_approx(perks.speed_multiplier, 1.2) and is_equal_approx(perks.headshot_bonus, 1.0), "Sprint+ (+20%) e Deadeye (+100% no headshot) somam")
	check(revive.works_without_power and not fortify.works_without_power, "só o Quick Revive funciona sem energia")
	var uses := 0
	for i in 5:
		if perks.grant(revive) and perks.consume_self_revive():
			uses += 1
	check(uses == 3, "Quick Revive: no máximo 3 por partida (%d)" % uses)
	check(perks.consume_self_revive() == null, "sem Quick Revive, não levanta")
	perks.free()


func _test_composition() -> void:
	print("Composição por round (jogo web)")
	var data := load("res://data/configs/rounds.tres") as RoundData
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	var seen := func(round_number: int, map_id: String, alive: Dictionary) -> Dictionary:
		var types := {}
		for i in 400:
			types[data.pick_type(round_number, map_id, alive, rng)] = true
		return types
	check(seen.call(1, "terminal", {}).keys() == [&"walker"], "round 1: só Walkers")
	var r6: Dictionary = seen.call(6, "terminal", {})
	check(r6.has(&"tank") and r6.has(&"runner") and not r6.has(&"exploder"), "round 6: Tanks e Runners, sem Exploders ainda")
	check(seen.call(11, "terminal", {}).has(&"exploder"), "round 11: Exploders")
	check(not seen.call(8, "terminal", {}).has(&"crawler") and seen.call(8, "map2", {}).has(&"armored"), "inimigos do Hospital só no Hospital")
	check(not seen.call(6, "terminal", {&"tank": 2}).has(&"tank"), "no máximo 2 Tanks vivos")
	check(data.type_cap(&"tank", 16) == 3, "a partir do round 16: até 3 Tanks")
	var hound_rounds := range(1, 30).filter(func(r: int) -> bool: return data.is_hound_round(r, "map2"))
	check(hound_rounds == [5, 11, 17, 23, 29], "cães no Hospital: rounds 5, 11, 17... (%s)" % [hound_rounds])
	check(range(1, 30).all(func(r: int) -> bool: return not data.is_hound_round(r, "terminal")), "sem rodada dos cães no Terminal")
	check(data.hound_total(5, "map2") == 7, "round 5: 7 cães")


func _test_save() -> void:
	print("Save (mesmo formato do jogo web)")
	# Um save escrito pelo jogo web (chaves em camelCase, números como no JSON do navegador).
	var web := {
		"version": 1,
		"settings": {"muted": false, "musicOn": false, "playerName": "MARIA", "volume": 0.5, "skin": "nurse"},
		"records": {"terminal": {"bestWave": 12, "bestKills": 150, "bestScore": 42000}},
		"unlockedMaps": ["terminal", "map2", "mapa_que_nao_existe"],
		"ranking": {"terminal": [{"name": "MARIA", "score": 42000, "wave": 12, "kills": 150, "date": "2026-09-20T10:00:00Z"}]},
		"lifetime": {"gamesPlayed": 7, "totalKills": 900, "bossesDefeated": 1, "playTimeMs": 3600000, "knifeKills": 12, "headshots": 80},
		"secrets": {"teddies": true, "konami": false},
		"achievements": {"first_blood": "2026-09-20T10:00:00Z"},
	}
	var clean := Save.sanitize(web)
	check(clean.settings.playerName == "MARIA" and clean.settings.musicOn == false and is_equal_approx(clean.settings.volume, 0.5), "lê as configurações do jogo web")
	check(clean.records.terminal.bestScore == 42000 and clean.unlockedMaps == ["terminal", "map2"], "lê recordes e mapas (ignora mapa desconhecido)")
	check(clean.lifetime.totalKills == 900 and clean.achievements.has("first_blood"), "lê totais e conquistas")
	var broken := Save.sanitize({"settings": "lixo", "records": [1, 2], "ranking": {"terminal": [{"sem_nome": 1}]}, "lifetime": {"totalKills": "muitos"}})
	check(broken.settings.playerName == "SOBREVIVENTE" and broken.ranking.terminal.is_empty() and broken.lifetime.totalKills == 0, "save corrompido vira o padrão, campo a campo")
	check(Save.sanitize(null).unlockedMaps == ["terminal"], "save vazio: só o Terminal liberado")
	# Web: save e sessão do jogo antigo vêm do localStorage (aqui como texto, sem navegador).
	var legacy := Save.sanitize(SaveStore.parse_legacy(JSON.stringify(web)))
	check(legacy.records.terminal.bestScore == 42000 and legacy.ranking.terminal[0].name == "MARIA", "save do jogo web antigo (localStorage) é importado")
	check(SaveStore.parse_legacy("") == null and SaveStore.parse_legacy("{lixo") == null and SaveStore.web_storage("ts-save-v1") == "",
		"save antigo vazio ou quebrado vira null; fora da Web não lê localStorage")
	var session: Dictionary = Account.session_from_web(JSON.stringify({"accessToken": "a", "refreshToken": "r", "expiresAt": 1790000000000, "username": "maria"}))
	check(session.get("access_token") == "a" and session.get("username") == "maria" and is_equal_approx(float(session.get("expires_at", 0)), 1790000000.0),
		"sessão do jogo web vira a do Godot (validade de ms para s)")
	check(Account.session_from_web(JSON.stringify({"accessToken": "a"})).is_empty() and Account.session_from_web("").is_empty(), "sessão antiga incompleta é ignorada")
	Save.reset()
	for i in 12:
		Save.add_ranking("terminal", "j%d" % i, 1000 + i * 10, 3, 20)
	var list := Save.ranking("terminal")
	check(list.size() == 10 and list[0].score == 1110 and list[0].name == "J11", "ranking: top 10, ordenado, nome em maiúsculas")
	check(not Save.qualifies("terminal", 1000) and Save.qualifies("terminal", 5000), "só entra quem supera o 10º")
	var before := Save.finish_run("terminal", {"wave": 8, "kills": 60, "score": 9000, "bosses": 0, "time_ms": 60000, "knife_kills": 2, "headshots": 9})
	check(before.bestScore == 0 and Save.records("terminal").bestScore == 9000 and Save.lifetime.gamesPlayed == 1, "fim de partida grava recorde e totais")
	Save.merge_from(web)
	check(Save.records("terminal").bestScore == 42000 and Save.is_unlocked("map2") and Save.lifetime.gamesPlayed == 7, "mescla da nuvem fica com o melhor de cada lado")
	check(Save.ranking("terminal")[0].name == "MARIA", "mescla junta os rankings")
	check(Save.catalog.unlocked_by("terminal", 10) == PackedStringArray(["map2"]) and Save.catalog.unlocked_by("terminal", 9).is_empty(), "boss do round 10 no Terminal libera o Hospital")
	Save.reset()


func _test_score() -> void:
	print("Pontuação do ranking (jogo web)")
	var score := ScoreManager.new()
	score.data = load("res://data/configs/score.tres")
	_tree_root.add_child(score)
	var walker := ZombieFactory.create(load("res://data/zombies/walker.tres"), null, 1, 1, 1)
	Events.round_started.emit(1, 9)
	Events.zombie_killed.emit(walker, DamageInfo.new(100, DamageInfo.Kind.WEAPON, null, true))
	check(score.score == 16, "Walker no round 1 na cabeça: 10 × 1.1 + 5 = 16 (%d)" % score.score)
	var before := score.score
	Events.zombie_killed.emit(walker, DamageInfo.new(100, DamageInfo.Kind.ENVIRONMENT))
	check(score.score - before == 6, "morte indireta vale metade (%d)" % (score.score - before))
	Events.round_completed.emit(3)
	check(score.score - before - 6 == 150, "round 3 completo: +150")
	walker.free()
	score.queue_free()


func _test_anti_cheat() -> void:
	print("Anti-trapaça (jogo web)")
	var cheat_data := load("res://data/configs/anticheat.tres") as AntiCheatData
	var make := func() -> Array:
		var points := PointsManager.new()
		points.data = load("res://data/configs/points.tres")
		var score := ScoreManager.new()
		score.data = load("res://data/configs/score.tres")
		var guard := AntiCheat.new()
		guard.data = cheat_data
		guard.points_manager = points
		guard.score_manager = score
		for node in [points, score, guard]:
			_tree_root.add_child(node)
		return [points, score, guard]
	var honest: Array = make.call()
	for i in 20:
		(honest[0] as PointsManager).add(150)
		(honest[1] as ScoreManager).add(40)
	check(not (honest[2] as AntiCheat).flagged, "jogo normal não é marcado")
	var greedy: Array = make.call()
	(greedy[0] as PointsManager).add(999999)
	check((greedy[2] as AntiCheat).flagged and (greedy[2] as AntiCheat).taunt in cheat_data.taunts, "ganho absurdo de pontos invalida a partida (zoeira)")
	var editor: Array = make.call()
	(editor[1] as ScoreManager).score = 500000  # alterado por fora, sem passar pelo sistema
	(editor[2] as AntiCheat)._check_integrity()
	check((editor[2] as AntiCheat).flagged, "score alterado por fora é detectado")
	# Partida invalidada: o fim de jogo não grava nada no save.
	Save.reset()
	var rounds := RoundManager.new()
	rounds.data = load("res://data/configs/rounds.tres")
	rounds.process_mode = Node.PROCESS_MODE_DISABLED
	var game := GameManager.new()
	game.round_manager = rounds
	game.points_manager = editor[0]
	game.score_manager = editor[1]
	game.anti_cheat = editor[2]
	_tree_root.add_child(rounds)
	_tree_root.add_child(game)
	var summary := {}
	var capture := func(s: Dictionary) -> void: summary.merge(s)
	Events.game_over.connect(capture)
	Events.player_died.emit()
	Events.game_over.disconnect(capture)
	check(summary.get("cheat_taunt", "") != "" and not summary.get("rank_eligible", true), "fim de jogo invalidado: sem ranking")
	check(Save.lifetime.gamesPlayed == 0 and Save.records(Session.map_id).bestScore == 0, "fim de jogo invalidado: save intacto")
	for node in honest + greedy + editor + [rounds, game]:
		node.queue_free()


func _test_achievements() -> void:
	print("Conquistas e visuais (jogo web)")
	Save.reset()
	var catalog := load("res://data/configs/achievements.tres") as AchievementCatalog
	check(catalog.achievements.size() == 23 and not catalog.find("last_train").is_empty() and not catalog.find("underworld_gate").is_empty(), "17 conquistas do jogo web + a da missão do Terminal + 5 do Templo")
	check(catalog.achievements.all(func(a: Dictionary) -> bool: return String(a.get("icon", "")) != ""), "toda conquista tem ícone")
	var system := AchievementSystem.new()
	system.catalog = catalog
	_tree_root.add_child(system)
	var got: Array[String] = []
	var capture := func(id: String, _n: String, _d: String) -> void: got.append(id)
	Events.achievement_unlocked.connect(capture)
	var walker := ZombieFactory.create(load("res://data/zombies/walker.tres"), null, 1, 1, 1)
	Events.zombie_killed.emit(walker, DamageInfo.new(100, DamageInfo.Kind.MELEE))
	Events.round_started.emit(10, 9)
	Events.boss_defeated.emit(&"conductor", "The Conductor", 2000, Vector3.ZERO)
	Events.zombie_killed.emit(walker, DamageInfo.new(100, DamageInfo.Kind.WEAPON))
	check(got.has("first_blood") and got.count("first_blood") == 1, "Primeiro Sangue (uma vez só)")
	check(got.has("survivor") and got.has("conductor") and not got.has("veteran"), "Sobrevivente (round 10) e Maquinista (boss)")
	Save.data.lifetime.knifeKills = 49
	Events.zombie_killed.emit(walker, DamageInfo.new(100, DamageInfo.Kind.MELEE))
	check(Save.has_achievement("knife_master"), "Faca na Caveira: 50 abates na faca (total + partida)")
	Events.hound_round_changed.emit(true, {})
	Events.hound_round_changed.emit(false, {})
	check(Save.has_achievement("dog_trainer"), "Adestrador: rodada dos cães sem levar dano")
	Events.achievement_unlocked.disconnect(capture)
	var skins := load("res://data/configs/skins.tres") as SkinCatalog
	check(skins.skins.size() == 12 and CharacterScreenCheck.unlocked(skins.find("conductor")) and not CharacterScreenCheck.unlocked(skins.find("agent")),
		"visual Maquinista liberado pelo boss; Agente ainda trancado")
	walker.free()
	system.queue_free()
	Save.reset()
