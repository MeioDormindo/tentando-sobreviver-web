extends RefCounted
## Testes do áudio (autoload Audio + AudioManager na partida, Terminal): catálogo exportado do
## jogo web, barramentos, som posicional (distância e alcance), loops, limite de vozes, sons
## das armas e dos passos, ambiente por área e a música adaptativa. Executados por run_tests.gd.

var _passed := 0
var _failed := 0
var _tree: SceneTree
var _main: Node
var _player: Player
var _audio: Node


func run(tree: SceneTree) -> int:
	_tree = tree
	if not String(Save.get("_path")).contains("test"):
		Save.load_from("user://test_save.json")
	print("Áudio (cena)")
	_audio = tree.root.get_node("Audio")
	# Com --headless os sons nunca terminam: as vozes das suítes anteriores ficariam ocupadas.
	_audio.stop_all()
	_catalog()
	_main = (load("res://scenes/main.tscn") as PackedScene).instantiate()
	tree.root.add_child(_main)
	_player = _main.get_node("Player") as Player
	_player.controlled = false
	await _tree.create_timer(0.4).timeout
	_player.health.reset(99999.0)
	(_main.get_node("RoundManager") as RoundManager).stop()

	await _positional()
	await _loops()
	_voices()
	_weapon_shots()
	await _game_sounds()
	await _area_themes()
	await _music()

	_main.queue_free()
	await tree.physics_frame
	print("\n%d ok, %d falharam (áudio)" % [_passed, _failed])
	return _failed


## Toda arma (catálogo + Lanterna) tem som de tiro: o próprio ou o parecido (SHOT_ALIAS).
func _weapon_shots() -> void:
	var catalog := load("res://data/weapons/catalog.tres") as WeaponCatalog
	var ids: Array = catalog.weapons.map(func(w: WeaponData) -> StringName: return w.id)
	ids.append(&"conductor_lantern")
	var silent: Array = ids.filter(func(id: StringName) -> bool: return not _audio.has_sound(String(AudioManager.shot_sound(id)[0])))
	check(silent.is_empty(), "todas as %d armas têm som de tiro (sem som: %s)" % [ids.size(), str(silent)])


func check(condition: bool, description: String) -> void:
	if condition:
		_passed += 1
		print("  ok  ", description)
	else:
		_failed += 1
		printerr("  FALHOU  ", description)


## Sons tocando agora cujo arquivo começa com `key`.
func _playing(key: String) -> Array[Node]:
	var found: Array[Node] = []
	for child in _audio.get_children():
		var stream: AudioStream = child.get(&"stream")
		if stream and stream.resource_path.get_file().begins_with(key + "_") and not child.is_queued_for_deletion():
			found.append(child)
	return found


func _catalog() -> void:
	var sounds: Dictionary = _audio.config.get("sounds", {})
	check(sounds.size() == 171, "catálogo do jogo web + 4 ambientes do Templo + 25 temas de sala: %d sons" % sounds.size())
	var missing: Array[String] = []
	for key: String in sounds:
		for v in int(sounds[key]):
			if not ResourceLoader.exists("res://assets/audio/%s_%d.wav" % [key, v]):
				missing.append("%s_%d" % [key, v])
	check(missing.is_empty(), "todos os WAV importados (%s)" % ("ok" if missing.is_empty() else ", ".join(missing.slice(0, 5))))
	var beep: AudioStreamPlayer = _audio.play("ui_beep", "ui")
	check(beep != null and beep.bus == &"UI" and beep.playing, "som de interface no barramento UI")
	var looped := _audio.stream("mus_pad", true) as AudioStreamWAV
	check(looped != null and looped.loop_mode == AudioStreamWAV.LOOP_FORWARD and looped.loop_end > 0, "loops de música com repetição")


func _positional() -> void:
	var here := _player.global_position
	var near: AudioStreamPlayer3D = _audio.play_at("impact_hard", here + Vector3(2, 0, 0), "world")
	var far: AudioStreamPlayer3D = _audio.play_at("impact_hard", here + Vector3(20, 0, 0), "world")
	var out: AudioStreamPlayer3D = _audio.play_at("impact_hard", here + Vector3(40, 0, 0), "world")
	check(near != null and far != null and near.volume_db > far.volume_db, "mais longe, mais baixo (%.1f dB → %.1f dB)" % [near.volume_db if near else 0.0, far.volume_db if far else 0.0])
	check(out == null, "fora do alcance (28 m) não toca")
	check(near.bus == &"Environment", "som do mundo no barramento Environment")


func _loops() -> void:
	var anchor := Node3D.new()
	_main.add_child(anchor)
	anchor.global_position = _player.global_position + Vector3(3, 0, 0)
	var handle: Dictionary = _audio.loop_at("evt_gas", anchor, "world", 1.0, 25.0)
	await _tree.process_frame
	var player := handle.player as AudioStreamPlayer3D
	var close_db := player.volume_db
	anchor.global_position = _player.global_position + Vector3(20, 0, 0)
	await _tree.process_frame
	await _tree.process_frame
	check(player.volume_db < close_db - 3.0, "loop acompanha o ponto: volume cai com a distância")
	_audio.stop_loop(handle, 0.1)
	await _tree.create_timer(0.3).timeout
	check(not is_instance_valid(player) or player.is_queued_for_deletion(), "loop para com fade")
	anchor.queue_free()


func _voices() -> void:
	var limit := int(_audio.config.max_voices.zombie)
	var started := 0
	for i in limit + 3:
		if _audio.play("zombie_tank_death", "zombie"):
			started += 1
	check(started <= limit, "limite de vozes por categoria (zumbis: %d de %d)" % [started, limit + 3])


func _game_sounds() -> void:
	var fired := [&""]
	Events.weapon_fired.connect(func(id: StringName, _l: int) -> void: fired[0] = id, CONNECT_ONE_SHOT)
	_player.aim_point = _player.global_position + Vector3(0, 0, -5)
	_player.fire()
	await _tree.process_frame
	check(fired[0] == &"m1911" and not _playing("shot_m1911").is_empty(), "tiro da M1911 com o som dela")
	_player.weapon.magazine = 0
	_player.weapon.start_reload()
	await _tree.process_frame
	check(not _playing("reload_pistol").is_empty(), "som de recarga da pistola")
	# Passos: anda alguns metros.
	for i in 12:
		_player.global_position += Vector3(0.3, 0, 0)
		await _tree.process_frame
	var world := _main.get_node("World") as GameWorld
	var surface := world.surface_at(_player.global_position)
	check(surface != "" and _audio.has_sound("step_" + String(_audio.config.step_alias.get(surface, surface))), "piso sob o jogador: %s" % surface)
	var steps := 0
	for child in _audio.get_children():
		var stream: AudioStream = child.get(&"stream")
		if stream and stream.resource_path.get_file().begins_with("step_"):
			steps += 1
	check(steps > 0, "passos tocam ao andar (%d)" % steps)
	await _tree.create_timer(0.7).timeout
	var manager := _main.get_node("AudioManager") as AudioManager
	check(manager._ambience_loop != "" and manager._ambience != null, "ambiente da área: amb_%s" % manager._ambience_loop)


## Música tema de cada sala: toda área dos 3 mapas tem a sua; ao mudar de sala o tema troca
## com crossfade e começa no mesmo compasso das outras camadas.
func _area_themes() -> void:
	var missing: Array[String] = []
	for map_id: String in ["terminal", "map2", "temple"]:
		var data: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://data/maps/%s.json" % map_id))
		for area: Dictionary in data.areas:
			if not _audio.has_sound("mus_area_%s" % area.id):
				missing.append("%s/%s" % [map_id, area.id])
	check(missing.is_empty(), "toda sala dos 3 mapas tem música tema%s" % ("" if missing.is_empty() else " — faltam: " + ", ".join(missing)))
	var manager := _main.get_node("AudioManager") as AudioManager
	var world := _main.get_node("World") as LayoutMap
	await _tree.create_timer(0.7).timeout
	var here := String(world.area_of(_player.global_position))
	check(manager.current_theme() == "mus_area_%s" % here, "tema da sala atual (%s): %s" % [here, manager.current_theme()])
	# Vai para outra sala: o tema troca, com as duas tocando no crossfade.
	var other: Dictionary = {}
	for area: Dictionary in world.data.areas:
		if String(area.id) != here:
			other = area
			break
	var r: Dictionary = other.rects[0]
	world.open_area(StringName(other.id))
	_player.global_position = Vector3(float(r.x) + float(r.w) * 0.5, 0.1, float(r.y) + float(r.h) * 0.5)
	await _tree.create_timer(0.7).timeout
	var key := "mus_area_%s" % other.id
	check(manager.current_theme() == key and manager._pad_players.has(key) and manager._pad_players.has("mus_area_%s" % here), "mudou de sala: crossfade para %s" % key)
	var pulse: AudioStreamPlayer = manager._layers.get("pulse")
	var theme: AudioStreamPlayer = manager._pad_players.get(key)
	var drift := absf(theme.get_playback_position() - pulse.get_playback_position()) if theme and pulse else 99.0
	check(drift < 0.15 or absf(drift - theme.stream.get_length()) < 0.15, "o tema novo entra no mesmo compasso das outras camadas (%.2f s)" % drift)
	await _tree.create_timer(AudioManager.THEME_FADE + 0.4).timeout
	check(not manager._pad_players.has("mus_area_%s" % here) and is_equal_approx(float(manager._pad_weights[key]), 1.0), "o tema anterior sai ao fim do crossfade")


func _music() -> void:
	var manager := _main.get_node("AudioManager") as AudioManager
	check(manager._layers.size() == 4, "4 camadas de música tocando juntas")
	check(manager.music_state == "exploration", "sem round: exploração")
	var rounds := _main.get_node("RoundManager") as RoundManager
	rounds.start_round(1)
	await _tree.process_frame
	await _tree.process_frame
	check(manager.music_state == "normal", "round ativo: música do round")
	Events.world_event_state.emit({"id": &"horde", "name": "HORDA", "color": Color.RED, "remaining": -1.0, "total": -1.0})
	await _tree.process_frame
	await _tree.process_frame
	check(manager.music_state == "high", "Horda: alta intensidade")
	Events.boss_state.emit("Boss", 100.0, 100.0, 1)
	await _tree.process_frame
	await _tree.process_frame
	check(manager.music_state == "boss", "boss vivo: música do boss")
	rounds.stop()
	Events.player_died.emit()
	await _tree.process_frame
	await _tree.process_frame
	check(manager.music_state == "silent" and not _playing("mus_gameover").is_empty(), "morte: silêncio e vinheta de fim de jogo")
