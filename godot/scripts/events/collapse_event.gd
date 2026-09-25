class_name CollapseEvent
extends WorldEvent
## Desabamento: pedaços do teto caem perto do jogador. Cada um é avisado por um círculo
## vermelho que fecha; ao cair, fere quem estiver dentro (zumbis também) e deixa entulho.

const WARN_COLOR := Color(1.0, 0.23, 0.16)

var _next := 0.0
## Pedaços caindo: {node, at (Vector3), left (s)}.
var _falling: Array[Dictionary] = []
var _debris: Array[Node3D] = []


func _init() -> void:
	id = &"collapse"


func start() -> void:
	duration = float(config.get("duration_time", 20.0))
	_next = 0.6
	_falling.clear()
	Events.screen_shake.emit(0.5, 0.12)


func update(delta: float) -> bool:
	_next -= delta
	if _next <= 0.0:
		_next = float(config.get("every_time", 1.1))
		_drop()
	var warning := float(config.get("warning_time", 1.2))
	var radius := float(config.get("radius", 1.3))
	for piece in _falling.duplicate():
		piece.left -= delta
		var t := 1.0 - maxf(0.0, piece.left) / warning
		var ring: Sprite3D = piece.node
		ring.scale = Vector3.ONE * (1.6 - 0.6 * t)
		ring.modulate.a = 0.35 + 0.65 * t
		if piece.left <= 0.0:
			_impact(piece, radius)
	return true


func end() -> void:
	for piece in _falling:
		(piece.node as Node).queue_free()
	_falling.clear()
	for rubble in _debris:
		if is_instance_valid(rubble):
			rubble.queue_free()
	_debris.clear()


func _drop() -> void:
	var at := system.player.global_position
	if randf() >= float(config.get("aim_at_player_chance", 0.35)):
		var angle := randf() * TAU
		var distance := sqrt(randf()) * float(config.get("spread", 6.9))
		at += Vector3(cos(angle), 0.0, sin(angle)) * distance
	at.y = 0.0
	# Só cai em chão (não no meio de paredes).
	if not system.world.is_open_floor(at):
		return
	var ring := EventFx.disc(WARN_COLOR, float(config.get("radius", 1.3)), 0.2)
	system.world_root().add_child(ring)
	ring.global_position = at + Vector3.UP * 0.03
	_falling.append({"node": ring, "at": at, "left": float(config.get("warning_time", 1.2))})


func _impact(piece: Dictionary, radius: float) -> void:
	_falling.erase(piece)
	(piece.node as Node).queue_free()
	var at: Vector3 = piece.at
	system.damage_area(at, radius, float(config.get("player_damage", 25)), float(config.get("zombie_damage", 220)))
	SpecialFire.flash(system.get_tree(), at + Vector3.UP * 0.5, radius * 1.3, Color(0.78, 0.71, 0.54))
	Events.screen_shake.emit(0.14, 0.1)
	var rubble: Node3D = PropFactory.create("rubble")
	if rubble == null:
		rubble = EventFx.box(Vector3(0.7, 0.25, 0.5), EventFx.glow(Color(0.35, 0.32, 0.27), 1.0, 0.0))
		rubble.position.y = 0.12
	system.world_root().add_child(rubble)
	rubble.global_position = at + Vector3.UP * rubble.position.y
	PixelFx.spawn(system.get_tree(), "smoke", at + Vector3.UP * 0.5, 2.2)
	rubble.rotation.y = randf() * TAU
	_debris.append(rubble)
