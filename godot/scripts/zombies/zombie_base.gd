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

var target: CharacterBase
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
	if to_target.length() <= data.attack_range:
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
	_repath_left -= delta
	if _repath_left <= 0.0:
		_repath_left = repath_interval
		agent.target_position = target.global_position
	var direction := agent.get_next_path_position() - global_position
	direction.y = 0.0
	# Sem caminho ainda (malha sincronizando): vai direto.
	if direction.length() < 0.05:
		direction = to_target
	direction = direction.normalized()
	velocity.x = direction.x * move_speed
	velocity.z = direction.z * move_speed
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


## Empurra o zumbi (velocidade em m/s, no plano).
func apply_knockback(push: Vector3) -> void:
	_knockback = Vector3(push.x, 0.0, push.z)


func _face(direction: Vector3) -> void:
	if direction.length() > 0.01:
		pivot.rotation.y = atan2(-direction.x, -direction.z)


func _on_health_died(info: DamageInfo) -> void:
	state = State.DEAD
	remove_from_group(&"zombies")
	super(info)
	Events.zombie_killed.emit(self, info)
	# Não bloqueia mais ninguém nem recebe tiros; cai e afunda no chão.
	collision_layer = 0
	collision_mask = PhysicsLayers.WORLD
	for child in get_children():
		if child is Hurtbox:
			(child as Hurtbox).disable()
	var tween := create_tween()
	tween.tween_property(pivot, "rotation:x", deg_to_rad(-85.0), 0.35)
	tween.tween_interval(CORPSE_TIME * 0.5)
	tween.tween_property(pivot, "position:y", -1.0, CORPSE_TIME * 0.5)
	tween.tween_callback(queue_free)
