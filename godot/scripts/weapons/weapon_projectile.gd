class_name WeaponProjectile
extends Node3D
## Projétil visível das armas especiais (granada e plasma). Anda em linha reta checando
## colisão por raio a cada passo de física.
## - granada: explode no primeiro zumbi, parede ou no fim do alcance;
## - plasma: atravessa os zumbis (fere cada um uma vez) e explode na parede ou no fim.

var _weapon_data: WeaponData
var _damage_multiplier := 1.0
var _velocity := Vector3.ZERO
var _travel_left := 0.0
var _exclude: Array[RID] = []
var _shooter: Node
var _struck: Array[HealthComponent] = []
var _is_plasma := false
var _done := false


func setup(weapon: Weapon, direction: Vector3, exclude: Array[RID], shooter: Node) -> void:
	_weapon_data = weapon.data
	_damage_multiplier = weapon.damage_multiplier
	_is_plasma = weapon.data.special_type == &"plasma"
	_velocity = Vector3(direction.x, 0.0, direction.z).normalized() * weapon.data.projectile_speed
	_travel_left = weapon.data.max_range
	_exclude = exclude.duplicate()
	_shooter = shooter
	PixelFx.attach_loop(self, "plasma" if _is_plasma else "grenade", 0.7 if _is_plasma else 0.32)
	if _is_plasma:
		var light := OmniLight3D.new()
		light.light_color = SpecialFire.PLASMA_COLOR
		light.light_energy = 2.0
		light.omni_range = 3.0
		add_child(light)


func _physics_process(delta: float) -> void:
	if _done:
		return
	var step := _velocity * delta
	var from := global_position
	var to := from + step
	var space := get_world_3d().direct_space_state
	for i in 8:
		var query := PhysicsRayQueryParameters3D.create(from, to, PhysicsLayers.SHOT_MASK, _exclude)
		query.collide_with_areas = true
		var hit := space.intersect_ray(query)
		if hit.is_empty():
			break
		var hurtbox := hit.collider as Hurtbox
		if hurtbox == null:
			_explode(hit.position)  # parede
			return
		_exclude.append(hurtbox.get_rid())
		if hurtbox.health in _struck:
			continue
		_struck.append(hurtbox.health)
		hurtbox.receive_hit(_weapon_data.damage * _damage_multiplier, _weapon_data.headshot_multiplier, DamageInfo.Kind.WEAPON, _shooter, hit.position)
		if not _is_plasma:
			_explode(hit.position)
			return
	global_position = to
	_travel_left -= step.length()
	if _travel_left <= 0.0:
		_explode(global_position)


func _explode(at: Vector3) -> void:
	_done = true
	var params := _weapon_data.special_params
	SpecialFire.blast(get_tree(), at, float(params.get("blast_radius", 0)), float(params.get("blast_damage", 0)) * _damage_multiplier,
		float(params.get("stun_time", 0)), _shooter, SpecialFire.PLASMA_COLOR if _is_plasma else SpecialFire.EXPLOSION_COLOR)
	queue_free()
