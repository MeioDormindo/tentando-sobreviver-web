extends Node3D
## Cena da partida: troca o mapa pelo escolhido no menu (Session.map_id) antes de os nós
## ficarem prontos, cria um jogador por pessoa da Session.roster e liga ao jogador desta máquina
## quem depende dele (câmera, HUD, áudio, minimapa). Em `_enter_tree` os filhos ainda não
## entraram na árvore: o mapa antigo sai sem nunca ser montado.

const PLAYER_SCENE := "res://scenes/player/player.tscn"


func _enter_tree() -> void:
	_swap_world()
	var local := _create_players()
	bind_local_player(local)


func _swap_world() -> void:
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
	# Referências que apontavam para o mapa antigo (todo sistema com `world`, e a arena do
	# GameManager).
	for child in get_children():
		if child != world and &"world" in child:
			child.set(&"world", world)
	($GameManager as GameManager).arena = world


## O nó "Player" da cena é o do host (peer 1); cada colega da roster vira "Player<peer>" logo
## depois dele. Devolve o jogador desta máquina.
func _create_players() -> Player:
	var host := get_node("Player") as Player
	var local: Player = host
	var roster := Session.roster
	if roster.is_empty():
		return host
	var after: Node = host
	for entry: Dictionary in roster:
		var peer := int(entry.get("peer", 1))
		var someone := host
		if peer != 1:
			someone = (load(PLAYER_SCENE) as PackedScene).instantiate() as Player
			someone.name = "Player%d" % peer
			after.add_sibling(someone)
			after = someone
		someone.peer_id = peer
		someone.player_name = String(entry.get("name", ""))
		someone.skin_id = String(entry.get("skin", ""))
		someone.is_local = peer == Session.local_peer
		someone.controlled = someone.is_local and not bool(entry.get("bot", false))
		if bool(entry.get("ai", false)):
			var brain := CompanionBot.new()
			brain.name = "CompanionBot"
			brain.player = someone
			someone.add_child(brain)
		if someone.is_local:
			local = someone
	return local


## Liga câmera, oclusão e os sistemas que acompanham "o jogador" ao jogador desta máquina.
func bind_local_player(local: Player) -> void:
	var camera := get_node_or_null("Camera") as TopDownCamera
	for someone in get_children():
		if someone is Player:
			(someone as Player).camera = camera if someone == local else null
	if camera:
		camera.target = local
		var occlusion := camera.get_node_or_null("Occlusion")
		if occlusion:
			occlusion.set(&"target", local)
	for child in get_children():
		if child is Player or child is Camera3D:
			continue
		if &"player" in child:
			child.set(&"player", local)
		elif child is SpawnManager:
			(child as SpawnManager).target = local
	if local.is_inside_tree():
		Events.local_player_ready.emit(local)
	else:
		(func() -> void: Events.local_player_ready.emit(local)).call_deferred()
