extends Node
## Serviço de áudio (autoload "Audio", como o `audio` do jogo web): toca os sons exportados do
## jogo web (npm run godot:audio → assets/audio/<som>_<n>.wav) com variação de afinação,
## limite de vozes por categoria, som posicional (volume pela distância ao jogador e pan
## esquerda/direita pela posição na tela) e loops que acompanham um ponto ou um nó.
## Cada categoria sai no seu barramento (Weapons, Zombies, Environment, SFX, UI, Music).

const DIR := "res://assets/audio"
const CONFIG := "res://data/configs/audio.json"
## Categoria → barramento (data/configs/default_bus_layout.tres).
const BUSES := {
	"weapon": &"Weapons", "zombie": &"Zombies", "world": &"Environment", "player": &"SFX",
	"ui": &"UI", "ambience": &"Environment", "music": &"Music",
}

## Mixagem e catálogo (audio.json): sounds, categories, max_voices, hearing_distance...
var config: Dictionary = {}
## Quem ouve (o jogador na partida); null = sons posicionais ficam mudos (menus).
var listener: Node3D

var _streams: Dictionary = {}
var _looped: Dictionary = {}
var _voices: Dictionary = {}
## Loops posicionais: {player, target (Node3D ou Vector3), base, distance, fade, fade_left}.
var _loops: Array[Dictionary] = []
var _ear: AudioListener3D


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(CONFIG))
	config = parsed if parsed is Dictionary else {}
	_ear = AudioListener3D.new()
	_ear.name = "Ear"
	add_child(_ear)


## Ao fechar o jogo: solta os sons carregados e os players. (Com --headless o driver de áudio
## falso não termina os sons, e o Godot avisa de playbacks presos na saída; com o driver real, não.)
func _exit_tree() -> void:
	_loops.clear()
	_streams.clear()
	_looped.clear()
	for child in get_children():
		if child != _ear:
			if child.has_method(&"stop"):
				child.call(&"stop")
			child.free()


func has_sound(key: String) -> bool:
	return config.get("sounds", {}).has(key)


## Uma variação aleatória do som (carregada na primeira vez).
func stream(key: String, loop := false) -> AudioStream:
	var variants := int(config.get("sounds", {}).get(key, 0))
	if variants <= 0:
		return null
	var index := randi() % variants
	var id := "%s_%d" % [key, index]
	if loop:
		if not _looped.has(id):
			var base := _load(id) as AudioStreamWAV
			if base == null:
				return null
			var copy := base.duplicate() as AudioStreamWAV
			copy.loop_mode = AudioStreamWAV.LOOP_FORWARD
			copy.loop_begin = 0
			copy.loop_end = int(copy.get_length() * copy.mix_rate)
			_looped[id] = copy
		return _looped[id]
	return _load(id)


func _load(id: String) -> AudioStream:
	if not _streams.has(id):
		var path := "%s/%s.wav" % [DIR, id]
		_streams[id] = load(path) if ResourceLoader.exists(path) else null
	return _streams[id]


## Volume final (linear) de uma categoria.
func category_volume(category: String) -> float:
	return float(config.get("categories", {}).get(category, 1.0)) * float(config.get("master", 1.0))


## Passa a ouvir do ponto de vista deste nó (o jogador); null = sem ouvinte (menus).
func set_listener(node: Node3D) -> void:
	listener = node
	if node:
		_ear.make_current()
	else:
		_ear.clear_current()


## Som não posicional (interface, arma do próprio jogador...). Devolve o player (ou null).
func play(key: String, category := "world", volume := 1.0, pitch_jitter := 0.04, rate := 1.0) -> AudioStreamPlayer:
	if not _take_voice(category):
		return null
	var sound := stream(key)
	if sound == null:
		_release_voice(category)
		return null
	var player := AudioStreamPlayer.new()
	player.stream = sound
	player.bus = BUSES.get(category, &"SFX")
	player.volume_db = linear_to_db(maxf(0.0001, volume * category_volume(category)))
	player.pitch_scale = maxf(0.05, rate * (1.0 + randf_range(-1.0, 1.0) * pitch_jitter))
	# Interface toca mesmo com o jogo pausado; o resto pausa junto.
	player.process_mode = Node.PROCESS_MODE_ALWAYS if category == "ui" else Node.PROCESS_MODE_PAUSABLE
	add_child(player)
	player.finished.connect(func() -> void:
		_release_voice(category)
		player.queue_free())
	player.play()
	return player


## Som no mundo: volume pela distância ao jogador (como no jogo web) e pan pela posição.
func play_at(key: String, at: Vector3, category := "world", volume := 1.0, distance := -1.0, pitch_jitter := 0.04, rate := 1.0) -> AudioStreamPlayer3D:
	if listener == null or not is_instance_valid(listener):
		return null
	var reach := distance if distance > 0.0 else float(config.get("hearing_distance", 28.0))
	var falloff := _falloff(at, reach)
	if falloff * volume < 0.02:
		return null
	if not _take_voice(category):
		return null
	var sound := stream(key)
	if sound == null:
		_release_voice(category)
		return null
	var player := _player_3d(sound, category)
	player.volume_db = linear_to_db(maxf(0.0001, volume * falloff * category_volume(category)))
	player.pitch_scale = maxf(0.05, rate * (1.0 + randf_range(-1.0, 1.0) * pitch_jitter))
	add_child(player)
	player.global_position = at
	player.finished.connect(func() -> void:
		_release_voice(category)
		player.queue_free())
	player.play()
	return player


## Loop que segue um nó ou fica num ponto (sirene, gás, trem): o volume acompanha a distância.
## Devolve o handle para `stop_loop`.
func loop_at(key: String, target: Variant, category := "world", volume := 1.0, distance := -1.0) -> Dictionary:
	var sound := stream(key, true)
	if sound == null:
		return {}
	var player := _player_3d(sound, category)
	player.volume_db = -80.0
	add_child(player)
	var handle := {"player": player, "target": target, "base": volume * category_volume(category),
		"distance": distance if distance > 0.0 else float(config.get("hearing_distance", 28.0)), "fade": -1.0, "fade_left": 0.0}
	_loops.append(handle)
	_update_loop(handle, 0.0)
	player.play()
	return handle


## Para um loop posicional (com fade em segundos).
func stop_loop(handle: Dictionary, fade := 0.4) -> void:
	if handle.is_empty():
		return
	handle.fade = maxf(0.01, fade)
	handle.fade_left = handle.fade


## Loop sem posição (ambiente, música, batimento). Volume inicial em linear (0 = mudo).
func loop(key: String, category := "ambience", volume := 1.0) -> AudioStreamPlayer:
	var sound := stream(key, true)
	if sound == null:
		return null
	var player := AudioStreamPlayer.new()
	player.stream = sound
	player.bus = BUSES.get(category, &"SFX")
	player.volume_db = linear_to_db(maxf(0.0001, volume * category_volume(category)))
	player.process_mode = Node.PROCESS_MODE_PAUSABLE
	add_child(player)
	player.play()
	return player


## Para tudo o que está tocando e zera a contagem de vozes.
func stop_all() -> void:
	_loops.clear()
	_voices.clear()
	for child in get_children():
		if child != _ear:
			if child.has_method(&"stop"):
				child.call(&"stop")
			child.queue_free()


## Para todos os loops posicionais (fim da partida).
func stop_all_loops() -> void:
	for handle in _loops:
		if is_instance_valid(handle.player):
			(handle.player as Node).queue_free()
	_loops.clear()


func _process(delta: float) -> void:
	if listener and is_instance_valid(listener):
		# O ouvinte fica no jogador, virado para o "norte" da tela: pan = esquerda/direita.
		_ear.global_transform = Transform3D(Basis.IDENTITY, listener.global_position + Vector3.UP * 1.2)
	for handle in _loops.duplicate():
		if not _update_loop(handle, delta):
			_loops.erase(handle)


func _update_loop(handle: Dictionary, delta: float) -> bool:
	var player := handle.player as AudioStreamPlayer3D
	if not is_instance_valid(player):
		return false
	var fade := 1.0
	if float(handle.fade) > 0.0:
		handle.fade_left = float(handle.fade_left) - delta
		if float(handle.fade_left) <= 0.0:
			player.queue_free()
			return false
		fade = float(handle.fade_left) / float(handle.fade)
	var target: Variant = handle.target
	var at: Vector3 = target if target is Vector3 else ((target as Node3D).global_position if is_instance_valid(target) else player.global_position)
	player.global_position = at
	var falloff := _falloff(at, float(handle.distance)) if listener and is_instance_valid(listener) else 0.0
	player.volume_db = linear_to_db(maxf(0.0001, float(handle.base) * falloff * fade))
	return true


func _falloff(at: Vector3, reach: float) -> float:
	var from := listener.global_position
	var distance := Vector2(at.x - from.x, at.z - from.z).length()
	return 0.0 if distance >= reach else pow(1.0 - distance / reach, 1.6)


func _player_3d(sound: AudioStream, category: String) -> AudioStreamPlayer3D:
	var player := AudioStreamPlayer3D.new()
	player.stream = sound
	player.bus = BUSES.get(category, &"SFX")
	# A distância é tratada aqui (curva do jogo web); o Godot só faz o pan.
	player.attenuation_model = AudioStreamPlayer3D.ATTENUATION_DISABLED
	player.max_distance = 0.0
	player.panning_strength = 0.85
	player.process_mode = Node.PROCESS_MODE_PAUSABLE
	return player


func _take_voice(category: String) -> bool:
	var active := int(_voices.get(category, 0))
	if active >= int(config.get("max_voices", {}).get(category, 16)):
		return false
	_voices[category] = active + 1
	return true


func _release_voice(category: String) -> void:
	_voices[category] = maxi(0, int(_voices.get(category, 1)) - 1)
