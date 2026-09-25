class_name ElementEffects
extends RefCounted
## Efeito do elemento da arma quando o tiro acerta (como no jogo web, elementEffects.ts).
## `chance` = probabilidade deste chumbo disparar os efeitos "por disparo" (espingardas
## dividem por chumbo, para dar ~1 vez por tiro).


static func apply(weapon: Weapon, info: DamageInfo, shooter: Node, chance: float) -> void:
	if weapon == null or weapon.element == &"" or info == null:
		return
	var target := info.target as CharacterBase
	if target == null or not is_instance_valid(target):
		return
	var catalog := ElementCatalog.shared()
	var p := catalog.param(weapon.element)
	var color: Color = catalog.info(weapon.element).get("color", Color.WHITE)
	var tree := weapon.get_tree()
	var at := target.global_position + Vector3.UP * 1.0
	var alive := target.is_alive()
	var boss := target is Boss
	match weapon.element:
		&"fire":
			if alive:
				target.call(&"apply_burn", float(p.dps), float(p.burn_time), shooter)
		&"ice":
			if alive and not boss and target.has_method(&"chill"):
				target.call(&"chill", float(p.slow_time), float(p.slow_factor))
				if randf() < float(p.freeze_chance):
					target.call(&"stun", float(p.freeze_time))
					SpecialFire.flash(tree, at, 0.9, color)
		&"light":
			if boss:
				if alive:
					target.take_damage(DamageInfo.new(info.amount * float(p.boss_bonus), DamageInfo.Kind.WEAPON, shooter, false, at))
			elif alive:
				target.call(&"stun", float(p.stun_time))
		&"shadow":
			var player := shooter as CharacterBase
			if player and player.health:
				player.health.heal(minf(float(p.max_heal_per_hit), info.amount * float(p.leech)))
		&"lightning":
			if randf() >= chance:
				return
			_chain(weapon, target, info.amount * float(p.damage_factor), int(p.chains), float(p.range), shooter, color)
		&"explosive":
			if randf() >= chance:
				return
			SpecialFire.blast(tree, target.global_position, float(p.radius), info.amount * float(p.damage_factor), 0.0, shooter, color)
	# Faísca na cor do elemento em cada acerto.
	var spark := PixelFx.spawn(tree, "spark", at, 0.6)
	if spark:
		spark.modulate = color


## Raio que salta do alvo para os `count` zumbis mais perto (um de cada vez).
static func _chain(weapon: Weapon, from: CharacterBase, damage: float, count: int, reach: float, shooter: Node, color: Color) -> void:
	var hit: Array[Node] = [from]
	var current: Node3D = from
	for i in count:
		var best: CharacterBase = null
		var best_distance := reach
		for node in weapon.get_tree().get_nodes_in_group(&"zombies"):
			var zombie := node as CharacterBase
			if zombie == null or zombie in hit or not zombie.is_alive():
				continue
			var d := zombie.global_position.distance_to(current.global_position)
			if d < best_distance:
				best = zombie
				best_distance = d
		if best == null:
			return
		hit.append(best)
		var hurtbox := best.get_node_or_null("BodyHurtbox") as Hurtbox
		if hurtbox:
			hurtbox.receive_hit(damage, 1.0, DamageInfo.Kind.WEAPON, shooter, best.global_position)
		weapon.spawn_tracer(current.global_position + Vector3.UP * 1.1, best.global_position + Vector3.UP * 1.1, color, true)
		current = best
