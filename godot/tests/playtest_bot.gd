extends Node
## Bot do teste jogado: abre a cena principal, mira e atira nos zumbis (alternando cabeça e
## corpo) até o round 3, depois deixa o jogador morrer, confere a tela de fim e reinicia.

const TIME_SCALE := 3.0
## Tempo máximo de jogo (s, já acelerado) antes de desistir.
const MAX_GAME_TIME := 240.0
const TARGET_ROUND := 3

var _checks: Array[String] = []
var _failed := 0
var _game_time := 0.0
var _phase := &"boot"
var _kills := 0
var _headshots := 0
var _body_kills := 0
var _saw_attack := false
var _saw_nav_path := false
var _shot_mid := false
var _body_turn := false
## Munição cheia ao começar o round 2 (reabastecimento do MVP).
var _refilled := false


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://tests/output"))
	Events.zombie_killed.connect(_on_zombie_killed)
	Events.round_started.connect(_on_round_started)
	get_tree().change_scene_to_file.call_deferred("res://scenes/main.tscn")
	Engine.time_scale = TIME_SCALE
	_phase = &"play"


func _physics_process(delta: float) -> void:
	var main := get_tree().current_scene
	if main == null or main.name != &"Main":
		return
	var player := main.get_node("Player") as Player
	var rounds := main.get_node("RoundManager") as RoundManager
	_game_time += delta
	match _phase:
		&"play":
			_play(main, player, rounds)
		&"die":
			if not player.is_alive():
				_phase = &"game_over"
				_finish_game_over.call_deferred(main)


func _play(main: Node, player: Player, rounds: RoundManager) -> void:
	player.controlled = false
	player.health.invulnerable = true
	var zombies := main.get_node("Zombies").get_children().filter(func(z: Node) -> bool: return z is ZombieBase and (z as ZombieBase).is_alive())
	for z in zombies:
		var zombie := z as ZombieBase
		if zombie.state == ZombieBase.State.ATTACK:
			_saw_attack = true
		if zombie.agent.get_current_navigation_path().size() > 1:
			_saw_nav_path = true
	if zombies.size() >= 4 and not _shot_mid:
		_shot_mid = true
		_screenshot.call_deferred("playtest_combate")
	# Deixa os primeiros zumbis chegarem (confere o ataque) antes de atirar.
	var hold_fire := not _saw_attack and _game_time < 60.0
	var nearest: ZombieBase = null
	for z in zombies:
		if nearest == null or player.global_position.distance_to(z.global_position) < player.global_position.distance_to(nearest.global_position):
			nearest = z
	player.move_input = Vector2.ZERO
	if nearest and not hold_fire:
		var aim := nearest.get_node("BodyHurtbox" if _body_turn else "HeadHurtbox") as Node3D
		player.aim_point = aim.global_position
		player.fire()
	if rounds.round_number >= TARGET_ROUND or _game_time > MAX_GAME_TIME:
		_end_play(main, player, rounds)


func _end_play(main: Node, player: Player, rounds: RoundManager) -> void:
	var points := (main.get_node("PointsManager") as PointsManager).points
	_check(rounds.round_number >= TARGET_ROUND, "chegou ao round %d (round atual %d, %.0fs de jogo)" % [TARGET_ROUND, rounds.round_number, _game_time])
	_check(_saw_nav_path, "zumbis seguiram caminho da navegação")
	_check(_saw_attack, "zumbis chegaram e atacaram o jogador")
	_check(_kills >= 21, "abateu os zumbis dos rounds 1 e 2 (%d abates)" % _kills)
	_check(_headshots > 0 and _body_kills > 0, "abates na cabeça (%d) e no corpo (%d)" % [_headshots, _body_kills])
	_check(_refilled, "munição reabastecida ao fim do round")
	_check(points > 500, "pontos subiram (%d)" % points)
	var data := (main.get_node("RoundManager") as RoundManager).data
	var alive := (main.get_node("SpawnManager") as SpawnManager).alive_count()
	_check(alive <= data.max_alive(rounds.round_number), "respeita o limite de vivos (%d)" % alive)
	# Agora o jogador fica vulnerável e para de atirar: os zumbis devem matá-lo.
	player.health.invulnerable = false
	_phase = &"die"


func _finish_game_over(main: Node) -> void:
	await get_tree().create_timer(2.0 * TIME_SCALE).timeout
	var hud := main.get_node("HUD")
	var panel := hud.get(&"_game_over_panel") as Control
	_check(panel != null and panel.visible, "tela de fim de jogo aparece quando o jogador morre")
	await _screenshot("playtest_game_over")
	Events.restart_requested.emit()
	await get_tree().create_timer(1.0 * TIME_SCALE).timeout
	var fresh := get_tree().current_scene
	var restarted := fresh != main and (fresh.get_node("RoundManager") as RoundManager).round_number == 0 and (fresh.get_node("Player") as Player).is_alive()
	_check(restarted, "jogar novamente reinicia a partida")
	_report()


func _on_round_started(round_number: int, _total: int) -> void:
	var main := get_tree().current_scene
	if round_number == 2 and main and main.has_node("Player"):
		var weapon := (main.get_node("Player") as Player).weapon
		_refilled = weapon.reserve == weapon.data.reserve_ammo


func _on_zombie_killed(_zombie: Node3D, info: DamageInfo) -> void:
	_kills += 1
	if info.is_headshot:
		_headshots += 1
	else:
		_body_kills += 1
	# Alterna o alvo: um zumbi na cabeça, o próximo no corpo.
	_body_turn = not _body_turn


func _screenshot(file_name: String) -> void:
	await RenderingServer.frame_post_draw
	var image := get_viewport().get_texture().get_image()
	image.save_png(ProjectSettings.globalize_path("res://tests/output/%s.png" % file_name))


func _check(condition: bool, description: String) -> void:
	if not condition:
		_failed += 1
	_checks.append(("  ok  " if condition else "  FALHOU  ") + description)


func _report() -> void:
	print("\nPLAYTEST")
	for line in _checks:
		print(line)
	print("%d falharam" % _failed)
	Engine.time_scale = 1.0
	get_tree().quit(1 if _failed > 0 else 0)
