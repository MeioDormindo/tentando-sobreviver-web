class_name Arena
extends Node3D
## Mapa de teste (seção 39): o blockout vem de uma lista de caixas (chão, paredes,
## obstáculos) e vira corpos estáticos dentro do NavigationRegion3D; depois a malha de
## navegação é gerada. Quando os modelos do Blender chegarem, as caixas saem e a malha
## passa a ser gerada no editor.

## Caixas do blockout (posição do canto e tamanho, em m). Topo abaixo de 0.1 = chão.
@export var blockout: Array[AABB] = []
@export var floor_color: Color = Color(0.22, 0.23, 0.21)
@export var wall_color: Color = Color(0.36, 0.35, 0.32)
@export var obstacle_color: Color = Color(0.42, 0.33, 0.22)
## Altura a partir da qual a caixa é parede (não obstáculo baixo).
@export var wall_height: float = 2.5

@onready var nav_region: NavigationRegion3D = $NavigationRegion3D
@onready var player_spawn: Marker3D = $PlayerSpawn


func _ready() -> void:
	_build_blockout()
	# Síncrono: a malha fica pronta antes do primeiro zumbi nascer.
	nav_region.bake_navigation_mesh(false)


func get_player_spawn() -> Vector3:
	return player_spawn.global_position


func _build_blockout() -> void:
	var materials := {}
	for box in blockout:
		var kind := &"floor" if box.end.y <= 0.1 else (&"wall" if box.size.y >= wall_height else &"obstacle")
		if not materials.has(kind):
			materials[kind] = _material(floor_color if kind == &"floor" else (wall_color if kind == &"wall" else obstacle_color))
		var body := StaticBody3D.new()
		body.name = "%s_%d" % [kind, nav_region.get_child_count()]
		body.collision_layer = PhysicsLayers.WORLD
		body.collision_mask = 0
		var shape := BoxShape3D.new()
		shape.size = box.size
		var collision := CollisionShape3D.new()
		collision.shape = shape
		body.add_child(collision)
		var mesh := BoxMesh.new()
		mesh.size = box.size
		var visual := MeshInstance3D.new()
		visual.mesh = mesh
		visual.material_override = materials[kind]
		body.add_child(visual)
		nav_region.add_child(body)
		body.position = box.get_center()


func _material(color: Color) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = 0.9
	return material
