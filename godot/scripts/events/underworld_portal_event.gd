class_name UnderworldPortalEvent
extends WorldEvent
## Portão do Submundo (Templo): um portal roxo se abre no chão e solta criaturas até ser
## destruído a tiros. Destruí-lo pela primeira vez na partida deixa o Tridente de Poseidon num
## pedestal onde ele estava.

const COLOR := Color(0.65, 0.35, 1.0)
const TRIDENT := "res://data/weapons/poseidon_trident.tres"

var portal: Node3D
var health: HealthComponent
var destroyed := false
var _next := 0.0


func _init() -> void:
	id = &"underworld_portal"


func can_start() -> bool:
	return TempleEvents.in_temple(system)


func start() -> void:
	duration = float(config.get("duration_time", 60.0))
	destroyed = false
	var point: Variant = system.pick_floor_point(float(config.get("min_distance", 10.0)), float(config.get("max_distance", 18.0)))
	var at: Vector3 = point if point is Vector3 else system.player.global_position + Vector3(10, 0, 0)
	portal = Node3D.new()
	portal.name = "UnderworldPortal"
	portal.add_to_group(&"underworld_portal")
	system.world_root().add_child(portal)
	portal.global_position = Vector3(at.x, 0.0, at.z)
	portal.add_child(EventFx.disc(COLOR, 1.6, 0.8))
	var ring := EventFx.box(Vector3(2.4, 2.8, 0.25), EventFx.glow(COLOR, 0.7, 2.0))
	ring.position.y = 1.5
	portal.add_child(ring)
	var light := EventFx.light(COLOR, 2.2, 7.0)
	light.position.y = 1.6
	portal.add_child(light)
	# Alvo dos tiros: vida e hurtbox (como o cadeado das missões).
	health = HealthComponent.new()
	health.name = "HealthComponent"
	portal.add_child(health)
	var rounds := system.round_manager
	health.reset(float(config.get("health", 600)) + float(config.get("health_per_wave", 60)) * (rounds.round_number if rounds else 1))
	var hurtbox := Hurtbox.new()
	hurtbox.name = "Hurtbox"
	hurtbox.health = health
	hurtbox.collision_layer = PhysicsLayers.HURTBOXES
	hurtbox.collision_mask = 0
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(2.4, 2.8, 1.0)
	shape.shape = box
	shape.position.y = 1.4
	hurtbox.add_child(shape)
	portal.add_child(hurtbox)
	health.died.connect(func(_info: DamageInfo) -> void: _destroy())
	_next = 1.5
	SpecialFire.flash(system.get_tree(), portal.global_position + Vector3.UP, 3.0, COLOR)
	Audio.play_at("boss_summon", portal.global_position, "world", 1.0, 40.0)


func update(delta: float) -> bool:
	if destroyed or not is_instance_valid(portal):
		return false
	_next -= delta
	if _next <= 0.0:
		_next = float(config.get("every_time", 4.0))
		var type := &"hellwolf" if randf() < 0.35 else &"skeleton"
		var zombie := system.spawn_manager.spawn_at(type, portal.global_position + Vector3(randf_range(-1.2, 1.2), 0, 1.4))
		if zombie:
			Events.zombies_summoned.emit(1)
			SpecialFire.flash(system.get_tree(), zombie.global_position + Vector3.UP, 1.0, COLOR)
	portal.rotation.y += delta * 0.8
	return true


func end() -> void:
	if is_instance_valid(portal):
		portal.queue_free()
	portal = null


func _destroy() -> void:
	if destroyed:
		return
	destroyed = true
	var at := portal.global_position
	SpecialFire.flash(system.get_tree(), at + Vector3.UP, 4.0, COLOR)
	Events.screen_shake.emit(0.6, 0.15)
	Audio.play_at("explosion", at, "world", 1.0)
	if not system.has_meta(&"trident_given") and ResourceLoader.exists(TRIDENT):
		system.set_meta(&"trident_given", true)
		var pedestal := PrizePedestal.new()
		pedestal.weapon_path = TRIDENT
		pedestal.prop_name = "altar"
		pedestal.position = at
		system.world_root().add_child(pedestal)
		Events.toast.emit("O PORTAL CAIU — O TRIDENTE DE POSEIDON FICOU NO LUGAR")
	else:
		Events.toast.emit("O PORTÃO DO SUBMUNDO SE FECHOU")
