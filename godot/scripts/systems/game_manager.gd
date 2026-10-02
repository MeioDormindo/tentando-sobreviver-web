class_name GameManager
extends Node
## Fluxo da partida (seção 37): posiciona os jogadores, conta estatísticas, pausa e fim de jogo.
## Roda mesmo com o jogo pausado (para despausar). No cooperativo, a partida só acaba quando o
## time inteiro está caído ou morto.

## O jogador desta máquina (pausa, estatísticas de tiro). Os outros vêm do registro `Players`.
@export var player: Player
@export var arena: GameWorld
@export var round_manager: RoundManager
@export var points_manager: PointsManager
@export var score_manager: ScoreManager
@export var anti_cheat: AntiCheat

var kills: int = 0
## Abates do time inteiro (no solo, igual a `kills`).
var team_kills: int = 0
var headshots: int = 0
var knife_kills: int = 0
var bosses: int = 0
var shots_fired: int = 0
var shots_hit: int = 0
var damage_dealt: float = 0.0
## Tempo de jogo (s), sem contar a pausa.
var elapsed: float = 0.0
## A partida acabou (fim de jogo já mostrado).
var over: bool = false


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_place_player()
	Events.zombie_killed.connect(_on_zombie_killed)
	Events.player_died.connect(_on_player_died)
	Events.player_downed.connect(func(_p: Node3D) -> void: _check_team())
	Events.player_bled_out.connect(func(_p: Node3D) -> void: _check_team())
	Events.restart_requested.connect(restart)
	Events.resume_requested.connect(func() -> void: set_paused(false))
	Events.round_completed.connect(_on_round_completed)
	Events.shot_fired.connect(func() -> void: shots_fired += 1)
	# Um disparo conta como acerto se atingiu ao menos um alvo, não um por zumbi (escopeta e
	# armas perfurantes acertam vários zumbis num só disparo).
	Events.shot_connected.connect(func() -> void: shots_hit += 1)
	Events.zombie_hit.connect(func(_z: Node3D, info: DamageInfo) -> void:
		if info.kind in [DamageInfo.Kind.WEAPON, DamageInfo.Kind.MELEE, DamageInfo.Kind.BURN] and not Players.is_remote(info.source):
			damage_dealt += info.amount)
	Events.boss_defeated.connect(_on_boss_defeated)
	# Arma que saiu do inventário cai no chão (pode ser pega de volta por 60s).
	Events.weapon_dropped.connect(func(weapon: Weapon, at: Vector3) -> void:
		var drop := WeaponDrop.spawn(get_tree(), weapon, at)
		if Net.world and Net.is_host():
			Net.world.on_drop(drop))


## Jogadores no início do mapa (os colegas em volta do primeiro). O mapa trocado pelo menu
## (Hospital) fica pronto depois deste nó: espera ele carregar os dados, senão o início cairia
## em (0, 0).
func _place_player() -> void:
	if arena == null:
		return
	if not arena.is_node_ready():
		await arena.ready
	# Os jogadores da cena (não o grupo "player": os colegas criados pela roster podem ainda não
	# ter ficado prontos aqui).
	var players: Array[Player] = []
	for child in get_parent().get_children():
		if child is Player:
			players.append(child)
	players.sort_custom(func(a: Player, b: Player) -> bool: return a.peer_id < b.peer_id)
	if players.is_empty() and player:
		players.append(player)
	var spots := arena.get_player_spawns(players.size())
	for i in players.size():
		players[i].global_position = spots[i]
		if arena.has_method(&"start_weapon"):
			players[i].set_start_weapon(arena.call(&"start_weapon"))
	var camera := get_viewport().get_camera_3d() as TopDownCamera
	if camera:
		camera.snap()


func _process(delta: float) -> void:
	if not get_tree().paused and not over and not Players.alive().is_empty():
		elapsed += delta


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed(&"pause") and player and player.is_alive() and not over:
		set_paused(not (Net.menu_open if Net.is_online() else get_tree().paused))


## Cooperativo: ninguém mais de pé (todos caídos ou mortos) = fim da partida.
func _check_team() -> void:
	# Em rede, no colega: quem decide o fim é o host.
	if over or not Players.coop() or Net.is_client():
		return
	if Players.standing().is_empty():
		Events.player_died.emit()


## Pausa. Em rede o mundo não para (os colegas continuam jogando): só abre o menu por cima.
func set_paused(value: bool) -> void:
	if Net.is_online():
		Net.menu_open = value
	else:
		get_tree().paused = value
	Events.pause_changed.emit(value)


func restart() -> void:
	# Em rede: o host leva todos de volta à sala.
	if Net.is_online():
		Net.return_to_room()
		return
	get_tree().paused = false
	get_tree().reload_current_scene()


func _on_zombie_killed(_zombie: Node3D, info: DamageInfo) -> void:
	team_kills += 1
	_count_for(info)
	# Estatísticas pessoais: no cooperativo, só os abates do jogador desta máquina.
	if Players.is_remote(info.source):
		return
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
	if not round_manager.data.refill_ammo_on_round_end:
		return
	for someone in Players.all():
		if someone.is_alive():
			for weapon in someone.inventory.weapons:
				weapon.reset_ammo()


## Fim de jogo: grava recordes e totais e manda o resumo para a HUD.
func _on_player_died() -> void:
	if over:
		return
	over = true
	var map_id := current_map()
	var score := score_manager.score if score_manager else 0
	var run := {"wave": round_manager.round_number, "kills": kills, "score": score, "bosses": bosses,
		"time_ms": int(elapsed * 1000.0), "knife_kills": knife_kills, "headshots": headshots}
	var flagged := anti_cheat != null and anti_cheat.flagged
	# Partida invalidada pelo anti-trapaça não entra em recordes, totais nem ranking. A partida em
	# grupo também não (ela vai para o ranking do modo dela, não para os recordes do solo).
	var counts := not flagged and not Players.coop()
	var before := Save.finish_run(map_id, run) if counts else Save.records(map_id).duplicate()
	var best := Save.records(map_id)
	var summary := {
		"map_id": map_id,
		"round": round_manager.round_number,
		"kills": kills,
		"team_kills": team_kills,
		"players": Players.all().size() if Players.coop() else 1,
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
		"new_record": counts and score > int(before.bestScore),
		"rank_eligible": counts and Save.qualifies(map_id, score),
		"cheat_taunt": anti_cheat.taunt if flagged else "",
	}
	_team_result(summary, flagged)
	Events.game_over.emit(summary)
	if Net.world and Net.is_host():
		Net.world.send_game_over(self)


func go_to_menu() -> void:
	Net.leave()
	get_tree().paused = false
	get_tree().change_scene_to_file("res://scenes/ui/main_menu.tscn")


# ───────────────────────── Partida em grupo ─────────────────────────

## Abates de cada jogador (peer → {kills, headshots, knife_kills}), para o resumo de cada um.
var _peer_stats: Dictionary = {}


func _count_for(info: DamageInfo) -> void:
	var shooter := info.source as Player if is_instance_valid(info.source) else null
	if shooter == null:
		return
	var stats: Dictionary = _peer_stats.get(shooter.peer_id, {"kills": 0, "headshots": 0, "knife_kills": 0})
	stats.kills += 1
	if info.is_headshot:
		stats.headshots += 1
	if info.kind == DamageInfo.Kind.MELEE:
		stats.knife_kills += 1
	_peer_stats[shooter.peer_id] = stats


## Host: o resumo do fim de jogo para o colega `peer` (o do time + os números dele).
func summary_for(peer: int) -> Dictionary:
	var stats: Dictionary = _peer_stats.get(peer, {"kills": 0, "headshots": 0, "knife_kills": 0})
	var someone := Players.by_peer(peer)
	return {
		"map_id": current_map(),
		"round": round_manager.round_number,
		"kills": int(stats.kills),
		"team_kills": team_kills,
		"players": Players.all().size(),
		"headshots": int(stats.headshots),
		"knife_kills": int(stats.knife_kills),
		"points": points_manager.points_of(someone) if someone else 0,
		"points_earned": points_manager.earned_of(someone) if someone else 0,
		"time_seconds": int(elapsed),
		"bosses": bosses,
		"score": score_manager.score if score_manager else 0,
		"best_score": 0,
		"best_wave": 0,
		"new_record": false,
		"rank_eligible": false,
		"cheat_taunt": "",
	}


## Colega: o host avisou o fim de jogo (com os tiros contados aqui).
func net_game_over(summary: Dictionary) -> void:
	if over:
		return
	over = true
	summary.shots_fired = shots_fired
	summary.shots_hit = mini(shots_hit, shots_fired)
	summary.damage = roundi(damage_dealt)
	_team_result(summary, false)
	Events.game_over.emit(summary)


## Partida em grupo: o resultado do time vai para o ranking local do modo (sem pedir nome: os
## nomes vêm da sala) e o host o envia ao global. Com bots (teste) ou invalidada, não conta.
func _team_result(summary: Dictionary, flagged: bool) -> void:
	var count := Session.player_count()
	if count <= 1:
		return
	var names := PackedStringArray()
	for entry: Dictionary in Session.roster:
		names.append(String(entry.get("name", "")).to_upper())
	var team := " · ".join(names)
	var bots := Session.roster.any(func(entry: Dictionary) -> bool: return bool(entry.get("bot", false)))
	var counts := not bots and not flagged
	summary.team = team
	summary.players = count
	summary.coop_rank = Save.add_ranking_coop(String(summary.map_id), count, team, int(summary.score), int(summary.round), int(summary.get("team_kills", summary.kills))) if counts else 0
	summary.global_submit = counts and Net.is_host() and Online.is_configured() and int(summary.score) > 0
