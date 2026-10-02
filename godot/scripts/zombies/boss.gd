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
var _retarget_left := 0.0
## Partida em rede, num colega: só segue o host (posição, modo e ataques), sem IA nem dano.
var puppet := false
var _net_target := Vector3.ZERO
var _net_velocity := Vector3.ZERO
var _net_yaw := 0.0
var _net_has_target := false
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
## Hesitação (raio, plasma, headshot): boss grande demais pra ser empurrado, mas ainda sente o
## golpe — trava a ação por um instante em vez de simplesmente ignorar.
var _hesitate_left := 0.0
const HEADSHOT_HESITATE := 0.16
## Fúria (Minotauro): buff temporário de dano/velocidade ao quebrar um pilar com a investida.
var _fury_until := 0.0
var _fury_tinted := false
var _body_material: StandardMaterial3D
var _body_color := Color(0.3, 0.26, 0.22)
## Sprite em pixel art (null = formas simples da cena) e a ação em andamento (animação).
var model: CharacterSprite
var _action_id: StringName = &""
## Animação de cada ação.
const ACTION_ANIMS := {&"shockwave": &"Slam", &"scream": &"Roar", &"summon": &"Roar", &"vomit": &"Attack", &"volley": &"Attack", &"breath": &"Attack", &"rupture": &"Charge"}

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


## Fúria ativa agora (Minotauro, após quebrar um pilar na investida)?
func _fury_active() -> bool:
	return _clock < _fury_until


## Dano com o bônus da Fúria aplicado, se estiver ativa.
func _fury_damage(base: float) -> float:
	return base * float(data.fury.get("damage_mult", 1.3)) if _fury_active() else base


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


## Grande demais para ser derrubado ou atordoado de verdade (raio, plasma): mas trava a ação
## por uma hesitação breve, com o mesmo pisca do flinch dos zumbis comuns.
func stun(seconds: float) -> void:
	if not is_alive() or mode in [Mode.ROAR, Mode.CHARGING, Mode.STUNNED, Mode.DEAD]:
		return
	_hesitate_left = maxf(_hesitate_left, seconds)
	if model:
		model.flash(Color(1.0, 0.92, 0.9))


## Sem empurrão de posição (grande demais pra isso fazer sentido), mas ainda pisca ao ser
## atingido — hoje reviver empurrado e rajada de vento passavam batido nele.
func apply_knockback(_push: Vector3) -> void:
	if not is_alive() or mode == Mode.DEAD:
		return
	if model:
		model.flash(Color(1.0, 0.92, 0.9))


func _physics_process(delta: float) -> void:
	_clock += delta
	if mode == Mode.DEAD:
		return
	if puppet:
		_follow_net(delta)
		return
	apply_gravity(delta)
	if _fury_tinted and not _fury_active():
		_fury_tinted = false
		if model:
			model.tint(Color.WHITE)
	if _hesitate_left > 0.0 and mode not in [Mode.ROAR, Mode.CHARGING, Mode.STUNNED]:
		_hesitate_left -= delta
		_stop()
		move_and_slide()
		return
	# Cooperativo: entre um ataque e outro, persegue o jogador de pé mais perto.
	if mode in [Mode.CHASE, Mode.ROAR, Mode.STUNNED]:
		_update_target(delta)
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
					target.take_damage(DamageInfo.new(_fury_damage(float(data.melee.get("damage", 35))), DamageInfo.Kind.ZOMBIE, self, false, global_position))
					if not data.infect.is_empty() and target.has_method(&"infect"):
						target.call(&"infect", float(data.infect.get("dps", 9.0)), float(data.infect.get("duration", 4.5)))
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


## Mesma regra dos zumbis (ZombieBase._update_target): o mais perto de pé, a cada 0,5 s.
func _update_target(delta: float) -> void:
	if target != null and not is_instance_valid(target):
		target = null
	if not Players.coop():
		return
	_retarget_left -= delta
	if target is Player and not (target as Player).is_standing():
		_retarget_left = minf(_retarget_left, 0.1)
	if _retarget_left > 0.0:
		return
	_retarget_left = ZombieBase.RETARGET_TIME
	var nearest := Players.nearest(global_position)
	if nearest:
		target = nearest


func _charging(distance: float) -> void:
	var speed := float(data.charge.get("speed", 14.0))
	velocity.x = _charge_dir.x * speed
	velocity.z = _charge_dir.z * speed
	if not _charge_hit and target.is_alive() and distance <= data.body_radius + 0.6:
		_charge_hit = true
		target.take_damage(DamageInfo.new(_fury_damage(float(data.charge.get("damage", 45))), DamageInfo.Kind.ZOMBIE, self, false, global_position))
	move_and_slide()
	# Bateu na parede: fica atordoado (janela para o jogador atacar).
	for i in get_slide_collision_count():
		var collider := get_slide_collision(i).get_collider()
		# Minotauro na Fúria (fase 2+): atravessa as colunas da praça, que desabam, e ganha um
		# bônus temporário de dano/velocidade por ter quebrado uma.
		if collider is BreakablePillar and bool(data.extras.get("breaks_pillars", false)) and phase >= 2:
			(collider as BreakablePillar).collapse()
			if not data.fury.is_empty():
				_fury_until = _clock + float(data.fury.get("duration", 4.0))
				_fury_tinted = true
				if model:
					model.tint(Color(1.0, 0.55, 0.35))
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
	if _fury_active():
		speed *= float(data.fury.get("speed_mult", 1.25))
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
	if _can(data.blind, &"blind") and distance <= float(data.blind.get("range", 7.0)) and distance > float(data.melee.get("range", 2.0)) and _line_of_sight():
		_face(to_target)
		_start_action(float(data.blind.get("windup_time", 0.4)) + 0.3, float(data.blind.cooldown_time), &"blind")
		_pending_at = _clock + float(data.blind.get("windup_time", 0.4))
		_pending_action = &"blind"
		return true
	if _can(data.breath, &"breath") and distance <= float(data.breath.get("range", 7.0)) and _line_of_sight():
		_face(to_target)
		_start_action(float(data.breath.get("windup_time", 0.4)) + 0.3, float(data.breath.cooldown_time), &"breath")
		_pending_at = _clock + float(data.breath.get("windup_time", 0.4))
		_pending_action = &"breath"
		return true
	if _can(data.rupture, &"rupture") and distance <= float(data.rupture.get("range", 14.0)) and distance > float(data.melee.get("range", 2.0)):
		_start_action(float(data.rupture.get("windup_time", 0.35)) + 0.35, float(data.rupture.cooldown_time), &"rupture")
		_pending_at = _clock + float(data.rupture.get("windup_time", 0.35))
		_pending_action = &"rupture"
		return true
	if _can(data.area, &"area"):
		_start_action(0.65, float(data.area.cooldown_time), &"area")
		# Minotauro (Colapso): as pedras que caem ficam como escombro por alguns segundos.
		var area_cfg := data.area
		if data.extras.has("rubble_time"):
			area_cfg = data.area.duplicate()
			area_cfg["rubble_time"] = data.extras.rubble_time
		var points := BossAttacks.area_points(target.global_position, area_cfg)
		_fx(&"area", [points])
		BossAttacks.area_at(get_tree(), points, area_cfg, data.area_acid, target, bool(data.extras.get("fire_pools", false)))
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
const ACTION_SOUNDS := {&"scream": "boss_roar", &"shockwave": "boss_slam", &"summon": "boss_summon", &"vomit": "boss_area", &"blind": "boss_stun", &"breath": "boss_area", &"rupture": "boss_charge"}


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
			var points := BossAttacks.vomit_points(global_position, -pivot.global_basis.z, data.vomit)
			_fx(&"vomit", [points])
			BossAttacks.vomit_at(get_tree(), points, data.vomit, bool(data.extras.get("fire_pools", false)))
		&"volley":
			var toward := target.global_position - global_position
			_fx(&"volley", [global_position + Vector3.UP * 1.4, toward])
			BossAttacks.volley(get_tree(), global_position + Vector3.UP * 1.4, toward, data.volley, target, self)
		&"shockwave":
			_fx(&"shockwave", [global_position])
			BossAttacks.shockwave(get_tree(), global_position, data.shockwave, target)
		&"blind":
			_fx(&"blind", [global_position])
			BossAttacks.blind(get_tree(), global_position, data.blind, target)
		&"breath":
			_fx(&"breath", [global_position, -pivot.global_basis.z])
			BossAttacks.triple_breath(get_tree(), global_position, -pivot.global_basis.z, data.breath, target)
		&"rupture":
			_rupture()
	_pending_action = &""


## Ruptura (Entidade, fase 3): some e reaparece perto do jogador com um golpe.
func _rupture() -> void:
	var cfg: Dictionary = data.rupture
	var reach := float(cfg.get("teleport_range", 1.6))
	var world3d := get_world_3d()
	var landing := global_position
	for i in 6:
		var angle := randf() * TAU
		var candidate := target.global_position + Vector3(cos(angle), 0.0, sin(angle)) * reach
		if SpawnManager.is_free(world3d, candidate, data.body_radius):
			landing = candidate
			break
	SpecialFire.flash(get_tree(), global_position, 2.2, Color(0.7, 0.35, 1.0))
	if Net.world and Net.is_host():
		Net.world.on_flash(global_position, 2.2, Color(0.7, 0.35, 1.0))
		Net.world.on_flash(landing, 2.2, Color(0.7, 0.35, 1.0))
	global_position = landing
	SpecialFire.flash(get_tree(), global_position, 2.2, Color(0.7, 0.35, 1.0))
	_face(target.global_position - global_position)
	if target.is_alive() and global_position.distance_to(target.global_position) <= reach + 0.6:
		target.take_damage(DamageInfo.new(float(cfg.get("damage", 55)), DamageInfo.Kind.ZOMBIE, self, false, global_position))


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
	HitFeedback.report(self, info, current)
	if info.kind in [DamageInfo.Kind.WEAPON, DamageInfo.Kind.MELEE]:
		_feel_hit(info)
	if info.is_headshot and is_alive() and mode not in [Mode.ROAR, Mode.CHARGING, Mode.STUNNED, Mode.DEAD]:
		_hesitate_left = maxf(_hesitate_left, HEADSHOT_HESITATE)
		if model:
			model.flash(Color(1.0, 0.75, 0.7), 0.12)
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
	var middle := global_position + _charge_dir * length * 0.5
	# Sempre acima do piso visual (o corpo do chefe pode estar alguns centímetros acima do chão).
	_telegraph.global_position = Vector3(middle.x, PixelShapes.GROUND_Y, middle.z)
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
	# Fantoche (rede): o aviso do chefe derrotado já vem do host.
	if not puppet:
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


# ───────────────────────── Rede ─────────────────────────

## Ordem dos modos na rede (o snapshot leva o índice).
const NET_ACTIONS: Array[StringName] = [&"", &"shockwave", &"scream", &"summon", &"vomit", &"volley", &"breath", &"rupture", &"blind", &"area"]


## Host: o ataque com os parâmetros exatos (pontos sorteados) para os colegas verem igual.
func _fx(kind: StringName, args: Array) -> void:
	if Net.world and Net.is_host():
		Net.world.on_boss_fx(self, kind, args)


## Vira fantoche (antes de entrar na árvore): sem IA, colisão nem dano.
func make_puppet() -> void:
	puppet = true
	collision_layer = 0
	collision_mask = 0


## Estado mandado pelo host: posição, velocidade, direção, modo e a ação em andamento.
func net_state(at: Vector3, moving: Vector3, yaw: float, new_mode: int, action: int, new_phase := 1, fury := false) -> void:
	if not _net_has_target:
		global_position = at
	_net_target = at
	_net_velocity = moving
	_net_yaw = yaw
	_net_has_target = true
	# Troca de fase (forma nova da Entidade) e a Fúria do Minotauro, como no host.
	if new_phase > phase:
		phase = new_phase
		var sheet := String(data.extras.get("phase_sheets", {}).get(str(phase), ""))
		if sheet != "" and model and CharacterSprite.exists(sheet):
			model.set_sheet(sheet)
			SpecialFire.flash(get_tree(), global_position + Vector3.UP * 1.5, 5.0, Color(0.7, 0.35, 1.0))
	if fury != _fury_tinted and model:
		_fury_tinted = fury
		model.tint(Color(1.0, 0.55, 0.35) if fury else Color.WHITE)
	var action_id: StringName = NET_ACTIONS[action] if action >= 0 and action < NET_ACTIONS.size() else &""
	if new_mode == mode and action_id == _action_id:
		return
	var old := mode
	mode = new_mode as Mode
	_action_id = action_id
	health.invulnerable = true
	match mode:
		Mode.ROAR:
			if old != Mode.ROAR:
				Audio.play_at("boss_roar", global_position, "world", 1.0, 80.0)
		Mode.ACTION:
			if model:
				model.play_once(ACTION_ANIMS.get(_action_id, &"Roar"), 0.1)
			if ACTION_SOUNDS.has(_action_id):
				Audio.play_at(ACTION_SOUNDS[_action_id], global_position, "world", 1.0, 60.0)
		Mode.CHARGE_WINDUP:
			_charge_dir = Vector3(-sin(yaw), 0.0, -cos(yaw))
			Audio.play_at("boss_charge", global_position, "world", 1.0, 60.0)
			_show_telegraph()
	if mode != Mode.CHARGE_WINDUP:
		_clear_telegraph()


func _follow_net(delta: float) -> void:
	if not _net_has_target:
		return
	_net_target += _net_velocity * delta
	global_position = global_position.lerp(_net_target, clampf(12.0 * delta, 0.0, 1.0))
	velocity = _net_velocity
	pivot.rotation.y = lerp_angle(pivot.rotation.y, _net_yaw, clampf(14.0 * delta, 0.0, 1.0))


## Índice da ação em andamento (snapshot).
func net_action() -> int:
	return maxi(0, NET_ACTIONS.find(_action_id))


## Ataque visto no host: o mesmo visual aqui (o dano é do host; nos colegas ele não pega).
func net_fx(kind: StringName, args: Array) -> void:
	var tree := get_tree()
	var fire := bool(data.extras.get("fire_pools", false))
	match kind:
		&"area":
			var points: Array[Vector3] = []
			points.assign(args[0])
			var area_cfg := data.area
			if data.extras.has("rubble_time"):
				area_cfg = data.area.duplicate()
				area_cfg["rubble_time"] = data.extras.rubble_time
			BossAttacks.area_at(tree, points, area_cfg, data.area_acid, null, fire)
		&"vomit":
			var points: Array[Vector3] = []
			points.assign(args[0])
			BossAttacks.vomit_at(tree, points, data.vomit, fire)
		&"volley":
			BossAttacks.volley(tree, args[0], args[1], data.volley, null, self)
		&"shockwave":
			BossAttacks.shockwave(tree, args[0], data.shockwave, null)
		&"blind":
			BossAttacks.blind(tree, args[0], data.blind, null)
		&"breath":
			BossAttacks.triple_breath(tree, args[0], args[1], data.breath, null)


## Acerto avisado pelo host: só o pisca.
func net_hit(at: Vector3, headshot: bool, kind: int, amount: float = 0.0) -> void:
	if model and is_alive() and kind in [DamageInfo.Kind.WEAPON, DamageInfo.Kind.MELEE]:
		_feel_hit(DamageInfo.new(amount, kind as DamageInfo.Kind, null, headshot, at))


## O corpo sente o tiro (sem sair do lugar: grande demais para ser empurrado): pisca e dá um
## solavanco menor que o dos zumbis comuns, mais forte quanto maior o dano do quadro.
var _feel_frame := -1
var _feel_damage := 0.0


func _feel_hit(info: DamageInfo) -> void:
	if model == null or not is_alive():
		return
	var frame := Engine.get_physics_frames()
	if frame != _feel_frame:
		_feel_frame = frame
		_feel_damage = 0.0
	_feel_damage += info.amount
	var factor := ZombieBase.flinch_factor(_feel_damage, info.is_headshot)
	var push := Vector3.ZERO
	var source := info.source as Node3D
	if source and is_instance_valid(source):
		push = global_position - source.global_position
	elif info.hit_position != Vector3.ZERO:
		push = global_position - info.hit_position
	model.flash(Color(1.0, 0.75, 0.7) if info.is_headshot else ZombieBase.HIT_FLASH, 0.06)
	HitFeedback.jolt(model, push, ZombieBase.JOLT_DISTANCE * factor * 0.4, ZombieBase.JOLT_SQUASH * minf(factor, 1.8) * 0.4)


## Morte avisada pelo host: o mesmo fim do solo, direto (sem passar pelo dano, que trocaria de
## fase e rugiria aqui), e sem repetir o aviso, que já veio do host.
func net_die(headshot: bool, kind: int, at: Vector3) -> void:
	if mode == Mode.DEAD:
		return
	health.current = 0.0
	health.is_dead = true
	_on_health_died(DamageInfo.new(0.0, kind as DamageInfo.Kind, null, headshot, at))
