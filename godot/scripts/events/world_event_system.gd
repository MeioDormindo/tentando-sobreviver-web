class_name WorldEventSystem
extends Node
## Eventos do mapa (como no jogo web): quando um round começa, pode sortear um evento (um de
## cada vez), respeitando round mínimo, espera entre repetições e as condições de cada um. A
## Horda começa junto com o round; os outros, depois de um atraso. O trem tem agenda própria e
## roda junto com qualquer outro evento. Nada acontece em rounds de cães ou de boss.

@export var data: WorldEventData
@export var player: Player
@export var world: GameWorld
@export var round_manager: RoundManager
@export var spawn_manager: SpawnManager
@export var points_manager: PointsManager

## id → WorldEvent.
var events: Dictionary = {}
var running: WorldEvent
var running_time := 0.0
## Round em que cada evento aconteceu por último.
var last_round: Dictionary = {}

var _pending_id: StringName = &""
var _pending_in := 0.0
var _train: WorldEvent
var _train_in := -1.0
var _train_passes := 0
var _round := 0
var _active := false
var _state_key := ""


func _ready() -> void:
	add_to_group(&"world_events")
	if data == null:
		data = WorldEventData.shared()
	for script: GDScript in [BlackoutEvent, AlarmEvent, TrainEvent, HordeEvent, SupplyDropEvent, GasLeakEvent,
			GoldenZombieEvent, BloodMoonEvent, CollapseEvent, FogEvent]:
		var event: WorldEvent = script.new()
		event.system = self
		event.config = data.config(event.id)
		events[event.id] = event
	Events.round_started.connect(func(n: int, _t: int) -> void: _on_round_started(n))
	Events.round_completed.connect(func(_n: int) -> void: _on_round_ended())


func _physics_process(delta: float) -> void:
	if player == null or not player.is_alive():
		return
	if _pending_id != &"":
		_pending_in -= delta
		if _pending_in <= 0.0:
			var id := _pending_id
			_pending_id = &""
			if _active and running == null:
				trigger(id)
	if running:
		running_time += delta
		var expired := running.duration >= 0.0 and running_time >= running.duration
		if expired or not running.update(delta):
			stop()
	_update_train(delta)
	_emit_state()


## Evento em andamento (fora o trem), ou vazio.
func active_id() -> StringName:
	return running.id if running else &""


## Inicia um evento agora (também usado por painéis e testes). Devolve false se não pôde.
func trigger(id: StringName) -> bool:
	if id == &"train":
		return call_train()
	if running or not events.has(id):
		return false
	var event: WorldEvent = events[id]
	if not event.can_start():
		return false
	running = event
	running_time = 0.0
	last_round[id] = _round
	event.start()
	_announce(id)
	return true


## Encerra o evento em andamento se for `id` (painéis de energia e alarme).
func end_event(id: StringName) -> bool:
	if running == null or running.id != id:
		return false
	stop()
	return true


func stop() -> void:
	if running == null:
		return
	var event := running
	running = null
	event.end()
	_emit_state()


## Chama o trem agora (painel da Plataforma, agenda). Devolve false se já está passando.
func call_train() -> bool:
	var event: WorldEvent = events[&"train"]
	if _train or not event.can_start():
		return false
	_train = event
	_train_passes += 1
	event.start()
	_announce(&"train")
	return true


## Situação do trem para o painel de horários: {state: none/scheduled/warning/passing, time}.
func train_status() -> Dictionary:
	if _train:
		return {"state": "warning" if (_train as TrainEvent).is_warning() else "passing", "time": 0.0}
	if _train_in >= 0.0:
		return {"state": "scheduled", "time": _train_in}
	return {"state": "none", "time": 0.0}


# ───────────────────────── Ajuda para os eventos ─────────────────────────

## Ponto de chão livre numa área aberta, a uma distância do jogador no intervalo (ou null).
func pick_floor_point(min_distance: float, max_distance: float, tries: int = 80) -> Variant:
	var nav_map := player.get_world_3d().navigation_map
	for i in tries:
		var angle := randf() * TAU
		var distance := randf_range(min_distance, max_distance)
		var point := player.global_position + Vector3(cos(angle), 0.0, sin(angle)) * distance
		point.y = 0.0
		if not world.is_open_floor(point):
			continue
		var closest := NavigationServer3D.map_get_closest_point(nav_map, point)
		if Vector2(closest.x - point.x, closest.z - point.z).length() < 0.6:
			return point
	return null


## Zumbis vivos (sem o boss).
func live_zombies() -> Array[ZombieBase]:
	var list: Array[ZombieBase] = []
	for node in get_tree().get_nodes_in_group(&"zombies"):
		var zombie := node as ZombieBase
		if zombie and zombie.is_alive():
			list.append(zombie)
	return list


## Fere o jogador e os zumbis dentro do raio (gás, desabamento).
func damage_area(center: Vector3, radius: float, player_damage: float, zombie_damage: float) -> void:
	var flat := Vector2(center.x, center.z)
	if player.is_alive() and Vector2(player.global_position.x, player.global_position.z).distance_to(flat) <= radius:
		player.take_damage(DamageInfo.new(player_damage, DamageInfo.Kind.ENVIRONMENT, null, false, center))
	for zombie in live_zombies():
		if Vector2(zombie.global_position.x, zombie.global_position.z).distance_to(flat) <= radius:
			zombie.take_damage(DamageInfo.new(zombie_damage, DamageInfo.Kind.ENVIRONMENT, null, false, zombie.global_position))


func world_root() -> Node:
	return SpecialFire.world_root(get_tree())


# ───────────────────────── Agenda ─────────────────────────

func _on_round_started(number: int) -> void:
	_round = number
	_active = true
	_train_passes = 0
	# Rodada dos cães: a névoa dela não pode brigar com outro evento.
	if round_manager and round_manager.is_hound_round:
		stop()
		return
	var boss_round := round_manager != null and round_manager.is_boss_round
	var train_info := data.info(&"train")
	if number >= int(train_info.get("min_round", 2)) and not boss_round and events[&"train"].can_start() \
			and randf() < float(data.config(&"train").get("chance_per_wave", 0.0)):
		_schedule_train()
	var schedule := data.schedule
	if number < int(schedule.get("first_wave", 2)) or boss_round:
		return
	var forced: Dictionary = schedule.get("forced", {})
	var is_forced := number >= int(forced.get("first_wave", 15)) and (number - int(forced.get("first_wave", 15))) % int(forced.get("every", 10)) == 0
	# O evento especial do round tem prioridade sobre um que ainda esteja em andamento.
	if is_forced:
		stop()
	if running:
		return
	if not is_forced and randf() >= float(schedule.get("chance_per_wave", 0.6)):
		return
	var id := StringName(forced.get("id", "horde")) if is_forced else _pick()
	if id == &"":
		return
	if (events[id] as WorldEvent).at_round_start:
		trigger(id)
	else:
		var delay: Array = schedule.get("start_delay_time", [5, 16])
		_pending_id = id
		_pending_in = randf_range(float(delay[0]), float(delay[1]))


func _on_round_ended() -> void:
	_active = false
	_pending_id = &""
	_train_in = -1.0
	if running and running.ends_with_round:
		stop()


## Sorteio pelos pesos entre os eventos que podem acontecer neste round.
func _pick() -> StringName:
	var eligible: Array[StringName] = []
	var total := 0.0
	for id: StringName in events:
		var info := data.info(id)
		var weight := float(info.get("weight", 0))
		if weight <= 0.0 or _round < int(info.get("min_round", 1)):
			continue
		if last_round.has(id) and _round - int(last_round[id]) <= int(info.get("cooldown_rounds", 0)):
			continue
		if not (events[id] as WorldEvent).can_start():
			continue
		eligible.append(id)
		total += weight
	var roll := randf() * total
	for id in eligible:
		roll -= float(data.info(id).weight)
		if roll < 0.0:
			return id
	return &""


func _schedule_train() -> void:
	var delay: Array = data.config(&"train").get("delay_time", [4, 22])
	_train_in = randf_range(float(delay[0]), float(delay[1]))


## O trem passou por completo: talvez venha outra passagem no mesmo round.
func _update_train(delta: float) -> void:
	if _train and not _train.update(delta):
		_train.end()
		_train = null
		if _active and _train_passes == 1 and randf() < float(data.config(&"train").get("second_pass_chance", 0.0)):
			_schedule_train()
	if _train_in >= 0.0:
		_train_in -= delta
		if _train_in < 0.0 and _active:
			call_train()


func _announce(id: StringName) -> void:
	var info := data.info(id)
	Events.world_event_started.emit(id, String(info.get("name", id)), String(info.get("hint", "")), info.get("color", Color.WHITE))
	_state_key = "#"


## Indicador da HUD (nome e segundos que faltam), enviado quando o segundo exibido muda.
func _emit_state() -> void:
	var event := running if running else _train
	if event == null:
		if _state_key != "":
			_state_key = ""
			Events.world_event_state.emit({})
		return
	var remaining := -1.0
	if event == running and running.duration >= 0.0:
		remaining = maxf(0.0, running.duration - running_time)
	var with_train := _train != null and event != _train
	var key := "%s|%s|%d" % [event.id, with_train, ceili(remaining)]
	if key == _state_key:
		return
	_state_key = key
	var info := data.info(event.id)
	var event_name := String(info.get("name", event.id))
	if with_train:
		event_name += " + " + String(data.info(&"train").get("name", "TREM"))
	Events.world_event_state.emit({"id": event.id, "name": event_name, "color": info.get("color", Color.WHITE),
		"remaining": remaining, "total": running.duration if event == running else -1.0})
