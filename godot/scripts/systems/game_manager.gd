class_name GameManager
extends Node
## Fluxo da partida (seção 37): posiciona o jogador, conta estatísticas, pausa e fim de jogo.
## Roda mesmo com o jogo pausado (para despausar).

@export var player: Player
@export var arena: GameWorld
@export var round_manager: RoundManager
@export var points_manager: PointsManager

var kills: int = 0
var headshots: int = 0
## Tempo de jogo (s), sem contar a pausa.
var elapsed: float = 0.0


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	if arena and player:
		player.global_position = arena.get_player_spawn()
	Events.zombie_killed.connect(_on_zombie_killed)
	Events.player_died.connect(_on_player_died)
	Events.restart_requested.connect(restart)
	Events.round_completed.connect(_on_round_completed)


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


func _on_round_completed(_round_number: int) -> void:
	if round_manager.data.refill_ammo_on_round_end and player.is_alive():
		for weapon in player.inventory.weapons:
			weapon.reset_ammo()


func _on_player_died() -> void:
	Events.game_over.emit({
		"round": round_manager.round_number,
		"kills": kills,
		"headshots": headshots,
		"points": points_manager.points,
		"time_seconds": int(elapsed),
	})
