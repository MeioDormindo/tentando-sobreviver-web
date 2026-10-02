extends RefCounted
## Testes de cena da partida completa (main.tscn, Terminal): arma que cai ao trocar e é pega
## de volta, minimapa (grade, posições, área aberta, configuração e Tab) e o menu de pausa
## com as configurações. Executados por run_tests.gd.

var _passed := 0
var _failed := 0
var _tree: SceneTree
var _main: Node
var _player: Player


func run(tree: SceneTree) -> int:
	_tree = tree
	# Nunca no save do jogador: sem o save de teste do run_tests, usa um só desta suíte.
	if not String(Save.get("_path")).contains("test"):
		Save.load_from("user://test_save.json")
	print("Partida: arma caída, minimapa e pausa (cena)")
	_main = (load("res://scenes/main.tscn") as PackedScene).instantiate()
	tree.root.add_child(_main)
	_player = _main.get_node("Player") as Player
	_player.controlled = false
	await _tree.create_timer(0.4).timeout
	var game := _main.get_node("GameManager") as GameManager
	check(game.anti_cheat != null and game.anti_cheat == _main.get_node("AntiCheat"), "o fim de jogo da cena consulta o anti-trapaça")

	await _weapon_drop()
	await _minimap()
	await _pause_menu()
	await _perk_icons()
	await _hit_hud()

	tree.paused = false
	_main.queue_free()
	for node in tree.get_nodes_in_group(&"weapon_drops"):
		node.queue_free()
	await tree.physics_frame
	print("\n%d ok, %d falharam (partida)" % [_passed, _failed])
	return _failed


## Feedback de acerto na HUD: marcador com a cor do tipo (o abate vence), no ponto do acerto
## sem mira de mouse; números de dano que somam no mesmo alvo; desligados nas Configurações.
func _hit_hud() -> void:
	var hud := _main.get_node("HUD")
	var marker := hud.get("_hit_marker") as HitMarker
	var numbers := hud.get("_damage_numbers") as DamageNumbers
	numbers.clear()
	_player.mouse_aim = false
	var at := _player.global_position + Vector3(1.5, 1.2, -2.0)
	Events.hit_confirmed.emit(901, at, 30.0, false, false, false)
	await _tree.process_frame
	check(marker.visible and marker.kind == HitMarker.Kind.HIT, "acerto: marcador branco aparece")
	var camera := _player.get_viewport().get_camera_3d()
	check(camera != null and marker.position.distance_to(camera.unproject_position(at)) < 2.0, "sem mira de mouse (toque/controle): o marcador fica no ponto do acerto")
	Events.hit_confirmed.emit(901, at, 40.0, true, false, false)
	await _tree.process_frame
	check(marker.kind == HitMarker.Kind.HEADSHOT and numbers.text_of(901) == "70", "headshot: marcador amarelo e o número soma no mesmo alvo (%s)" % numbers.text_of(901))
	Events.hit_confirmed.emit(902, at + Vector3(2, 0, 0), 15.0, false, false, true)
	await _tree.process_frame
	check(marker.kind == HitMarker.Kind.HEADSHOT and numbers.count() == 2 and numbers.text_of(902) == "15",
		"bloqueado logo depois não apaga o amarelo; outro alvo ganha número próprio")
	Events.hit_confirmed.emit(902, at, 10.0, false, true, false)
	await _tree.process_frame
	check(marker.kind == HitMarker.Kind.KILL, "abate: marcador vermelho")
	await _tree.create_timer(HitMarker.LIFE + 0.1).timeout
	check(not marker.visible, "o marcador some sozinho")
	await _tree.create_timer(DamageNumbers.LIFE).timeout
	check(numbers.count() == 0, "os números somem sozinhos")
	Save.set_setting("damageNumbers", false)
	Events.hit_confirmed.emit(903, at, 30.0, false, false, false)
	await _tree.process_frame
	check(numbers.count() == 0 and marker.visible, "NÚMEROS DE DANO desligado: só o marcador")
	Save.set_setting("damageNumbers", true)
	check(DamageNumbers.style_of(true, true, true) == &"kill" and DamageNumbers.style_of(false, false, true) == &"blocked"
		and HitMarker.kind_of(true, false, true) == HitMarker.Kind.HEADSHOT, "prioridade: abate > headshot > bloqueado > acerto")


func check(condition: bool, description: String) -> void:
	if condition:
		_passed += 1
		print("  ok  ", description)
	else:
		_failed += 1
		printerr("  FALHOU  ", description)


func _weapon_drop() -> void:
	var inventory := _player.inventory
	inventory.give(load("res://data/weapons/pump.tres"))
	await _tree.create_timer(0.5).timeout
	check(inventory.weapons.size() == 2, "dois espaços ocupados (%s)" % ", ".join(inventory.weapons.map(func(w: Weapon) -> String: return w.data.display_name)))
	var held := _player.weapon
	held.magazine = 1
	var dropped := _player.give_weapon(load("res://data/weapons/glock.tres"))
	check(dropped == held, "pegar uma terceira arma tira a arma em mãos")
	Events.weapon_dropped.emit(dropped, _player.global_position)
	await _tree.process_frame
	var drops := _tree.get_nodes_in_group(&"weapon_drops")
	check(drops.size() == 1, "a arma que saiu cai no chão")
	if drops.is_empty():
		return
	var drop := drops[0] as WeaponDrop
	check(Loc.text(drop.get_interaction_prompt(_player)).contains("troca por GLOCK"), "aviso: %s" % Loc.text(drop.get_interaction_prompt(_player)))
	await _tree.create_timer(0.5).timeout
	check(drop.interact(_player), "pegar a arma de volta")
	await _tree.process_frame
	check(inventory.owns(held.data.id) and held.magazine == 1, "voltou a mesma arma, com a munição dela")
	var swapped := _tree.get_nodes_in_group(&"weapon_drops").filter(func(n: Node) -> bool: return not n.is_queued_for_deletion())
	check(swapped.size() == 1 and (swapped[0] as WeaponDrop).weapon.data.id == &"glock", "a Glock caiu no lugar")
	if swapped.size() == 1:
		var old := swapped[0] as WeaponDrop
		old.age = WeaponDrop.LIFETIME - 0.01
		await _tree.create_timer(0.1).timeout
		check(not is_instance_valid(old), "a arma no chão some depois de 60s")


func _minimap() -> void:
	var hud := _main.get_node("HUD") as Hud
	var minimap := hud.minimap
	var world := _main.get_node("World") as GameWorld
	var grid := world.minimap_size()
	check(minimap.cols == grid.x and minimap.rows == grid.y and grid.x > 0, "minimapa recebeu a grade do mapa (%dx%d)" % [grid.x, grid.y])
	var cells := world.minimap_cells()
	var open_before := cells.count(1)
	check(open_before > 0 and cells.count(2) > 0 and cells.count(3) > 0, "áreas abertas, fechadas e portas no minimapa")
	var state := [{}]
	Events.minimap_state.connect(func(s: Dictionary) -> void: state[0] = s, CONNECT_ONE_SHOT)
	await _tree.create_timer(0.3).timeout
	var player_point: Vector2 = state[0].get("player", Vector2(INF, INF))
	check(player_point.distance_to(Vector2(_player.global_position.x, _player.global_position.z)) < 0.5, "posição do jogador enviada ao minimapa")
	check((state[0].get("boxes", PackedVector2Array()) as PackedVector2Array).size() >= 1, "Mystery Box no minimapa")
	var doors := world.find_children("*", "", true, false).filter(func(n: Node) -> bool: return n is Door and not (n as Door).is_open)
	if not doors.is_empty():
		(doors[0] as Door).open()
	await _tree.process_frame
	check(world.minimap_cells().count(1) > open_before, "abrir uma porta clareia a área no minimapa")
	var small_width := 0.0
	Save.set_setting("minimapSize", "small")
	Events.settings_changed.emit()
	small_width = minimap.size.x
	Save.set_setting("minimapSize", "large")
	Events.settings_changed.emit()
	check(minimap.size.x > small_width, "tamanho do minimapa segue a configuração (%.0f → %.0f)" % [small_width, minimap.size.x])
	Save.set_setting("minimap", false)
	Events.settings_changed.emit()
	check(not minimap.visible, "minimapa desligado nas configurações")
	minimap.set_expanded(true)
	check(minimap.visible and minimap.size.x > small_width * 2.0, "Tab: mapa grande mesmo com o minimapa desligado")
	minimap.set_expanded(false)
	Save.set_setting("minimap", true)
	Save.set_setting("minimapSize", "medium")
	Events.settings_changed.emit()


## Cada perk comprado vira um selo hexagonal (assets/web/machines/perk_<id>.png + badge.mjs),
## tingido na cor do próprio perk, nunca texto.
func _perk_icons() -> void:
	var hud := _main.get_node("HUD") as Hud
	var row: HBoxContainer = hud.get(&"_perks_row")
	check(row.get_child_count() == 0, "sem perk: nenhum ícone")
	_player.perks.grant(load("res://data/perks/deadeye.tres") as PerkData)
	var revive := load("res://data/perks/quick_revive.tres") as PerkData
	_player.perks.grant(revive)
	await _tree.process_frame
	check(row.get_child_count() == 2, "2 perks comprados: 2 selos (%d)" % row.get_child_count())
	var icons_ok := row.get_children().all(func(badge: Control) -> bool:
		return badge.find_children("*", "TextureRect", true, false).all(func(t: TextureRect) -> bool: return t.texture != null))
	check(icons_ok, "cada selo carregou moldura, anel e ícone do perk")
	var revive_badge := row.get_children()[-1] as Control
	var ring := revive_badge.find_child("Ring", true, false) as TextureRect
	check(ring != null and ring.self_modulate.is_equal_approx(revive.color), "o anel do selo usa a cor do próprio perk")


func _pause_menu() -> void:
	var game := _main.get_node("GameManager") as GameManager
	var menu := _main.get_node("HUD").find_child("PauseMenu", true, false) as PauseMenu
	game.set_paused(true)
	await _tree.process_frame
	check(menu.visible and _tree.paused, "ESC: pausa com o menu de pausa")
	var size_button := menu.find_child("MinimapSize", true, false) as Button
	check(size_button != null and menu.find_child("minimap", true, false) != null and menu.find_child("Tabs", true, false) != null, "configurações em abas no menu de pausa (aba JOGO: minimapa, tamanho...)")
	if size_button:
		size_button.pressed.emit()
		await _tree.process_frame
		check(String(Save.get_setting("minimapSize")) == "large", "mudar o tamanho do minimapa na pausa")
		Save.set_setting("minimapSize", "medium")
	var audio_tab := menu.find_child("Tab_audio", true, false) as Button
	if audio_tab:
		audio_tab.pressed.emit()
	await _tree.process_frame
	await _tree.process_frame
	check(menu.find_child("Volume", true, false) != null and menu.find_child("MusicVolume", true, false) != null, "aba ÁUDIO na pausa: volume geral e da música")
	var resume := menu.find_child("Resume", true, false) as Button
	if resume:
		resume.pressed.emit()
	await _tree.process_frame
	check(not _tree.paused and not menu.visible, "CONTINUAR volta ao jogo")
