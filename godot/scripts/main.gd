extends Node3D
## Cena da partida: troca o mapa pelo escolhido no menu (Session.map_id) antes de os nós
## ficarem prontos, e aponta para ele quem precisa do mapa. Em `_enter_tree` os filhos
## ainda não entraram na árvore: o mapa antigo sai sem nunca ser montado.


func _enter_tree() -> void:
	var catalog := load("res://data/configs/maps.tres") as MapCatalog
	var wanted := Session.map_id if catalog.maps.has(Session.map_id) else catalog.default_map
	var scene_path := String(catalog.info(wanted).get("scene", ""))
	var current := get_node("World")
	if current.scene_file_path == scene_path:
		return
	var world := (load(scene_path) as PackedScene).instantiate() as GameWorld
	var index := current.get_index()
	remove_child(current)
	current.free()
	world.name = "World"
	add_child(world)
	move_child(world, index)
	# Referências que apontavam para o mapa antigo.
	($SpawnManager as SpawnManager).world = world
	($GameManager as GameManager).arena = world
