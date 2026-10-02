class_name SaveStore
extends Node
## Save do jogador (autoload "Save"): configurações, recordes, mapas liberados, ranking local,
## totais, segredos, conquistas e o que já foi encontrado para o glossário. Usa **o mesmo formato JSON do jogo web** (mesmas chaves),
## então o save na nuvem vale para as duas versões. Arquivo em user:// (seção 32: nada de
## caminho fixo do Windows); cada alteração grava na hora, trocando o arquivo de uma vez.

signal changed()

const VERSION := 1
const DEFAULT_PATH := "user://save.json"
## Save do jogo web antigo (Phaser) no localStorage do navegador: mesmo site, mesmo formato.
const LEGACY_WEB_KEY := "ts-save-v1"

var data: Dictionary = {}
var catalog: MapCatalog

var _path := DEFAULT_PATH


func _ready() -> void:
	catalog = load("res://data/configs/maps.tres") as MapCatalog
	load_from(_path)


## Carrega (e valida) o save do arquivo; testes usam outro arquivo.
func load_from(path: String) -> void:
	_path = path
	var raw: Variant = null
	if FileAccess.file_exists(path):
		raw = JSON.parse_string(FileAccess.get_file_as_string(path))
	elif path == DEFAULT_PATH and OS.has_feature("web"):
		# Primeira vez no navegador: traz recordes, ranking e conquistas do jogo web antigo.
		raw = parse_legacy(web_storage(LEGACY_WEB_KEY))
	data = sanitize(raw)
	_persist()
	apply_audio()
	apply_display()
	InputBindings.apply_saved()
	# O idioma (o Loc é carregado depois deste autoload; na primeira carga ele mesmo aplica).
	var loc := get_node_or_null(^"/root/Loc")
	if loc:
		loc.call(&"apply")


## Texto de um save antigo (JSON) → dados crus para o sanitize, ou null se vazio/inválido.
static func parse_legacy(text: String) -> Variant:
	if text.strip_edges() == "":
		return null
	var json := JSON.new()
	return json.data if json.parse(text) == OK else null


## Valor do localStorage do navegador ("" fora da Web ou se não existir).
static func web_storage(key: String) -> String:
	if not OS.has_feature("web"):
		return ""
	var value: Variant = JavaScriptBridge.eval("window.localStorage.getItem(%s) || ''" % JSON.stringify(key), true)
	return String(value) if value is String else ""


## Volta tudo ao padrão (apagar progresso).
func reset() -> void:
	data = _defaults()
	_persist()


# ───────────────────────── Configurações ─────────────────────────

## Volumes (barramentos de áudio): geral e mudo, música (também a chave musicOn do jogo web),
## efeitos (SFX, que leva armas, zumbis e ambiente), interface e vozes.
func apply_audio() -> void:
	var s: Dictionary = data.settings
	_bus(&"Master", 0.0 if bool(s.muted) else float(s.volume))
	_bus(&"Music", float(s.get("musicVolume", 1.0)) if bool(s.musicOn) else 0.0)
	_bus(&"SFX", float(s.get("sfxVolume", 1.0)))
	_bus(&"UI", float(s.get("uiVolume", 1.0)))
	_bus(&"Voice", float(s.get("voiceVolume", 1.0)))


static func _bus(bus: StringName, linear: float) -> void:
	var index := AudioServer.get_bus_index(bus)
	if index < 0:
		return
	AudioServer.set_bus_mute(index, linear <= 0.0)
	AudioServer.set_bus_volume_db(index, linear_to_db(clampf(linear, 0.0001, 1.0)))


## Modo de tela (janela, tela cheia, exclusiva), resolução da janela, VSync, limite de FPS e
## escala da interface. Sem janela (testes) não vale; na Web o navegador aplica a tela cheia no
## próximo toque ou clique. Brilho e sombras ficam com o mapa e o jogador (Events.settings_changed).
func apply_display() -> void:
	var s: Dictionary = data.settings
	Engine.max_fps = maxi(0, int(s.get("maxFps", 0.0)))
	if DisplayServer.get_name() == "headless":
		return
	var tree := get_tree()
	if tree and tree.root:
		tree.root.content_scale_factor = clampf(float(s.get("uiScale", 1.0)), 0.5, 2.0)
	var mode := window_mode()
	var want := DisplayServer.WINDOW_MODE_WINDOWED
	if mode == "fullscreen":
		want = DisplayServer.WINDOW_MODE_FULLSCREEN
	elif mode == "exclusive" and not OS.has_feature("web"):
		want = DisplayServer.WINDOW_MODE_EXCLUSIVE_FULLSCREEN
	if DisplayServer.window_get_mode() != want:
		DisplayServer.window_set_mode(want)
	if OS.has_feature("web") or OS.has_feature("mobile"):
		return
	var vsync := {"on": DisplayServer.VSYNC_ENABLED, "off": DisplayServer.VSYNC_DISABLED, "adaptive": DisplayServer.VSYNC_ADAPTIVE}
	DisplayServer.window_set_vsync_mode(vsync.get(String(s.get("vsync", "on")), DisplayServer.VSYNC_ENABLED))
	if want == DisplayServer.WINDOW_MODE_WINDOWED:
		var size := parse_resolution(String(s.get("resolution", "")))
		var screen := DisplayServer.screen_get_size()
		if size.x > 0 and size.x <= screen.x and size.y <= screen.y and DisplayServer.window_get_size() != size:
			DisplayServer.window_set_size(size)
			DisplayServer.window_set_position(DisplayServer.screen_get_position() + (screen - size) / 2)


## Modo de tela: o escolhido, ou (save antigo) a chave fullscreen do jogo web.
func window_mode() -> String:
	var mode := String(data.settings.get("windowMode", ""))
	if mode in ["windowed", "fullscreen", "exclusive"]:
		return mode
	return "fullscreen" if bool(data.settings.get("fullscreen", false)) else "windowed"


## "1920x1080" → Vector2i(1920, 1080) (zero se não der).
static func parse_resolution(text: String) -> Vector2i:
	var parts := text.split("x")
	if parts.size() != 2 or not parts[0].is_valid_int() or not parts[1].is_valid_int():
		return Vector2i.ZERO
	return Vector2i(int(parts[0]), int(parts[1]))


func get_setting(key: String) -> Variant:
	return data.settings.get(key)


func set_setting(key: String, value: Variant) -> void:
	data.settings[key] = value
	_persist()


var player_name: String:
	get:
		return data.settings.playerName


# ───────────────────────── Mapas e recordes ─────────────────────────

func is_unlocked(map_id: String) -> bool:
	return map_id in data.unlockedMaps


## Libera um mapa; devolve true se era novidade.
func unlock(map_id: String) -> bool:
	if is_unlocked(map_id) or not catalog.maps.has(map_id):
		return false
	data.unlockedMaps.append(map_id)
	_persist()
	return true


func records(map_id: String) -> Dictionary:
	return data.records.get(map_id, _empty_records())


## Fim de partida: atualiza recordes e totais; devolve os recordes de antes.
## `run`: wave, kills, score, bosses, time_ms, knife_kills, headshots.
func finish_run(map_id: String, run: Dictionary) -> Dictionary:
	var before: Dictionary = records(map_id).duplicate()
	data.records[map_id] = {
		"bestWave": maxi(before.bestWave, int(run.get("wave", 0))),
		"bestKills": maxi(before.bestKills, int(run.get("kills", 0))),
		"bestScore": maxi(before.bestScore, int(run.get("score", 0))),
	}
	var l: Dictionary = data.lifetime
	l.gamesPlayed += 1
	l.totalKills += int(run.get("kills", 0))
	l.bossesDefeated += int(run.get("bosses", 0))
	l.playTimeMs += int(run.get("time_ms", 0))
	l.knifeKills += int(run.get("knife_kills", 0))
	l.headshots += int(run.get("headshots", 0))
	_persist()
	return before


# ───────────────────────── Ranking local ─────────────────────────

func ranking(map_id: String) -> Array:
	return data.ranking.get(map_id, [])


## A pontuação entra no top do mapa?
func qualifies(map_id: String, score: int) -> bool:
	var list := ranking(map_id)
	return score > 0 and (list.size() < catalog.ranking_size or score > int(list.back().score))


## Grava no ranking e devolve a posição (1 = primeiro), ou 0 se não entrou.
func add_ranking(map_id: String, player: String, score: int, wave: int, kills: int) -> int:
	if not qualifies(map_id, score):
		return 0
	var clean := player.strip_edges().substr(0, catalog.player_name_max).to_upper()
	if clean == "":
		clean = "SOBREVIVENTE"
	data.settings.playerName = clean
	var row := {"name": clean, "score": score, "wave": wave, "kills": kills, "date": Time.get_datetime_string_from_system(true) + "Z"}
	var list: Array = ranking(map_id).duplicate()
	list.append(row)
	list.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return int(a.score) > int(b.score))
	list = list.slice(0, catalog.ranking_size)
	data.ranking[map_id] = list
	_persist()
	return list.find(row) + 1


# ───────────────────────── Ranking local do cooperativo ─────────────────────────

const COOP_MODES := ["2", "3", "4"]


## Ranking das partidas em grupo (players = 2, 3 ou 4) no mapa: {team, score, wave, kills, date}.
func ranking_coop(map_id: String, players: int) -> Array:
	var maps: Dictionary = data.get("rankingCoop", {})
	return (maps.get(map_id, {}) as Dictionary).get(str(players), [])


## O resultado do time entra no top do modo?
func qualifies_coop(map_id: String, players: int, score: int) -> bool:
	var list := ranking_coop(map_id, players)
	return score > 0 and (list.size() < catalog.ranking_size or score > int(list.back().score))


## Grava o resultado do time (`team`: os nomes da sala). Devolve a posição (1 = primeiro), ou 0.
func add_ranking_coop(map_id: String, players: int, team: String, score: int, wave: int, kills: int) -> int:
	if not str(players) in COOP_MODES or not qualifies_coop(map_id, players, score):
		return 0
	var row := _coop_row({"team": team, "score": score, "wave": wave, "kills": kills, "date": Time.get_datetime_string_from_system(true) + "Z"})
	var position := _insert_coop(map_id, str(players), row)
	_persist()
	return position


func _insert_coop(map_id: String, mode: String, row: Dictionary) -> int:
	if not data.has("rankingCoop"):
		data.rankingCoop = {}
	if not data.rankingCoop.has(map_id):
		data.rankingCoop[map_id] = {}
	var list: Array = (data.rankingCoop[map_id] as Dictionary).get(mode, []).duplicate()
	for other: Dictionary in list:
		if other.team == row.team and int(other.score) == int(row.score) and other.date == row.date:
			return 0
	list.append(row)
	list.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return int(a.score) > int(b.score))
	list = list.slice(0, catalog.ranking_size)
	data.rankingCoop[map_id][mode] = list
	return list.find(row) + 1


func _coop_row(row: Dictionary) -> Dictionary:
	return {"team": String(row.get("team", "")).strip_edges().substr(0, 64).to_upper(), "score": _num(row.get("score")),
		"wave": _num(row.get("wave")), "kills": _num(row.get("kills")), "date": String(row.get("date", "")).substr(0, 40)}


# ───────────────────────── Segredos e conquistas ─────────────────────────

func discover(secret: String) -> bool:
	unlock_achievement(secret)
	if data.secrets.get(secret, false):
		return false
	data.secrets[secret] = true
	_persist()
	return true


func has_achievement(id: String) -> bool:
	return data.achievements.has(id)


func unlock_achievement(id: String) -> bool:
	if has_achievement(id):
		return false
	data.achievements[id] = Time.get_datetime_string_from_system(true) + "Z"
	_persist()
	return true


var lifetime: Dictionary:
	get:
		return data.lifetime


# ───────────────────────── Glossário ─────────────────────────

## Entrada do glossário já encontrada numa partida (chave "tipo:id", ex.: "zombie:walker")? As
## outras aparecem como "???" na tela GLOSSÁRIO.
func has_seen(key: String) -> bool:
	return data.glossary.has(key)


## Marca uma entrada do glossário como encontrada; devolve true se era novidade.
func see(key: String) -> bool:
	if has_seen(key):
		return false
	data.glossary[key] = Time.get_datetime_string_from_system(true) + "Z"
	_persist()
	return true


# ───────────────────────── Nuvem ─────────────────────────

## Cópia do save para enviar à nuvem (mesmo formato do jogo web).
func export_data() -> Dictionary:
	return data.duplicate(true)


## Mescla um save da nuvem sem perder nada: recordes, totais e segredos ficam com o maior,
## mapas e conquistas somam, ranking junta as melhores. Configurações só com `take_settings`.
func merge_from(raw: Variant, take_settings: bool = false) -> void:
	var other := sanitize(raw)
	if take_settings:
		data.settings = other.settings
	for id: String in catalog.maps:
		var a := records(id)
		var b: Dictionary = other.records.get(id, _empty_records())
		data.records[id] = {
			"bestWave": maxi(a.bestWave, b.bestWave), "bestKills": maxi(a.bestKills, b.bestKills), "bestScore": maxi(a.bestScore, b.bestScore)}
		var seen := {}
		var merged: Array = []
		for row: Dictionary in ranking(id) + other.ranking.get(id, []):
			var key := "%s|%d|%s" % [row.name, row.score, row.date]
			if not seen.has(key):
				seen[key] = true
				merged.append(row)
		merged.sort_custom(func(x: Dictionary, y: Dictionary) -> bool: return int(x.score) > int(y.score))
		data.ranking[id] = merged.slice(0, catalog.ranking_size)
	for id: String in other.unlockedMaps:
		if not id in data.unlockedMaps:
			data.unlockedMaps.append(id)
	for key: String in data.lifetime:
		data.lifetime[key] = maxi(int(data.lifetime[key]), int(other.lifetime.get(key, 0)))
	for key: String in other.secrets:
		data.secrets[key] = data.secrets.get(key, false) or other.secrets[key]
	for id: String in other.achievements:
		var date: String = other.achievements[id]
		if not data.achievements.has(id) or date < String(data.achievements[id]):
			data.achievements[id] = date
	for id: String in other.get("rankingCoop", {}):
		for mode: String in COOP_MODES:
			var theirs: Array = other.rankingCoop[id].get(mode, []) if other.rankingCoop[id] is Dictionary else []
			for row: Dictionary in theirs:
				_insert_coop(id, mode, row)
	for key: String in other.glossary:
		var date: String = other.glossary[key]
		if not data.glossary.has(key) or date < String(data.glossary[key]):
			data.glossary[key] = date
	_persist()


# ───────────────────────── Validação ─────────────────────────

## Lê um save campo a campo: o que estiver faltando ou corrompido vira o padrão.
func sanitize(raw: Variant) -> Dictionary:
	var d := _defaults()
	if not raw is Dictionary:
		return d
	var r: Dictionary = raw
	var s: Dictionary = r.get("settings", {}) if r.get("settings") is Dictionary else {}
	for key: String in d.settings:
		if s.has(key) and typeof(s[key]) == typeof(d.settings[key]):
			d.settings[key] = s[key]
		elif s.has(key) and d.settings[key] is float and (s[key] is int or s[key] is float):
			d.settings[key] = float(s[key])
	d.settings.playerName = String(d.settings.playerName).substr(0, catalog.player_name_max)
	d.settings.volume = clampf(float(d.settings.volume), 0.0, 1.0)
	if not String(d.settings.touchButtons) in ["small", "medium", "large"]:
		d.settings.touchButtons = "medium"
	var recs: Dictionary = r.get("records", {}) if r.get("records") is Dictionary else {}
	for id: String in catalog.maps:
		var m: Dictionary = recs.get(id, {}) if recs.get(id) is Dictionary else {}
		d.records[id] = {"bestWave": _num(m.get("bestWave")), "bestKills": _num(m.get("bestKills")), "bestScore": _num(m.get("bestScore"))}
	if r.get("unlockedMaps") is Array:
		for id in r.unlockedMaps:
			if id is String and catalog.maps.has(id) and not id in d.unlockedMaps:
				d.unlockedMaps.append(id)
	var rank: Dictionary = r.get("ranking", {}) if r.get("ranking") is Dictionary else {}
	for id: String in catalog.maps:
		var list: Array = []
		if rank.get(id) is Array:
			for row in rank[id]:
				if row is Dictionary and row.get("name") is String:
					list.append({"name": String(row.name).substr(0, catalog.player_name_max), "score": _num(row.get("score")),
						"wave": _num(row.get("wave")), "kills": _num(row.get("kills")), "date": String(row.get("date", ""))})
		list.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return a.score > b.score)
		d.ranking[id] = list.slice(0, catalog.ranking_size)
	var l: Dictionary = r.get("lifetime", {}) if r.get("lifetime") is Dictionary else {}
	for key: String in d.lifetime:
		d.lifetime[key] = _num(l.get(key))
	var sec: Dictionary = r.get("secrets", {}) if r.get("secrets") is Dictionary else {}
	for key: String in d.secrets:
		d.secrets[key] = sec.get(key) == true
	var ach: Dictionary = r.get("achievements", {}) if r.get("achievements") is Dictionary else {}
	for id: String in ach:
		if ach[id] is String:
			d.achievements[id] = String(ach[id]).substr(0, 40)
	var seen: Dictionary = r.get("glossary", {}) if r.get("glossary") is Dictionary else {}
	for key: Variant in seen:
		if key is String and String(key).length() <= 64 and seen[key] is String:
			d.glossary[key] = String(seen[key]).substr(0, 40)
	var coop: Dictionary = r.get("rankingCoop", {}) if r.get("rankingCoop") is Dictionary else {}
	for id: String in catalog.maps:
		if not coop.get(id) is Dictionary:
			continue
		for mode: String in COOP_MODES:
			var rows: Array = []
			if coop[id].get(mode) is Array:
				for row: Variant in coop[id][mode]:
					if row is Dictionary and row.get("team") is String:
						rows.append(_coop_row(row))
			if not rows.is_empty():
				rows.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return a.score > b.score)
				if not d.rankingCoop.has(id):
					d.rankingCoop[id] = {}
				d.rankingCoop[id][mode] = rows.slice(0, catalog.ranking_size)
	# Mapas liberados por conquista (saves de antes do Templo já com a missão feita).
	for id: String in d.achievements:
		for map_id in catalog.unlocked_by_achievement(id):
			if not map_id in d.unlockedMaps:
				d.unlockedMaps.append(map_id)
	return d


func _defaults() -> Dictionary:
	var unlocked: Array = []
	var recs := {}
	var rank := {}
	for id: String in catalog.maps:
		recs[id] = _empty_records()
		rank[id] = []
		if catalog.starts_unlocked(id):
			unlocked.append(id)
	return {
		"version": VERSION,
		"settings": {"muted": false, "musicOn": true, "playerName": "SOBREVIVENTE", "volume": 1.0, "minimap": true,
			"minimapSize": "medium", "touchMode": "auto", "screenShake": true, "bigHeads": false, "skin": "default",
			# Só no Godot (o jogo web ignora chaves que não conhece).
			"fullscreen": false, "skinHospital": "patient", "skinTemple": "archaeologist", "blood": false, "crosshair": true,
			"language": "auto", "windowMode": "", "resolution": "1280x720", "vsync": "on", "maxFps": 0.0, "uiScale": 1.0,
			"brightness": 1.0, "shadows": true, "showFps": false, "musicVolume": 1.0, "sfxVolume": 1.0, "uiVolume": 1.0,
			"voiceVolume": 1.0, "bindings": {},
			# Celular: mira que acompanha o zumbi mais perto, tiro automático, botões e vibração.
			"autoAim": true, "autoFire": false, "touchButtons": "medium", "touchLeftHanded": false, "vibration": true},
		"records": recs,
		"unlockedMaps": unlocked,
		"ranking": rank,
		"lifetime": {"gamesPlayed": 0, "totalKills": 0, "bossesDefeated": 0, "playTimeMs": 0, "knifeKills": 0, "headshots": 0},
		"secrets": {"teddies": false, "konami": false},
		"achievements": {},
		# Só no Godot: entradas do glossário já encontradas (chave → data).
		"glossary": {},
		# Só no Godot: ranking local das partidas em grupo, por mapa e modo ("2", "3", "4").
		"rankingCoop": {},
	}


func _empty_records() -> Dictionary:
	return {"bestWave": 0, "bestKills": 0, "bestScore": 0}


func _num(value: Variant) -> int:
	return int(value) if (value is int or value is float) and is_finite(float(value)) else 0


## Grava num arquivo temporário e troca de uma vez (uma queda no meio não corrompe o save).
func _persist() -> void:
	var tmp := _path + ".tmp"
	var file := FileAccess.open(tmp, FileAccess.WRITE)
	if file == null:
		return  # sem armazenamento: vale só nesta sessão
	file.store_string(JSON.stringify(data, "\t"))
	file.close()
	DirAccess.rename_absolute(tmp, _path)
	changed.emit()
