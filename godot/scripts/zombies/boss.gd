class_name Boss
extends CharacterBase
## Boss (como no jogo web): 4 fases (75/50/25% da vida), cada troca com um rugido em que
## fica invulnerável. Persegue pela navegação e escolhe ataques pela ordem do jogo web:
## golpe, área, grito, vômito, onda de choque, invocação e investida (que o deixa atordoado
## se bater na parede). Cada ataque tem recarga, encurtada nas fases finais.

enum Mode { ROAR, CHASE, MELEE, CHARGE_WINDUP, CHARGING, STUNNED, ACTION, DEAD }

const MELEE_HIT_DELAY := 0.25
const REPATH_INTERVAL := 0.3

@export var data: BossData

var target: CharacterBase
var phase: int = 1
var mode: Mode = Mode.ROAR
## Invoca zumbis em volta: (tipos, quantidade, ponto) → quantos surgiram.
var summoner: Callable

var _health_mult := 1.0
var _clock := 0.0
var _mode_until := 0.0
var _pending_at := -1.0
var _pending_action := &""
var _ready_at: Dictionary = {}
var _repath_left := 0.0
var _charge_dir := Vector3.ZERO
var _charge_start := Vector3.ZERO
var _charge_hit := false
var _telegraph: MeshInstance3D
var _body_material: StandardMaterial3D
var _body_color := Color(0.3, 0.26, 0.22)
## Sprite em pixel art (null = formas simples da cena) e a ação em andamento (animação).
var model: CharacterSprite
var _action_id: StringName = &""
## Animação de cada ação.
const ACTION_ANIMS := {&"shockwave": &"Slam", &"scream": &"Roar", &"summon": &"Roar", &"vomit": &"Attack", &"volley": &"Attack"}

@onready var agent: NavigationAgent3D = $NavigationAgent3D
@onready var pivot: Node3D = $Pivot


func setup(p_data: BossData, p_target: CharacterBase, health_mult: float, p_summoner: Callable) -> void:
	data = p_data
	target = p_target
	_health_mult = health_mult
	summoner = p_summoner


func _ready() -> void:
	super()
	health.reset(data.max_health * _health_mult)
	add_to_group(&"zombies")
	add_to_group(&"bosses")
	health.damaged.connect(_on_damaged)
	_body_material = StandardMaterial3D.new()
	_body_material.albedo_color = Color(0.3, 0.26, 0.22)
	var body := pivot.get_node_or_null("Body") as MeshInstance3D
	if body:
		body.material_override = _body_material
	# Pixel art (npm run godot:sprites): "boss_<id>", já no tamanho do boss.
	model = CharacterSprite.create("boss_%s" % data.id)
	if model:
		for part in pivot.get_children():
			if part is MeshInstance3D:
				(part as MeshInstance3D).visible = false
		pivot.add_child(model)
		model.play(&"Roar", 0.0)
	if data.lantern:
		var lantern := OmniLight3D.new()
		lantern.light_color = Color(1.0, 0.69, 0.29)
		lantern.light_energy = 2.0
		lantern.omni_range = 5.0
		lantern.position = Vector3(0.9, 1.6, -0.3)
		pivot.add_child(lantern)
	# A investida só depois de uns segundos (como no jogo web).
	_ready_at[&"charge"] = 3.0
	_enter_roar()


## Animação conforme o modo (visual; a lógica fica no _physics_process).
func _process(_delta: float) -> void:
	if model == null:
		return
	match mode:
		Mode.ROAR:
			model.play(&"Roar", 0.2)
		Mode.MELEE:
			model.play(&"Attack", 0.1)
		Mode.CHARGE_WINDUP:
			model.play(&"Charge", 0.2, 0.35)
		Mode.CHARGING:
			model.play(&"Charge", 0.1, 1.6)
		Mode.STUNNED:
			model.play(&"Idle", 0.2)
		Mode.ACTION:
			model.play(ACTION_ANIMS.get(_action_id, &"Roar"), 0.15)
		Mode.DEAD:
			pass
		_:
			var speed := Vector2(velocity.x, velocity.z).length()
			model.play(&"Walk" if speed > 0.3 else &"Idle", 0.2, clampf(speed / 1.8, 0.6, 1.6))


func is_invulnerable() -> bool:
	return mode == Mode.ROAR


## Fogo, atordoamento e empurrão das armas: o boss só queima (não para nem sai do lugar).
func apply_burn(dps: float, seconds: float, source: Node) -> void:
	if not is_alive():
		return
	var tween := create_tween()
	var ticks := int(seconds / 0.25)
	for i in ticks:
		tween.tween_interval(0.25)
		tween.tween_callback(func() -> void:
			if is_alive():
				take_damage(DamageInfo.new(dps * 0.25, DamageInfo.Kind.BURN, source, false, global_position)))


func stun(_seconds: float) -> void:
	pass


func apply_knockback(_push: Vector3) -> void:
	pass


func _physics_process(delta: float) -> void:
	_clock += delta
	if mode == Mode.DEAD:
		return
	apply_gravity(delta)
	var to_target := target.global_position - global_position if target else Vector3.ZERO
	to_target.y = 0.0
	var distance := to_target.length()
	match mode:
		Mode.ROAR, Mode.ACTION:
			_stop()
			_resolve_pending()
			if _clock >= _mode_until:
				_to_chase()
		Mode.MELEE:
			_stop()
			_face(to_target)
			if _pending_at >= 0.0 and _clock >= _pending_at:
				_pending_at = -1.0
				if target.is_alive() and distance <= float(data.melee.get("range", 2.0)) + 0.45:
					target.take_damage(DamageInfo.new(float(data.melee.get("damage", 35)), DamageInfo.Kind.ZOMBIE, self, false, global_position))
			if _clock >= _mode_until:
				_to_chase()
		Mode.CHARGE_WINDUP:
			_stop()
			if _clock >= _mode_until:
				_clear_telegraph()
				mode = Mode.CHARGING
				_charge_hit = false
				_charge_start = global_position
		Mode.CHARGING:
			_charging(distance)
			return
		Mode.STUNNED:
			_stop()
			if _clock >= _mode_until:
				_body_material.albedo_color = _body_color
				if model:
					model.tint(Color.WHITE)
				_to_chase()
		Mode.CHASE:
			if target == null or not target.is_alive():
				_stop()
			elif not _try_attack(distance, to_target):
				_chase(delta, to_target)
	move_and_slide()


func _charging(distance: float) -> void:
	var speed := float(data.charge.get("speed", 14.0))
	velocity.x = _charge_dir.x * speed
	velocity.z = _charge_dir.z * speed
	if not _charge_hit and target.is_alive() and distance <= data.body_radius + 0.6:
		_charge_hit = true
		target.take_damage(DamageInfo.new(float(data.charge.get("damage", 45)), DamageInfo.Kind.ZOMBIE, self, false, global_position))
	move_and_slide()
	# Bateu na parede: fica atordoado (janela para o jogador atacar).
	for i in get_slide_collision_count():
		var collider := get_slide_collision(i).get_collider()
		# Minotauro na Fúria (fase 2+): atravessa as colunas da praça, que desabam.
		if collider is BreakablePillar and bool(data.extras.get("breaks_pillars", false)) and phase >= 2:
			(collider as BreakablePillar).collapse()
			continue
		if collider is StaticBody3D and absf(get_slide_collision(i).get_normal().y) < 0.5:
			mode = Mode.STUNNED
			_mode_until = _clock + float(data.charge.get("stun_time", 1.2))
			_body_material.albedo_color = Color(0.55, 0.55, 0.55)
			if model:
				model.tint(Color(0.6, 0.6, 0.65))
			_stop()
			return
	if global_position.distance_to(_charge_start) >= float(data.charge.get("max_distance", 20.0)):
		_to_chase()
		# Cérbero: a cabeça da mordida ataca logo depois da investida.
		if bool(data.extras.get("combo_bite", false)):
			_ready_at[&"melee"] = _clock


func _chase(delta: float, to_target: Vector3) -> void:
	_repath_left -= delta
	if _repath_left <= 0.0:
		_repath_left = REPATH_INTERVAL
		agent.target_position = target.global_position
	var direction := agent.get_next_path_position() - global_position
	direction.y = 0.0
	if direction.length() < 0.05:
		direction = to_target
	direction = direction.normalized()
	var speed := data.move_speed * data.phase_speed[phase - 1]
	velocity.x = direction.x * speed
	velocity.z = direction.z * speed
	_face(direction)
	# Arrebenta a janela inteira de uma vez.
	for node in get_tree().get_nodes_in_group(&"barricades"):
		var barricade := node as Barricade
		if barricade and barricade.is_intact() and barricade.global_position.distance_to(global_position) <= 2.2:
			barricade.take_hit(99)


func _try_attack(distance: float, to_target: Vector3) -> bool:
	if not data.melee.is_empty() and distance <= float(data.melee.range) and _is_ready(&"melee"):
		mode = Mode.MELEE
		_mode_until = _clock + 0.52
		_pending_at = _clock + MELEE_HIT_DELAY
		_cooldown(&"melee", float(data.melee.cooldown_time))
		return true
	if _can(data.area, &"area"):
		_start_action(0.65, float(data.area.cooldown_time), &"area")
		# Minotauro (Colapso): as pedras que caem ficam como escombro por alguns segundos.
		var area_cfg := data.area
		if data.extras.has("rubble_time"):
			area_cfg = data.area.duplicate()
			area_cfg["rubble_time"] = data.extras.rubble_time
		BossAttacks.area(get_tree(), target.global_position, area_cfg, data.area_acid, target, bool(data.extras.get("fire_pools", false)))
		return true
	if _can(data.scream, &"scream") and distance <= float(data.scream.radius):
		_start_action(1.0, float(data.scream.cooldown_time), &"scream")
		BossAttacks.scream(global_position, data.scream, target)
		_summon(data.scream.get("types", []), int(data.scream.get("summon_count", 0)))
		return true
	if _can(data.vomit, &"vomit") and distance <= float(data.vomit.range) and _line_of_sight():
		_face(to_target)
		_start_action(float(data.vomit.windup_time) + 0.3, float(data.vomit.cooldown_time), &"vomit")
		_pending_at = _clock + float(data.vomit.windup_time)
		_pending_action = &"vomit"
		return true
	if _can(data.shockwave, &"shockwave") and distance <= float(data.shockwave.radius) * 0.8:
		_start_action(float(data.shockwave.windup_time) + 0.38, float(data.shockwave.cooldown_time), &"shockwave")
		_pending_at = _clock + float(data.shockwave.windup_time)
		_pending_action = &"shockwave"
		return true
	if _can(data.volley, &"volley") and distance <= float(data.volley.get("range", 16.0)) and _line_of_sight():
		_face(to_target)
		_start_action(float(data.volley.get("windup_time", 0.5)) + 0.3, float(data.volley.cooldown_time), &"volley")
		_pending_at = _clock + float(data.volley.get("windup_time", 0.5))
		_pending_action = &"volley"
		return true
	if _can(data.summon, &"summon"):
		_start_action(0.9, float(data.summon.cooldown_time), &"summon")
		_summon(data.summon.get("types", []), int(data.summon.get("count", 0)))
		return true
	if not data.charge.is_empty() and phase >= int(data.extras.get("charge_from_phase", 1)) \
			and distance >= float(data.charge.min_range) and distance <= float(data.charge.max_range) \
			and _is_ready(&"charge") and _line_of_sight():
		mode = Mode.CHARGE_WINDUP
		_mode_until = _clock + float(data.charge.windup_time)
		_charge_dir = to_target.normalized()
		_face(_charge_dir)
		_cooldown(&"charge", float(data.charge.cooldown_time))
		Audio.play_at("boss_charge", global_position, "world", 1.0, 60.0)
		_show_telegraph()
		return true
	return false


func _can(attack: Dictionary, id: StringName) -> bool:
	return not attack.is_empty() and phase >= int(attack.get("from_phase", 1)) and _is_ready(id)


## Som de cada ação do boss (como no jogo web).
const ACTION_SOUNDS := {&"scream": "boss_roar", &"shockwave": "boss_slam", &"summon": "boss_summon", &"vomit": "boss_area"}


func _start_action(duration: float, cooldown: float, id: StringName) -> void:
	_action_id = id
	if model:
		model.play_once(ACTION_ANIMS.get(id, &"Roar"), 0.1)
	if ACTION_SOUNDS.has(id):
		Audio.play_at(ACTION_SOUNDS[id], global_position, "world", 1.0, 60.0)
	mode = Mode.ACTION
	_mode_until = _clock + duration
	_cooldown(id, cooldown)


func _resolve_pending() -> void:
	if _pending_at < 0.0 or _clock < _pending_at:
		return
	_pending_at = -1.0
	match _pending_action:
		&"vomit":
			BossAttacks.vomit(get_tree(), global_position, -pivot.global_basis.z, data.vomit, bool(data.extras.get("fire_pools", false)))
		&"volley":
			BossAttacks.volley(get_tree(), global_position + Vector3.UP * 1.4, (target.global_position - global_position), data.volley, target, self)
		&"shockwave":
			BossAttacks.shockwave(get_tree(), global_position, data.shockwave, target)
	_pending_action = &""


func _summon(types: Array, count: int) -> void:
	if count > 0 and summoner.is_valid() and not types.is_empty():
		summoner.call(types, count, global_position)


func _is_ready(id: StringName) -> bool:
	return _clock >= float(_ready_at.get(id, 0.0))


func _cooldown(id: StringName, base: float) -> void:
	_ready_at[id] = _clock + base * data.phase_cooldown[phase - 1]


func _line_of_sight() -> bool:
	var query := PhysicsRayQueryParameters3D.create(global_position + Vector3.UP * 1.5, target.global_position + Vector3.UP * 1.2, PhysicsLayers.WORLD)
	return get_world_3d().direct_space_state.intersect_ray(query).is_empty()


func _on_damaged(info: DamageInfo, current: float) -> void:
	Events.zombie_hit.emit(self, info)
	var ratio := current / health.max_health
	var new_phase := 1
	for threshold in data.phase_thresholds:
		if ratio <= threshold:
			new_phase += 1
	if new_phase > phase and is_alive():
		phase = new_phase
		# Troca de forma (Entidade do Submundo, fase 3).
		var sheet := String(data.extras.get("phase_sheets", {}).get(str(phase), ""))
		if sheet != "" and model and CharacterSprite.exists(sheet):
			model.set_sheet(sheet)
			SpecialFire.flash(get_tree(), global_position + Vector3.UP * 1.5, 5.0, Color(0.7, 0.35, 1.0))
			Events.screen_shake.emit(0.8, 0.2)
		_clear_telegraph()
		_enter_roar()
		Events.boss_phase.emit(data.display_name, phase)
	Events.boss_state.emit(data.display_name, current, health.max_health, phase)


func _enter_roar() -> void:
	Audio.play_at("boss_roar", global_position, "world", 1.0, 80.0)
	mode = Mode.ROAR
	_mode_until = _clock + data.roar_time
	health.invulnerable = true


func _to_chase() -> void:
	mode = Mode.CHASE
	health.invulnerable = false


func _stop() -> void:
	velocity.x = 0.0
	velocity.z = 0.0


func _face(direction: Vector3) -> void:
	if Vector2(direction.x, direction.z).length() > 0.01:
		pivot.rotation.y = atan2(-direction.x, -direction.z)


## Faixa vermelha no chão mostrando a direção da investida.
func _show_telegraph() -> void:
	_clear_telegraph()
	var length := float(data.charge.get("max_distance", 20.0))
	var mesh := BoxMesh.new()
	mesh.size = Vector3(data.body_radius * 2.0, 0.03, length)
	var material := StandardMaterial3D.new()
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	material.albedo_color = Color(0.9, 0.15, 0.1, 0.35)
	mesh.material = material
	_telegraph = MeshInstance3D.new()
	_telegraph.mesh = mesh
	_telegraph.top_level = true
	add_child(_telegraph)
	_telegraph.global_position = global_position + _charge_dir * length * 0.5 + Vector3.UP * 0.05
	_telegraph.rotation.y = atan2(-_charge_dir.x, -_charge_dir.z)


func _clear_telegraph() -> void:
	if is_instance_valid(_telegraph):
		_telegraph.queue_free()
	_telegraph = null


func _on_health_died(info: DamageInfo) -> void:
	mode = Mode.DEAD
	_clear_telegraph()
	remove_from_group(&"zombies")
	remove_from_group(&"bosses")
	super(info)
	collision_layer = 0
	collision_mask = PhysicsLayers.WORLD
	for child in get_children():
		if child is Hurtbox:
			(child as Hurtbox).disable()
	SpecialFire.flash(get_tree(), global_position, 4.0, Color(1.0, 0.85, 0.7))
	Events.boss_defeated.emit(data.id, data.display_name, data.reward, global_position)
	if data.extras.has("lore"):
		Events.toast.emit(String(data.extras.lore))
	var tween := create_tween()
	if model and model.has_animation(&"Death"):
		model.play_once(&"Death", 0.05, 0.6)
		tween.tween_interval(0.6)
	else:
		tween.tween_property(pivot, "rotation:x", deg_to_rad(-85.0), 0.6)
	tween.tween_interval(8.0)
	tween.tween_property(pivot, "position:y", -2.5, 2.0)
	tween.tween_callback(queue_free)
