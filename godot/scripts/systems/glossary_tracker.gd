class_name GlossaryTracker
extends Node
## Glossário (tela GLOSSÁRIO): marca no save o que o jogador encontra na partida — inimigos e
## chefes que chegam perto ou que ele acerta, eventos, power-ups que pega, perks, elementos,
## bênçãos e as mecânicas conforme aparecem. O que ainda não foi encontrado fica como "???".

## Distância em que um inimigo conta como encontrado (m): mais ou menos o que cabe na tela.
const NEAR := 12.0
## Distância em que uma máquina, a Mystery Box, o Weapon Lab ou um rádio contam como achados.
const NEAR_OBJECT := 5.0
const CHECK_EVERY := 0.5

@export var player: Player

var _check := 0.0


func _ready() -> void:
	Events.round_started.connect(func(_n: int, _t: int) -> void:
		for id: String in ["rounds", "points", "barricades", "wall_buy"]:
			Save.see("mechanic:" + id))
	Events.knife_swung.connect(func() -> void: Save.see("mechanic:knife"))
	Events.flashlight_toggled.connect(func(_on: bool) -> void: Save.see("mechanic:flashlight"))
	Events.weapon_changed.connect(func(_current: String, other: String) -> void:
		if other != "":
			Save.see("mechanic:inventory"))
	Events.weapon_dropped.connect(func(_w: Weapon, _at: Vector3) -> void: Save.see("mechanic:inventory"))
	Events.zombie_hit.connect(func(zombie: Node3D, _info: DamageInfo) -> void: _see_enemy(zombie))
	Events.zombie_killed.connect(func(zombie: Node3D, _info: DamageInfo) -> void: _see_enemy(zombie))
	Events.world_event_started.connect(func(id: StringName, _n: String, _h: String, _c: Color) -> void: Save.see("event:%s" % id))
	# A Fúria é um prêmio do Golden Drop, sem entrada própria.
	Events.power_up_collected.connect(func(id: StringName, _n: String, _c: Color, _d: String) -> void:
		Save.see("powerup:%s" % (&"golden" if id == &"fury" else id))
		Save.see("mechanic:power_ups"))
	Events.perks_changed.connect(func(ids: Array[StringName]) -> void:
		for id in ids:
			Save.see("perk:%s" % id))
	Events.weapon_element_changed.connect(func(_w: StringName, element: StringName) -> void:
		if element != &"":
			Save.see("element:%s" % element)
			Save.see("mechanic:elements"))
	Events.blessing_changed.connect(func(god: StringName, _t: String, _c: Color) -> void:
		if god != &"":
			Save.see("blessing:%s" % god)
			Save.see("mechanic:blessings"))
	Events.mystery_box_rolled.connect(func(_fire_sale: bool) -> void: Save.see("mechanic:mystery_box"))
	Events.power_changed.connect(func(on: bool) -> void:
		if on:
			Save.see("mechanic:power"))
	Events.area_opened.connect(func(_id: StringName, _n: String) -> void: Save.see("mechanic:doors"))
	Events.hound_round_changed.connect(func(active: bool, _c: Dictionary) -> void:
		if active:
			Save.see("mechanic:hound_round"))
	Events.boss_incoming.connect(func(_n: String) -> void: Save.see("mechanic:boss_round"))
	Events.quest_state.connect(func(state: Dictionary) -> void:
		if not state.is_empty():
			Save.see("mechanic:quests"))
	Events.teddy_found.connect(func(_f: int, _t: int) -> void: Save.see("mechanic:teddies"))
	Events.statue_lit.connect(func(_f: int, _t: int) -> void: Save.see("mechanic:statues"))
	Events.weapon_visual_changed.connect(func(_id: StringName, level: int, _o: StringName, _ol: int) -> void:
		if level > 0:
			Save.see("mechanic:weapon_lab"))


func _physics_process(delta: float) -> void:
	_check -= delta
	if _check > 0.0 or player == null or not is_instance_valid(player):
		return
	_check = CHECK_EVERY
	var here := player.global_position
	for node in get_tree().get_nodes_in_group(&"zombies"):
		var enemy := node as Node3D
		if enemy and enemy.global_position.distance_to(here) <= NEAR:
			_see_enemy(enemy)
	for node in get_tree().get_nodes_in_group(&"interactable"):
		var thing := node as Node3D
		if thing == null or thing.global_position.distance_to(here) > NEAR_OBJECT:
			continue
		if thing is PerkMachine:
			Save.see("perk:%s" % (thing as PerkMachine).perk.id)
			Save.see("mechanic:perks")
		elif thing is MysteryBox:
			Save.see("mechanic:mystery_box")
		elif thing is WeaponLab:
			Save.see("mechanic:weapon_lab")
		elif thing is LoreRadio:
			Save.see("mechanic:radios")


func _see_enemy(node: Node) -> void:
	if node is ZombieBase:
		Save.see("zombie:%s" % (node as ZombieBase).data.id)
	elif node is Boss:
		Save.see("boss:%s" % (node as Boss).data.id)
