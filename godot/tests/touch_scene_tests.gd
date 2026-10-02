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
	await _auto_aim()
	await _hints_and_layout()

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
	# Controles simplificados: um analógico só (mover), tela toda fora dos botões e do topo —
	# não existe mais analógico de mira (a mira é sempre assistida, ver _assist()).
	var r := _touch.radius
	var left := Vector2(_touch.size.x * 0.2, _touch.size.y * 0.7)
	_press(0, left)
	_drag(0, left + Vector2(r * 2.0, 0.0))
	await _frames(1)
	var movement := Input.get_vector(&"move_left", &"move_right", &"move_up", &"move_down")
	check(movement.x > 0.95 and absf(movement.y) < 0.05, "analógico para a direita: move para a direita (%.2f)" % movement.x)
	check(Input.get_vector(&"aim_left", &"aim_right", &"aim_up", &"aim_down") == Vector2.ZERO, "não existe mais analógico de mira")
	var right := Vector2(_touch.size.x * 0.8, _touch.size.y * 0.6)
	_press(1, right)
	_drag(1, right + Vector2(0.0, -r * 0.5))
	await _frames(1)
	check(Input.get_vector(&"move_left", &"move_right", &"move_up", &"move_down").x > 0.95, "segundo dedo (já tem analógico ativo): mover continua com o primeiro")
	_release(0)
	_release(1)
	await _frames(1)
	check(Input.get_vector(&"move_left", &"move_right", &"move_up", &"move_down") == Vector2.ZERO, "soltar o dedo zera o movimento")
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
	InputBindings.press_back()
	await _frames(2)
	check(_tree.paused, "botão voltar do Android pausa a partida (como ESC)")
	(_main.get_node("GameManager") as GameManager).set_paused(false)
	await _frames(2)


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
	await _frames(1)
	await _face_movement_without_target()


## Sem analógico de mira: parado (sem zumbi no cone, sem ATIRAR), o personagem vira sozinho
## para a direção em que o analógico de mover está sendo empurrado.
func _face_movement_without_target() -> void:
	_player.set(&"_aim_dir", Vector3.BACK)
	_player.controlled = true
	var finger := 9
	var at := Vector2(_touch.size.x * 0.2, _touch.size.y * 0.7)
	_press(finger, at)
	_drag(finger, at + Vector2(_touch.radius * 2.0, 0.0))
	await _frames(12)
	var dir: Vector3 = _player.get(&"_aim_dir")
	check(dir.x > 0.5, "sem zumbi perto: vira pra direção em que anda (%.2f, %.2f)" % [dir.x, dir.z])
	_release(finger)
	_player.controlled = false
	await _frames(1)


## Mira automática 360° (padrão no toque): trava no zumbi à vista mais perto em qualquer direção,
## sem ATIRAR; parede bloqueia; alvo grudento; desligada volta o cone; tiro automático opcional.
func _auto_aim() -> void:
	var data := load("res://data/zombies/walker.tres") as ZombieData
	var arena := _player.get_parent() as Node3D
	var hud := _main.get_node("HUD")
	var saved := [Save.get_setting("autoAim"), Save.get_setting("autoFire")]
	Save.set_setting("autoAim", true)
	Save.set_setting("autoFire", false)
	_player.set(&"_aim_dir", Vector3.RIGHT)
	_player.controlled = true
	# Atrás do personagem (fora do antigo cone de 22°), num lugar sem parede no caminho.
	var behind := _clear_offset([Vector3(-5.0, 0.0, 0.5), Vector3(-4.0, 0.0, -2.0), Vector3(-4.0, 0.0, 2.5), Vector3(-3.0, 0.0, 0.0)])
	var back := _zombie(data, arena, behind)
	# Parado no lugar (sem a IA andando até o jogador): a conferência do giro não depende da
	# velocidade da máquina. Continua vivo e com hurtbox (alvo dos raios e dos tiros).
	back.process_mode = Node.PROCESS_MODE_DISABLED
	await _physics(30)
	var dir: Vector3 = _player.get(&"_aim_dir")
	var to_back := back.global_position - _player.global_position
	to_back.y = 0.0
	check(_player.assist_lock == back and dir.dot(to_back.normalized()) > 0.9 and not Input.is_action_pressed(&"fire"),
		"mira automática: trava no zumbi atrás e gira para ele sem ATIRAR (%.2f)" % dir.dot(to_back.normalized()))
	var mark := hud.get("_target_mark") as Control
	var camera := _player.get_viewport().get_camera_3d()
	var expected := camera.unproject_position(back.global_position + Vector3.UP) if camera else Vector2.ZERO
	check(mark != null and mark.visible and mark.position.distance_to(expected) < 24.0, "marcador sobre o alvo travado")
	# Alvo grudento: um pouco mais perto não troca; bem mais perto troca.
	var current_distance := _flat(back)
	var near_side := behind.normalized().rotated(Vector3.UP, 0.6) * (current_distance * 0.85)
	var slightly := _zombie(data, arena, near_side)
	await _frames(2)
	check(_player.pick_lock(back) == back, "alvo grudento: um zumbi só um pouco mais perto não rouba a mira")
	slightly.queue_free()
	var much := _zombie(data, arena, behind.normalized() * 1.5)
	await _frames(2)
	check(_player.pick_lock(back) == much, "um zumbi bem mais perto vira o alvo")
	much.queue_free()
	# Parede (camada do mundo) entre o jogador e o zumbi: ele não é alvo.
	var wall := StaticBody3D.new()
	wall.collision_layer = PhysicsLayers.WORLD
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(4.0, 4.0, 0.4)  # fina na direção do olhar (o -Z do look_at)
	shape.shape = box
	wall.add_child(shape)
	arena.add_child(wall)
	wall.global_position = _player.global_position + behind.normalized() * (current_distance * 0.5) + Vector3.UP * 1.5
	wall.look_at(_player.global_position + Vector3.UP * 1.5, Vector3.UP)
	await _tree.physics_frame
	await _tree.physics_frame
	check(_player.pick_lock() != back, "zumbi atrás de uma parede não é alvo")
	wall.queue_free()
	await _tree.physics_frame
	# Desligada: volta a mira assistida (cone + ATIRAR) e o zumbi atrás é ignorado.
	Save.set_setting("autoAim", false)
	_player.set(&"_aim_dir", -to_back.normalized())
	await _physics(12)
	dir = _player.get(&"_aim_dir")
	check(_player.assist_lock == null and dir.dot(to_back.normalized()) < 0.0, "MIRA AUTOMÁTICA desligada: só o cone ao atirar, como antes")
	Save.set_setting("autoAim", true)
	await _physics(30)
	dir = _player.get(&"_aim_dir")
	check(dir.dot(to_back.normalized()) > 0.95, "zumbi exatamente atrás (180°): a mira vira até ele (%.2f)" % dir.dot(to_back.normalized()))
	# Tiro automático: desligado não atira; ligado, gasta o pente sozinho no alvo.
	var weapon := _player.weapon
	weapon.reloading = false
	weapon.magazine = weapon.data.magazine_size
	await _physics(20)
	check(weapon.magazine == weapon.data.magazine_size, "TIRO AUTOMÁTICO desligado: não atira sozinho")
	Save.set_setting("autoFire", true)
	await _physics(40)
	check(weapon.magazine < weapon.data.magazine_size or not is_instance_valid(back) or not back.is_alive(), "TIRO AUTOMÁTICO ligado: atira sozinho no alvo travado (pente %d/%d, alvo %s, recarga %s, ocupada %s, mira %s)" % [weapon.magazine, weapon.data.magazine_size, _player.assist_lock == back, weapon.reloading, weapon.busy, (_player.get(&"_aim_dir") as Vector3).snappedf(0.01)])
	Save.set_setting("autoFire", false)
	_player.controlled = false
	if is_instance_valid(back):
		back.queue_free()
	# Deixa os sons dos tiros e do zumbi terminarem (senão ficam presos no áudio ao sair).
	await _tree.create_timer(1.5).timeout
	Save.set_setting("autoAim", saved[0] if saved[0] is bool else true)
	Save.set_setting("autoFire", saved[1] if saved[1] is bool else false)


## Dicas com o nome do botão, USAR pulsando, canhoto e tamanho dos botões.
func _hints_and_layout() -> void:
	var door := Loc.fmt("[%s] ABRIR PORTA  ·  %s pontos", [Loc.key(&"interact"), 750])
	check(InputBindings.hint_label(&"interact") == "USAR" and Loc.text(door).begins_with("[USAR] ABRIR PORTA"), "no toque a dica mostra o botão: %s" % Loc.text(door))
	Events.interaction_prompt.emit(door, "", -1.0)
	await _frames(1)
	var pulsing := _touch.is_highlighted(&"interact")
	Events.interaction_prompt.emit("MUNIÇÃO CHEIA", "", -1.0)
	await _frames(1)
	check(pulsing and not _touch.is_highlighted(&"interact"), "USAR pulsa quando a dica pede ele (e para quando não pede)")
	Events.interaction_prompt.emit("", "", -1.0)
	var saved := [Save.get_setting("touchLeftHanded"), Save.get_setting("touchButtons")]
	var medium: float = _touch.buttons[&"fire"].r
	Save.set_setting("touchButtons", "large")
	Save.set_setting("touchLeftHanded", true)
	Events.settings_changed.emit()
	await _frames(3)
	var hud := _main.get_node("HUD")
	var health_panel := ((hud.get("_health_label") as Control).get_parent().get_parent()) as Control
	check(_touch.buttons[&"fire"].pos.x < _touch.size.x * 0.5 and float(_touch.buttons[&"fire"].r) > medium,
		"canhoto: ATIRAR à esquerda; GRANDE: botões maiores")
	var ammo_panel := ((hud.get("_ammo_box") as Control).get_parent()) as Control
	check(health_panel.position.x > _touch.size.x * 0.5 and health_panel.position.y + health_panel.size.y <= ammo_panel.position.y,
		"canhoto: o painel de vida vai para a direita, em cima da munição (longe dos botões)")
	Save.set_setting("touchLeftHanded", saved[0] if saved[0] is bool else false)
	Save.set_setting("touchButtons", saved[1] if saved[1] is String else "medium")
	Events.settings_changed.emit()
	await _frames(2)
	check(_touch.buttons[&"fire"].pos.x > _touch.size.x * 0.5, "destro de novo: ATIRAR à direita")


## Primeiro deslocamento sem parede entre o peito do jogador e o ponto.
func _clear_offset(options: Array) -> Vector3:
	var space := _player.get_world_3d().direct_space_state
	for offset: Vector3 in options:
		var from := _player.global_position + Vector3.UP * _player.muzzle_height
		var query := PhysicsRayQueryParameters3D.create(from, from + offset, PhysicsLayers.WORLD)
		if space.intersect_ray(query).is_empty():
			return offset
	return options[0]


func _flat(node: Node3D) -> float:
	var offset := node.global_position - _player.global_position
	offset.y = 0.0
	return offset.length()


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


## Quadros de física (a mira e o tiro andam na física; sem janela, os quadros de desenho correm
## bem mais rápido que ela).
func _physics(count: int) -> void:
	for i in count:
		await _tree.physics_frame


func _frames(count: int) -> void:
	for i in count:
		await _tree.process_frame
