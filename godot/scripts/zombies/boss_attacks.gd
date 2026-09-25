class_name BossAttacks
extends RefCounted
## Efeitos dos ataques de área dos bosses (como no jogo web): onda de choque, círculos
## marcados no chão (explosão ou chuva de ácido), vômito ácido em leque e grito.

const BLAST_COLOR := Color(0.84, 0.23, 0.16)
const ACID_COLOR := Color(0.61, 0.81, 0.16)


## Onda de choque: um anel que cresce a partir do boss e fere o jogador quando passa por ele.
static func shockwave(tree: SceneTree, at: Vector3, cfg: Dictionary, player: CharacterBase) -> void:
	# Anel pontilhado em pixel art (raio 1 m, escala = raio atual).
	var ring := PixelShapes.flat("ring", Color(1.0, 0.6, 0.29, 0.9), 1.0)
	SpecialFire.world_root(tree).add_child(ring)
	ring.global_position = Vector3(at.x, 0.15, at.z)
	var radius := float(cfg.get("radius", 7.0))
	var hit := [false]
	var tween := ring.create_tween()
	tween.tween_method(func(t: float) -> void:
		var current := radius * t
		ring.scale = Vector3(maxf(current, 0.05), 1.0, maxf(current, 0.05))
		ring.modulate.a = 0.9 * (1.0 - t)
		if hit[0] or player == null or not player.is_alive():
			return
		var offset := player.global_position - at
		offset.y = 0.0
		if absf(offset.length() - current) <= 1.25:
			hit[0] = true
			player.take_damage(DamageInfo.new(float(cfg.get("damage", 30)), DamageInfo.Kind.ZOMBIE, null, false, at)),
		0.0, 1.0, float(cfg.get("expand_time", 0.65)))
	tween.tween_callback(ring.queue_free)


## Círculos marcados perto do jogador que, no fim do aviso, explodem (ou viram poça de ácido).
static func area(tree: SceneTree, target_at: Vector3, cfg: Dictionary, acid: bool, player: CharacterBase) -> void:
	var spread := float(cfg.get("spread", 4.0))
	var radius := float(cfg.get("radius", 2.0))
	var points: Array[Vector3] = [target_at]
	for i in range(1, int(cfg.get("count", 3))):
		points.append(target_at + Vector3(randf_range(-spread, spread), 0.0, randf_range(-spread, spread)))
	var root := SpecialFire.world_root(tree)
	for point in points:
		var mark := PixelShapes.flat("disc", Color(ACID_COLOR if acid else BLAST_COLOR, 0.3), radius)
		root.add_child(mark)
		mark.global_position = Vector3(point.x, 0.06, point.z)
		var tween := mark.create_tween()
		tween.tween_property(mark, "modulate:a", 1.0, float(cfg.get("telegraph_time", 1.0)))
		tween.tween_callback(func() -> void:
			if acid and cfg.has("pool"):
				ZombieAbilities._spawn_pool_at(root, cfg.pool, ACID_COLOR, point)
			else:
				SpecialFire.flash(tree, point, radius, BLAST_COLOR)
			if player and player.is_alive():
				var offset := player.global_position - point
				offset.y = 0.0
				if offset.length() <= radius + 0.3:
					player.take_damage(DamageInfo.new(float(cfg.get("damage", 30)), DamageInfo.Kind.ZOMBIE, null, false, point))
			mark.queue_free())


## Vômito: poças de ácido em leque à frente do boss.
static func vomit(tree: SceneTree, at: Vector3, facing: Vector3, cfg: Dictionary) -> void:
	var count := int(cfg.get("count", 5))
	var reach := float(cfg.get("range", 8.0))
	var arc := deg_to_rad(float(cfg.get("arc_deg", 50)))
	var forward := Vector3(facing.x, 0.0, facing.z).normalized()
	var root := SpecialFire.world_root(tree)
	for i in count:
		var t := (float(i) / maxf(1.0, count - 1.0)) - 0.5
		var dir := forward.rotated(Vector3.UP, arc * t)
		var point := at + dir * reach * randf_range(0.4, 1.0)
		ZombieAbilities._spawn_pool_at(root, cfg.get("pool", {}), ACID_COLOR, point)


## Grito: deixa o jogador lento (se estiver no raio).
static func scream(at: Vector3, cfg: Dictionary, player: CharacterBase) -> void:
	if player == null or not player.has_method(&"slow"):
		return
	if player.global_position.distance_to(at) <= float(cfg.get("radius", 16.0)):
		player.call(&"slow", float(cfg.get("slow_factor", 0.55)), float(cfg.get("slow_time", 2.5)))
