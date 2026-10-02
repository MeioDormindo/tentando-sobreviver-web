class_name ZeusWrathEvent
extends WorldEvent
## Ira de Zeus (Templo): raios caem perto do jogador. Cada um é avisado por um círculo azul que
## fecha; ao cair, fere quem estiver dentro (zumbis também) com um clarão e trovão.

const WARN_COLOR := Color(0.55, 0.8, 1.0)

var _next := 0.0
var _falling: Array[Dictionary] = []


func _init() -> void:
	id = &"zeus_wrath"


func can_start() -> bool:
	return TempleEvents.in_temple(system)


func start() -> void:
	duration = float(config.get("duration_time", 18.0))
	_next = 0.8
	_falling.clear()
	Events.screen_shake.emit(0.4, 0.1)


func update(delta: float) -> bool:
	_next -= delta
	if _next <= 0.0:
		_next = float(config.get("every_time", 1.0))
		_strike_warning()
	_tick_falling(delta)
	return true


## Os círculos encolhem e o raio cai no fim do aviso (dano só no host).
func _tick_falling(delta: float) -> void:
	var warning := float(config.get("warning_time", 0.9))
	for piece in _falling.duplicate():
		piece.left -= delta
		var t := 1.0 - maxf(0.0, piece.left) / warning
		var ring: Node3D = piece.node
		ring.scale = Vector3.ONE * (1.5 - 0.5 * t)
		if piece.left <= 0.0:
			_impact(piece)


func end() -> void:
	for piece in _falling:
		(piece.node as Node).queue_free()
	_falling.clear()


func _strike_warning() -> void:
	var at := system.focus().global_position
	if randf() >= float(config.get("aim_at_player_chance", 0.4)):
		var angle := randf() * TAU
		at += Vector3(cos(angle), 0.0, sin(angle)) * sqrt(randf()) * float(config.get("spread", 8.0))
	at.y = 0.0
	if not system.world.is_open_floor(at):
		return
	system.net_fx(id, [at])
	_place(at)


## Círculo de aviso do raio (no host e, em rede, nos colegas no mesmo lugar).
func _place(at: Vector3) -> void:
	var ring := EventFx.disc(WARN_COLOR, float(config.get("radius", 1.6)), 0.25)
	system.world_root().add_child(ring)
	ring.global_position = at + Vector3.UP * 0.03
	_falling.append({"node": ring, "at": at, "left": float(config.get("warning_time", 0.9))})


func _impact(piece: Dictionary) -> void:
	_falling.erase(piece)
	(piece.node as Node).queue_free()
	var at: Vector3 = piece.at
	var radius := float(config.get("radius", 1.6))
	system.damage_area(at, radius, float(config.get("player_damage", 22)), float(config.get("zombie_damage", 260)))
	# O raio: uma coluna de luz do céu, clarão e trovão.
	var bolt := EventFx.box(Vector3(0.18, 9.0, 0.18), EventFx.glow(Color(0.85, 0.95, 1.0), 1.0, 3.0))
	system.world_root().add_child(bolt)
	bolt.global_position = at + Vector3.UP * 4.5
	var tween := bolt.create_tween()
	tween.tween_property(bolt, "scale:x", 0.1, 0.25)
	tween.tween_callback(bolt.queue_free)
	SpecialFire.flash(system.get_tree(), at + Vector3.UP * 0.6, radius * 1.6, WARN_COLOR)
	Audio.play_at("explosion", at, "world", 0.8)
	Events.screen_shake.emit(0.15, 0.12)


func client_start(_params: Dictionary) -> void:
	_falling.clear()
	Events.screen_shake.emit(0.4, 0.1)


func client_update(delta: float) -> void:
	_tick_falling(delta)


func client_fx(args: Array) -> void:
	if not args.is_empty():
		_place(args[0])


func client_end() -> void:
	end()
