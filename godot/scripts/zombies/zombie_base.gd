class_name ZombieBase
extends CharacterBase
## Zumbi base (seções 13 e 19): máquina de estados simples, perseguir → atacar → morto.
## Anda pela malha de navegação (NavigationAgent3D), recalculando o caminho a cada
## `repath_interval` em vez de todo frame. Os números vêm do ZombieData × multiplicadores
## do round. Behavior Tree fica para quando o comportamento pedir (seção 11).

enum State { CHASE, ATTACK, BREAK_BARRICADE, DEAD }

## Tempo (s) até o corpo sumir depois de morrer.
const CORPSE_TIME := 1.6
## Os corpos ficam no chão por um bom tempo (o mapa vai acumulando os mortos); passando do
## limite, o mais antigo afunda.
const CORPSE_STAY := 45.0
const MAX_CORPSES := 40
static var _corpses: Array[ZombieBase] = []

@export var data: ZombieData
@export var repath_interval: float = 0.25

## Lua de Sangue: todos os zumbis mais rápidos.
static var event_speed: float = 1.0

## Quem persegue: o jogador de pé mais perto, reavaliado a cada RETARGET_TIME (e logo que o
## alvo cai ou morre). Sem ninguém de pé, fica com o último.
var target: CharacterBase
const RETARGET_TIME := 0.5
var _retarget_left := 0.0
## Destino de fuga (Zumbi Dourado): anda até lá em vez de perseguir e não ataca.
var flee_goal: Variant = null
var state: State = State.CHASE
var move_speed: float = 0.0
var attack_damage: float = 0.0

var _health_mult := 1.0
var _damage_mult := 1.0
var _speed_mult := 1.0
var _repath_left := 0.0
## Empurrão (faca, explosões) que se soma ao movimento e some rápido.
var _knockback := Vector3.ZERO
## Tranco do tiro: tempo andando mais devagar e o quadro do último recuo (não empilha chumbos).
const FLINCH_TIME := 0.12
const FLINCH_SPEED := 0.35
const FLINCH_PUSH := 1.6
## Na cabeça, o tranco é mais forte (reação maior, mais visível).
const HEADSHOT_FLINCH_TIME := 0.22
const HEADSHOT_FLINCH_PUSH := 2.6
## Desvio lateral leve dos tipos sem habilidade própria (Walker, Runner, Tank, Hoplita comum),
## para não andarem em fileira reta como clones (mesma técnica do zigue-zague do Sátiro, com
## amplitude bem menor).
const WANDER_AMPLITUDE := 0.16
const WANDER_FREQUENCY := 1.4
## Esqueletos usam poeira/estilhaço no lugar de sangue, sempre (não é carne).
const BONE_TYPES: Array[StringName] = [&"skeleton", &"skeleton_archer"]
var _flinch_left := 0.0
var _flinch_frame := -1
var _wander_clock := 0.0
## Jitter por instância em move_speed/attack_interval (±8%), para zumbis do mesmo tipo pararem
## de andar e atacar em lockstep perfeito.
var _attack_interval_jitter := 1.0
var _walk_anim_started := false
## Investida (Runner): tempo restante do dash, sua direção e o resfriamento até o próximo.
var _dash_left := 0.0
var _dash_cooldown := 0.0
var _dash_dir := Vector3.ZERO
var _attack_cooldown := 0.0
## Atordoado (raio, plasma): não anda nem ataca.
var _stun_left := 0.0
## Lentidão do gelo: tempo restante e fator da velocidade.
var _chill_left := 0.0
var _chill_factor := 1.0
## Queimando (lança-chamas): dano por segundo até acabar o tempo.
var _burn_dps := 0.0
var _burn_left := 0.0
var _burn_source: Node
## Tempo sem se aproximar do alvo (o SpawnManager realoca zumbis presos).
var stuck_time: float = 0.0
## Tempo seguido colidindo com parede/objeto sem progresso (quina emperrada) — diferente de só
## "longe e sem chegar perto": o SpawnManager usa isto pra saber quando vale um empurrão local
## mesmo perto do jogador (fila da horda, que segue progredindo aos poucos, não conta).
var wall_jam_time: float = 0.0
var _best_distance := INF
var _abilities: ZombieAbilities
var _materials: Array[StandardMaterial3D] = []
## Modelo do Blender (null = formas simples da cena).
var model: CharacterSprite
var _attack_anim_left := 0.0
var _armor_meshes: Array[MeshInstance3D] = []

@onready var agent: NavigationAgent3D = $NavigationAgent3D
@onready var pivot: Node3D = $Pivot


## Configura antes de entrar na árvore (chamado pela ZombieFactory).
func setup(p_data: ZombieData, p_target: CharacterBase, health_mult: float = 1.0, damage_mult: float = 1.0, speed_mult: float = 1.0) -> void:
	data = p_data
	target = p_target
	_health_mult = health_mult
	_damage_mult = damage_mult
	_speed_mult = speed_mult


func _ready() -> void:
	super()
	health.reset(data.max_health * _health_mult)
	var jitter := randf_range(0.92, 1.08)
	move_speed = data.move_speed * _speed_mult * jitter
	_attack_interval_jitter = randf_range(0.92, 1.08)
	attack_damage = data.damage * _damage_mult
	add_to_group(&"zombies")
	_apply_look()
	if not (data.explosive.is_empty() and data.ranged.is_empty() and data.armor.is_empty() and data.death_cloud.is_empty()
			and data.shield.is_empty() and data.revive.is_empty() and data.zigzag.is_empty() and data.hit_and_run.is_empty()
			and data.flying.is_empty() and data.gaze.is_empty()):
		_abilities = ZombieAbilities.new()
		add_child(_abilities)
		_abilities.setup(self)
	health.damaged.connect(func(info: DamageInfo, _current: float) -> void:
		Events.zombie_hit.emit(self, info)
		if info.kind in [DamageInfo.Kind.WEAPON, DamageInfo.Kind.MELEE] and is_inside_tree():
			var at: Vector3 = info.hit_position if info.hit_position != Vector3.ZERO else global_position + Vector3.UP * 1.2
			_hit_fx(at)
			_flinch(info))
	# Espalha o recálculo de caminho entre os zumbis (nem todos no mesmo frame).
	_repath_left = randf() * repath_interval


func _physics_process(delta: float) -> void:
	if state == State.DEAD:
		return
	if _burn_left > 0.0:
		_burn_left -= delta
		take_damage(DamageInfo.new(_burn_dps * delta, DamageInfo.Kind.BURN, _burn_source, false, global_position))
		if state == State.DEAD:
			return
	apply_gravity(delta)
	_flinch_left = maxf(0.0, _flinch_left - delta)
	if _chill_left > 0.0:
		_chill_left -= delta
		if _chill_left <= 0.0:
			_chill_factor = 1.0
			if model:
				model.tint(Color.WHITE)
	if _stun_left > 0.0:
		_stun_left -= delta
		velocity.x = _knockback.x
		velocity.z = _knockback.z
		_knockback = _knockback.move_toward(Vector3.ZERO, 30.0 * delta)
		move_and_slide()
		return
	_update_target(delta)
	if target == null or not target.is_alive():
		velocity.x = 0.0
		velocity.z = 0.0
		move_and_slide()
		return

	var to_target := target.global_position - global_position
	to_target.y = 0.0
	_attack_cooldown = maxf(0.0, _attack_cooldown - delta)
	_dash_cooldown = maxf(0.0, _dash_cooldown - delta)
	var barricade := _blocking_barricade()
	if _dash_left > 0.0:
		_dash_left -= delta
		velocity.x = _dash_dir.x * float(data.dash.get("speed", move_speed))
		velocity.z = _dash_dir.z * float(data.dash.get("speed", move_speed))
		_face(_dash_dir)
	elif _abilities and _abilities.override_movement(delta, to_target):
		# A habilidade pode mover o zumbi (investida, recuo, mergulho) ou só pará-lo.
		var moved: Variant = _abilities.move_velocity
		velocity.x = (moved as Vector3).x if moved is Vector3 else 0.0
		velocity.z = (moved as Vector3).z if moved is Vector3 else 0.0
		_face(to_target if not moved is Vector3 or (moved as Vector3).length() < 0.1 or _abilities.face_target else moved)
	elif flee_goal == null and to_target.length() <= data.attack_range:
		_attack(to_target)
	elif flee_goal == null and not data.dash.is_empty() and _dash_cooldown <= 0.0 and to_target.length() <= float(data.dash.get("range", 6.0)):
		# Investida (Runner): fecha distância de repente antes do ataque normal.
		state = State.CHASE
		_dash_left = float(data.dash.get("duration", 0.3))
		_dash_cooldown = float(data.dash.get("cooldown", 3.5))
		_dash_dir = to_target.normalized()
		velocity.x = _dash_dir.x * float(data.dash.get("speed", move_speed))
		velocity.z = _dash_dir.z * float(data.dash.get("speed", move_speed))
		_face(_dash_dir)
	elif barricade:
		_break(barricade)
	else:
		_chase(to_target, delta)
	velocity.x += _knockback.x
	velocity.z += _knockback.z
	_knockback = _knockback.move_toward(Vector3.ZERO, 30.0 * delta)
	move_and_slide()


## Persegue o jogador de pé mais perto (cooperativo). No solo é sempre o mesmo jogador.
func _update_target(delta: float) -> void:
	if target != null and not is_instance_valid(target):
		target = null
	if not Players.coop():
		return
	_retarget_left -= delta
	var lost := target == null or (target is Player and not (target as Player).is_standing())
	if lost:
		_retarget_left = minf(_retarget_left, 0.1)
	if _retarget_left > 0.0:
		return
	_retarget_left = RETARGET_TIME
	var nearest := Players.nearest(global_position)
	if nearest and nearest != target:
		target = nearest
		_best_distance = INF


func _chase(to_target: Vector3, delta: float) -> void:
	if state == State.ATTACK or state == State.BREAK_BARRICADE:
		state = State.CHASE
	# Preso: não chega mais perto do alvo há um tempo.
	if to_target.length() < _best_distance - 0.5:
		_best_distance = to_target.length()
		stuck_time = 0.0
	else:
		stuck_time += delta
	_repath_left -= delta
	if _repath_left <= 0.0:
		_repath_left = repath_interval
		agent.target_position = flee_goal if flee_goal is Vector3 else target.global_position
	var direction := agent.get_next_path_position() - global_position
	direction.y = 0.0
	# Sem caminho ainda (malha sincronizando): vai direto.
	if direction.length() < 0.05:
		direction = to_target
	direction = direction.normalized()
	if _abilities:
		direction = _abilities.steer(direction, delta)
	else:
		direction = _wander(direction, delta)
	# Emperrado numa quina (porta, coluna): recalcula o caminho e escorrega ao longo da parede.
	var jammed := stuck_time > 0.8 and get_slide_collision_count() > 0
	wall_jam_time = wall_jam_time + delta if jammed else 0.0
	if jammed:
		# A colisão com a parede (não com o chão): a primeira lateral.
		var normal := Vector3.ZERO
		for i in get_slide_collision_count():
			var n := get_slide_collision(i).get_normal()
			if absf(n.y) < 0.5:
				normal = Vector3(n.x, 0.0, n.z)
				break
		if normal.length() > 0.1:
			var slid := direction.slide(normal.normalized())
			direction = (slid if slid.length() > 0.2 else normal.normalized().rotated(Vector3.UP, PI * 0.5 * signf(float(get_instance_id() % 2) - 0.5))).normalized()
		if _repath_left > 0.05:
			_repath_left = 0.05
	# Emperrado há mais tempo (quina com a horda empurrando): vai variando a direção para sair.
	if stuck_time > 2.5:
		direction = direction.rotated(Vector3.UP, sin(stuck_time * 2.7 + float(get_instance_id() % 13)) * 1.2).normalized()
	var chill := (_chill_factor if _chill_left > 0.0 else 1.0) * (FLINCH_SPEED if _flinch_left > 0.0 else 1.0)
	velocity.x = direction.x * move_speed * event_speed * chill
	velocity.z = direction.z * move_speed * event_speed * chill
	_face(direction)


## Desvio lateral leve dos tipos sem habilidade própria (ver WANDER_AMPLITUDE).
func _wander(direction: Vector3, delta: float) -> Vector3:
	_wander_clock += delta
	var side := Vector3(-direction.z, 0.0, direction.x)
	var wave := sin(_wander_clock * WANDER_FREQUENCY + float(get_instance_id() % 11)) * WANDER_AMPLITUDE
	return (direction + side * wave).normalized()


## No ar (Harpia fora do mergulho): a faca não alcança.
func is_airborne() -> bool:
	return _abilities != null and _abilities.airborne()


func _attack(to_target: Vector3) -> void:
	if state != State.ATTACK:
		state = State.ATTACK
		# Pequena preparação ao chegar (dá tempo de reagir).
		_attack_cooldown = maxf(_attack_cooldown, 0.35)
	velocity.x = 0.0
	velocity.z = 0.0
	_face(to_target)
	if _attack_cooldown <= 0.0:
		_attack_cooldown = data.attack_interval * _attack_interval_jitter
		Events.zombie_attacked.emit(self)
		if model and not data.crawls:
			model.play_once(&"Attack")
			_attack_anim_left = 0.55
		var applied := target.take_damage(DamageInfo.new(attack_damage, DamageInfo.Kind.ZOMBIE, self, false, global_position))
		if applied > 0.0 and not data.grab.is_empty() and target.has_method(&"slow") and randf() < float(data.grab.get("chance", 0.0)):
			target.call(&"slow", float(data.grab.get("slow_factor", 0.4)), float(data.grab.get("slow_time", 0.9)))
		if applied > 0.0 and not data.stomp.is_empty() and to_target.length() <= float(data.stomp.get("radius", 1.15)) and randf() < float(data.stomp.get("chance", 1.0)):
			if target.has_method(&"slow"):
				target.call(&"slow", float(data.stomp.get("slow_factor", 0.25)), float(data.stomp.get("slow_time", 1.2)))
			Events.screen_shake.emit(float(data.stomp.get("shake_duration", 0.15)), float(data.stomp.get("shake_strength", 0.1)))
		# Investida curta do golpe (mais longa no Hoplita: estocada de lança).
		var lunge := -pivot.basis.z * data.lunge_reach
		lunge.y = 0.0
		var tween := create_tween()
		tween.tween_property(pivot, "position", lunge, 0.08)
		tween.tween_property(pivot, "position", Vector3.ZERO, 0.15)


## Barricada inteira logo à frente, vista de fora (o zumbi precisa arrancar as tábuas).
func _blocking_barricade() -> Barricade:
	for node in get_tree().get_nodes_in_group(&"barricades"):
		var barricade := node as Barricade
		if barricade == null or not barricade.is_intact() or not barricade.is_outside(global_position):
			continue
		var offset := barricade.global_position - global_position
		offset.y = 0.0
		if offset.length() <= 1.5:
			return barricade
	return null


func _break(barricade: Barricade) -> void:
	if state != State.BREAK_BARRICADE:
		state = State.BREAK_BARRICADE
		_attack_cooldown = maxf(_attack_cooldown, 0.35)
	velocity.x = 0.0
	velocity.z = 0.0
	var to_barricade := barricade.global_position - global_position
	to_barricade.y = 0.0
	_face(to_barricade)
	if _attack_cooldown <= 0.0:
		_attack_cooldown = data.attack_interval * _attack_interval_jitter
		barricade.take_hit(data.plank_damage)


## Gelo: fica lento (velocidade × `factor`) por `seconds`, com um tom azulado.
func chill(seconds: float, factor: float) -> void:
	_chill_left = maxf(_chill_left, seconds)
	_chill_factor = minf(factor, _chill_factor if _chill_left > 0.0 else 1.0)
	if model:
		model.tint(Color(0.62, 0.85, 1.25))


func is_chilled() -> bool:
	return _chill_left > 0.0


## Atordoa por `seconds` (não soma: vale o maior).
func stun(seconds: float) -> void:
	_stun_left = maxf(_stun_left, seconds)


## Põe fogo: `dps` de dano por segundo durante `seconds` (renova com o fogo mais forte).
func apply_burn(dps: float, seconds: float, source: Node) -> void:
	_burn_dps = maxf(_burn_dps if _burn_left > 0.0 else 0.0, dps)
	_burn_left = maxf(_burn_left, seconds)
	_burn_source = source


## Empurra o zumbi (velocidade em m/s, no plano). Tank e Blindado não saem do lugar.
func apply_knockback(push: Vector3) -> void:
	if data.pushable:
		_knockback = Vector3(push.x, 0.0, push.z)


## Recomeça a contagem de "preso" (depois de ser realocado).
func reset_stuck() -> void:
	stuck_time = 0.0
	_best_distance = INF
	wall_jam_time = 0.0


## Linha de visão até o alvo (paredes bloqueiam).
func has_line_of_sight() -> bool:
	return has_line_of_sight_to(target)


## Nada de parede entre o zumbi e `other` (a Górgona olha para cada jogador).
func has_line_of_sight_to(other: Node3D) -> bool:
	if other == null:
		return false
	var query := PhysicsRayQueryParameters3D.create(global_position + Vector3.UP * 1.4, other.global_position + Vector3.UP * 1.2, PhysicsLayers.WORLD)
	return get_world_3d().direct_space_state.intersect_ray(query).is_empty()


## Tranco ao levar tiro ou faca (como sentir o impacto): recua um pouco na direção do golpe,
## hesita por um instante e pisca. Uma vez por quadro (os chumbos de uma espingarda contam
## como um tranco só). Tank e Blindado não recuam (apply_knockback ignora), só hesitam.
func _flinch(info: DamageInfo) -> void:
	var frame := Engine.get_physics_frames()
	if frame == _flinch_frame or not is_alive():
		return
	_flinch_frame = frame
	var push_strength := HEADSHOT_FLINCH_PUSH if info.is_headshot else FLINCH_PUSH
	_flinch_left = HEADSHOT_FLINCH_TIME if info.is_headshot else FLINCH_TIME
	var source := info.source as Node3D
	if source and is_instance_valid(source):
		var push := global_position - source.global_position
		push.y = 0.0
		if push.length() > 0.01 and _knockback.length() < push_strength:
			apply_knockback(push.normalized() * push_strength)
	if model:
		model.flash(Color(1.0, 0.92, 0.9))


## Brilho rápido no corpo (aviso de explosão, preparo do cuspe).
func flash(color: Color) -> void:
	if model:
		model.flash(color)
		return
	for material in _materials:
		material.emission_enabled = true
		material.emission = color * 0.6
	get_tree().create_timer(0.08).timeout.connect(func() -> void:
		for material in _materials:
			material.emission_enabled = false)


## A armadura caiu (headshot ou dano suficiente).
func break_armor() -> void:
	if model and CharacterSprite.exists(sprite_sheet() + "_bare"):
		model.set_sheet(sprite_sheet() + "_bare")
	for mesh in _armor_meshes:
		if is_instance_valid(mesh):
			mesh.queue_free()
	_armor_meshes.clear()


## Aparência provisória por tipo (cores, tamanho, rastejante, armadura) e raio do corpo.
func _apply_look() -> void:
	model = CharacterSprite.create(sprite_sheet())
	if model:
		_apply_sprite()
		return
	var shirt := StandardMaterial3D.new()
	shirt.albedo_color = data.shirt_color
	shirt.roughness = 0.95
	var skin := StandardMaterial3D.new()
	skin.albedo_color = data.skin_color
	skin.roughness = 0.9
	_materials = [shirt, skin]
	for part in pivot.get_children():
		var mesh := part as MeshInstance3D
		if mesh == null or part.name.begins_with("Eye"):
			continue
		mesh.material_override = shirt if part.name == "Body" else skin
	# Modo cabeção (segredo do código Konami).
	if Save.data.secrets.get("konami", false) and bool(Save.get_setting("bigHeads")):
		var head := pivot.get_node_or_null("Head") as Node3D
		if head:
			head.scale = Vector3.ONE * 1.9
	var scale_xz := data.model_scale
	var scale_y := data.model_scale * (0.45 if data.crawls else 1.0)
	pivot.scale = Vector3(scale_xz, scale_y, scale_xz)
	for child in get_children():
		if child is Hurtbox:
			var hurtbox := child as Hurtbox
			hurtbox.position.y *= scale_y
			hurtbox.scale = Vector3(scale_xz, scale_xz, scale_xz)
	var body_shape := ($CollisionShape3D as CollisionShape3D).shape.duplicate() as CapsuleShape3D
	if body_shape:
		body_shape.radius = data.body_radius
		($CollisionShape3D as CollisionShape3D).shape = body_shape
	if not data.armor.is_empty():
		var metal := StandardMaterial3D.new()
		metal.albedo_color = Color(0.25, 0.27, 0.3)
		metal.metallic = 0.6
		var helmet := MeshInstance3D.new()
		var helmet_mesh := SphereMesh.new()
		helmet_mesh.radius = 0.23
		helmet_mesh.height = 0.3
		helmet.mesh = helmet_mesh
		helmet.material_override = metal
		helmet.position = Vector3(0, 1.72, 0)
		var vest := MeshInstance3D.new()
		var vest_mesh := BoxMesh.new()
		vest_mesh.size = Vector3(0.72, 0.6, 0.5)
		vest.mesh = vest_mesh
		vest.material_override = metal
		vest.position = Vector3(0, 0.95, 0)
		pivot.add_child(helmet)
		pivot.add_child(vest)
		_armor_meshes = [helmet, vest]


## Visual adaptado ao mapa dos tipos que existem em mais de um mapa (sufixo da folha).
const MAP_LOOK := {"map2": "_hospital", "temple": "_temple"}


## Folha de sprites do tipo (gerada por npm run godot:sprites): "zombie_<tipo>" ou "hound".
## No Hospital e no Templo, os tipos que também existem no Terminal têm o visual do mapa
## (Hospital: paciente, enfermeiro...; Templo: arqueólogo, cultista, gladiador...), quando a
## folha existe.
func sprite_sheet() -> String:
	var sheet := "hound" if data.id == &"hound" else "zombie_%s" % data.id
	var suffix := String(MAP_LOOK.get(Session.map_id, ""))
	if suffix != "" and CharacterSprite.exists(sheet + suffix):
		return sheet + suffix
	return sheet


## Pixel art (especificação 2.5D): o sprite já vem no tamanho e com as cores do tipo (e a
## armadura do blindado); as hurtboxes e o corpo continuam os da cena.
func _apply_sprite() -> void:
	for part in pivot.get_children():
		if part is MeshInstance3D:
			(part as MeshInstance3D).visible = false
	pivot.add_child(model)
	var scale_xz := data.model_scale
	var scale_y := data.model_scale * (0.45 if data.crawls else 1.0)
	for child in get_children():
		if child is Hurtbox:
			var hurtbox := child as Hurtbox
			hurtbox.position.y *= scale_y
			hurtbox.scale = Vector3(scale_xz, scale_xz, scale_xz)
	var body_shape := ($CollisionShape3D as CollisionShape3D).shape.duplicate() as CapsuleShape3D
	if body_shape:
		body_shape.radius = data.body_radius
		($CollisionShape3D as CollisionShape3D).shape = body_shape
	model.play(&"Crawl" if data.crawls else &"Idle", 0.0)


## Animação conforme o estado (visual; a lógica fica no _physics_process).
func _process(delta: float) -> void:
	if model == null or state == State.DEAD:
		return
	_attack_anim_left -= delta
	if _attack_anim_left > 0.0:
		return
	if _stun_left > 0.0:
		model.play(&"Idle")
		return
	var speed := Vector2(velocity.x, velocity.z).length()
	if data.crawls:
		model.play(&"Crawl", 0.2, clampf(speed / 1.2, 0.3, 1.6))
	elif speed > 0.2:
		var running: bool = speed > 3.2 and model.has_animation(&"Run")
		var anim := &"Run" if running else &"Walk"
		var starting := model.current != anim
		model.play(anim, 0.2, clampf(speed / (4.5 if running else 1.3), 0.5, 1.8))
		if starting and not _walk_anim_started:
			_walk_anim_started = true
			model.randomize_phase()
	else:
		model.play(&"Idle")


func _face(direction: Vector3) -> void:
	if direction.length() > 0.01:
		pivot.rotation.y = atan2(-direction.x, -direction.z)


func _on_health_died(info: DamageInfo) -> void:
	state = State.DEAD
	remove_from_group(&"zombies")
	super(info)
	Events.zombie_killed.emit(self, info)
	Events.screen_shake.emit(0.12 if info.is_headshot else 0.06, 0.08 if info.is_headshot else 0.035)
	if _abilities:
		_abilities.on_death(info)
	# Não bloqueia mais ninguém nem recebe tiros; cai e afunda no chão.
	collision_layer = 0
	collision_mask = PhysicsLayers.WORLD
	for child in get_children():
		if child is Hurtbox:
			(child as Hurtbox).disable()
	if not data.burns_on_death and is_inside_tree() and blood_enabled() and data.id not in BONE_TYPES:
		PixelFx.decal(get_tree(), "blood_pool", global_position, 1.1 * data.model_scale, CORPSE_STAY)
	if data.burns_on_death:
		# Cão: pega fogo e some, sem corpo.
		flash(Color(1.0, 0.45, 0.1))
		var burn := create_tween()
		burn.tween_property(pivot, "scale", Vector3.ONE * 0.05, 0.4)
		burn.tween_callback(queue_free)
		return
	var tween := create_tween()
	if model and model.has_animation(&"Death"):
		model.play_once(&"Death", 0.05)
		tween.tween_interval(0.35)
	else:
		_face_away_from_hit(info)
		tween.tween_property(pivot, "rotation:x", deg_to_rad(randf_range(-92.0, -78.0)), randf_range(0.3, 0.4))
	# O corpo fica no chão; depois de CORPSE_STAY (ou quando há corpos demais) afunda.
	tween.tween_interval(CORPSE_STAY)
	tween.tween_callback(_sink)
	_corpses.append(self)
	_corpses.assign(_corpses.filter(func(c: ZombieBase) -> bool: return is_instance_valid(c)))
	while _corpses.size() > MAX_CORPSES:
		var oldest: ZombieBase = _corpses.pop_front()
		if is_instance_valid(oldest):
			oldest._sink()


## Vira o corpo para o lado de onde veio o golpe antes de cair (mesmo vetor do knockback):
## em vez do tombo sempre igual, cada morte cai na direção do impacto que a matou.
func _face_away_from_hit(info: DamageInfo) -> void:
	var source := info.source as Node3D
	if source and is_instance_valid(source):
		var to_source := source.global_position - global_position
		to_source.y = 0.0
		if to_source.length() > 0.05:
			_face(to_source)


## O corpo afunda no chão e some.
func _sink() -> void:
	if is_queued_for_deletion() or has_meta(&"sinking"):
		return
	set_meta(&"sinking", true)
	_corpses.erase(self)
	var tween := create_tween()
	tween.tween_property(pivot, "position:y", -1.0, CORPSE_TIME)
	tween.tween_callback(queue_free)


## Sangue ligado nas configurações (desligado por padrão).
static func blood_enabled() -> bool:
	return bool(Save.get_setting("blood"))


## Efeito do acerto: com sangue, um jato e gotas no chão; sem (ou esqueleto, que é osso, não
## carne), só um estalo de poeira.
func _hit_fx(at: Vector3) -> void:
	if blood_enabled() and data.id not in BONE_TYPES:
		PixelFx.spawn(get_tree(), "blood_splat", at, 0.9)
		if randf() < 0.45:
			var drop := at + Vector3(randf_range(-0.5, 0.5), 0.0, randf_range(-0.5, 0.5))
			PixelFx.decal(get_tree(), "blood_pool", drop, randf_range(0.25, 0.45), CORPSE_STAY)
	else:
		PixelFx.spawn(get_tree(), "dust", at, 0.45)
