class_name GameManager
extends Node
## Fluxo da partida (seção 37): posiciona o jogador, conta estatísticas, pausa e fim de jogo.
## Roda mesmo com o jogo pausado (para despausar).

@export var player: Player
@export var arena: GameWorld
@export var round_manager: RoundManager
@export var points_manager: PointsManager
@export var score_manager: ScoreManager
@export var anti_cheat: AntiCheat

var kills: int = 0
var headshots: int = 0
var knife_kills: int = 0
var bosses: int = 0
var shots_fired: int = 0
var shots_hit: int = 0
var damage_dealt: float = 0.0
## Tempo de jogo (s), sem contar a pausa.
var elapsed: float = 0.0


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	if arena and player:
		player.global_position = arena.get_player_spawn()
	Events.zombie_killed.connect(_on_zombie_killed)
	Events.player_died.connect(_on_player_died)
	Events.restart_requested.connect(restart)
	Events.resume_requested.connect(func() -> void: set_paused(false))
	Events.round_completed.connect(_on_round_completed)
	Events.shot_fired.connect(func() -> void: shots_fired += 1)
	Events.zombie_hit.connect(func(_z: Node3D, info: DamageInfo) -> void:
		if info.kind == DamageInfo.Kind.WEAPON:
			shots_hit += 1
		if info.kind in [DamageInfo.Kind.WEAPON, DamageInfo.Kind.MELEE, DamageInfo.Kind.BURN]:
			damage_dealt += info.amount)
	Events.boss_defeated.connect(_on_boss_defeated)
	# Arma que saiu do inventário cai no chão (pode ser pega de volta por 60s).
	Events.weapon_dropped.connect(func(weapon: Weapon, at: Vector3) -> void: WeaponDrop.spawn(get_tree(), weapon, at))


func _process(delta: float) -> void:
	if not get_tree().paused and player and player.is_alive():
		elapsed += delta


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed(&"pause") and player and player.is_alive():
		set_paused(not get_tree().paused)


func set_paused(value: bool) -> void:
	get_tree().paused = value
	Events.pause_changed.emit(value)


func restart() -> void:
	get_tree().paused = false
	get_tree().reload_current_scene()


func _on_zombie_killed(_zombie: Node3D, info: DamageInfo) -> void:
	kills += 1
	if info.is_headshot:
		headshots += 1
	if info.kind == DamageInfo.Kind.MELEE:
		knife_kills += 1


## Derrotar o boss de um round libera mapas (ex.: boss do round 10 no Terminal → Hospital).
func _on_boss_defeated(_id: StringName, _name: String, _reward: int, _at: Vector3) -> void:
	bosses += 1
	var catalog := Save.catalog
	for map_id in catalog.unlocked_by(current_map(), round_manager.round_number):
		if Save.unlock(map_id):
			Events.map_unlocked.emit(map_id, catalog.display_name(map_id))


func current_map() -> String:
	var id := arena.map_id() if arena else ""
	return id if id != "" else Session.map_id


func _on_round_completed(_round_number: int) -> void:
	if round_manager.data.refill_ammo_on_round_end and player.is_alive():
		for weapon in player.inventory.weapons:
			weapon.reset_ammo()


## Fim de jogo: grava recordes e totais e manda o resumo para a HUD.
func _on_player_died() -> void:
	var map_id := current_map()
	var score := score_manager.score if score_manager else 0
	var run := {"wave": round_manager.round_number, "kills": kills, "score": score, "bosses": bosses,
		"time_ms": int(elapsed * 1000.0), "knife_kills": knife_kills, "headshots": headshots}
	var flagged := anti_cheat != null and anti_cheat.flagged
	# Partida invalidada pelo anti-trapaça não entra em recordes, totais nem ranking.
	var before := Save.records(map_id).duplicate() if flagged else Save.finish_run(map_id, run)
	var best := Save.records(map_id)
	Events.game_over.emit({
		"map_id": map_id,
		"round": round_manager.round_number,
		"kills": kills,
		"headshots": headshots,
		"knife_kills": knife_kills,
		"points": points_manager.points,
		"points_earned": points_manager.earned,
		"time_seconds": int(elapsed),
		"bosses": bosses,
		"shots_fired": shots_fired,
		"shots_hit": mini(shots_hit, shots_fired),
		"damage": roundi(damage_dealt),
		"score": score,
		"best_score": int(best.bestScore),
		"best_wave": int(best.bestWave),
		"new_record": not flagged and score > int(before.bestScore),
		"rank_eligible": not flagged and Save.qualifies(map_id, score),
		"cheat_taunt": anti_cheat.taunt if flagged else "",
	})


func go_to_menu() -> void:
	get_tree().paused = false
	get_tree().change_scene_to_file("res://scenes/ui/main_menu.tscn")
