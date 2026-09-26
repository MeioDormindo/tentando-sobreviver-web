class_name AchievementSystem
extends Node
## Conquistas da partida (como no jogo web): escuta os eventos e libera as conquistas (salvas
## na hora, e na nuvem com a conta). As acumuladas somam o total salvo com o desta partida.
## Partida invalidada pelo anti-trapaça não libera nada.

@export var catalog: AchievementCatalog
@export var anti_cheat: AntiCheat

var _run := {"kills": 0, "knifeKills": 0, "headshots": 0}
var _hound_round := false
var _hurt_in_hound_round := false
var _last_health := INF


func _ready() -> void:
	Events.zombie_killed.connect(_on_kill)
	Events.round_started.connect(func(n: int, _t: int) -> void:
		if n >= catalog.survivor_round:
			unlock("survivor")
		if n >= catalog.veteran_round:
			unlock("veteran"))
	Events.power_changed.connect(func(on: bool) -> void: if on: unlock("power_on"))
	Events.boss_defeated.connect(func(id: StringName, _n: String, _r: int, _at: Vector3) -> void:
		if id == &"conductor":
			unlock("conductor")
		elif id == &"patient_zero":
			unlock("patient_zero")
		elif id == &"minotaur":
			unlock("minotaur")
		elif id == &"cerberus":
			unlock("cerberus")
		elif id == &"entity":
			unlock("the_door"))
	Events.perks_changed.connect(func(ids: Array[StringName]) -> void:
		if ids.size() >= 7:
			unlock("collector"))
	Events.ammo_changed.connect(func(weapon_name: String, _m: int, _r: int, _l: bool) -> void:
		if weapon_name == "Tornado":
			unlock("tornado"))
	Events.hound_round_changed.connect(_on_hound_round)
	Events.quest_completed.connect(func(id: StringName, _t: String, _s: String) -> void:
		if id == &"serum":
			unlock("serum")
		elif id == &"train":
			unlock("last_train")
		elif id == &"temple":
			unlock("underworld_gate"))
	Events.statue_lit.connect(func(found: int, total: int) -> void:
		if found >= total:
			unlock("twelve_statues"))
	Events.train_run_over.connect(func(count: int) -> void:
		if count >= catalog.train_kills:
			unlock("train_wreck"))
	Events.teddy_found.connect(func(found: int, total: int) -> void:
		if found >= total:
			unlock("teddies"))
	Events.mystery_box_rolled.connect(func(fire_sale: bool) -> void: if fire_sale: unlock("fire_sale"))
	Events.player_health_changed.connect(func(current: float, _max: float) -> void:
		if current < _last_health and _hound_round:
			_hurt_in_hound_round = true
		_last_health = current)


func unlock(id: String) -> void:
	if (anti_cheat and anti_cheat.flagged) or Save.has_achievement(id):
		return
	var info := catalog.find(id)
	if info.is_empty() or not Save.unlock_achievement(id):
		return
	Events.achievement_unlocked.emit(id, String(info.name), String(info.description))
	# Conquistas que liberam mapas (missão do Terminal ou do Hospital → Templo).
	for map_id in Save.catalog.unlocked_by_achievement(id):
		if Save.unlock(map_id):
			Events.map_unlocked.emit(map_id, Save.catalog.display_name(map_id))


func _on_kill(_zombie: Node3D, info: DamageInfo) -> void:
	if not info.kind in [DamageInfo.Kind.WEAPON, DamageInfo.Kind.MELEE, DamageInfo.Kind.BURN]:
		return
	_run.kills += 1
	if info.kind == DamageInfo.Kind.MELEE:
		_run.knifeKills += 1
	if info.is_headshot and info.kind == DamageInfo.Kind.WEAPON:
		_run.headshots += 1
	unlock("first_blood")
	# Acumuladas: o total salvo mais o desta partida.
	for a: Dictionary in catalog.achievements:
		var key := String(a.total_key)
		if key != "" and int(Save.lifetime.get("totalKills" if key == "kills" else key, 0)) + int(_run.get(key, 0)) >= int(a.total_target):
			unlock(a.id)


## Adestrador: vencer uma rodada dos cães sem levar dano.
func _on_hound_round(active: bool, _config: Dictionary) -> void:
	if active:
		_hound_round = true
		_hurt_in_hound_round = false
	elif _hound_round:
		_hound_round = false
		if not _hurt_in_hound_round:
			unlock("dog_trainer")
