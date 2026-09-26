extends RefCounted
## Testes de cena dos controles de toque (Fase 8): regra auto/ligado/desligado, analógicos de
## mover e mirar, botões (segurar e soltar), pausa, atalhos de mouse fora no modo toque e a
## mira assistida. Toques simulados com InputEventScreenTouch/Drag. Executados por run_tests.gd.

var _passed := 0
var _failed := 0
var _tree: SceneTree
var _main: Node
var _player: Player
var _touch: TouchControls


func run(tree: SceneTree) -> int:
	_tree = tree
	# Nunca no save do jogador.
	if not String(Save.get("_path")).contains("test"):
		Save.load_from("user://test_save.json")
	print("Controles de toque (cena)")
	_rules()
	var previous_mode := String(Save.get_setting("touchMode"))
	Save.set_setting("touchMode", "on")
	_main = (load("res://scenes/main.tscn") as PackedScene).instantiate()
	tree.root.add_child(_main)
	_main.get_node("RoundManager").stop()
	_player = _main.get_node("Player") as Player
	_player.controlled = false
	_player.health.reset(99999.0)
	await _frames(4)
	_touch = _main.get_node("HUD").touch as TouchControls

	await _visibility()
	await _sticks()
	await _buttons()
	await _pause()
	await _assist()

	_main.queue_free()
	await _frames(2)
	check(not InputBindings.touch_active and _has_mouse(&"fire"), "saiu da partida: modo toque desligado e o clique volta a atirar")
	Save.set_setting("touchMode", previous_mode)
	print("\n%d ok, %d falharam (toque)" % [_passed, _failed])
	return _failed


func check(condition: bool, description: String) -> void:
	if condition:
		_passed += 1
		print("  ok  ", description)
	else:
		_failed += 1
		printerr("  FALHOU  ", description)


func _rules() -> void:
	check(InputBindings.touch_wanted("on", false) and not InputBindings.touch_wanted("off", true),
		"LIGADO sempre mostra, DESLIGADO nunca mostra")
	check(InputBindings.touch_wanted("auto", true) and not InputBindings.touch_wanted("auto", false),
		"AUTO mostra só em aparelho de toque")
	check(not InputBindings.is_touch_device(), "PC não é aparelho de toque")


func _visibility() -> void:
	check(_touch != null and _touch.visible, "controles de toque aparecem na partida (LIGADO)")
	check(InputBindings.touch_active and not _has_mouse(&"fire") and not _has_mouse(&"melee"),
		"modo toque: clique (toque emulado) não atira nem dá facada")
	var panel := ((_main.get_node("HUD").get("_ammo_box") as Control).get_parent()) as Control
	check(panel.position.y + panel.size.y <= _touch.buttons_top(), "painel de munição sobe para cima dos botões")


func _sticks() -> void:
	var r := _touch.radius
	var left := Vector2(_touch.size.x * 0.2, _touch.size.y * 0.7)
	_press(0, left)
	_drag(0, left + Vector2(r * 2.0, 0.0))
	await _frames(1)
	var movement := Input.get_vector(&"move_left", &"move_right", &"move_up", &"move_down")
	check(movement.x > 0.95 and absf(movement.y) < 0.05, "analógico esquerdo para a direita: move para a direita (%.2f)" % movement.x)
	var right := Vector2(_touch.size.x * 0.6, _touch.size.y * 0.6)
	_press(1, right)
	_drag(1, right + Vector2(0.0, -r * 0.5))
	await _frames(1)
	var aim := Input.get_vector(&"aim_left", &"aim_right", &"aim_up", &"aim_down")
	check(aim.y < -0.95, "analógico direito para cima: mira para cima com força total (%.2f)" % aim.y)
	check(Input.get_vector(&"move_left", &"move_right", &"move_up", &"move_down").x > 0.95, "dois dedos ao mesmo tempo: mover continua")
	_release(0)
	_release(1)
	await _frames(1)
	check(Input.get_vector(&"move_left", &"move_right", &"move_up", &"move_down") == Vector2.ZERO
		and Input.get_vector(&"aim_left", &"aim_right", &"aim_up", &"aim_down") == Vector2.ZERO, "soltar os dedos zera mover e mirar")
	_press(2, Vector2(_touch.size.x * 0.2, _touch.size.y * 0.05))
	_drag(2, Vector2(_touch.size.x * 0.2 + r, _touch.size.y * 0.05))
	await _frames(1)
	check(Input.get_vector(&"move_left", &"move_right", &"move_up", &"move_down") == Vector2.ZERO, "toque no topo (HUD) não vira analógico")
	_release(2)


func _buttons() -> void:
	var fire: Vector2 = _touch.buttons[&"fire"].pos
	_press(3, fire)
	await _frames(1)
	check(Input.is_action_pressed(&"fire"), "ATIRAR segurado: fire apertado")
	await _frames(3)
	check(Input.is_action_pressed(&"fire"), "ATIRAR continua apertado enquanto o dedo fica")
	_release(3)
	await _frames(1)
	check(not Input.is_action_pressed(&"fire"), "soltar ATIRAR solta o fire")
	var reload: Vector2 = _touch.buttons[&"reload"].pos
	_press(4, reload)
	await _tree.process_frame
	check(Input.is_action_just_pressed(&"reload"), "RECARR.: reload apertado no toque")
	_release(4)
	await _frames(1)
	check(not Input.is_action_pressed(&"reload"), "soltar RECARR. solta o reload")


func _pause() -> void:
	_press(5, _touch.buttons[&"fire"].pos)
	_press(6, _touch.buttons[&"pause"].pos)
	await _frames(2)
	check(_tree.paused, "botão II pausa a partida")
	check(not _touch.visible and not Input.is_action_pressed(&"fire"), "na pausa os controles somem e soltam tudo (ATIRAR que estava segurado)")
	_release(5)
	_release(6)
	(_main.get_node("GameManager") as GameManager).set_paused(false)
	await _frames(2)
	check(_touch.visible, "controles voltam ao despausar")


func _assist() -> void:
	var data := load("res://data/zombies/walker.tres") as ZombieData
	var arena := _player.get_parent() as Node3D
	_player.set(&"_aim_dir", Vector3.RIGHT)
	var inside := _zombie(data, arena, Vector3(5.0, 0.0, 1.0))
	var outside := _zombie(data, arena, Vector3(0.0, 0.0, 4.0))
	await _frames(2)
	check(_player.assist_target() == inside, "mira assistida: escolhe o zumbi dentro do cone")
	inside.queue_free()
	await _frames(1)
	check(_player.assist_target() == null, "zumbi fora do cone (90°) é ignorado")
	var far := _zombie(data, arena, Vector3(Player.ASSIST_RANGE + 3.0, 0.0, 0.0))
	await _frames(2)
	check(_player.assist_target() == null, "zumbi no cone mas longe demais é ignorado")
	outside.queue_free()
	far.queue_free()


func _zombie(data: ZombieData, arena: Node3D, offset: Vector3) -> ZombieBase:
	var zombie := ZombieFactory.create(data, _player, 60.0, 0.0, 0.0)
	zombie.position = arena.to_local(_player.global_position + offset)
	arena.add_child(zombie)
	return zombie


func _has_mouse(action: StringName) -> bool:
	return InputMap.action_get_events(action).any(func(e: InputEvent) -> bool: return e is InputEventMouseButton)


func _press(finger: int, at: Vector2) -> void:
	var event := InputEventScreenTouch.new()
	event.index = finger
	event.position = at
	event.pressed = true
	_tree.root.push_input(event, true)


func _drag(finger: int, at: Vector2) -> void:
	var event := InputEventScreenDrag.new()
	event.index = finger
	event.position = at
	_tree.root.push_input(event, true)


func _release(finger: int) -> void:
	var event := InputEventScreenTouch.new()
	event.index = finger
	event.pressed = false
	_tree.root.push_input(event, true)


func _frames(count: int) -> void:
	for i in count:
		await _tree.process_frame
