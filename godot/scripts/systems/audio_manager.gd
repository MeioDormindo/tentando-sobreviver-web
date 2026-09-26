class_name AudioManager
extends Node
## Som da partida (como o AudioSystem e o MusicSystem do jogo web): ouve os eventos e toca os
## sons pelo autoload Audio; ambiente por área com transição suave e sons pontuais em volta,
## passos conforme o piso, batimento com pouca vida, gemidos dos zumbis e a música adaptativa
## (Exploração → Round → Alta intensidade → Boss, com vinhetas de vitória e de fim de jogo).
## Volumes independentes por barramento (seção 35): Music, SFX, Weapons, Zombies,
## Environment, UI e Voice (data/configs/default_bus_layout.tres).

const LAYERS: Array[String] = ["pad", "pulse", "drive", "boss"]
const STING_GAP := 5.0
const GROAN_EVERY := 0.9

@export var player: Player
@export var world: GameWorld

var music_state: String = "exploration"

var _ambience: AudioStreamPlayer
var _ambience_loop := ""
var _area: StringName = &""
var _area_check := 0.0
var _next_ambient := 4.0
var _heartbeat: AudioStreamPlayer
var _last_health := -1.0
var _walked := 0.0
var _last_position := Vector3.ZERO
var _groan := 0.0
var _last_hit_sound := 0.0
var _clock := 0.0
var _first_weapon_change := true
var _layers: Dictionary = {}
## Música tema da sala (camada de exploração): chave → player e peso (0 a 1) no crossfade.
## O tema da área atual sobe; os outros descem e somem. Sem tema, a camada "mus_pad" antiga.
const THEME_FADE := 3.0
var pad_key := "mus_pad"
var _pad_players: Dictionary = {}
var _pad_weights: Dictionary = {}
var _levels: Dictionary = {"pad": 0.0, "pulse": 0.0, "drive": 0.0, "boss": 0.0}
var _round_active := false
var _boss_active := false
var _dead := false
var _hp_ratio := 1.0
var _event_id: StringName = &""
var _duck_until := 0.0
var _last_sting := -INF
var _event_loops: Dictionary = {}


func _ready() -> void:
	if player:
		Audio.set_listener(player)
		_last_position = player.global_position
	tree_exiting.connect(func() -> void:
		Audio.set_listener(null)
		Audio.stop_all_loops())
	for layer in LAYERS:
		var sound := Audio.loop("mus_" + layer, "music", 0.0)
		if sound:
			_layers[layer] = sound
	if _layers.has("pad"):
		_pad_players["mus_pad"] = _layers["pad"]
		_pad_weights["mus_pad"] = 1.0
	_connect_events()


## Armas só do Godot (sem som no jogo web): tiro de uma arma parecida, noutro tom.
const SHOT_ALIAS := {
	&"beretta": ["m1911", 1.1], &"nailgun": ["glock", 1.45], &"p90": ["mp5", 1.12],
	&"sawed_off": ["pump", 0.82], &"conductor_lantern": ["arc_gun", 0.75],
	# Arsenal do Templo.
	&"makarov": ["m1911", 1.2], &"mauser_c96": ["glock", 0.9], &"thompson": ["mp5", 0.88], &"lupara": ["pump", 0.9],
	&"lee_enfield": ["barrett", 1.25], &"stg44": ["ak", 0.95], &"winchester_1887": ["combat_shotgun", 0.85], &"bren": ["rpk", 0.9],
	&"hephaestus_spear": ["grenade_launcher", 0.8], &"zeus_bolt": ["arc_gun", 0.62], &"artemis_bow": ["rail", 1.35],
	&"poseidon_trident": ["wind_cannon", 0.8],
}


## Som do tiro da arma: [chave, tom]. Usa o próprio (shot_<id>) ou o parecido da tabela.
static func shot_sound(id: StringName) -> Array:
	if Audio.has_sound("shot_%s" % id) or not SHOT_ALIAS.has(id):
		return ["shot_%s" % id, 1.0]
	var alias: Array = SHOT_ALIAS[id]
	return ["shot_%s" % alias[0], float(alias[1])]


func _connect_events() -> void:
	Events.weapon_fired.connect(func(id: StringName, level: int) -> void:
		var shot := shot_sound(id)
		Audio.play(shot[0], "weapon", 0.85, 0.05, shot[1])
		if level > 0:
			Audio.play("mk2_layer", "weapon", 0.6))
	Events.weapon_reload_started.connect(func(kind: StringName) -> void: Audio.play("reload_%s" % kind, "weapon", 0.7, 0.0))
	Events.dry_fire.connect(func() -> void: Audio.play("dry_fire", "weapon", 0.8, 0.0))
	Events.knife_swung.connect(func() -> void: Audio.play("knife_swing", "player", 0.8))
	Events.weapon_changed.connect(func(_c: String, _o: String) -> void:
		if _first_weapon_change:
			_first_weapon_change = false
		else:
			Audio.play("weapon_switch", "weapon", 0.7))
	Events.zombie_hit.connect(func(zombie: Node3D, info: DamageInfo) -> void:
		if info.kind == DamageInfo.Kind.WEAPON and _clock - _last_hit_sound > 0.05:
			_last_hit_sound = _clock
			Audio.play_at("impact_flesh", zombie.global_position, "world", 0.6))
	Events.zombie_killed.connect(func(zombie: Node3D, _info: DamageInfo) -> void:
		var type := String((zombie as ZombieBase).data.id) if zombie is ZombieBase else ""
		Audio.play_at("zombie_%s_death" % type, zombie.global_position, "zombie", 0.9))
	Events.zombie_attacked.connect(func(zombie: Node3D) -> void:
		if zombie is ZombieBase:
			Audio.play_at("zombie_%s_attack" % (zombie as ZombieBase).data.id, zombie.global_position, "zombie", 0.85))
	Events.player_health_changed.connect(_on_health)
	Events.player_died.connect(func() -> void:
		Audio.play("player_death", "player", 1.0)
		_stop_heartbeat()
		_dead = true
		_last_sting = -INF
		_sting("mus_gameover", 1.0))
	Events.round_started.connect(func(_n: int, _t: int) -> void:
		_round_active = true
		Audio.play("wave_start", "ui", 0.9, 0.0))
	Events.round_completed.connect(func(_n: int) -> void:
		if _round_active and not _dead:
			_sting("mus_victory", 0.8)
		_round_active = false
		Audio.play("wave_end", "ui", 1.0, 0.0))
	Events.points_changed.connect(func(_total: int, delta: int) -> void:
		if delta < 0:
			Audio.play("purchase", "ui", 0.8))
	Events.purchase_denied.connect(func() -> void: Audio.play("denied", "ui"))
	Events.power_up_collected.connect(func(_id: StringName, _n: String, _c: Color, _d: String) -> void: Audio.play("powerup", "ui", 0.9))
	Events.perks_changed.connect(func(_ids: Array[StringName]) -> void: Audio.play("perk", "ui", 0.8, 0.0))
	Events.power_changed.connect(func(on: bool) -> void:
		if on:
			Audio.play("evt_power_up", "world", 0.9, 0.0))
	Events.area_opened.connect(func(_id: StringName, _n: String) -> void:
		if _clock > 1.0:
			Audio.play("door_open", "world", 0.9))
	Events.boss_incoming.connect(func(_n: String) -> void: Audio.play("boss_warning", "ui", 0.9, 0.0))
	Events.boss_state.connect(func(_n: String, current: float, _m: float, _p: int) -> void: _boss_active = current > 0.0)
	Events.boss_defeated.connect(func(_id: StringName, _n: String, _r: int, at: Vector3) -> void:
		_boss_active = false
		Audio.play_at("boss_death", at, "world", 1.0, 60.0)
		_sting("mus_victory", 1.0))
	Events.hound_round_changed.connect(func(active: bool, _c: Dictionary) -> void:
		if active:
			Audio.play("hound_howl", "zombie", 1.0, 0.0))
	Events.mystery_box_rolled.connect(func(_fire_sale: bool) -> void: Audio.play("box_music", "ui", 0.8, 0.0))
	Events.world_event_started.connect(_on_world_event)
	Events.world_event_state.connect(func(state: Dictionary) -> void: _event_id = StringName(state.get("id", &"")))
	Events.teddy_found.connect(func(found: int, total: int) -> void:
		Audio.play("secret_song" if found >= total else "box_reveal", "ui", 0.9 if found >= total else 0.5, 0.0, 1.0 if found >= total else 1.4))
	Events.quest_completed.connect(func(_id: StringName, _t: String, _s: String) -> void: Audio.play("secret_song", "ui", 1.0, 0.0))
	Events.explosion.connect(func(at: Vector3, radius: float) -> void:
		var mini := radius < 2.5
		Audio.play_at("explosion", at, "world", 1.0 if not mini else 0.7, 22.0 if mini else 47.0, 0.04, 1.5 if mini else 1.0)
		Events.screen_shake.emit(0.2 if mini else 0.35, 0.08 if mini else 0.2))


func _process(delta: float) -> void:
	_clock += delta
	if player == null or not is_instance_valid(player):
		return
	_footsteps()
	_update_area(delta)
	_ambient_events(delta)
	_groans(delta)
	_update_music(delta)


# ───────────────────────── Jogador ─────────────────────────

func _footsteps() -> void:
	var here := player.global_position
	var moved := Vector2(here.x - _last_position.x, here.z - _last_position.z).length()
	_last_position = here
	# Teleporte (reinício, testes) não conta como passo.
	if moved > 1.0 or not player.is_alive():
		return
	_walked += moved
	if _walked < float(Audio.config.get("step_distance", 1.4)):
		return
	_walked = 0.0
	var surface := world.surface_at(here) if world else "concrete"
	surface = String(Audio.config.get("step_alias", {}).get(surface, surface))
	Audio.play_at("step_" + surface, here, "player", 0.55, -1.0, 0.08)


func _on_health(current: float, maximum: float) -> void:
	if _last_health >= 0.0 and current < _last_health and current > 0.0:
		Audio.play("player_hurt", "player", 0.9)
	_last_health = current
	_hp_ratio = current / maximum if maximum > 0.0 else 1.0
	var low := current > 0.0 and _hp_ratio < float(Audio.config.get("heartbeat_below", 0.3))
	if low and _heartbeat == null:
		_heartbeat = Audio.loop("heartbeat", "player", 0.8)
	elif not low:
		_stop_heartbeat()


func _stop_heartbeat() -> void:
	if _heartbeat and is_instance_valid(_heartbeat):
		_heartbeat.queue_free()
	_heartbeat = null


# ───────────────────────── Ambiente ─────────────────────────

func _update_area(delta: float) -> void:
	_area_check -= delta
	if _area_check > 0.0 or world == null:
		return
	_area_check = 0.5
	var area := world.area_of(player.global_position)
	if area == &"" or area == _area:
		return
	_area = area
	set_area_theme(area)
	var loop_id := String(Audio.config.get("ambience_alias", {}).get(String(area), String(area)))
	if loop_id == _ambience_loop or not Audio.has_sound("amb_" + loop_id):
		return
	# Troca o loop de ambiente com transição suave.
	var crossfade := float(Audio.config.get("ambience_crossfade", 2.5))
	var old := _ambience
	_ambience_loop = loop_id
	_ambience = Audio.loop("amb_" + loop_id, "ambience", 0.0)
	if _ambience:
		var target := linear_to_db(Audio.category_volume("ambience"))
		_ambience.create_tween().tween_property(_ambience, "volume_db", target, crossfade).from(-40.0)
	if old and is_instance_valid(old):
		var tween := old.create_tween()
		tween.tween_property(old, "volume_db", -60.0, crossfade)
		tween.tween_callback(old.queue_free)


## Sons pontuais em volta do jogador (estrondos, gemidos, gotas, trem distante).
func _ambient_events(delta: float) -> void:
	_next_ambient -= delta
	if _next_ambient > 0.0 or _area == &"":
		return
	var range_s: Array = Audio.config.get("ambient_event_time", [6, 14])
	_next_ambient = randf_range(float(range_s[0]), float(range_s[1]))
	var options: Array = Audio.config.get("ambient_events", {}).get(String(_area), [])
	if options.is_empty():
		return
	var angle := randf() * TAU
	var at := player.global_position + Vector3(cos(angle), 0.0, sin(angle)) * randf_range(7.8, 18.8)
	Audio.play_at(String(options.pick_random()), at, "ambience", 0.9, 37.5)


## Gemidos: de tempos em tempos um zumbi por perto geme.
func _groans(delta: float) -> void:
	_groan -= delta
	if _groan > 0.0:
		return
	_groan = GROAN_EVERY
	var nearby: Array[ZombieBase] = []
	for node in get_tree().get_nodes_in_group(&"zombies"):
		var zombie := node as ZombieBase
		if zombie and zombie.is_alive() and zombie.global_position.distance_to(player.global_position) < 20.0:
			nearby.append(zombie)
	if nearby.is_empty() or randf() > 0.45:
		return
	var chosen: ZombieBase = nearby.pick_random()
	Audio.play_at("zombie_%s_groan" % chosen.data.id, chosen.global_position, "zombie", 0.75)


# ───────────────────────── Eventos do mapa ─────────────────────────

func _on_world_event(id: StringName, _n: String, _h: String, _c: Color) -> void:
	match id:
		&"horde", &"blood_moon":
			Audio.play("evt_horde", "world", 1.0 if id == &"horde" else 0.8, 0.0, 1.0 if id == &"horde" else 0.8)
		&"blackout":
			Audio.play("evt_power_down", "world", 1.0, 0.0)
		&"supply_drop":
			Audio.play("evt_plane", "world", 0.9, 0.0)
		&"collapse":
			Audio.play("amb_creak", "world", 1.0, 0.04, 0.7)
		&"emergency_alarm":
			# A sirene soa pelo mapa inteiro: acompanha o jogador.
			_event_loops[id] = Audio.loop_at("evt_siren", player, "ambience", 0.8, 3000.0)


## Loops dos eventos que acabaram (a sirene some com o fim do alarme).
func _stop_event_loops() -> void:
	for id: StringName in _event_loops.keys():
		if id != _event_id:
			Audio.stop_loop(_event_loops[id], 1.2)
			_event_loops.erase(id)


# ───────────────────────── Música adaptativa ─────────────────────────

func _state() -> String:
	if _dead:
		return "silent"
	if _boss_active:
		return "boss"
	if not _round_active:
		return "exploration"
	var music: Dictionary = Audio.config.get("music", {})
	var alive := get_tree().get_nodes_in_group(&"zombies").size()
	var high := alive >= int(music.get("high_alive", 12)) or _hp_ratio < float(music.get("high_hp", 0.35)) \
		or Array(music.get("high_events", [])).has(String(_event_id))
	return "high" if high else "normal"


func _update_music(delta: float) -> void:
	_stop_event_loops()
	music_state = _state()
	var music: Dictionary = Audio.config.get("music", {})
	var target: Dictionary = music.get("mix", {}).get(music_state, {})
	var step := float(music.get("fade_per_second", 0.6)) * delta
	var duck := float(music.get("sting_duck", 0.35)) if _clock < _duck_until else 1.0
	var enabled := bool(Save.get_setting("musicOn"))
	var base := Audio.category_volume("music") * (1.0 if enabled else 0.0) * duck
	for layer in LAYERS:
		var goal := float(target.get(layer, 0.0))
		var current: float = _levels[layer]
		_levels[layer] = minf(goal, current + step) if current < goal else maxf(goal, current - step)
		if layer == "pad":
			continue
		var sound: AudioStreamPlayer = _layers.get(layer)
		if sound and is_instance_valid(sound):
			sound.volume_db = linear_to_db(maxf(0.0001, float(_levels[layer]) * base))
	# Camada de exploração: o tema da sala (com crossfade entre salas).
	_update_themes(delta, float(_levels["pad"]), base)


## Troca a música de exploração para o tema da área (crossfade de THEME_FADE s, começando na
## mesma posição das outras camadas: tudo continua no mesmo compasso).
func set_area_theme(area: StringName) -> void:
	var key := "mus_area_%s" % area
	if not Audio.has_sound(key):
		key = "mus_pad"
	if key == pad_key:
		return
	pad_key = key
	if not _pad_players.has(key) or not is_instance_valid(_pad_players[key]):
		var sound := Audio.loop(key, "music", 0.0)
		if sound == null:
			return
		var reference: AudioStreamPlayer = _layers.get("pulse", _layers.get("pad"))
		if reference and is_instance_valid(reference) and reference.playing and sound.stream:
			var length := sound.stream.get_length()
			if length > 0.0:
				sound.seek(fposmod(reference.get_playback_position(), length))
		_pad_players[key] = sound
		_pad_weights[key] = 0.0


## Música tema tocando agora (a de maior peso).
func current_theme() -> String:
	return pad_key


func _update_themes(delta: float, pad_level: float, base: float) -> void:
	var step := delta / THEME_FADE
	for key: String in _pad_players.keys():
		var sound: AudioStreamPlayer = _pad_players[key]
		var weight: float = _pad_weights.get(key, 0.0)
		weight = minf(1.0, weight + step) if key == pad_key else maxf(0.0, weight - step)
		_pad_weights[key] = weight
		if not is_instance_valid(sound):
			_pad_players.erase(key)
			_pad_weights.erase(key)
			continue
		if weight <= 0.0 and key != pad_key and key != "mus_pad":
			sound.queue_free()
			_pad_players.erase(key)
			_pad_weights.erase(key)
			continue
		sound.volume_db = linear_to_db(maxf(0.0001, pad_level * base * weight))


func _sting(key: String, volume: float) -> void:
	if not bool(Save.get_setting("musicOn")) or _clock - _last_sting < STING_GAP:
		return
	_last_sting = _clock
	_duck_until = _clock + float(Audio.config.get("music", {}).get("sting_duck_time", 3.5))
	Audio.play(key, "music", volume, 0.0)


# ───────────────────────── Barramentos ─────────────────────────

## Volume de um barramento de 0 a 1 (0 = mudo).
func set_bus_volume(bus: StringName, linear: float) -> void:
	var index := AudioServer.get_bus_index(bus)
	if index < 0:
		push_warning("AudioManager: barramento %s não existe" % bus)
		return
	AudioServer.set_bus_mute(index, linear <= 0.0)
	AudioServer.set_bus_volume_db(index, linear_to_db(clampf(linear, 0.0001, 1.0)))


func get_bus_volume(bus: StringName) -> float:
	var index := AudioServer.get_bus_index(bus)
	return db_to_linear(AudioServer.get_bus_volume_db(index)) if index >= 0 else 0.0
