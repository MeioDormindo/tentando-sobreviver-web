extends RefCounted
## Testes dos sistemas isolados (seção 42). Executados por run_tests.gd.

var _passed := 0
var _failed := 0


## Roda tudo e devolve o número de falhas.
func run() -> int:
	_test_health()
	_test_hurtbox()
	_test_weapon_ammo_and_reload()
	_test_round_formulas()
	_test_spawn_pick()
	_test_points_data()
	_test_inventory()
	_test_spin_up()
	_test_migrated_data()
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
	var dir := DirAccess.open("res://data/weapons")
	var count := 0
	for file in dir.get_files():
		if file.ends_with(".tres") and file != "knife.tres":
			count += 1
	check(count == 19, "19 armas migradas (%d)" % count)
