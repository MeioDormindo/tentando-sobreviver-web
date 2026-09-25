class_name TrainEvent
extends WorldEvent
## Trem atravessando a plataforma (como no jogo web): aviso (faixa piscando e semáforos) e
## depois o trem cruza a faixa dos trilhos em alta velocidade, matando os zumbis e ferindo o
## jogador que estiverem nela. Quem está na beira é empurrado pelo deslocamento de ar.

const BLINK := 0.26
const RED := Color(1.0, 0.16, 0.1)

## Contagem de atropelados desta passagem.
var run_over := 0
## Posição x da frente do trem e direção (+1 → para a direita).
var head_x := 0.0
var direction := 1

var _elapsed := 0.0
var _top := 0.0
var _bottom := 0.0
var _from := 0.0
var _to := 0.0
var _map_width := 128.0
var _length := 50.0
var _player_hit := false
var _node: Node3D
var _stripe: MeshInstance3D
var _train: Node3D
## Ponto do ronco do trem (na faixa, o mais perto do jogador dentro do trem).
var _rumble_point: Node3D
var _rumble: Dictionary = {}


func _init() -> void:
	id = &"train"


## Só em mapas com estação, e com a área dos trilhos aberta.
func can_start() -> bool:
	var station := system.world.station()
	return not station.is_empty() and system.world.is_area_open(StringName(station.area))


func is_warning() -> bool:
	return _train == null


func start() -> void:
	var station := system.world.station()
	_top = float(station.lane.y)
	_bottom = _top + float(station.lane.h)
	_from = float(station.span.from)
	_to = float(station.span.to)
	_map_width = float(system.world.minimap_size().x)
	_length = float(config.get("cars", 5)) * float(config.get("car_length", 10.0))
	_elapsed = 0.0
	_player_hit = false
	run_over = 0
	direction = 1 if randf() < 0.5 else -1
	_node = Node3D.new()
	_node.name = "Train"
	system.world_root().add_child(_node)
	_stripe = EventFx.box(Vector3(_to - _from, 0.04, _bottom - _top), EventFx.glow(RED, 0.0, 1.0))
	_node.add_child(_stripe)
	_stripe.global_position = Vector3((_from + _to) * 0.5, 0.04, (_top + _bottom) * 0.5)
	# A buzina vem do lado de onde o trem chega.
	Audio.play_at("evt_train_warning", Vector3(_from if direction > 0 else _to, 0.0, (_top + _bottom) * 0.5), "world", 1.0, 81.0, 0.0)


func update(delta: float) -> bool:
	_elapsed += delta
	var blink_on := int(_elapsed / BLINK) % 2 == 0
	var warning := float(config.get("warning_time", 4.5))
	(_stripe.mesh.material as StandardMaterial3D).albedo_color.a = (0.28 if blink_on else 0.08) if _elapsed < warning else (0.22 if blink_on else 0.06)
	if _elapsed < warning:
		return true
	if _train == null:
		_spawn_train()
	head_x += direction * float(config.get("speed", 46.9)) * delta
	_train.global_position.x = head_x
	var min_x := minf(head_x, head_x - direction * _length)
	var max_x := maxf(head_x, head_x - direction * _length)
	if _rumble_point:
		_rumble_point.global_position = Vector3(clampf(system.player.global_position.x, min_x, max_x), 1.0, (_top + _bottom) * 0.5)
	_run_over(min_x, max_x)
	_air_blast(min_x, max_x, delta)
	var player := system.player
	if absf(player.global_position.z - (_top + _bottom) * 0.5) < 8.0 and player.global_position.x > min_x - 12.0 and player.global_position.x < max_x + 12.0:
		Events.screen_shake.emit(0.08, 0.06)
	# Terminou quando o último vagão saiu do mapa.
	var running := min_x < _map_width + 2.0 if direction > 0 else max_x > -2.0
	if not running and run_over > 0:
		Events.toast.emit("ATROPELADOS ×%d" % run_over)
		Events.train_run_over.emit(run_over)
	return running


func end() -> void:
	Audio.stop_loop(_rumble, 0.6)
	_rumble = {}
	_rumble_point = null
	if _node and is_instance_valid(_node):
		_node.queue_free()
	_node = null
	_train = null


## Locomotivas nas pontas e vagões no meio.
func _spawn_train() -> void:
	_train = Node3D.new()
	_train.name = "Cars"
	_node.add_child(_train)
	var cars := int(config.get("cars", 5))
	var car_length := float(config.get("car_length", 10.0))
	var width := _bottom - _top - 0.6
	for i in cars:
		var engine := i == 0 or i == cars - 1
		var car := EventFx.box(Vector3(car_length - 0.4, 2.6, width), EventFx.glow(Color(0.25, 0.36, 0.44) if engine else Color(0.3, 0.33, 0.36), 1.0, 0.05))
		# O trem cresce para trás da frente (head_x).
		car.position = Vector3(-direction * (car_length * 0.5 + i * car_length), 1.3, 0.0)
		_train.add_child(car)
	var headlight := EventFx.light(Color(1.0, 0.94, 0.75), 3.0, 12.0)
	headlight.position = Vector3(direction * 2.0, 1.5, 0.0)
	_train.add_child(headlight)
	head_x = -2.0 if direction > 0 else _map_width + 2.0
	_rumble_point = Node3D.new()
	_node.add_child(_rumble_point)
	_rumble = Audio.loop_at("evt_train_pass", _rumble_point, "world", 1.0, 47.0)
	_train.global_position = Vector3(head_x, 0.0, (_top + _bottom) * 0.5)


## Quem estiver na faixa dos trilhos é atropelado.
func _run_over(min_x: float, max_x: float) -> void:
	for zombie in system.live_zombies():
		var at := zombie.global_position
		if at.x < min_x or at.x > max_x or at.z < _top - 0.3 or at.z > _bottom + 0.3:
			continue
		zombie.take_damage(DamageInfo.new(zombie.health.current + 1.0, DamageInfo.Kind.ENVIRONMENT, null, false, at))
		if not zombie.is_alive():
			run_over += 1
	var player := system.player
	var p := player.global_position
	if not _player_hit and player.is_alive() and p.x >= min_x and p.x <= max_x and p.z > _top - 0.25 and p.z < _bottom + 0.25:
		_player_hit = true
		player.take_damage(DamageInfo.new(float(config.get("player_damage", 70)), DamageInfo.Kind.ENVIRONMENT, null, false, p))
		Events.screen_shake.emit(0.4, 0.3)


## Deslocamento de ar: quem está na beira da faixa, ao lado do trem, é empurrado para longe.
func _air_blast(min_x: float, max_x: float, delta: float) -> void:
	var blast: Dictionary = system.data.config(&"station").get("air_blast", {})
	var reach := float(blast.get("range", 1.1))
	var player := system.player
	var p := player.global_position
	if not player.is_alive() or p.x < min_x or p.x > max_x:
		return
	var above := p.z < _top and p.z > _top - reach
	var below := p.z > _bottom and p.z < _bottom + reach
	if above or below:
		player.global_position.z += (-1.0 if above else 1.0) * float(blast.get("speed", 2.2)) * delta
