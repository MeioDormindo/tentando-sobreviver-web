class_name AllySpirit
extends Node3D
## Espírito aliado (bênção de Hades): um morto que volta por alguns segundos do lado do jogador,
## corre até o zumbi mais perto e morde. Não bloqueia ninguém nem leva dano; some ao fim.

const LIFETIME := 10.0
const SPEED := 5.0
const BITE_DAMAGE := 35.0
const BITE_EVERY := 0.8
const BITE_RANGE := 1.2
const GLOW := Color(0.55, 0.8, 1.0)

var owner_player: Node3D
var _left := LIFETIME
var _bite_in := 0.0
var _model: CharacterSprite
var _light: OmniLight3D
var _pulse := 0.0


static func summon(tree: SceneTree, at: Vector3, player: Node3D) -> AllySpirit:
	# Em rede: surge também nos colegas (lá ele corre e morde os fantoches, que não levam dano).
	if Net.world and Net.is_host():
		Net.world.on_spirit(at)
	var spirit := AllySpirit.new()
	spirit.owner_player = player
	SpecialFire.world_root(tree).add_child(spirit)
	spirit.global_position = Vector3(at.x, 0.0, at.z)
	SpecialFire.flash(tree, at + Vector3.UP, 1.5, GLOW)
	return spirit


func _ready() -> void:
	add_to_group(&"ally_spirits")
	_model = CharacterSprite.create("zombie_skeleton")
	if _model:
		add_child(_model)
		_model.tint(Color(GLOW, 0.75))
		_model.play(&"Walk")
	else:
		add_child(EventFx.box(Vector3(0.4, 1.6, 0.3), EventFx.glow(GLOW, 0.6, 1.0)))
	_light = EventFx.light(GLOW, 1.6, 3.5)
	_light.position.y = 1.2
	add_child(_light)
	# Rótulo flutuante: nunca confundir com um zumbi de verdade.
	var label := Label3D.new()
	label.text = "ALIADO"
	label.outline_size = 0
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.pixel_size = 0.0045
	label.font_size = 44
	label.modulate = GLOW
	label.position.y = 2.1
	add_child(label)


func _process(delta: float) -> void:
	_left -= delta
	if _left <= 0.0:
		SpecialFire.flash(get_tree(), global_position + Vector3.UP, 1.0, GLOW)
		queue_free()
		return
	_pulse += delta * 4.0
	if _light:
		_light.light_energy = 1.6 + sin(_pulse) * 0.5
	var target := _nearest_zombie()
	if target == null:
		return
	var to := target.global_position - global_position
	to.y = 0.0
	if to.length() > BITE_RANGE:
		global_position += to.normalized() * minf(SPEED * delta, to.length() - BITE_RANGE * 0.8)
		rotation.y = atan2(-to.x, -to.z)
		return
	_bite_in -= delta
	if _bite_in <= 0.0:
		_bite_in = BITE_EVERY
		target.take_damage(DamageInfo.new(BITE_DAMAGE, DamageInfo.Kind.MELEE, owner_player if is_instance_valid(owner_player) else null, false, target.global_position))
		if _model:
			_model.play_once(&"Attack", 0.05)


func _nearest_zombie() -> CharacterBase:
	var best: CharacterBase = null
	for node in get_tree().get_nodes_in_group(&"zombies"):
		var zombie := node as CharacterBase
		if zombie and zombie.is_alive() and (best == null or zombie.global_position.distance_to(global_position) < best.global_position.distance_to(global_position)):
			best = zombie
	return best
