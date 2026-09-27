class_name WorldEventSystem
extends Node
## Eventos do mapa (como no jogo web, com escalonamento próprio do Godot): soltos por um
## temporizador de jogo corrido (a cada `interval_time`, não mais uma vez por round), até
## `MAX_CONCURRENT_EVENTS` de sala ao mesmo tempo, respeitando round mínimo, espera entre
## repetições e as condições de cada um. A Horda forçada (a cada `forced.every` rounds) e o
## bloqueio em round de cães/boss são regras especiais que continuam por round, não pelo
## temporizador. O trem tem agenda própria e roda junto com qualquer evento de sala.

## Quantos eventos "de sala" (fora o trem) podem rodar ao mesmo tempo.
const MAX_CONCURRENT_EVENTS := 2

@export var data: WorldEventData
@export var player: Player
@export var world: GameWorld
@export var round_manager: RoundManager
@export var spawn_manager: SpawnManager
@export var points_manager: PointsManager

## id → WorldEvent.
var events: Dictionary = {}
## Eventos de sala em andamento agora (até MAX_CONCURRENT_EVENTS; fora o trem).
var running: Array[WorldEvent] = []
## Tempo decorrido de cada evento em `running` (id → segundos).
var _running_time: Dictionary = {}
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
## Até a próxima tentativa de soltar um evento novo (negativo = ainda não sorteado).
var _next_event_in := -1.0


func _ready() -> void:
	add_to_group(&"world_events")
	if data == null:
		data = WorldEventData.shared()
	var scripts: Array = [BlackoutEvent, AlarmEvent, TrainEvent, HordeEvent, SupplyDropEvent, GasLeakEvent,
			GoldenZombieEvent, BloodMoonEvent, CollapseEvent, FogEvent]
	# Os do Templo dos Mortos (só começam no mapa "temple").
	scripts.append_array(TempleEvents.SCRIPTS)
	# O do Hospital (só começa no mapa "map2").
	scripts.append_array(HospitalEvents.SCRIPTS)
	for script: GDScript in scripts:
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
			if _active:
				trigger(id)
	if _active and not _round_blocks_events() and _round >= int(data.schedule.get("first_wave", 2)):
		if _next_event_in < 0.0:
			_next_event_in = _next_event_delay()
		_next_event_in -= delta
		if _next_event_in <= 0.0:
			_next_event_in = _next_event_delay()
			if running.size() < MAX_CONCURRENT_EVENTS:
				var id := _pick()
				if id != &"":
					trigger(id)
	for event: WorldEvent in running.duplicate():
		var elapsed: float = float(_running_time.get(event.id, 0.0)) + delta
		_running_time[event.id] = elapsed
		var expired: bool = event.duration >= 0.0 and elapsed >= event.duration
		if expired or not event.update(delta):
			stop_event(event)
	_update_train(delta)
	_emit_state()


func _round_blocks_events() -> bool:
	return round_manager != null and (round_manager.is_hound_round or round_manager.is_boss_round)


func _next_event_delay() -> float:
	var interval: Array = data.schedule.get("interval_time", [20.0, 40.0])
	return randf_range(float(interval[0]), float(interval[1]))


## Nome do "primeiro" evento de sala em andamento (fora o trem), ou vazio. Com dois ao mesmo
## tempo, use `is_running(id)` para saber se um específico está ativo.
func active_id() -> StringName:
	return running[0].id if not running.is_empty() else &""


func is_running(id: StringName) -> bool:
	return running.any(func(event: WorldEvent) -> bool: return event.id == id)


## Inicia um evento agora (também usado por painéis e testes). Devolve false se não pôde
## (já rodando, no limite de eventos simultâneos, ou can_start() recusou).
func trigger(id: StringName) -> bool:
	if id == &"train":
		return call_train()
	if not events.has(id) or is_running(id) or running.size() >= MAX_CONCURRENT_EVENTS:
		return false
	var event: WorldEvent = events[id]
	if not event.can_start():
		return false
	running.append(event)
	_running_time[id] = 0.0
	last_round[id] = _round
	event.start()
	_announce(id)
	return true


## Encerra o evento `id` se estiver rodando (painéis de energia e alarme).
func end_event(id: StringName) -> bool:
	for event in running:
		if event.id == id:
			stop_event(event)
			return true
	return false


## Encerra todos os eventos de sala em andamento (round de cães, evento forçado que assume).
func stop() -> void:
	for event: WorldEvent in running.duplicate():
		stop_event(event)


func stop_event(event: WorldEvent) -> void:
	if not running.has(event):
		return
	running.erase(event)
	_running_time.erase(event.id)
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
	if boss_round:
		return
	# Horda forçada (a cada `forced.every` rounds): regra especial por round, não pelo
	# temporizador — tem prioridade e assume o lugar do que estiver rodando.
	var schedule := data.schedule
	var forced: Dictionary = schedule.get("forced", {})
	var is_forced := number >= int(forced.get("first_wave", 15)) and (number - int(forced.get("first_wave", 15))) % int(forced.get("every", 10)) == 0
	if not is_forced:
		return
	stop()
	var id := StringName(forced.get("id", "horde"))
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
	for event: WorldEvent in running.duplicate():
		if event.ends_with_round:
			stop_event(event)


## Sorteio pelos pesos entre os eventos que podem acontecer neste round.
func _pick() -> StringName:
	var eligible: Array[StringName] = []
	var total := 0.0
	for id: StringName in events:
		if is_running(id):
			continue
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


## Indicador da HUD (nome e segundos que faltam), enviado quando o segundo exibido muda. Com
## dois eventos de sala ao mesmo tempo (+ talvez o trem), mostra o que muda primeiro (menos
## tempo restante) e junta o nome dos outros do lado — nenhum some da HUD.
func _emit_state() -> void:
	if running.is_empty() and _train == null:
		if _state_key != "":
			_state_key = ""
			Events.world_event_state.emit({})
		return
	var primary: WorldEvent = null
	var primary_remaining := INF
	for event in running:
		var elapsed: float = float(_running_time.get(event.id, 0.0))
		var remaining: float = (event.duration - elapsed) if event.duration >= 0.0 else INF
		if primary == null or remaining < primary_remaining:
			primary = event
			primary_remaining = remaining
	var showing_train := primary == null
	if showing_train:
		primary = _train
	var others: Array[String] = []
	for event in running:
		if event != primary:
			others.append(String(data.info(event.id).get("name", event.id)))
	if _train and not showing_train:
		others.append(String(data.info(&"train").get("name", "TREM")))
	var remaining := primary_remaining if primary_remaining < INF else -1.0
	var key := "%s|%s|%d" % [primary.id, ",".join(others), ceili(maxf(remaining, 0.0))]
	if key == _state_key:
		return
	_state_key = key
	var info := data.info(primary.id)
	var event_name := String(info.get("name", primary.id))
	for extra in others:
		event_name += " + " + extra
	Events.world_event_state.emit({"id": primary.id, "name": event_name, "color": info.get("color", Color.WHITE),
		"remaining": remaining, "total": primary.duration if not showing_train else -1.0})
