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
## Armadura (power-up): absorve o dano antes da vida.
var armor: float = 0.0
## Speed Boost (power-up) e Fúria (Golden Drop: dano das armas multiplicado).
var speed_buff: float = 1.0
var fury_multiplier: float = 1.0:
	set(value):
		fury_multiplier = value
		if is_node_ready():
			_apply_weapon_modifiers()
## Lentidão (grito do Paciente Zero): fator e até quando.
var _slow_factor := 1.0
var _slow_until := 0.0
var _last_hurt_at := -INF
var _was_reloading := false
var _firing := false
## Interagível mais perto (porta, compra...) e o último texto mostrado na HUD.
var _interactable: Node3D
var _last_prompt := ""

@onready var pivot: Node3D = $Pivot
@onready var inventory: WeaponInventory = $Pivot/Hand
@onready var melee: Melee = $Melee
@onready var muzzle: Marker3D = $Pivot/Hand/Muzzle
@onready var perks: PerkSystem = $Perks

## Caído esperando o Quick Revive levantar.
var is_down: bool = false

## Arma em mãos.
var weapon: Weapon:
	get:
		return inventory.current


func _ready() -> void:
	super()
	add_to_group(&"player")
	_apply_skin()
	health.reset(data.max_health)
	inventory.slots = data.inventory_slots
	inventory.switch_time = data.switch_time
	melee.data = data.knife
	inventory.weapon_changed.connect(_on_weapon_changed)
	melee.swung.connect(func() -> void: Events.knife_swung.emit())
	perks.perks_changed.connect(_on_perks_changed)
	Events.max_ammo.connect(func(_at: Vector3) -> void:
		for w in inventory.weapons:
			w.reset_ammo())
	Events.hound_round_changed.connect(_on_hound_round)
	inventory.give(data.starting_weapon)
	health.health_changed.connect(func(current: float, maximum: float) -> void: Events.player_health_changed.emit(current, maximum))
	aim_point = global_position - global_basis.z * 3.0
	# Depois que a cena inteira estiver pronta (a HUD fica pronta por último).
	call_deferred(&"_emit_initial_state")


## Visual escolhido (cores da jaqueta, mochila e cabelo); trancado volta ao padrão.
func _apply_skin() -> void:
	var catalog := load("res://data/configs/skins.tres") as SkinCatalog
	var skin := catalog.find(String(Save.get_setting("skin")))
	if String(skin.get("unlock", "")) != "" and not Save.has_achievement(skin.unlock):
		skin = catalog.find("default")
	if skin.is_empty():
		return
	var jacket := StandardMaterial3D.new()
	jacket.albedo_color = skin.jacket
	jacket.roughness = 0.85
	($Pivot/Body as MeshInstance3D).material_override = jacket
	var pack := MeshInstance3D.new()
	pack.name = "Pack"
	var pack_mesh := BoxMesh.new()
	pack_mesh.size = Vector3(0.42, 0.5, 0.2)
	pack.mesh = pack_mesh
	var pack_material := StandardMaterial3D.new()
	pack_material.albedo_color = skin.pack
	pack.material_override = pack_material
	pack.position = Vector3(0, 1.05, 0.33)
	pivot.add_child(pack)
	var hair := MeshInstance3D.new()
	hair.name = "Hair"
	var hair_mesh := SphereMesh.new()
	hair_mesh.radius = 0.2
	hair_mesh.height = 0.22
	hair.mesh = hair_mesh
	var hair_material := StandardMaterial3D.new()
	hair_material.albedo_color = skin.hair
	hair.material_override = hair_material
	hair.position = Vector3(0, 1.74, 0.03)
	pivot.add_child(hair)


func _emit_initial_state() -> void:
	Events.player_health_changed.emit(health.current, health.max_health)
	_on_weapon_changed(inventory.current, inventory.other())


func _physics_process(delta: float) -> void:
	_clock += delta
	if not is_alive() or is_down:
		velocity = Vector3.ZERO
		return
	_firing = false
	if controlled:
		_read_input()
	_regenerate(delta)
	_update_interaction()
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


## Usa o interagível mais perto (tecla E). Devolve true se algo aconteceu.
func interact() -> bool:
	if _interactable == null or not is_instance_valid(_interactable):
		return false
	return _interactable.call(&"interact", self)


## Segurando E (consertar barricada, disjuntor...). Devolve true se algo aconteceu.
func hold_interact(delta: float) -> bool:
	if _interactable == null or not is_instance_valid(_interactable) or not _interactable.has_method(&"hold_interact"):
		return false
	return _interactable.call(&"hold_interact", self, delta)


## Armadura cheia (power-up Armor).
func refill_armor() -> void:
	armor = data.max_armor
	Events.player_armor_changed.emit(armor, data.max_armor)


## Deixa o jogador mais lento por `seconds` (fator de velocidade).
func slow(factor: float, seconds: float) -> void:
	_slow_factor = factor
	_slow_until = _clock + seconds


## Levou dano nos últimos `seconds` segundos?
func hurt_within(seconds: float) -> bool:
	return _clock - _last_hurt_at < seconds


## Golpe de faca na direção da mira.
func knife() -> bool:
	if not is_alive():
		return false
	return melee.swing(self, aim_point - global_position, weapon)


func take_damage(info: DamageInfo) -> float:
	# Invulnerável por um instante só contra golpes (ácido e gás ferem continuamente).
	var is_blow := info.kind == DamageInfo.Kind.ZOMBIE
	if is_blow and _clock < _invulnerable_until:
		return 0.0
	if armor > 0.0 and info.amount > 0.0:
		var absorbed := minf(armor, info.amount)
		armor -= absorbed
		info.amount -= absorbed
		Events.player_armor_changed.emit(armor, data.max_armor)
		if info.amount <= 0.0:
			if is_blow:
				_invulnerable_until = _clock + data.invulnerability_time
			_last_hurt_at = _clock
			return 0.0
	var applied := super(info)
	if applied > 0.0:
		if is_blow:
			_invulnerable_until = _clock + data.invulnerability_time
		_last_hurt_at = _clock
	return applied


## Névoa da rodada dos cães: a lanterna fica mais fraca.
func _on_hound_round(active: bool, config: Dictionary) -> void:
	set_flashlight_factor(float(config.get("flashlight_factor", 1.0)) if active else 1.0)


## Alcance/força da lanterna (névoa dos cães, Neblina): 1 = normal.
func set_flashlight_factor(factor: float) -> void:
	var flashlight := pivot.get_node_or_null("Flashlight") as SpotLight3D
	if flashlight == null:
		return
	if not flashlight.has_meta(&"base_energy"):
		flashlight.set_meta(&"base_energy", flashlight.light_energy)
		flashlight.set_meta(&"base_range", flashlight.spot_range)
	flashlight.light_energy = float(flashlight.get_meta(&"base_energy")) * factor
	flashlight.spot_range = float(flashlight.get_meta(&"base_range")) * lerpf(1.0, factor, 0.7)


func _go_down(revive: PerkData) -> void:
	is_down = true
	health.invulnerable = true
	Events.interaction_prompt.emit("")
	Events.toast.emit("QUICK REVIVE!")
	var tween := create_tween()
	tween.tween_property(pivot, "rotation:z", deg_to_rad(70.0), 0.3)
	tween.tween_interval(revive.down_time)
	tween.tween_property(pivot, "rotation:z", 0.0, 0.3)
	tween.tween_callback(_stand_up.bind(revive))


func _stand_up(revive: PerkData) -> void:
	is_down = false
	health.invulnerable = false
	health.reset(data.max_health + perks.max_health_bonus)
	_last_hurt_at = _clock
	# Empurra os zumbis em volta ao levantar.
	for node in get_tree().get_nodes_in_group(&"zombies"):
		var zombie := node as ZombieBase
		if zombie == null:
			continue
		var offset := zombie.global_position - global_position
		offset.y = 0.0
		if offset.length() <= revive.revive_push_radius:
			zombie.apply_knockback(offset.normalized() * revive.revive_push_speed)


func _read_input() -> void:
	move_input = Input.get_vector(&"move_left", &"move_right", &"move_up", &"move_down")
	_update_aim_from_input()
	if Input.is_action_just_pressed(&"fire") and weapon.magazine <= 0 and not weapon.reloading:
		Events.dry_fire.emit()
	if (weapon.data.automatic and Input.is_action_pressed(&"fire")) or Input.is_action_just_pressed(&"fire"):
		fire()
	elif Input.is_action_pressed(&"fire"):
		weapon.hold_trigger()  # minigun gira o cano enquanto o gatilho está seguro
	if Input.is_action_just_pressed(&"reload"):
		weapon.start_reload()
	if Input.is_action_just_pressed(&"interact"):
		interact()
	elif Input.is_action_pressed(&"interact"):
		hold_interact(get_physics_process_delta_time())
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
	var slow := _slow_factor if _clock < _slow_until else 1.0
	var speed := data.move_speed * _speed_factor(direction) * perks.speed_multiplier * slow * speed_buff
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


## Acha o interagível mais perto no alcance dele e atualiza o texto da HUD.
func _update_interaction() -> void:
	_interactable = null
	var best := INF
	for node in get_tree().get_nodes_in_group(&"interactable"):
		var target := node as Node3D
		if target == null:
			continue
		var offset := target.global_position - global_position
		offset.y = 0.0
		var distance := offset.length()
		if distance <= float(target.get(&"interaction_radius")) and distance < best:
			best = distance
			_interactable = target
	var prompt: String = _interactable.call(&"get_interaction_prompt", self) if _interactable else ""
	if prompt != _last_prompt:
		_last_prompt = prompt
		Events.interaction_prompt.emit(prompt)


func _regenerate(delta: float) -> void:
	var regen := perks.regen_multiplier
	if _clock - _last_hurt_at >= data.regen_delay / regen and health.current < health.max_health:
		health.heal(data.regen_per_second * regen * delta)


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


## Perks mudaram: vida máxima e os modificadores de todas as armas.
func _on_perks_changed() -> void:
	var new_max := data.max_health + perks.max_health_bonus
	if not is_equal_approx(new_max, health.max_health):
		var gained := new_max - health.max_health
		health.max_health = new_max
		health.current = clampf(health.current + maxf(0.0, gained), 0.0, new_max)
		health.health_changed.emit(health.current, health.max_health)
	_apply_weapon_modifiers()
	var names: Array[String] = []
	for perk in perks.owned:
		names.append(perk.display_name)
	Events.perks_changed.emit(names)


func _apply_weapon_modifiers() -> void:
	for w in inventory.weapons:
		w.damage_multiplier = perks.damage_multiplier * fury_multiplier
		w.headshot_bonus = perks.headshot_bonus
		w.reload_multiplier = perks.reload_multiplier


func _on_weapon_changed(current: Weapon, other: Weapon) -> void:
	_apply_weapon_modifiers()
	for w in inventory.weapons:
		if not w.fired.is_connected(_on_fired):
			w.fired.connect(_on_fired)
	for w in inventory.weapons:
		if w.ammo_changed.is_connected(_on_ammo_changed):
			w.ammo_changed.disconnect(_on_ammo_changed)
	current.ammo_changed.connect(_on_ammo_changed)
	Events.weapon_changed.emit(current.data.display_name, other.data.display_name if other else "")
	_on_ammo_changed(current.magazine, current.reserve, current.reloading)


func _on_fired() -> void:
	Events.shot_fired.emit()
	Events.weapon_fired.emit(weapon.data.id, weapon.level)


func _on_ammo_changed(magazine: int, reserve: int, reloading: bool) -> void:
	if reloading and not _was_reloading:
		Events.weapon_reload_started.emit(weapon.data.kind)
	_was_reloading = reloading
	Events.ammo_changed.emit(weapon.data.display_name, magazine, reserve, reloading)


func _on_health_died(info: DamageInfo) -> void:
	# Quick Revive: cai, fica alguns segundos no chão e levanta sozinho (gasta o perk).
	var revive := perks.consume_self_revive()
	if revive:
		_go_down(revive)
		return
	super(info)
	Events.interaction_prompt.emit("")
	# Cai de lado.
	create_tween().tween_property(pivot, "rotation:z", deg_to_rad(80.0), 0.4)
	Events.player_died.emit()
