class_name Weapon
extends Node3D
## Arma em mãos (seção 21): munição, cadência, recarga e o tiro instantâneo (raycast).
## Os números vêm do WeaponData. A lógica de munição não depende da física (dá para testar
## com `tick` sem cena).

signal ammo_changed(magazine: int, reserve: int, reloading: bool)
signal fired()

@export var data: WeaponData

var magazine: int = 0
var reserve: int = 0
var reloading: bool = false

var _cooldown := 0.0
var _reload_left := 0.0
## Coice acumulado (graus), volta a zero quando o jogador para de atirar.
var _recoil := 0.0

static var _tracer_material: StandardMaterial3D


func _ready() -> void:
	if data:
		reset_ammo()


func _process(delta: float) -> void:
	tick(delta)


## Pente e reserva cheios.
func reset_ammo() -> void:
	magazine = data.magazine_size
	reserve = data.reserve_ammo
	reloading = false
	_reload_left = 0.0
	_emit_ammo()


## Avança cadência, coice e recarga.
func tick(delta: float) -> void:
	_cooldown = maxf(0.0, _cooldown - delta)
	_recoil = maxf(0.0, _recoil - delta * 8.0)
	if reloading:
		_reload_left -= delta
		if _reload_left <= 0.0:
			_finish_reload()


func can_fire() -> bool:
	return not reloading and _cooldown <= 0.0 and magazine > 0


## Gasta uma bala se puder atirar. Pente vazio começa a recarga sozinho.
func consume_shot() -> bool:
	if not can_fire():
		if magazine == 0:
			start_reload()
		return false
	magazine -= 1
	_cooldown = 1.0 / data.fire_rate
	_emit_ammo()
	fired.emit()
	if magazine == 0:
		start_reload()
	return true


func start_reload() -> bool:
	if reloading or magazine >= data.magazine_size or reserve <= 0:
		return false
	reloading = true
	_reload_left = data.reload_time
	_emit_ammo()
	return true


## Atira de `origin` em direção a `target`: gasta a bala, aplica spread/coice, faz o raycast
## e entrega o dano à hurtbox atingida. Devolve o DamageInfo do acerto (ou null).
func shoot(space: PhysicsDirectSpaceState3D, origin: Vector3, target: Vector3, exclude: Array[RID], shooter: Node) -> DamageInfo:
	if not consume_shot():
		return null
	var direction := (target - origin).normalized()
	if direction.is_zero_approx():
		direction = -global_basis.z
	var deviation := data.spread_degrees + _recoil
	direction = direction.rotated(Vector3.UP, deg_to_rad(randf_range(-deviation, deviation)))
	_recoil = minf(_recoil + data.recoil_degrees, 10.0)

	var end := origin + direction * data.max_range
	var query := PhysicsRayQueryParameters3D.create(origin, end, PhysicsLayers.SHOT_MASK, exclude)
	query.collide_with_areas = true
	var hit := space.intersect_ray(query)
	var info: DamageInfo = null
	if not hit.is_empty():
		end = hit.position
		var hurtbox := hit.collider as Hurtbox
		if hurtbox:
			info = hurtbox.receive_hit(data.damage, data.headshot_multiplier, DamageInfo.Kind.WEAPON, shooter, hit.position)
	_spawn_tracer(origin, end)
	return info


func _finish_reload() -> void:
	var take := mini(data.magazine_size - magazine, reserve)
	magazine += take
	reserve -= take
	reloading = false
	_reload_left = 0.0
	_emit_ammo()


func _emit_ammo() -> void:
	ammo_changed.emit(magazine, reserve, reloading)


## Rastro rápido do tiro (some em 60 ms).
func _spawn_tracer(from: Vector3, to: Vector3) -> void:
	if not is_inside_tree() or from.distance_to(to) < 0.1:
		return
	if _tracer_material == null:
		_tracer_material = StandardMaterial3D.new()
		_tracer_material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		_tracer_material.albedo_color = Color(1.0, 0.85, 0.45)
	var mesh := BoxMesh.new()
	mesh.size = Vector3(0.03, 0.03, from.distance_to(to))
	var tracer := MeshInstance3D.new()
	tracer.mesh = mesh
	tracer.material_override = _tracer_material
	tracer.top_level = true
	add_child(tracer)
	tracer.global_position = (from + to) * 0.5
	tracer.look_at(to, Vector3.UP if absf((to - from).normalized().y) < 0.99 else Vector3.RIGHT)
	get_tree().create_timer(0.06).timeout.connect(tracer.queue_free)
