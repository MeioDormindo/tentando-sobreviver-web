class_name BlessingAltar
extends StaticBody3D
## Altar de bênção (Templo dos Mortos): oferece a bênção de um deus, sorteada a cada round (os
## altares do mapa nunca repetem o mesmo deus). E para receber, por pontos (de graça no evento
## Sangue dos Deuses). Uma bênção por vez: a nova substitui a anterior.

const PRICE := 1500

## Round em que os altares estão de graça (evento Sangue dos Deuses) e o round atual.
static var free_round := -1
static var current_round := 0

var god: StringName = &"zeus"
var interaction_radius := 2.0
var _label: Label3D
var _light: OmniLight3D


func _ready() -> void:
	add_to_group(&"interactable")
	add_to_group(&"blessing_altars")
	collision_layer = PhysicsLayers.WORLD
	collision_mask = 0
	var shape := BoxShape3D.new()
	shape.size = Vector3(1.75, 1.0, 1.06)
	var collision := CollisionShape3D.new()
	collision.shape = shape
	collision.position.y = 0.5
	add_child(collision)
	var art := PropFactory.create("altar")
	add_child(art if art else EventFx.box(Vector3(1.7, 1.0, 1.0), EventFx.glow(Color(0.5, 0.48, 0.44), 1.0, 0.0)))
	_label = Label3D.new()
	_label.outline_size = 0  # a fonte pixel já tem o contorno embutido
	_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	_label.pixel_size = 0.006
	_label.font_size = 52
	_label.position.y = 2.3
	add_child(_label)
	_light = EventFx.light(Color.WHITE, 1.2, 4.0)
	_light.position.y = 1.4
	add_child(_light)
	Events.round_started.connect(func(n: int, _t: int) -> void:
		current_round = n
		reroll())
	reroll.call_deferred()


## Sorteia o deus do altar, sem repetir o de outro altar.
func reroll() -> void:
	if not is_inside_tree():
		return
	var taken: Array = get_tree().get_nodes_in_group(&"blessing_altars").filter(func(a: Node) -> bool: return a != self).map(func(a: Node) -> StringName: return (a as BlessingAltar).god)
	var options: Array = BlessingSystem.GODS.keys().filter(func(g: StringName) -> bool: return not taken.has(g))
	if options.is_empty():
		options = BlessingSystem.GODS.keys()
	set_god(options.pick_random())


func set_god(id: StringName) -> void:
	god = id
	var info: Dictionary = BlessingSystem.GODS[god]
	_label.text = "BÊNÇÃO DE %s" % info.name
	_label.modulate = info.color
	_light.light_color = info.color


func is_free() -> bool:
	return free_round >= 0 and current_round == free_round


func get_interaction_prompt(player: Node3D) -> String:
	var info: Dictionary = BlessingSystem.GODS[god]
	var blessings := _blessings(player)
	if blessings and blessings.active == god:
		return "BÊNÇÃO DE %s ATIVA" % info.name
	return "[E] BÊNÇÃO DE %s — %s: %s  ·  %s" % [info.name, String(info.title).to_upper(), info.hint, "DE GRAÇA" if is_free() else "%d pontos" % PRICE]


func interact(player: Node3D) -> bool:
	var blessings := _blessings(player)
	if blessings == null or blessings.active == god:
		return false
	if not is_free():
		var points := get_tree().get_first_node_in_group(&"points_manager") as PointsManager
		if points == null or not points.spend(PRICE):
			Events.purchase_denied.emit()
			return false
	blessings.grant(god)
	var info: Dictionary = BlessingSystem.GODS[god]
	SpecialFire.flash(get_tree(), global_position + Vector3.UP * 1.4, 2.5, info.color)
	Audio.play("powerup", "ui", 0.9)
	Events.power_up_collected.emit(&"blessing", "BÊNÇÃO DE %s" % info.name, info.color, "%s — %s" % [info.title, info.hint])
	return true


func _blessings(player: Node3D) -> BlessingSystem:
	return player.get_node_or_null("Blessings") as BlessingSystem if player else null
