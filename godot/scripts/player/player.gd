class_name Player
extends CharacterBase
## Jogador (seção 20), com os atributos do jogo web (PlayerData): anda no plano (mais devagar
## de lado e de costas em relação à mira), mira pelo mouse ou analógico direito, atira, troca
## de arma (2 espaços), usa a faca, fica invulnerável por um instante ao levar dano e
## regenera a vida depois de um tempo sem apanhar. Lê só ações do InputMap. Bots e testes
## desligam `controlled` e usam `move_input`, `aim_point`, `fire()` e `knife()`.

@export var data: PlayerData
## Câmera usada para converter o mouse em ponto de mira.
@export var camera: Camera3D
## Altura do cano (m): o plano de mira quando o mouse não está sobre um zumbi.
@export var muzzle_height: float = 1.2
## Distância da mira com o analógico (m).
@export var stick_aim_distance: float = 8.0
@export var acceleration: float = 45.0

## false = controlado por código (bot/teste).
var controlled: bool = true
var move_input: Vector2 = Vector2.ZERO
var aim_point: Vector3 = Vector3.ZERO

## Relógio de jogo (s): para com a pausa e acompanha a velocidade do jogo.
var _clock := 0.0
var _invulnerable_until := 0.0
var _last_hurt_at := -INF
var _firing := false

@onready var pivot: Node3D = $Pivot
@onready var inventory: WeaponInventory = $Pivot/Hand
@onready var melee: Melee = $Melee
@onready var muzzle: Marker3D = $Pivot/Hand/Muzzle

## Arma em mãos.
var weapon: Weapon:
	get:
		return inventory.current


func _ready() -> void:
	super()
	health.reset(data.max_health)
	inventory.slots = data.inventory_slots
	inventory.switch_time = data.switch_time
	melee.data = data.knife
	inventory.weapon_changed.connect(_on_weapon_changed)
	inventory.give(data.starting_weapon)
	health.health_changed.connect(func(current: float, maximum: float) -> void: Events.player_health_changed.emit(current, maximum))
	aim_point = global_position - global_basis.z * 3.0
	# Depois que a cena inteira estiver pronta (a HUD fica pronta por último).
	call_deferred(&"_emit_initial_state")


func _emit_initial_state() -> void:
	Events.player_health_changed.emit(health.current, health.max_health)
	_on_weapon_changed(inventory.current, inventory.other())


func _physics_process(delta: float) -> void:
	if not is_alive():
		velocity = Vector3.ZERO
		return
	_clock += delta
	_firing = false
	if controlled:
		_read_input()
	_regenerate(delta)
	_move(delta)
	_face_aim()


## Pega uma arma (compra, Mystery Box...). Devolve a arma que saiu do inventário.
func give_weapon(weapon_data: WeaponData) -> Weapon:
	return inventory.give(weapon_data)


## Atira na direção da mira. Devolve os acertos.
func fire() -> Array[DamageInfo]:
	if not is_alive():
		return []
	_firing = true
	_face_aim()
	return weapon.shoot(get_world_3d().direct_space_state, muzzle.global_position, aim_point, [get_rid()], self)


## Golpe de faca na direção da mira.
func knife() -> bool:
	if not is_alive():
		return false
	return melee.swing(self, aim_point - global_position, weapon)


func take_damage(info: DamageInfo) -> float:
	if _clock < _invulnerable_until:
		return 0.0
	var applied := super(info)
	if applied > 0.0:
		_invulnerable_until = _clock + data.invulnerability_time
		_last_hurt_at = _clock
	return applied


func _read_input() -> void:
	move_input = Input.get_vector(&"move_left", &"move_right", &"move_up", &"move_down")
	_update_aim_from_input()
	if (weapon.data.automatic and Input.is_action_pressed(&"fire")) or Input.is_action_just_pressed(&"fire"):
		fire()
	elif Input.is_action_pressed(&"fire"):
		weapon.hold_trigger()  # minigun gira o cano enquanto o gatilho está seguro
	if Input.is_action_just_pressed(&"reload"):
		weapon.start_reload()
	if Input.is_action_just_pressed(&"melee"):
		knife()
	if Input.is_action_just_pressed(&"switch_weapon") or Input.is_action_just_pressed(&"weapon_next") or Input.is_action_just_pressed(&"weapon_prev"):
		inventory.switch_next()
	elif Input.is_action_just_pressed(&"weapon_1"):
		inventory.switch_to(0)
	elif Input.is_action_just_pressed(&"weapon_2"):
		inventory.switch_to(1)


func _move(delta: float) -> void:
	var direction := Vector3(move_input.x, 0.0, move_input.y)
	var speed := data.move_speed * _speed_factor(direction)
	var target := direction * speed
	if melee.lunge_left > 0.0:
		target = melee.lunge_velocity
		velocity.x = target.x
		velocity.z = target.z
	else:
		velocity.x = move_toward(velocity.x, target.x, acceleration * delta)
		velocity.z = move_toward(velocity.z, target.z, acceleration * delta)
	apply_gravity(delta)
	move_and_slide()


## Mais devagar andando de lado e de costas em relação à mira; e atirando com armas pesadas.
func _speed_factor(direction: Vector3) -> float:
	var factor := 1.0
	var facing := aim_point - global_position
	facing.y = 0.0
	if direction.length() > 0.01 and facing.length() > 0.05:
		var along := direction.normalized().dot(facing.normalized())
		if along < -0.3:
			factor = data.backpedal_multiplier
		elif along < 0.5:
			factor = data.strafe_multiplier
	if _firing:
		factor *= weapon.data.move_multiplier_while_firing
	return factor


func _regenerate(delta: float) -> void:
	if _clock - _last_hurt_at >= data.regen_delay and health.current < health.max_health:
		health.heal(data.regen_per_second * delta)


func _face_aim() -> void:
	var flat := aim_point - global_position
	flat.y = 0.0
	if flat.length() > 0.05:
		pivot.rotation.y = atan2(-flat.x, -flat.z)


func _update_aim_from_input() -> void:
	var stick := Input.get_vector(&"aim_left", &"aim_right", &"aim_up", &"aim_down")
	if stick.length() > 0.3:
		aim_point = global_position + Vector3(stick.x, 0.0, stick.y).normalized() * stick_aim_distance
		aim_point.y = muzzle_height
		return
	if camera == null:
		return
	var mouse := get_viewport().get_mouse_position()
	var from := camera.project_ray_origin(mouse)
	var direction := camera.project_ray_normal(mouse)
	# Mouse sobre um zumbi: mira nele (cabeça = headshot). Senão, no plano da altura do cano.
	var query := PhysicsRayQueryParameters3D.create(from, from + direction * 200.0, PhysicsLayers.HURTBOXES)
	query.collide_with_areas = true
	query.collide_with_bodies = false
	var hit := get_world_3d().direct_space_state.intersect_ray(query)
	if not hit.is_empty():
		aim_point = hit.position
		return
	var on_plane: Variant = Plane(Vector3.UP, muzzle_height).intersects_ray(from, direction)
	if on_plane != null:
		aim_point = on_plane


func _on_weapon_changed(current: Weapon, other: Weapon) -> void:
	for w in inventory.weapons:
		if w.ammo_changed.is_connected(_on_ammo_changed):
			w.ammo_changed.disconnect(_on_ammo_changed)
	current.ammo_changed.connect(_on_ammo_changed)
	Events.weapon_changed.emit(current.data.display_name, other.data.display_name if other else "")
	_on_ammo_changed(current.magazine, current.reserve, current.reloading)


func _on_ammo_changed(magazine: int, reserve: int, reloading: bool) -> void:
	Events.ammo_changed.emit(weapon.data.display_name, magazine, reserve, reloading)


func _on_health_died(info: DamageInfo) -> void:
	super(info)
	# Cai de lado.
	create_tween().tween_property(pivot, "rotation:z", deg_to_rad(80.0), 0.4)
	Events.player_died.emit()
