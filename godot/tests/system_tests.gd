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
	_test_coop_ranking()
	_test_score()
	_test_anti_cheat()
	_test_achievements()
	_test_coop_batch()
	_test_i18n_and_settings()
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
	# Cooperativo: cada jogador a mais soma metade da horda do solo.
	var hordes := [1, 2, 3, 4].map(func(n: int) -> int: return data.total_zombies(10, n))
	check(hordes == [36, 54, 72, 90], "round 10: 36 zumbis no solo, ×1,5 em dupla, ×2 em trio, ×2,5 em quarteto (%s)" % [hordes])
	check(data.max_alive(1, 2) == 10 and data.max_alive(20, 2) == 38 and data.max_alive(20, 4) == 40, "vivos no cooperativo: +25% por jogador a mais, teto 40")
	check(is_equal_approx(data.coop_boss_factor(1), 1.0) and is_equal_approx(data.coop_boss_factor(2), 1.5) and is_equal_approx(data.coop_boss_factor(4), 2.5), "chefe no cooperativo: vida ×1,5 em dupla, ×2,5 em quarteto")


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
	check(barricade.planks == data.max_planks and barricade.collision_layer & PhysicsLayers.BARRICADES, "começa com %d tábuas e bloqueia os zumbis" % data.max_planks)
	check(barricade.is_outside(Vector3(-2, 0, 0)) and not barricade.is_outside(Vector3(2, 0, 0)), "sabe o lado de fora")
	for i in data.max_planks:
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
	check(data.hound_total(5, "map2", 2) == 11, "round 5 em dupla: 11 cães (×1,5)")


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
	# Glossário: marca o que foi encontrado; o save valida e a nuvem soma as descobertas.
	check(Save.see("zombie:walker") and not Save.see("zombie:walker") and Save.has_seen("zombie:walker") and not Save.has_seen("zombie:tank"),
		"glossário: marca uma entrada encontrada (só a primeira vez é novidade)")
	var odd := Save.sanitize({"glossary": {"event:fog": "2026-09-01T00:00:00Z", "lixo": 3, "x".repeat(80): "2026-09-01T00:00:00Z"}})
	check(odd.glossary.keys() == ["event:fog"], "glossário no save: ignora entrada inválida")
	Save.merge_from({"glossary": {"zombie:tank": "2026-09-01T00:00:00Z"}})
	check(Save.has_seen("zombie:tank") and Save.has_seen("zombie:walker"), "mescla da nuvem soma as descobertas do glossário")
	Save.reset()


## Ranking local por modo: o time entra no ranking da dupla/trio/quarteto, separado do solo (o
## formato do jogo web), e passa pela validação e pela mescla com a nuvem.
func _test_coop_ranking() -> void:
	print("Ranking local por modo (cooperativo)")
	Save.reset()
	check(Save.add_ranking_coop("terminal", 2, "ana · beto", 900, 6, 40) == 1, "dupla: o time entra em 1º")
	check(Save.add_ranking_coop("terminal", 2, "caio · dani", 1500, 8, 60) == 1, "dupla: o melhor passa à frente")
	var duo := Save.ranking_coop("terminal", 2)
	check(duo.size() == 2 and duo[0].team == "CAIO · DANI" and duo[1].team == "ANA · BETO", "dupla: ordenado, nomes em maiúsculas")
	check(Save.ranking("terminal").is_empty() and Save.ranking_coop("terminal", 3).is_empty(), "o solo e o trio não mudam")
	check(Save.add_ranking_coop("terminal", 1, "x", 100, 1, 1) == 0 and Save.add_ranking_coop("terminal", 5, "x", 100, 1, 1) == 0, "só dupla, trio e quarteto")
	var clean := Save.sanitize({"rankingCoop": {"terminal": {"4": [{"team": "A · B · C · D", "score": 10, "wave": 2, "kills": 3}, {"score": 5}], "9": [{"team": "X", "score": 1}]}, "lixo": 3}})
	check((clean.rankingCoop.terminal as Dictionary).keys() == ["4"] and clean.rankingCoop.terminal["4"].size() == 1, "save: ignora modo e linha inválidos")
	Save.merge_from({"rankingCoop": {"terminal": {"2": [{"team": "EVA · FABIO", "score": 1200, "wave": 7, "kills": 50, "date": "2026-10-01T00:00:00Z"}]}}})
	check(Save.ranking_coop("terminal", 2).size() == 3 and Save.ranking_coop("terminal", 2)[1].team == "EVA · FABIO", "mescla da nuvem junta os times")
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


## Lote do cooperativo: spawn longe de todos, cães misturados, dinheiro na HUD, código da sala,
## PIX e catálogo de perks (funções puras).
func _test_coop_batch() -> void:
	print("Cooperativo (spawn, cães misturados, dinheiro, sala, PIX)")
	var points: Array[Vector3] = [Vector3(2, 0, 0), Vector3(20, 0, 0), Vector3(40, 0, 0)]
	var others: Array[Vector3] = [Vector3(21, 0, 0)]
	var far_from_all := true
	for i in 20:
		far_from_all = far_from_all and SpawnManager.pick_spawn_index(points, Vector3.ZERO, 8.0, others) == 2
	check(far_from_all, "cooperativo: o ponto de spawn fica longe de todos os jogadores, não só de um")
	var data := load("res://data/configs/rounds.tres") as RoundData
	check(data.hound_mix_chance(4) == 0.0 and is_equal_approx(data.hound_mix_chance(5), 0.05) and is_equal_approx(data.hound_mix_chance(10), 0.08) and is_equal_approx(data.hound_mix_chance(40), 0.14),
		"cães misturados: nada antes do round 5, 5%% no 5, sobem por round até 14%%")
	check(data.hound_mix_cap(5) == 3 and data.hound_mix_cap(16) == 4 and data.hound_mix_cap(5, 3) == 5, "cães misturados vivos: 3 (4 no fim de jogo), +1 por jogador a mais")
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	var hounds := 0
	for i in 2000:
		if data.hound_mix_roll(10, 0, rng):
			hounds += 1
	var capped := true
	for i in 200:
		capped = capped and not data.hound_mix_roll(10, 3, rng)
	check(hounds > 110 and hounds < 210 and capped, "round 10: cerca de 8%% dos inimigos são cães (%d de 2000), nunca acima do limite" % hounds)
	check(Hud.money_text(0) == "$0" and Hud.money_text(1250) == "$1.250" and Hud.money_text(1234567) == "$1.234.567" and Hud.money_text(-500) == "-$500" and Hud.money_text(50, true) == "+$50",
		"dinheiro com cifrão e milhar com ponto ($1.250, +$50, -$500)")
	check(Net.code_from_text(" ab cde ") == "ABCDE" and Net.code_from_text("https://site/?sala=xy7kq&x=1") == "XY7KQ"
		and Net.code_from_text("Bora jogar! Sala QWERT: https://site/?sala=QWERT") == "QWERT" and Net.code_from_text("abc") == "",
		"código da sala colado: com espaços, minúsculas ou o link inteiro do convite")
	var payload := SupportInfo.PIX_PAYLOAD
	check(payload.contains(SupportInfo.PIX_KEY) and payload.contains(SupportInfo.PIX_NAME) and _crc16(payload.left(payload.length() - 4)) == payload.right(4),
		"PIX copia e cola com a chave, o nome e o CRC certo (%s)" % payload.right(4))
	check(PerkCatalog.all().size() >= 7 and PerkCatalog.all().all(func(p: PerkData) -> bool: return p.id != &""), "catálogo de perks: todos da pasta (%d)" % PerkCatalog.all().size())


## CRC16-CCITT (0xFFFF) do PIX, em hexadecimal maiúsculo.
static func _crc16(text: String) -> String:
	var crc := 0xFFFF
	for byte in text.to_utf8_buffer():
		crc ^= byte << 8
		for i in 8:
			crc = ((crc << 1) ^ 0x1021) & 0xFFFF if crc & 0x8000 else (crc << 1) & 0xFFFF
	return "%04X" % crc


## Idiomas: o do aparelho, mensagens montadas em quem lê; atalhos trocados; resoluções.
func _test_i18n_and_settings() -> void:
	print("Idiomas, atalhos e vídeo")
	var cases := {"pt_BR": "pt_BR", "pt-PT": "pt_BR", "pt": "pt_BR", "zh_TW": "zh_TW", "zh_HK": "zh_TW", "zh-Hant": "zh_TW", "zh_CN": "zh_CN",
		"zh": "zh_CN", "en_US": "en", "de_AT": "de", "in_ID": "id", "uk_UA": "uk", "ja_JP": "ja", "ko": "ko", "tr_TR": "tr", "xx": "en", "": "en"}
	var wrong := []
	for os_locale: String in cases:
		if Loc.detect(os_locale) != cases[os_locale]:
			wrong.append("%s→%s" % [os_locale, Loc.detect(os_locale)])
	check(wrong.is_empty(), "idioma do aparelho: o da lista ou inglês (errados: %s)" % [wrong])
	check(Loc.wanted("de", "pt_BR") == "de" and Loc.wanted("auto", "fr_FR") == "fr" and Loc.wanted("xx", "ko_KR") == "ko", "a escolha nas Configurações vale mais que o aparelho")
	var door := Loc.fmt("[%s] ABRIR PORTA — %s  ·  %s pontos", [Loc.key(&"interact"), Loc.up("Bilheteria"), 750])
	check(Loc.text(door) == "[E] ABRIR PORTA — BILHETERIA  ·  750 pontos", "mensagem montada em quem lê (tecla e maiúsculas): %s" % Loc.text(door))
	check(Loc.text(Loc.cat(["HORDA", " + ", "TREM"])) == "HORDA + TREM" and Loc.text("JOGAR") == "JOGAR", "mensagens juntadas e texto comum")
	var esperanto := Translation.new()
	esperanto.locale = "eo"
	esperanto.add_message("%s abriu %s", "%s malfermis %s")
	esperanto.add_message("Bilheteria", "Biletejo")
	esperanto.add_message("Tornado", "Ventego")
	TranslationServer.add_translation(esperanto)
	var before := TranslationServer.get_locale()
	TranslationServer.set_locale("eo")
	var feed := Loc.text(Loc.fmt("%s abriu %s", ["ANA", "Bilheteria"]))
	var upgraded := Loc.t("Tornado Mk II")
	TranslationServer.set_locale(before)
	TranslationServer.remove_translation(esperanto)
	check(feed == "ANA malfermis Biletejo" and upgraded == "Ventego Mk II", "traduz o modelo e os argumentos no idioma de quem lê (%s · %s)" % [feed, upgraded])
	# Atalhos: trocar, a outra ação fica com o antigo, sobrevive ao save (JSON) e volta ao padrão.
	var saved: Variant = Save.get_setting("bindings")
	InputBindings.reset_bindings()
	var key_f := InputEventKey.new()
	key_f.physical_keycode = KEY_F
	var pad_a := InputEventJoypadButton.new()
	pad_a.button_index = JOY_BUTTON_A
	check(InputBindings.binding_of(&"reload", InputBindings.KEYBOARD) == ["key", KEY_R] and InputBindings.rebind(&"reload", InputBindings.KEYBOARD, key_f), "trocar a tecla de recarregar para F")
	check(InputBindings.binding_of(&"reload", InputBindings.KEYBOARD) == ["key", KEY_F] and InputBindings.binding_of(&"flashlight", InputBindings.KEYBOARD) == ["key", KEY_R],
		"a lanterna, que usava o F, fica com o R (troca)")
	check(InputMap.action_get_events(&"reload").any(func(e: InputEvent) -> bool: return e is InputEventKey and (e as InputEventKey).physical_keycode == KEY_F), "o F já recarrega (InputMap)")
	check(not InputBindings.rebind(&"reload", InputBindings.KEYBOARD, pad_a), "botão do controle não entra no lugar do teclado")
	Save.set_setting("bindings", JSON.parse_string(JSON.stringify(Save.get_setting("bindings"))))
	check(InputBindings.binding_of(&"reload", InputBindings.KEYBOARD) == ["key", KEY_F], "a troca sobrevive ao save (números do JSON)")
	check(InputBindings.binding_label(["mouse", MOUSE_BUTTON_LEFT]) == "MOUSE ESQ." and InputBindings.binding_label(["joy_button", JOY_BUTTON_A]) == "A"
		and InputBindings.binding_label(["key", KEY_SPACE]) == "ESPAÇO" and InputBindings.hint_label(&"interact") == "E", "nomes das teclas e dos botões")
	InputBindings.reset_bindings()
	check(InputBindings.binding_of(&"reload", InputBindings.KEYBOARD) == ["key", KEY_R] and InputBindings.binding_of(&"flashlight", InputBindings.KEYBOARD) == ["key", KEY_F], "restaurar padrões")
	Save.set_setting("bindings", saved if saved is Dictionary else {})
	InputBindings.apply_saved()
	var full_hd := SettingsRows.resolutions_for(Vector2i(1920, 1080))
	var laptop := SettingsRows.resolutions_for(Vector2i(1440, 900))
	check(full_hd == [Vector2i(1280, 720), Vector2i(1366, 768), Vector2i(1600, 900), Vector2i(1920, 1080)] and laptop.has(Vector2i(1440, 900)) and not laptop.has(Vector2i(1600, 900)),
		"resoluções: só as que cabem na tela, mais a da tela")
	check(SaveStore.parse_resolution("1920x1080") == Vector2i(1920, 1080) and SaveStore.parse_resolution("x") == Vector2i.ZERO, "resolução salva como texto")
	# Catálogo: os 15 idiomas registrados, cada um com todos os textos do .pot, e cada caractere
	# na fonte pixel ou na de reserva do idioma (nada de quadradinho).
	var pot := FileAccess.get_file_as_string("res://locale/messages.pot")
	var expected := pot.split("\nmsgid \"").size() - 1
	var registered := Array(ProjectSettings.get_setting("internationalization/locale/translations", PackedStringArray()))
	var pixel := load(String(ProjectSettings.get_setting("gui/theme/custom_font"))) as Font
	var short := []
	var missing := {}
	for code: String in Loc.LANGUAGES:
		var path := "res://locale/%s.po" % code
		var translation := load(path) as Translation if registered.has(path) else null
		if translation == null or translation.get_message_count() != expected:
			short.append("%s=%d" % [code, translation.get_message_count() if translation else -1])
			continue
		var cjk: Font = load(Loc.CJK_FONTS[code]) if Loc.CJK_FONTS.has(code) else null
		var absent := {}
		for message: String in translation.get_translated_message_list():
			for i in message.length():
				var c := message.unicode_at(i)
				if c != 10 and not pixel.has_char(c) and not (cjk and cjk.has_char(c)):
					absent[String.chr(c)] = true
		if not absent.is_empty():
			missing[code] = "".join(absent.keys().slice(0, 12))
	check(short.is_empty() and expected > 800, "os 15 idiomas registrados com os %d textos (faltando: %s)" % [expected, short])
	check(missing.is_empty(), "todo caractere das traduções existe na fonte do idioma (sem: %s)" % [missing])
	var names_ok := Loc.LANGUAGES.values().all(func(name: String) -> bool:
		for i in name.length():
			if not pixel.has_char(name.unicode_at(i)):
				return false
		return true)
	check(names_ok, "os nomes dos idiomas (日本語, 한국어...) aparecem na lista mesmo jogando em português")
	TranslationServer.set_locale("en")
	var english := [Loc.t("JOGAR"), Loc.text(Loc.fmt("%s abriu %s", ["ANA", Loc.up("Bilheteria")])), Loc.t("Tornado Mk II")]
	TranslationServer.set_locale(Loc.current)
	check(english == ["PLAY", "ANA opened TICKET OFFICE", "Tornado Mk II"], "em inglês: menu, feed e arma melhorada (%s)" % [english])
