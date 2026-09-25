class_name SpecialFire
extends RefCounted
## Mecânicas especiais das armas da Mystery Box (como no jogo web):
## - grenade: projétil que explode ao bater (ou no fim do alcance); não fere o jogador;
## - plasma: esfera que atravessa zumbis e explode na parede, atordoando;
## - flame: jato curto (chumbos que atravessam) que incendeia (dano por segundo);
## - arc: raio instantâneo que salta entre zumbis próximos e os atordoa;
## - gust: rajada de vento em cone que fere e arremessa tudo à frente.
## A Weapon chama `fire` depois de gastar a bala; os números vêm de `special_params`.

const EXPLOSION_COLOR := Color(1.0, 0.62, 0.25)
const PLASMA_COLOR := Color(0.45, 0.9, 1.0)
const ARC_COLOR := Color(0.55, 0.85, 1.0)


static func fire(weapon: Weapon, space: PhysicsDirectSpaceState3D, origin: Vector3, direction: Vector3, exclude: Array[RID], shooter: Node) -> Array[DamageInfo]:
	var data := weapon.data
	var params := data.special_params
	match data.special_type:
		&"grenade", &"plasma":
			var projectile := WeaponProjectile.new()
			projectile.setup(weapon, direction, exclude, shooter)
			world_root(weapon.get_tree()).add_child(projectile)
			projectile.global_position = origin
			return []
		&"flame":
			var hits: Array[DamageInfo] = []
			for pellet in maxi(1, data.pellets):
				var dir := direction.rotated(Vector3.UP, deg_to_rad(randf_range(-data.spread_degrees, data.spread_degrees)))
				hits.append_array(weapon.trace(space, origin, dir, exclude, shooter))
			# Bolas de fogo avançando no jato.
			var reach := minf(data.max_range, 6.0)
			for i in 3:
				var puff := PixelFx.spawn(weapon.get_tree(), "flame", origin + direction * (0.4 + i * 0.5), 0.6 + i * 0.25)
				if puff:
					puff.create_tween().tween_property(puff, "global_position", origin + direction * reach * (0.5 + i * 0.25), 0.3)
			for info in hits:
				var zombie := info.target as CharacterBase
				if zombie and zombie.is_alive() and zombie.has_method(&"apply_burn"):
					zombie.call(&"apply_burn", float(params.get("burn_dps", 0)) * weapon.damage_multiplier, float(params.get("burn_time", 0)), shooter)
			return hits
		&"arc":
			return _arc(weapon, space, origin, direction, exclude, shooter)
		&"gust":
			return _gust(weapon, origin, direction, shooter)
	return []


## Onde pôr efeitos e projéteis: a cena atual (ou a raiz, em cenas montadas à mão).
static func world_root(tree: SceneTree) -> Node:
	return tree.current_scene if tree.current_scene else tree.root


## Explosão (granada, plasma): fere os zumbis no raio, com atordoamento opcional. Nunca o jogador.
static func blast(tree: SceneTree, at: Vector3, radius: float, damage: float, stun_time: float, shooter: Node, color: Color) -> Array[DamageInfo]:
	Events.explosion.emit(at, radius)
	var hits: Array[DamageInfo] = []
	for node in tree.get_nodes_in_group(&"zombies"):
		var zombie := node as CharacterBase
		if zombie == null or not zombie.is_alive():
			continue
		var offset := zombie.global_position - at
		offset.y = 0.0
		if offset.length() > radius:
			continue
		var hurtbox := zombie.get_node_or_null("BodyHurtbox") as Hurtbox
		if hurtbox:
			hits.append(hurtbox.receive_hit(damage, 1.0, DamageInfo.Kind.WEAPON, shooter, zombie.global_position))
		if zombie.is_alive():
			if stun_time > 0.0:
				zombie.call(&"stun", stun_time)
			zombie.call(&"apply_knockback", offset.normalized() * 4.0)
	flash(tree, at, radius, color)
	return hits


## Clarão rápido (luz + esfera que cresce e some).
static func flash(tree: SceneTree, at: Vector3, radius: float, color: Color) -> void:
	var root := world_root(tree)
	var light := OmniLight3D.new()
	light.light_color = color
	light.light_energy = 4.0
	light.omni_range = radius * 2.0
	root.add_child(light)
	light.global_position = at + Vector3.UP
	# Explosão em pixel art (fogo que vira fumaça), no tamanho do raio; a luz some junto.
	var boom := PixelFx.spawn(tree, "explosion", at + Vector3.UP * 0.6, maxf(1.2, radius * 2.2))
	if boom:
		boom.modulate = Color.WHITE.lerp(color, 0.25)
	var tween := light.create_tween()
	tween.tween_property(light, "light_energy", 0.0, 0.4)
	tween.tween_callback(light.queue_free)


## Raio: acerta o primeiro zumbi na mira e salta para os mais próximos (dano caindo a cada salto).
static func _arc(weapon: Weapon, space: PhysicsDirectSpaceState3D, origin: Vector3, direction: Vector3, exclude: Array[RID], shooter: Node) -> Array[DamageInfo]:
	var params := weapon.data.special_params
	var hits := weapon.trace(space, origin, direction, exclude, shooter, ARC_COLOR)
	if hits.is_empty():
		return hits
	var stun_time := float(params.get("stun_time", 0))
	var chain_range := float(params.get("chain_range", 0))
	var falloff := float(params.get("chain_falloff", 1))
	var current := hits[0].target as CharacterBase
	var struck: Array[Node] = [current]
	if current and current.is_alive() and current.has_method(&"stun"):
		current.call(&"stun", stun_time)
	var damage := weapon.data.damage * weapon.damage_multiplier
	for i in int(params.get("chains", 0)):
		if current == null:
			break
		damage *= falloff
		var next := _nearest_zombie(weapon.get_tree(), current.global_position, chain_range, struck)
		if next == null:
			break
		weapon.spawn_tracer(current.global_position + Vector3.UP * 1.2, next.global_position + Vector3.UP * 1.2, ARC_COLOR)
		var zap := PixelFx.spawn(weapon.get_tree(), "spark", next.global_position + Vector3.UP * 1.2, 0.7)
		if zap:
			zap.modulate = ARC_COLOR
		var hurtbox := next.get_node_or_null("BodyHurtbox") as Hurtbox
		if hurtbox:
			hits.append(hurtbox.receive_hit(damage, 1.0, DamageInfo.Kind.WEAPON, shooter, next.global_position))
		if next.is_alive():
			next.call(&"stun", stun_time)
		struck.append(next)
		current = next
	return hits


## Vento: tudo no cone à frente leva dano e é arremessado.
static func _gust(weapon: Weapon, origin: Vector3, direction: Vector3, shooter: Node) -> Array[DamageInfo]:
	var params := weapon.data.special_params
	# Redemoinho de vento avançando à frente.
	for i in 2:
		var swirl := PixelFx.spawn(weapon.get_tree(), "wind", origin + direction * (1.0 + i), 1.6 + i * 0.8)
		if swirl:
			swirl.create_tween().tween_property(swirl, "global_position", origin + direction * (3.5 + i * 2.0), 0.35)
	var reach := float(params.get("range", 0))
	var cos_half := cos(deg_to_rad(float(params.get("arc_deg", 60)) * 0.5))
	var flat := Vector3(direction.x, 0.0, direction.z).normalized()
	var hits: Array[DamageInfo] = []
	for node in weapon.get_tree().get_nodes_in_group(&"zombies"):
		var zombie := node as CharacterBase
		if zombie == null or not zombie.is_alive():
			continue
		var offset := zombie.global_position - origin
		offset.y = 0.0
		if offset.length() > reach or (offset.length() > 0.5 and flat.dot(offset.normalized()) < cos_half):
			continue
		var hurtbox := zombie.get_node_or_null("BodyHurtbox") as Hurtbox
		if hurtbox:
			hits.append(hurtbox.receive_hit(float(params.get("damage", 0)) * weapon.damage_multiplier, 1.0, DamageInfo.Kind.WEAPON, shooter, zombie.global_position))
		if zombie.is_alive():
			zombie.call(&"apply_knockback", offset.normalized() * float(params.get("knockback", 0)))
	# Rastro das bordas e do meio do cone.
	for angle in [-0.5, 0.0, 0.5]:
		var edge := flat.rotated(Vector3.UP, acos(cos_half) * 2.0 * angle)
		weapon.spawn_tracer(origin, origin + edge * reach, Color(0.85, 0.95, 1.0))
	return hits


static func _nearest_zombie(tree: SceneTree, from: Vector3, max_distance: float, skip: Array[Node]) -> CharacterBase:
	var best: CharacterBase = null
	var best_distance := max_distance
	for node in tree.get_nodes_in_group(&"zombies"):
		var zombie := node as CharacterBase
		if zombie == null or not zombie.is_alive() or zombie in skip:
			continue
		var distance := zombie.global_position.distance_to(from)
		if distance <= best_distance:
			best = zombie
			best_distance = distance
	return best
