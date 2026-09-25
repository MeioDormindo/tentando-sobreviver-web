class_name BreakablePillar
extends StaticBody3D
## Coluna da praça das Ruínas (Templo): para balas e passagem até o Minotauro acertá-la numa
## investida. Aí desaba em pedaços, abre caminho e o mapa refaz a navegação.

const SIZE := Vector3(0.9, 3.0, 0.9)

var world: GameWorld
var broken := false
var _visual: Node3D


func _ready() -> void:
	add_to_group(&"breakable_pillars")
	collision_layer = PhysicsLayers.WORLD
	collision_mask = 0
	var shape := BoxShape3D.new()
	shape.size = SIZE
	var collision := CollisionShape3D.new()
	collision.shape = shape
	collision.position.y = SIZE.y * 0.5
	add_child(collision)
	_set_visual("pillar")


func _set_visual(prop_name: String) -> void:
	if _visual:
		_visual.queue_free()
	_visual = PropFactory.create(prop_name)
	if _visual == null:
		var mesh := MeshInstance3D.new()
		var box := BoxMesh.new()
		box.size = SIZE if prop_name == "pillar" else Vector3(1.0, 0.4, 1.0)
		mesh.mesh = box
		mesh.position.y = box.size.y * 0.5
		_visual = mesh
	add_child(_visual)


## Desaba (investida do Minotauro): vira escombro baixo que não bloqueia, poeira e tremor.
func collapse() -> void:
	if broken:
		return
	broken = true
	collision_layer = 0
	remove_from_group(&"breakable_pillars")
	_set_visual("pillar_rubble")
	PixelFx.spawn(get_tree(), "dust", global_position + Vector3.UP * 0.8, 1.6)
	Events.screen_shake.emit(0.35, 0.14)
	Audio.play_at("explosion", global_position, "world", 0.7)
	if world:
		world.rebake_navigation()
