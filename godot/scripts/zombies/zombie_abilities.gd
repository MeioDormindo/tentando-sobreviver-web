class_name ZombieAbilities
extends Node
## Habilidades especiais de um zumbi, montadas a partir do ZombieData (como no jogo web):
## - explosive (Exploder): perto do alvo arma a explosão (pisca) e explode; também ao morrer;
## - ranged (Cuspidor): a uma distância certa, para, prepara e cospe ácido que vira poça;
## - armor (Blindado): absorve o dano no corpo até quebrar; headshot derruba o capacete;
## - death_cloud (Rastejante): deixa uma nuvem de gás ao morrer;
## - burns_on_death (Cão): pega fogo e não deixa corpo;
## - shield (Hoplita com Escudo, Templo): de frente só passa uma fração do dano (headshot passa);
## - revive (Esqueleto, Templo): às vezes se levanta de novo depois de desmontar (uma vez);
## - ranged com projectile "arrow" (Esqueleto Arqueiro): flecha reta com dano direto.
## O ZombieBase pergunta `override_movement` a cada passo e avisa a morte em `on_death`.

const ACID_COLOR := Color(0.55, 0.85, 0.2)
const GAS_COLOR := Color(0.6, 0.75, 0.35)
const EXPLOSION_COLOR := Color(1.0, 0.55, 0.2)
const ARROW_COLOR := Color(0.55, 0.4, 0.25)
## Raio em volta do ponto de chegada da flecha que ainda acerta o jogador.
const ARROW_HIT_RADIUS := 0.9

var zombie: ZombieBase
var armor_hp: float = 0.0

var _fuse_left := -1.0
var _spit_cooldown := 0.0
var _windup_left := -1.0
var _exploded := false


func setup(p_zombie: ZombieBase) -> void:
	zombie = p_zombie
	name = "Abilities"
	var data := zombie.data
	if not data.armor.is_empty():
		armor_hp = float(data.armor.get("hp", 0))
		zombie.health.damage_filter = _filter_armor
	elif not data.shield.is_empty():
		zombie.health.damage_filter = _filter_shield
	_spit_cooldown = float(data.ranged.get("cooldown_time", 0)) * 0.5


## Devolve true quando a habilidade controla o zumbi neste passo (ele não persegue).
func override_movement(delta: float, to_target: Vector3) -> bool:
	var data := zombie.data
	var distance := to_target.length()
	if not data.explosive.is_empty():
		if _fuse_left >= 0.0:
			_fuse_left -= delta
			zombie.flash(Color(1.0, 0.3, 0.1) if int(_fuse_left * 10.0) % 2 == 0 else Color.WHITE)
			if _fuse_left <= 0.0:
				_explode()
			return true
		if distance <= float(data.explosive.get("trigger_range", 1.4)):
			_fuse_left = float(data.explosive.get("fuse_time", 0.65))
			return true
	if not data.ranged.is_empty():
		_spit_cooldown -= delta
		if _windup_left >= 0.0:
			_windup_left -= delta
			zombie.flash(ARROW_COLOR if String(data.ranged.get("projectile", "")) == "arrow" else ACID_COLOR)
			if _windup_left <= 0.0:
				_windup_left = -1.0
				if String(data.ranged.get("projectile", "")) == "arrow":
					_shoot_arrow(to_target)
				else:
					_spit(to_target)
			return true
		var min_range := float(data.ranged.get("min_range", 4.0))
		var max_range := float(data.ranged.get("max_range", 9.0))
		if _spit_cooldown <= 0.0 and distance >= min_range and distance <= max_range and zombie.has_line_of_sight():
			_windup_left = float(data.ranged.get("windup_time", 0.7))
			return true
	return false


func on_death(_info: DamageInfo) -> void:
	var data := zombie.data
	if not data.explosive.is_empty() and not _exploded:
		_explode()
	if not data.death_cloud.is_empty():
		_spawn_pool(data.death_cloud, GAS_COLOR, zombie.global_position)
	if not data.revive.is_empty() and not zombie.has_meta(&"revived") and randf() < float(data.revive.get("chance", 0.0)):
		_schedule_revive()


## Escudo: de frente (arco `arc_deg` para onde o zumbi olha) só `factor` do dano passa;
## tiro na cabeça, de lado ou de costas passa inteiro.
func _filter_shield(info: DamageInfo) -> float:
	if info.is_headshot or not blocks(info.source):
		return info.amount
	Audio.play_at("armor_hit", zombie.global_position, "zombie", 0.7)
	PixelFx.spawn(zombie.get_tree(), "spark", zombie.global_position + Vector3.UP * 1.1 - zombie.pivot.global_basis.z * 0.4, 0.5)
	return info.amount * float(zombie.data.shield.get("factor", 0.2))


## O escudo cobre quem vem de `source` (de frente, dentro do arco)?
func blocks(source: Node) -> bool:
	if zombie.data.shield.is_empty() or not source is Node3D:
		return false
	var to_source := (source as Node3D).global_position - zombie.global_position
	to_source.y = 0.0
	var forward := -zombie.pivot.global_basis.z
	forward.y = 0.0
	if to_source.length() < 0.01 or forward.length() < 0.01:
		return false
	return rad_to_deg(forward.angle_to(to_source)) <= float(zombie.data.shield.get("arc_deg", 100.0)) * 0.5


## Esqueleto: os ossos ficam no chão e, depois de `delay_time`, ele se levanta com parte da
## vida (entra na conta do round como um zumbi a mais; só uma vez).
func _schedule_revive() -> void:
	var tree := zombie.get_tree()
	var parent := zombie.get_parent()
	var at := zombie.global_position
	var params := zombie.data.revive
	var data := zombie.data
	var target := zombie.target
	var health := zombie.health.max_health * float(params.get("health_factor", 0.5))
	Events.zombies_summoned.emit(1)
	tree.create_timer(float(params.get("delay_time", 2.0))).timeout.connect(func() -> void:
		if not is_instance_valid(parent) or not is_instance_valid(target):
			return
		var risen := ZombieFactory.create(data, target, 1.0, 1.0, 1.0)
		risen.set_meta(&"revived", true)
		parent.add_child(risen)
		risen.global_position = at
		risen.health.reset(health)
		PixelFx.spawn(tree, "dust", at + Vector3.UP * 0.5, 1.2)
		risen.flash(Color(0.8, 0.9, 1.0)))


## Flecha: reta e rápida até onde o alvo está agora; fere quem estiver perto da chegada.
func _shoot_arrow(to_target: Vector3) -> void:
	Audio.play_at("knife_swing", zombie.global_position, "zombie", 0.8)
	var params := zombie.data.ranged
	var from := zombie.global_position + Vector3.UP * 1.3
	var land := zombie.global_position + to_target + Vector3.UP * 1.0
	var arrow := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = Vector3(0.05, 0.05, 0.7)
	var material := StandardMaterial3D.new()
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material.albedo_color = ARROW_COLOR
	mesh.material = material
	arrow.mesh = mesh
	var root := SpecialFire.world_root(zombie.get_tree())
	root.add_child(arrow)
	arrow.global_position = from
	arrow.look_at(land, Vector3.UP)
	var flight := maxf(0.08, from.distance_to(land) / float(params.get("projectile_speed", 18.0)))
	var damage := float(params.get("damage", 12)) * (zombie.attack_damage / maxf(1.0, zombie.data.damage))
	var shooter := zombie
	var tween := arrow.create_tween()
	tween.tween_property(arrow, "global_position", land, flight)
	tween.tween_callback(func() -> void:
		for node in arrow.get_tree().get_nodes_in_group(&"player"):
			var player := node as CharacterBase
			if player and Vector2(player.global_position.x - land.x, player.global_position.z - land.z).length() <= ARROW_HIT_RADIUS:
				player.take_damage(DamageInfo.new(damage, DamageInfo.Kind.ZOMBIE, shooter if is_instance_valid(shooter) else null, false, land))
		arrow.queue_free())
	_spit_cooldown = float(params.get("cooldown_time", 2.6))


## Armadura: o capacete cai com um headshot; no corpo, só `body_factor` do dano passa enquanto
## a armadura aguenta.
func _filter_armor(info: DamageInfo) -> float:
	if armor_hp <= 0.0:
		return info.amount
	if info.is_headshot:
		armor_hp = 0.0
		zombie.break_armor()
		return info.amount
	var factor := float(zombie.data.armor.get("body_factor", 0.25))
	armor_hp -= info.amount
	if armor_hp <= 0.0:
		zombie.break_armor()
		Audio.play_at("armor_break", zombie.global_position, "zombie", 1.0)
	else:
		Audio.play_at("armor_hit", zombie.global_position, "zombie", 0.8)
	return info.amount * factor


## Explosão: fere o jogador (dano cai até 30% na borda) e os zumbis em volta (sem pontos).
func _explode() -> void:
	if _exploded:
		return
	_exploded = true
	var params := zombie.data.explosive
	var radius := float(params.get("radius", 3.0))
	var damage := float(params.get("damage", 45))
	var at := zombie.global_position
	for node in zombie.get_tree().get_nodes_in_group(&"player"):
		var target := node as CharacterBase
		var distance := target.global_position.distance_to(at)
		if distance <= radius:
			target.take_damage(DamageInfo.new(damage * lerpf(1.0, 0.3, distance / radius), DamageInfo.Kind.ENVIRONMENT, zombie, false, at))
	for node in zombie.get_tree().get_nodes_in_group(&"zombies"):
		var other := node as ZombieBase
		if other and other != zombie and other.is_alive() and other.global_position.distance_to(at) <= radius:
			other.take_damage(DamageInfo.new(damage, DamageInfo.Kind.ENVIRONMENT, zombie, false, at))
	SpecialFire.flash(zombie.get_tree(), at, radius, EXPLOSION_COLOR)
	if zombie.is_alive():
		zombie.take_damage(DamageInfo.new(zombie.health.current + 1.0, DamageInfo.Kind.ENVIRONMENT, zombie, false, at))


## Cuspe: um projétil em arco até onde o alvo está agora; ao cair, vira poça de ácido.
func _spit(to_target: Vector3) -> void:
	Audio.play_at("spitter_spit", zombie.global_position, "zombie", 0.9)
	var params := zombie.data.ranged
	var from := zombie.global_position + Vector3.UP * 1.5
	var land := zombie.global_position + to_target
	land.y = 0.0
	# Bolha de ácido em pixel art; sem a arte, uma esfera verde.
	var ball := Node3D.new()
	if PixelFx.attach_loop(ball, "acid", 0.5) == null:
		var fallback := MeshInstance3D.new()
		var mesh := SphereMesh.new()
		mesh.radius = 0.15
		mesh.height = 0.3
		var material := StandardMaterial3D.new()
		material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		material.albedo_color = ACID_COLOR
		mesh.material = material
		fallback.mesh = mesh
		ball.add_child(fallback)
	var root := SpecialFire.world_root(zombie.get_tree())
	root.add_child(ball)
	ball.global_position = from
	var flight := maxf(0.2, from.distance_to(land) / float(params.get("projectile_speed", 8.0)))
	var tween := ball.create_tween()
	tween.tween_method(func(t: float) -> void:
		ball.global_position = from.lerp(land, t) + Vector3.UP * sin(t * PI) * 1.2, 0.0, 1.0, flight)
	var pool_params: Dictionary = params.get("pool", {})
	tween.tween_callback(func() -> void:
		_spawn_pool_at(root, pool_params, ACID_COLOR, land)
		ball.queue_free())
	_spit_cooldown = float(params.get("cooldown_time", 3.2))


func _spawn_pool(params: Dictionary, color: Color, at: Vector3) -> void:
	_spawn_pool_at(SpecialFire.world_root(zombie.get_tree()), params, color, at)


static func _spawn_pool_at(root: Node, params: Dictionary, color: Color, at: Vector3) -> void:
	var pool := HazardPool.new()
	pool.setup(params, color, color == GAS_COLOR)
	root.add_child(pool)
	pool.global_position = Vector3(at.x, 0.0, at.z)
