class_name RoundManager
extends Node
## Rounds (seção 17): espera → round ativo (spawna até o total, respeitando o limite de
## vivos e o intervalo) → todos abatidos → intervalo → próximo round, mais difícil.

enum Phase { WAITING, ACTIVE, INTERMISSION, STOPPED }

@export var data: RoundData
@export var spawn_manager: SpawnManager
## Rounds de boss (opcional: sem ele, não há boss).
@export var boss_manager: BossManager

var round_number: int = 0
var phase: Phase = Phase.WAITING
var total: int = 0
var spawned: int = 0
var killed: int = 0
## Rodada só de cães (Hospital).
var is_hound_round: bool = false
## Round de boss (o round só termina com o boss derrotado).
var is_boss_round: bool = false

var _timer := 0.0
var _rng := RandomNumberGenerator.new()
var _spawn_timer := 0.0


func _ready() -> void:
	_rng.randomize()
	Events.zombie_killed.connect(_on_zombie_killed)
	Events.zombies_summoned.connect(func(count: int) -> void:
		total += count
		spawned += count
		Events.round_remaining_changed.emit(total - killed))
	Events.boss_defeated.connect(func(_id: StringName, _n: String, _r: int, _at: Vector3) -> void: _check_complete.call_deferred())
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
	var map_id := _map_id()
	is_hound_round = data.is_hound_round(number, map_id)
	total = data.hound_total(number, map_id) if is_hound_round else data.total_zombies(number)
	Events.hound_round_changed.emit(is_hound_round, data.hound_rounds.get(map_id, {}))
	var boss_id: StringName = data.boss_by_map.get(map_id, &"")
	is_boss_round = boss_manager != null and boss_id != &"" and data.boss_rounds.has(number)
	if is_boss_round:
		# O boss vem com uma horda reduzida de escolta.
		total = maxi(2, roundi(total * boss_manager.escort_ratio(boss_id)))
		boss_manager.start(boss_id)
	spawn_manager.round_multipliers = [data.health_multiplier(number), data.damage_multiplier(number), data.speed_multiplier(number), number]
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


func _map_id() -> String:
	return spawn_manager.world.map_id() if spawn_manager and spawn_manager.world else ""


func _try_spawn() -> void:
	if is_hound_round:
		_try_spawn_hound()
		return
	if spawn_manager.alive_count() >= data.max_alive(round_number):
		_spawn_timer = 0.25
		return
	var map_id := _map_id()
	var type := data.pick_type(round_number, map_id, spawn_manager.alive_by_type(), _rng)
	if type == &"":
		_spawn_timer = 0.25  # todos os tipos no limite de vivos
		return
	var zombie := spawn_manager.spawn_zombie(
		data.health_multiplier(round_number), data.damage_multiplier(round_number), data.speed_multiplier(round_number), round_number, type)
	if zombie:
		spawned += 1
		_spawn_timer = data.spawn_interval(round_number)
	else:
		_spawn_timer = 0.5


## Cães: surgem com um raio perto do jogador, poucos vivos de cada vez.
func _try_spawn_hound() -> void:
	var cfg: Dictionary = data.hound_rounds.get(_map_id(), {})
	if spawn_manager.alive_count() >= int(cfg.get("max_alive", 5)):
		_spawn_timer = 0.25
		return
	var hound := spawn_manager.spawn_near_player(&"hound", float(cfg.spawn_distance_min), float(cfg.spawn_distance_max),
		data.health_multiplier(round_number), data.damage_multiplier(round_number), data.speed_multiplier(round_number))
	if hound:
		spawned += 1
		_spawn_timer = float(cfg.get("spawn_interval", 1.4))
	else:
		_spawn_timer = 0.3


func _on_zombie_killed(zombie: Node3D, _info: DamageInfo) -> void:
	if phase != Phase.ACTIVE:
		return
	killed += 1
	Events.round_remaining_changed.emit(total - killed)
	if killed >= total and is_hound_round:
		# O último cão deixa munição cheia (como o Max Ammo do jogo web).
		Events.max_ammo.emit(zombie.global_position)
		is_hound_round = false
		Events.hound_round_changed.emit(false, {})
	_check_complete()


## O round termina quando todos os zumbis morreram e não há boss vivo.
func _check_complete() -> void:
	if phase != Phase.ACTIVE or killed < total:
		return
	if boss_manager and boss_manager.is_active():
		return
	if is_hound_round:
		return  # o último cão ainda vai disparar a munição cheia
	phase = Phase.INTERMISSION
	_timer = data.intermission
	Events.round_completed.emit(round_number)
