class_name HitFeedback
extends RefCounted
## Feedback de acerto comum a zumbis e chefes: avisa o jogador que acertou (marcador, som e
## número de dano, só para ele) e faz o corpo "sentir" o tiro (solavanco do sprite).


## Host (ou sozinho): um inimigo levou um golpe. Se foi um jogador com arma ou faca, ele recebe
## o aviso (Player.confirm_hit junta os do mesmo quadro). Queimadura, espírito aliado e
## explosões de zumbi ficam de fora.
static func report(enemy: Node3D, info: DamageInfo, current: float) -> void:
	if not info.source is Player or not info.kind in [DamageInfo.Kind.WEAPON, DamageInfo.Kind.MELEE]:
		return
	var at: Vector3 = info.hit_position if info.hit_position != Vector3.ZERO else enemy.global_position + Vector3.UP * 1.2
	(info.source as Player).confirm_hit(key_of(enemy), at, info.amount, info.is_headshot, current <= 0.0, info.blocked)


## Identifica o alvo nos dois lados da rede (o id do host, ou o do objeto jogando sozinho).
static func key_of(enemy: Node) -> int:
	return int(enemy.get_meta(&"net_id")) if enemy.has_meta(&"net_id") else enemy.get_instance_id()


## Solavanco do sprite: recua `distance` m na direção do golpe e achata/estica, voltando em
## seguida. Os personagens são billboard (o shader ignora rotação), por isso posição e escala.
static func jolt(model: Node3D, direction: Vector3, distance: float, squash: float) -> void:
	if model == null or not model.is_inside_tree():
		return
	var base_position: Vector3 = model.get_meta(&"jolt_base", model.position)
	model.set_meta(&"jolt_base", base_position)
	direction.y = 0.0
	var away := direction.normalized() * distance if direction.length() > 0.01 else Vector3.ZERO
	# Para o pai (o Pivot gira): o deslocamento é no mundo.
	var parent := model.get_parent() as Node3D
	if parent:
		away = parent.global_basis.inverse() * away
	model.position = base_position + away
	model.scale = Vector3(1.0 + squash, 1.0 - squash * 0.8, 1.0 + squash)
	if model.has_meta(&"jolt_tween"):
		var previous: Variant = model.get_meta(&"jolt_tween")
		if previous is Tween and (previous as Tween).is_valid():
			(previous as Tween).kill()
	var tween := model.create_tween().set_parallel().set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_QUAD)
	tween.tween_property(model, "position", base_position, 0.16)
	tween.tween_property(model, "scale", Vector3.ONE, 0.16)
	model.set_meta(&"jolt_tween", tween)
