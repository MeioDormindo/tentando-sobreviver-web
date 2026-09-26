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
## Mira assistida dos controles de toque (mesmos valores do touchConfig do jogo web): cone em
## volta da mira (graus para cada lado), alcance (m) e quanto gira por frame a 60 fps.
const ASSIST_CONE_DEG := 22.0
const ASSIST_RANGE := 9.0
const ASSIST_TURN := 0.35
## Direção da mira no chão (mantida quando o analógico é solto, no toque).
var _aim_dir := Vector3.FORWARD
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
## Bênção dos Deuses ativa (BlessingSystem): dano, velocidade, recarga, dispersão e crítico.
var blessing_damage := 1.0
var blessing_speed := 1.0
var blessing_reload := 1.0
var blessing_spread := 1.0
var blessing_crit := 0.0
var fury_multiplier: float = 1.0:
	set(value):
		fury_multiplier = value
		if is_node_ready():
			_apply_weapon_modifiers()
## Lentidão (grito do Paciente Zero): fator e até quando.
## Lentidão ao levar um golpe de zumbi: fator da velocidade e duração (s).
## Petrificação (olhar da Górgona): acumula de 0 a 1; em 1 vira pedra por STONE_TIME
## (sem mover nem atirar); some aos poucos quando o olhar para.
const STONE_TIME := 1.5
const PETRIFY_DECAY := 0.35
const STONE_COLOR := Color(0.62, 0.62, 0.6)
var petrification := 0.0
var _stone_until := 0.0
var _last_gazed := -99.0
var _stone_tint := false
## Desenroscar: tempo tentando andar sem sair do lugar e a posição de referência.
const UNSTUCK_TIME := 1.0
var _stuck_time := 0.0
var _stuck_from := Vector3.ZERO
const HIT_SLOW_FACTOR := 0.6
const HIT_SLOW_TIME := 0.7
var _slow_factor := 1.0
var _slow_until := 0.0
var _last_hurt_at := -INF
var _was_reloading := false
## Pixel art (npm run godot:sprites): o corpo do visual escolhido e a arma na mão por tipo.
var model: CharacterSprite
## Folha da arma em mãos (weapon_<id>[_mk2|_mk3]).
var _gun_sheet: String = ""
## Folha que está na camada agora (a da arma ou a da faca durante o golpe).
var _layer_sheet: String = ""
const KNIFE_SHEET := "weapon_knife"
## Animação curta em andamento (tiro, faca, dano) e quanto falta.
var _action_anim: StringName = &""
var _action_left := 0.0
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
	melee.swung.connect(func() -> void:
		_play_action(&"Knife", 0.36)
		Events.knife_swung.emit())
	perks.perks_changed.connect(_on_perks_changed)
	var blessings := BlessingSystem.new()
	blessings.player = self
	add_child(blessings)
	Events.max_ammo.connect(func(_at: Vector3) -> void:
		for w in inventory.weapons:
			w.reset_ammo())
	Events.hound_round_changed.connect(_on_hound_round)
	inventory.give(data.starting_weapon)
	health.health_changed.connect(func(current: float, maximum: float) -> void: Events.player_health_changed.emit(current, maximum))
	aim_point = global_position - global_basis.z * 3.0
	# Depois que a cena inteira estiver pronta (a HUD fica pronta por último).
	call_deferred(&"_emit_initial_state")


## Pistola inicial deste mapa (a do PlayerData, ou a do mapa: Hospital começa com a Beretta).
var _start_weapon: WeaponData


func start_weapon_id() -> StringName:
	return (_start_weapon if _start_weapon else data.starting_weapon).id


## Troca a arma inicial pela do mapa (no começo da partida).
func set_start_weapon(weapon_data: WeaponData) -> void:
	if weapon_data == null or weapon_data.id == start_weapon_id():
		return
	_start_weapon = weapon_data
	inventory.reset_to(weapon_data)


## Visual escolhido (cores da jaqueta, mochila e cabelo); trancado volta ao padrão.
func _apply_skin() -> void:
	# O personagem do mapa da partida (sobrevivente no Terminal, paciente no Hospital).
	var catalog := load("res://data/configs/skins.tres") as SkinCatalog
	var skin := catalog.chosen(Session.map_id)
	if skin.is_empty():
		return
	model = CharacterSprite.create("player_%s" % skin.id)
	if model:
		($Pivot/Body as MeshInstance3D).visible = false
		($Pivot/Head as MeshInstance3D).visible = false
		(get_node("Pivot/Hand/Mesh") as MeshInstance3D).visible = false
		pivot.add_child(model)
		model.play(&"Idle", 0.0)
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
	_update_petrify(delta)
	if is_stone():
		velocity = Vector3.ZERO
		move_and_slide()
		return
	if controlled:
		_read_input()
	_regenerate(delta)
	_update_interaction()
	_move(delta)
	_face_aim()
	_check_unstuck(delta)


## Olhar da Górgona: soma à petrificação. Estágios: lento → cinza (metade) → pedra (inteira).
func petrify(amount: float) -> void:
	if is_stone() or not is_alive():
		return
	_last_gazed = _clock
	petrification = minf(1.0, petrification + amount)
	if petrification >= 1.0:
		petrification = 0.0
		_stone_until = _clock + STONE_TIME
		Events.toast.emit("PETRIFICADO! Não olhe para a Górgona")
		Events.screen_shake.emit(0.3, 0.1)
		if model:
			model.tint(STONE_COLOR * 0.85)
			_stone_tint = true


## Virado pedra agora (não anda nem atira).
func is_stone() -> bool:
	return _clock < _stone_until


func _update_petrify(delta: float) -> void:
	if is_stone():
		return
	if petrification > 0.0:
		if _clock - _last_gazed > 0.3:
			petrification = maxf(0.0, petrification - PETRIFY_DECAY * delta)
		# Estágio 1: fica lento; estágio 2 (metade): também vai ficando cinza.
		slow(1.0 - 0.55 * petrification, 0.2)
	# Tinta cinza só enquanto há petrificação (e uma vez para voltar ao normal).
	var grey := clampf((petrification - 0.4) / 0.6, 0.0, 1.0)
	if model and (grey > 0.0 or _stone_tint):
		model.tint(Color.WHITE.lerp(STONE_COLOR, grey))
		_stone_tint = grey > 0.0


## Preso: tentando andar há UNSTUCK_TIME sem sair do lugar e encostado no cenário ou fora do
## navmesh (numa fresta) — volta para o ponto livre mais próximo. Zumbis em volta não contam.
func _check_unstuck(delta: float) -> void:
	if move_input.length() < 0.2 or melee.lunge_left > 0.0:
		_stuck_time = 0.0
		_stuck_from = global_position
		return
	if global_position.distance_to(_stuck_from) > 0.08:
		_stuck_time = 0.0
		_stuck_from = global_position
		return
	_stuck_time += delta
	if _stuck_time < UNSTUCK_TIME:
		return
	_stuck_time = 0.0
	var world3d := get_world_3d()
	if SpawnManager.is_free(world3d, global_position, 0.3) and not SpawnManager.off_navmesh(world3d, global_position, 0.6):
		return
	global_position = SpawnManager.safe_point(world3d, global_position, 0.4) + Vector3.UP * 0.05
	_stuck_from = global_position


## Pega uma arma (compra, Mystery Box...). Devolve a arma que saiu do inventário.
func give_weapon(weapon_data: WeaponData) -> Weapon:
	return inventory.give(weapon_data)


## Atira na direção da mira. Devolve os acertos.
func fire() -> Array[DamageInfo]:
	if not is_alive() or is_stone():
		return []
	_firing = true
	_face_aim()
	var hits := weapon.shoot(get_world_3d().direct_space_state, muzzle.global_position, aim_point, [get_rid()], self)
	if not hits.is_empty():
		Events.shot_connected.emit()
	return hits


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
	# Vale a lentidão mais forte das que estão valendo agora.
	if _clock < _slow_until and _slow_factor < factor:
		_slow_until = maxf(_slow_until, _clock + seconds)
		return
	_slow_factor = factor
	_slow_until = _clock + seconds


## Fator de lentidão valendo agora (1 = velocidade normal).
func slow_factor() -> float:
	return _slow_factor if _clock < _slow_until else 1.0


## Levou dano nos últimos `seconds` segundos?
func hurt_within(seconds: float) -> bool:
	return _clock - _last_hurt_at < seconds


## Golpe de faca na direção da mira.
func knife() -> bool:
	if not is_alive() or is_stone():
		return false
	return melee.swing(self, aim_point - global_position, weapon)


func take_damage(info: DamageInfo) -> float:
	# Invulnerável por um instante só contra golpes (ácido e gás ferem continuamente).
	var is_blow := info.kind == DamageInfo.Kind.ZOMBIE
	if is_blow and _clock < _invulnerable_until:
		return 0.0
	# Golpe de zumbi: fica mais lento por um instante (o golpe "prende").
	if is_blow:
		slow(HIT_SLOW_FACTOR, HIT_SLOW_TIME)
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
		_play_action(&"Hurt", 0.18)
		if is_blow:
			_invulnerable_until = _clock + data.invulnerability_time
		_last_hurt_at = _clock
	return applied


## Nome da folha de uma arma: weapon_<id>, com _mk2/_mk3 depois do Weapon Lab.
static func gun_sheet(weapon_id: StringName, level: int) -> String:
	return "weapon_%s%s" % [weapon_id, "" if level <= 0 else "_mk%d" % (mini(level, 2) + 1)]


## Arma em mãos: camada do sprite da arma (e do nível do Weapon Lab).
func _show_gun(_kind: StringName = &"") -> void:
	if model == null or weapon == null:
		return
	var sheet := gun_sheet(weapon.data.id, weapon.level)
	# No golpe de faca, a faca aparece na mão no lugar da arma.
	var shown := KNIFE_SHEET if _action_anim == &"Knife" and _action_left > 0.0 else sheet
	if shown != _layer_sheet:
		_layer_sheet = shown
		model.set_layer(shown)
		# O tiro e o clarão saem da ponta do cano desenhado (gravada na folha da arma).
		var tip: Variant = model.layer_meta.get("muzzle")
		if shown == sheet and tip is Array and muzzle.get_parent() is Node3D:
			muzzle.position = Vector3(tip[0], tip[1], tip[2]) - (muzzle.get_parent() as Node3D).position
	if sheet == _gun_sheet:
		return
	_gun_sheet = sheet
	announce_weapon()


## Avisa a HUD da arma em mãos e da reserva (também quando a HUD fica pronta depois do jogador).
func announce_weapon() -> void:
	if weapon == null:
		return
	var other := inventory.other()
	Events.weapon_visual_changed.emit(weapon.data.id, weapon.level, other.data.id if other else &"", other.level if other else 0)


## Clarão do disparo: sprite de fogo e luz rápida na boca da arma.
func _muzzle_flash() -> void:
	var at := muzzle.global_position
	PixelFx.spawn(get_tree(), "muzzle", at, 0.55, 1.4)
	var light := OmniLight3D.new()
	light.light_color = Color(1.0, 0.78, 0.4)
	light.light_energy = 2.5
	light.omni_range = 5.0
	SpecialFire.world_root(get_tree()).add_child(light)
	light.global_position = at
	get_tree().create_timer(0.05).timeout.connect(light.queue_free)


## Toca uma animação curta (tiro, faca, dano) por cima da de movimento.
func _play_action(anim: StringName, seconds: float) -> void:
	if model == null:
		return
	_action_anim = anim
	_action_left = seconds
	model.play_once(anim)


## Animação do sprite: caído, ação curta (tiro, faca, dano), recarga, correr/andar ou parado.
func _process(delta: float) -> void:
	if model == null:
		return
	_show_gun()  # troca de arma ou melhoria no Weapon Lab
	if not is_alive() or is_down:
		model.play(&"Death")
		return
	_action_left -= delta
	if _action_left > 0.0:
		return
	if weapon and weapon.reloading:
		model.play(&"Reload")
		return
	var speed := Vector2(velocity.x, velocity.z).length()
	if speed > 3.5:
		model.play(&"Run", 0.15, clampf(speed / 5.0, 0.7, 1.5))
	elif speed > 0.3:
		model.play(&"Walk", 0.15, clampf(speed / 2.5, 0.7, 1.5))
	else:
		model.play(&"Idle")


## Névoa da rodada dos cães: a lanterna fica mais fraca.
func _on_hound_round(active: bool, config: Dictionary) -> void:
	set_flashlight_factor(float(config.get("flashlight_factor", 1.0)) if active else 1.0)


## Alcance/força da lanterna (névoa dos cães, Neblina): 1 = normal.
## Lanterna ligada? Começa ligada; nas salas bem iluminadas dá para desligar.
var flashlight_on := true


## Liga/desliga a lanterna (F / direcional para cima), com clique.
func toggle_flashlight(on: Variant = null) -> void:
	flashlight_on = (not flashlight_on) if on == null else bool(on)
	var flashlight := pivot.get_node_or_null("Flashlight") as SpotLight3D
	if flashlight:
		flashlight.visible = flashlight_on
	Audio.play("weapon_switch", "player", 0.45, 0.0, 1.6 if flashlight_on else 1.3)
	Events.flashlight_toggled.emit(flashlight_on)


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
	# Relativo à tela: com a câmera isométrica, "para cima" é a diagonal do mapa.
	move_input = screen_to_world(Input.get_vector(&"move_left", &"move_right", &"move_up", &"move_down"))
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
		hold_interact(get_physics_process_delta_time() * blessing_speed)
	if Input.is_action_just_pressed(&"melee"):
		knife()
	if Input.is_action_just_pressed(&"flashlight"):
		toggle_flashlight()
	if Input.is_action_just_pressed(&"switch_weapon") or Input.is_action_just_pressed(&"weapon_next") or Input.is_action_just_pressed(&"weapon_prev"):
		inventory.switch_next()
	elif Input.is_action_just_pressed(&"weapon_1"):
		inventory.switch_to(0)
	elif Input.is_action_just_pressed(&"weapon_2"):
		inventory.switch_to(1)


func _move(delta: float) -> void:
	var direction := Vector3(move_input.x, 0.0, move_input.y)
	var slow := slow_factor()
	var speed := data.move_speed * _speed_factor(direction) * perks.speed_multiplier * slow * speed_buff * blessing_speed
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


## Direção da tela (x para a direita, y para baixo) → plano do chão (x, z), pelo giro da câmera.
func screen_to_world(input: Vector2) -> Vector2:
	if camera == null or input == Vector2.ZERO:
		return input
	return input.rotated(-camera.global_rotation.y)


func _update_aim_from_input() -> void:
	var stick := screen_to_world(Input.get_vector(&"aim_left", &"aim_right", &"aim_up", &"aim_down"))
	if stick.length() > 0.3:
		_aim_dir = Vector3(stick.x, 0.0, stick.y).normalized()
		aim_point = global_position + _aim_dir * stick_aim_distance
		aim_point.y = muzzle_height
		return
	if InputBindings.touch_active:
		# Toque: só mover e atirar, sem analógico de mira. Ao atirar, gira sozinho para o zumbi
		# mais perto do cone (mira assistida); sem alvo, vira pra direção em que anda.
		var turn := 1.0 - pow(1.0 - ASSIST_TURN, get_physics_process_delta_time() * 60.0)
		var target := assist_target() if Input.is_action_pressed(&"fire") else null
		if target:
			var to_target := target.global_position - global_position
			to_target.y = 0.0
			_aim_dir = _aim_dir.slerp(to_target.normalized(), turn).normalized()
		else:
			var move_dir := screen_to_world(Input.get_vector(&"move_left", &"move_right", &"move_up", &"move_down"))
			if move_dir.length() > 0.1:
				_aim_dir = _aim_dir.slerp(Vector3(move_dir.x, 0.0, move_dir.y).normalized(), turn).normalized()
		aim_point = global_position + _aim_dir * stick_aim_distance
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


## Mira assistida: o inimigo vivo mais perto dentro do cone da mira e do alcance (ou null).
func assist_target() -> Node3D:
	var best: Node3D = null
	var best_distance := ASSIST_RANGE
	var cone := deg_to_rad(ASSIST_CONE_DEG)
	for node in get_tree().get_nodes_in_group(&"zombies"):
		var enemy := node as Node3D
		if enemy == null or (enemy.has_method(&"is_alive") and not enemy.call(&"is_alive")):
			continue
		var offset := enemy.global_position - global_position
		offset.y = 0.0
		var distance := offset.length()
		if distance < 0.01 or distance > best_distance or absf(_aim_dir.signed_angle_to(offset, Vector3.UP)) > cone:
			continue
		best = enemy
		best_distance = distance
	return best


## Perks mudaram: vida máxima e os modificadores de todas as armas.
func _on_perks_changed() -> void:
	var new_max := data.max_health + perks.max_health_bonus
	if not is_equal_approx(new_max, health.max_health):
		var gained := new_max - health.max_health
		health.max_health = new_max
		health.current = clampf(health.current + maxf(0.0, gained), 0.0, new_max)
		health.health_changed.emit(health.current, health.max_health)
	_apply_weapon_modifiers()
	var ids: Array[StringName] = []
	for perk in perks.owned:
		ids.append(perk.id)
	Events.perks_changed.emit(ids)


func _apply_weapon_modifiers() -> void:
	for w in inventory.weapons:
		w.damage_multiplier = perks.damage_multiplier * fury_multiplier * blessing_damage
		w.headshot_bonus = perks.headshot_bonus
		w.reload_multiplier = perks.reload_multiplier * blessing_reload
		w.spread_multiplier = blessing_spread
		w.crit_chance = blessing_crit


## Reaplica os multiplicadores nas armas (bênçãos, perks, Fúria).
func refresh_weapon_modifiers() -> void:
	_apply_weapon_modifiers()


func _on_weapon_changed(current: Weapon, other: Weapon) -> void:
	_apply_weapon_modifiers()
	if current:
		_show_gun(current.data.kind)
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
	_play_action(&"Shoot", 0.15)
	_muzzle_flash()
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
