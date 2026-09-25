class_name SoulAltar
extends StaticBody3D
## Altar do Portão do Templo (Zeus, Poseidon ou Hades): recebe um Fragmento de Alma (a missão
## do Templo cria o ponto de entrega ao lado). Aceso, o cristal brilha em roxo.

const GLOW := Color(0.6, 0.5, 1.0)

var god: StringName = &"zeus"
var active := false
var _crystal: Node3D
var _light: OmniLight3D


func _ready() -> void:
	add_to_group(&"soul_altars")
	collision_layer = PhysicsLayers.WORLD
	collision_mask = 0
	var shape := BoxShape3D.new()
	shape.size = Vector3(1.3, 1.0, 0.9)
	var collision := CollisionShape3D.new()
	collision.shape = shape
	collision.position.y = 0.5
	add_child(collision)
	var art := PropFactory.create("altar_%s" % god)
	if art:
		add_child(art)
		_crystal = art.find_child("soul", true, false) as Node3D
		if _crystal:
			_crystal.visible = false
	else:
		add_child(EventFx.box(Vector3(1.3, 1.0, 0.9), EventFx.glow(Color(0.45, 0.43, 0.4), 1.0, 0.0)))


## Recebe o fragmento: cristal aparece, luz roxa e um lampejo.
func activate() -> void:
	if active:
		return
	active = true
	if _crystal:
		_crystal.visible = true
	_light = EventFx.light(GLOW, 1.4, 4.5)
	_light.position.y = 1.6
	add_child(_light)
	SpecialFire.flash(get_tree(), global_position + Vector3.UP * 1.3, 2.0, GLOW)
	Audio.play_at("powerup", global_position, "world", 0.8)
