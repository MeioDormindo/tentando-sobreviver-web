class_name Weapon
extends Node3D
## Arma (seção 21): munição, cadência, recarga, giro do cano e o tiro instantâneo (raycast),
## com vários projéteis por disparo (espingardas) e perfuração. Os números vêm do WeaponData.
## A lógica de munição não depende da física (dá para testar com `tick` sem cena).

signal ammo_changed(magazine: int, reserve: int, reloading: bool)
signal fired()

## Zumbis atingidos por um mesmo projétil no máximo (segurança contra laços).
const MAX_HITS_PER_PELLET := 16

@export var data: WeaponData

var magazine: int = 0
var reserve: int = 0
var reloading: bool = false
## Arma parada por outra ação (troca de arma, faca).
var busy: bool = false
## Nível no Weapon Lab: 0 normal, 1 Mk II, 2 Mk III.
var level: int = 0
## Modificadores dos perks (aplicados pelo Player): dano, bônus de headshot e recarga.
var damage_multiplier: float = 1.0
var headshot_bonus: float = 0.0
var reload_multiplier: float = 1.0

var _cooldown := 0.0
var _reload_left := 0.0
## Coice acumulado (graus), volta a zero quando o jogador para de atirar.
var _recoil := 0.0
## Tempo com o gatilho seguro (giro do cano da minigun).
var _spin := 0.0
var _trigger_held := false
## Materiais dos rastros por cor (compartilhados).
static var _tracer_materials: Dictionary = {}


func _ready() -> void:
	if data and magazine == 0 and reserve == 0:
		reset_ammo()


## Mesmo relógio do jogador (física): o gatilho marcado no _physics_process do Player é lido
## aqui logo depois. No _process, frames sem passo de física soltariam o gatilho da minigun.
func _physics_process(delta: float) -> void:
	tick(delta)


## Pente e reserva cheios.
func reset_ammo() -> void:
	magazine = data.magazine_size
	reserve = data.reserve_ammo
	reloading = false
	_reload_left = 0.0
	_emit_ammo()


## Troca pelos dados melhorados do Weapon Lab (sobe um nível, enche a munição).
func upgrade_to(upgraded: WeaponData) -> void:
	data = upgraded
	level += 1
	reloading = false
	reset_ammo()


func is_ammo_full() -> bool:
	return magazine >= data.magazine_size and reserve >= data.reserve_ammo


## Avança cadência, coice, giro do cano e recarga.
func tick(delta: float) -> void:
	_cooldown = maxf(0.0, _cooldown - delta)
	_recoil = maxf(0.0, _recoil - delta * 8.0)
	_spin = minf(data.spin_up_time, _spin + delta) if _trigger_held else 0.0
	_trigger_held = false
	if reloading:
		_reload_left -= delta
		if _reload_left <= 0.0:
			_finish_reload()


## Gatilho seguro neste frame (a minigun precisa girar antes de atirar).
func hold_trigger() -> void:
	_trigger_held = true


func is_spun_up() -> bool:
	return _spin >= data.spin_up_time


func can_fire() -> bool:
	return not busy and not reloading and _cooldown <= 0.0 and magazine > 0 and is_spun_up()


## Gasta uma bala se puder atirar. Pente vazio começa a recarga sozinho.
func consume_shot() -> bool:
	hold_trigger()
	if not can_fire():
		if magazine == 0 and not busy:
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
	if reloading or busy or magazine >= data.magazine_size or reserve <= 0:
		return false
	reloading = true
	_reload_left = data.reload_time * reload_multiplier
	_emit_ammo()
	return true


## Cancela a recarga (ao guardar a arma).
func cancel_reload() -> void:
	if reloading:
		reloading = false
		_reload_left = 0.0
		_emit_ammo()


## Atira de `origin` em direção a `target`: gasta a bala e dispara `pellets` raios (com
## spread e coice), cada um atravessando até `pierce` zumbis extras. Devolve os acertos.
func shoot(space: PhysicsDirectSpaceState3D, origin: Vector3, target: Vector3, exclude: Array[RID], shooter: Node) -> Array[DamageInfo]:
	var hits: Array[DamageInfo] = []
	if not consume_shot():
		return hits
	var aim := (target - origin).normalized()
	if aim.is_zero_approx():
		aim = -global_basis.z
	var deviation := data.spread_degrees + _recoil
	if data.special_type != &"":
		# Granada, plasma, chama, raio, vento (special_fire.gd).
		var special_dir := aim.rotated(Vector3.UP, deg_to_rad(randf_range(-deviation, deviation))) if data.special_type != &"flame" else aim
		return SpecialFire.fire(self, space, origin, special_dir, exclude, shooter)
	for pellet in maxi(1, data.pellets):
		var direction := aim.rotated(Vector3.UP, deg_to_rad(randf_range(-deviation, deviation)))
		hits.append_array(trace(space, origin, direction, exclude, shooter))
	_recoil = minf(_recoil + data.recoil_degrees, 10.0)
	return hits


## Um projétil instantâneo: segue até a parede, o alcance ou acertar `1 + pierce` alvos diferentes.
func trace(space: PhysicsDirectSpaceState3D, origin: Vector3, direction: Vector3, exclude: Array[RID], shooter: Node, color: Color = Color(0, 0, 0, 0)) -> Array[DamageInfo]:
	var hits: Array[DamageInfo] = []
	var skip: Array[RID] = exclude.duplicate()
	var struck: Array[HealthComponent] = []
	var from := origin
	var end := origin + direction * data.max_range
	for i in MAX_HITS_PER_PELLET:
		var query := PhysicsRayQueryParameters3D.create(from, end, PhysicsLayers.SHOT_MASK, skip)
		query.collide_with_areas = true
		var hit := space.intersect_ray(query)
		if hit.is_empty():
			break
		var hurtbox := hit.collider as Hurtbox
		if hurtbox == null:
			end = hit.position  # parede
			break
		skip.append(hurtbox.get_rid())
		# Corpo e cabeça do mesmo zumbi contam como um alvo só.
		if hurtbox.health in struck:
			continue
		struck.append(hurtbox.health)
		hits.append(hurtbox.receive_hit(data.damage * damage_multiplier, data.headshot_multiplier + headshot_bonus, DamageInfo.Kind.WEAPON, shooter, hit.position))
		if struck.size() > data.pierce:
			end = hit.position
			break
	spawn_tracer(origin, end, color if color.a > 0.0 else data.tracer_color)
	return hits


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
func spawn_tracer(from: Vector3, to: Vector3, color: Color) -> void:
	if not is_inside_tree() or from.distance_to(to) < 0.1:
		return
	var key := color.to_html()
	if not _tracer_materials.has(key):
		var material := StandardMaterial3D.new()
		material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		material.albedo_color = color
		_tracer_materials[key] = material
	var mesh := BoxMesh.new()
	mesh.size = Vector3(0.03, 0.03, from.distance_to(to))
	var tracer := MeshInstance3D.new()
	tracer.mesh = mesh
	tracer.material_override = _tracer_materials[key]
	tracer.top_level = true
	add_child(tracer)
	tracer.global_position = (from + to) * 0.5
	tracer.look_at(to, Vector3.UP if absf((to - from).normalized().y) < 0.99 else Vector3.RIGHT)
	get_tree().create_timer(0.06).timeout.connect(tracer.queue_free)
