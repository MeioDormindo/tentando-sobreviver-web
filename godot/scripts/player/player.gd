class_name Player
extends CharacterBase
## Jogador (seção 20): anda no plano, mira (mouse pelo raio da câmera, ou analógico direito),
## atira e recarrega. Lê só ações do InputMap. Bots e testes desligam `controlled` e usam
## `move_input`, `aim_point` e `fire()`.

@export var move_speed: float = 5.2
@export var acceleration: float = 40.0
## Câmera usada para converter o mouse em ponto de mira.
@export var camera: Camera3D
## Altura do cano (m): o plano de mira quando o mouse não está sobre um zumbi.
@export var muzzle_height: float = 1.2
## Distância da mira com o analógico (m).
@export var stick_aim_distance: float = 8.0

## false = controlado por código (bot/teste).
var controlled: bool = true
var move_input: Vector2 = Vector2.ZERO
var aim_point: Vector3 = Vector3.ZERO

@onready var pivot: Node3D = $Pivot
@onready var weapon: Weapon = $Pivot/Weapon
@onready var muzzle: Marker3D = $Pivot/Weapon/Muzzle


func _ready() -> void:
	super()
	health.health_changed.connect(func(current: float, maximum: float) -> void: Events.player_health_changed.emit(current, maximum))
	weapon.ammo_changed.connect(_on_ammo_changed)
	aim_point = global_position - global_basis.z * 3.0
	# Depois que a cena inteira estiver pronta (a HUD fica pronta por último).
	call_deferred(&"_emit_initial_state")


func _emit_initial_state() -> void:
	Events.player_health_changed.emit(health.current, health.max_health)
	_on_ammo_changed(weapon.magazine, weapon.reserve, weapon.reloading)


func _physics_process(delta: float) -> void:
	if not is_alive():
		velocity = Vector3.ZERO
		return
	if controlled:
		move_input = Input.get_vector(&"move_left", &"move_right", &"move_up", &"move_down")
		_update_aim_from_input()
		if (weapon.data.automatic and Input.is_action_pressed(&"fire")) or Input.is_action_just_pressed(&"fire"):
			fire()
		if Input.is_action_just_pressed(&"reload"):
			weapon.start_reload()
	_move(delta)
	_face_aim()


## Atira na direção da mira. Devolve o DamageInfo do acerto (ou null).
func fire() -> DamageInfo:
	if not is_alive():
		return null
	_face_aim()
	return weapon.shoot(get_world_3d().direct_space_state, muzzle.global_position, aim_point, [get_rid()], self)


func _move(delta: float) -> void:
	var target := Vector3(move_input.x, 0.0, move_input.y) * move_speed
	velocity.x = move_toward(velocity.x, target.x, acceleration * delta)
	velocity.z = move_toward(velocity.z, target.z, acceleration * delta)
	apply_gravity(delta)
	move_and_slide()


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


func _on_ammo_changed(magazine: int, reserve: int, reloading: bool) -> void:
	Events.ammo_changed.emit(weapon.data.display_name, magazine, reserve, reloading)


func _on_health_died(info: DamageInfo) -> void:
	super(info)
	# Cai de lado.
	create_tween().tween_property(pivot, "rotation:z", deg_to_rad(80.0), 0.4)
	Events.player_died.emit()
