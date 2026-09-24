class_name RoundManager
extends Node
## Rounds (seção 17): espera → round ativo (spawna até o total, respeitando o limite de
## vivos e o intervalo) → todos abatidos → intervalo → próximo round, mais difícil.

enum Phase { WAITING, ACTIVE, INTERMISSION, STOPPED }

@export var data: RoundData
@export var spawn_manager: SpawnManager

var round_number: int = 0
var phase: Phase = Phase.WAITING
var total: int = 0
var spawned: int = 0
var killed: int = 0

var _timer := 0.0
var _spawn_timer := 0.0


func _ready() -> void:
	Events.zombie_killed.connect(_on_zombie_killed)
	Events.player_died.connect(stop)
	_timer = data.first_round_delay


func _process(delta: float) -> void:
	tick(delta)


func tick(delta: float) -> void:
	match phase:
		Phase.WAITING, Phase.INTERMISSION:
			_timer -= delta
			if _timer <= 0.0:
				start_round(round_number + 1)
		Phase.ACTIVE:
			_spawn_timer -= delta
			if _spawn_timer <= 0.0 and spawned < total:
				_try_spawn()


func start_round(number: int) -> void:
	round_number = number
	total = data.total_zombies(number)
	spawned = 0
	killed = 0
	phase = Phase.ACTIVE
	_spawn_timer = 0.0
	Events.round_started.emit(number, total)
	Events.round_remaining_changed.emit(total)


## Tempo que falta para o próximo round começar (s); 0 durante o round.
func time_to_next_round() -> float:
	return maxf(0.0, _timer) if phase == Phase.WAITING or phase == Phase.INTERMISSION else 0.0


func stop() -> void:
	phase = Phase.STOPPED


func _try_spawn() -> void:
	if spawn_manager.alive_count() >= data.max_alive(round_number):
		_spawn_timer = 0.25
		return
	var zombie := spawn_manager.spawn_zombie(
		data.health_multiplier(round_number), data.damage_multiplier(round_number), data.speed_multiplier(round_number), round_number)
	if zombie:
		spawned += 1
		_spawn_timer = data.spawn_interval(round_number)
	else:
		_spawn_timer = 0.5


func _on_zombie_killed(_zombie: Node3D, _info: DamageInfo) -> void:
	if phase != Phase.ACTIVE:
		return
	killed += 1
	Events.round_remaining_changed.emit(total - killed)
	if killed >= total:
		phase = Phase.INTERMISSION
		_timer = data.intermission
		Events.round_completed.emit(round_number)
