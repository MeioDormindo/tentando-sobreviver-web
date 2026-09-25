class_name ZombieBase
extends CharacterBase
## Zumbi base (seções 13 e 19): máquina de estados simples, perseguir → atacar → morto.
## Anda pela malha de navegação (NavigationAgent3D), recalculando o caminho a cada
## `repath_interval` em vez de todo frame. Os números vêm do ZombieData × multiplicadores
## do round. Behavior Tree fica para quando o comportamento pedir (seção 11).

enum State { CHASE, ATTACK, BREAK_BARRICADE, DEAD }

## Tempo (s) até o corpo sumir depois de morrer.
const CORPSE_TIME := 1.6

@export var data: ZombieData
@export var repath_interval: float = 0.25

## Lua de Sangue: todos os zumbis mais rápidos.
static var event_speed: float = 1.0

var target: CharacterBase
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
var _attack_cooldown := 0.0
## Atordoado (raio, plasma): não anda nem ataca.
var _stun_left := 0.0
## Queimando (lança-chamas): dano por segundo até acabar o tempo.
var _burn_dps := 0.0
var _burn_left := 0.0
var _burn_source: Node
## Tempo sem se aproximar do alvo (o SpawnManager realoca zumbis presos).
var stuck_time: float = 0.0
var _best_distance := INF
var _abilities: ZombieAbilities
var _materials: Array[StandardMaterial3D] = []
## Modelo do Blender (null = formas simples da cena).
var model: CharacterModel
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
	move_speed = data.move_speed * _speed_mult
	attack_damage = data.damage * _damage_mult
	add_to_group(&"zombies")
	_apply_look()
	if not (data.explosive.is_empty() and data.ranged.is_empty() and data.armor.is_empty() and data.death_cloud.is_empty()):
		_abilities = ZombieAbilities.new()
		add_child(_abilities)
		_abilities.setup(self)
	health.damaged.connect(func(info: DamageInfo, _current: float) -> void: Events.zombie_hit.emit(self, info))
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
	if _stun_left > 0.0:
		_stun_left -= delta
		velocity.x = _knockback.x
		velocity.z = _knockback.z
		_knockback = _knockback.move_toward(Vector3.ZERO, 30.0 * delta)
		move_and_slide()
		return
	if target == null or not target.is_alive():
		velocity.x = 0.0
		velocity.z = 0.0
		move_and_slide()
		return

	var to_target := target.global_position - global_position
	to_target.y = 0.0
	_attack_cooldown = maxf(0.0, _attack_cooldown - delta)
	var barricade := _blocking_barricade()
	if _abilities and _abilities.override_movement(delta, to_target):
		velocity.x = 0.0
		velocity.z = 0.0
		_face(to_target)
	elif flee_goal == null and to_target.length() <= data.attack_range:
		_attack(to_target)
	elif barricade:
		_break(barricade)
	else:
		_chase(to_target, delta)
	velocity.x += _knockback.x
	velocity.z += _knockback.z
	_knockback = _knockback.move_toward(Vector3.ZERO, 30.0 * delta)
	move_and_slide()


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
	velocity.x = direction.x * move_speed * event_speed
	velocity.z = direction.z * move_speed * event_speed
	_face(direction)


func _attack(to_target: Vector3) -> void:
	if state != State.ATTACK:
		state = State.ATTACK
		# Pequena preparação ao chegar (dá tempo de reagir).
		_attack_cooldown = maxf(_attack_cooldown, 0.35)
	velocity.x = 0.0
	velocity.z = 0.0
	_face(to_target)
	if _attack_cooldown <= 0.0:
		_attack_cooldown = data.attack_interval
		Events.zombie_attacked.emit(self)
		if model and not data.crawls:
			model.play_once(&"Attack")
			_attack_anim_left = 0.55
		target.take_damage(DamageInfo.new(attack_damage, DamageInfo.Kind.ZOMBIE, self, false, global_position))
		# Investida curta do golpe.
		var lunge := -pivot.basis.z * 0.25
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
		_attack_cooldown = data.attack_interval
		barricade.take_hit(data.plank_damage)


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


## Linha de visão até o alvo (paredes bloqueiam).
func has_line_of_sight() -> bool:
	if target == null:
		return false
	var query := PhysicsRayQueryParameters3D.create(global_position + Vector3.UP * 1.4, target.global_position + Vector3.UP * 1.2, PhysicsLayers.WORLD)
	return get_world_3d().direct_space_state.intersect_ray(query).is_empty()


## Brilho rápido no corpo (aviso de explosão, preparo do cuspe).
func flash(color: Color) -> void:
	for material in _materials:
		material.emission_enabled = true
		material.emission = color * 0.6
	get_tree().create_timer(0.08).timeout.connect(func() -> void:
		for material in _materials:
			material.emission_enabled = false)


## A armadura caiu (headshot ou dano suficiente).
func break_armor() -> void:
	for mesh in _armor_meshes:
		if is_instance_valid(mesh):
			mesh.queue_free()
	_armor_meshes.clear()


## Aparência provisória por tipo (cores, tamanho, rastejante, armadura) e raio do corpo.
func _apply_look() -> void:
	model = CharacterModel.create(data.model)
	if model:
		_apply_model()
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


## Modelo do Blender: cores do tipo, escala, cabeção e as mesmas hurtboxes da cena.
func _apply_model() -> void:
	for part in pivot.get_children():
		if part is MeshInstance3D:
			(part as MeshInstance3D).visible = false
	pivot.add_child(model)
	model.recolor({"Shirt": data.shirt_color, "Skin": data.skin_color, "Fur": data.shirt_color})
	# Olhos brilhantes ficam fora do piscar de dano.
	for material in model.materials:
		if material.resource_name != "Eyes":
			_materials.append(material)
	if Save.data.secrets.get("konami", false) and bool(Save.get_setting("bigHeads")):
		model.scale_bone("head", 1.9)
	var scale_xz := data.model_scale
	var scale_y := data.model_scale * (0.45 if data.crawls else 1.0)
	pivot.scale = Vector3.ONE * data.model_scale
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
		var helmet_mesh := BoxMesh.new()
		helmet_mesh.size = Vector3(0.32, 0.14, 0.32)
		helmet.mesh = helmet_mesh
		helmet.material_override = metal
		helmet.position = Vector3(0, 1.82, 0)
		var vest := MeshInstance3D.new()
		var vest_mesh := BoxMesh.new()
		vest_mesh.size = Vector3(0.58, 0.46, 0.36)
		vest.mesh = vest_mesh
		vest.material_override = metal
		vest.position = Vector3(0, 1.25, 0)
		# Presos ao corpo do modelo (acompanham a animação).
		var attach := BoneAttachment3D.new()
		attach.bone_name = "spine"
		model.skeleton.add_child(attach)
		var head_attach := BoneAttachment3D.new()
		head_attach.bone_name = "head"
		model.skeleton.add_child(head_attach)
		attach.add_child(vest)
		head_attach.add_child(helmet)
		vest.position = Vector3(0, 0.2, 0)
		helmet.position = Vector3(0, 0.34, 0)
		_armor_meshes = [helmet, vest]
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
		model.play(&"Run" if running else &"Walk", 0.2, clampf(speed / (4.5 if running else 1.3), 0.5, 1.8))
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
	if _abilities:
		_abilities.on_death(info)
	# Não bloqueia mais ninguém nem recebe tiros; cai e afunda no chão.
	collision_layer = 0
	collision_mask = PhysicsLayers.WORLD
	for child in get_children():
		if child is Hurtbox:
			(child as Hurtbox).disable()
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
		tween.tween_property(pivot, "rotation:x", deg_to_rad(-85.0), 0.35)
	tween.tween_interval(CORPSE_TIME * 0.5)
	tween.tween_property(pivot, "position:y", -1.0, CORPSE_TIME * 0.5)
	tween.tween_callback(queue_free)
