class_name SupplyDropEvent
extends WorldEvent
## Suprimentos: uma caixa desce de paraquedas num ponto do mapa (com sinalizador vermelho) e
## quem abrir recebe munição cheia, armadura e dinheiro.

const FALL_HEIGHT := 14.0

var crate: SupplyCrate
var _elapsed := 0.0


func _init() -> void:
	id = &"supply_drop"


func can_start() -> bool:
	var range_m: Array = config.get("distance", [6.9, 20.3])
	return system.pick_floor_point(float(range_m[0]), float(range_m[1]), 20) != null


func start() -> void:
	var fall := float(config.get("fall_time", 2.2))
	duration = float(config.get("lifetime_time", 60.0)) + fall
	_elapsed = 0.0
	var range_m: Array = config.get("distance", [6.9, 20.3])
	var at := system.floor_point_near(float(range_m[0]), float(range_m[1]))
	crate = SupplyCrate.new()
	crate.name = "SupplyCrate"
	crate.hold_time = float(config.get("open_hold_time", 3.0))
	crate.interrupt_time = float(config.get("interrupt_time", 0.5))
	crate.opened.connect(_open)
	system.world_root().add_child(crate)
	crate.global_position = Vector3(at.x, 0.0, at.z)
	crate.fall(FALL_HEIGHT, fall)


func net_params() -> Dictionary:
	return {"at": crate.global_position if crate and is_instance_valid(crate) else Vector3.ZERO}


## Colega: a mesma caixa caindo no mesmo ponto (quem abre e o prêmio são do host).
func client_start(params: Dictionary) -> void:
	crate = SupplyCrate.new()
	crate.name = "SupplyCrate"
	crate.hold_time = float(config.get("open_hold_time", 3.0))
	system.world_root().add_child(crate)
	crate.global_position = params.get("at", Vector3.ZERO)
	crate.fall(FALL_HEIGHT, float(config.get("fall_time", 2.2)))
	duration = float(config.get("lifetime_time", 60.0)) + float(config.get("fall_time", 2.2))
	_elapsed = 0.0


func client_update(delta: float) -> void:
	if crate and is_instance_valid(crate) and not crate.is_open:
		_elapsed += delta
		var left := duration - _elapsed
		crate.blink(left > 8.0 or int(left * 5.0) % 2 == 0)


func client_end() -> void:
	end()


func update(delta: float) -> bool:
	if crate == null or not is_instance_valid(crate) or crate.is_open:
		return false
	_elapsed += delta
	var left := duration - _elapsed
	crate.blink(left > 8.0 or int(left * 5.0) % 2 == 0)
	return true


func end() -> void:
	if crate and is_instance_valid(crate):
		crate.queue_free()
	crate = null


func _open() -> void:
	var money := int(config.get("money", 750))
	Events.max_ammo.emit(crate.global_position)
	var opener := crate.opened_by as Player if crate.opened_by is Player else system.player
	opener.refill_armor()
	system.points_manager.add(money, false, opener)
	var info := system.data.info(id)
	Events.power_up_collected.emit(id, String(info.get("name", "SUPRIMENTOS")), info.get("color", Color.GREEN),
		Loc.fmt("Munição cheia · Armadura · +%s", [money]))
