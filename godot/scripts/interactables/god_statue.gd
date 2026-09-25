class_name GodStatue
extends StaticBody3D
## Uma das 12 estátuas dos deuses do Templo (segredo): segurar E acende a estátua. Com as 12
## acesas na mesma partida, o templo treme e a passagem para o Santuário do Olimpo se abre
## (lá fica o Arco de Artemis); conquista "Os Doze do Olimpo".

const HOLD_TIME := 1.2
const GLOW := Color(1.0, 0.85, 0.45)
const NAMES := {
	&"zeus": "ZEUS", &"hera": "HERA", &"poseidon": "POSEIDON", &"demeter": "DEMÉTER", &"athena": "ATENA", &"apollo": "APOLO",
	&"artemis": "ÁRTEMIS", &"ares": "ARES", &"aphrodite": "AFRODITE", &"hephaestus": "HEFESTO", &"hermes": "HERMES", &"dionysus": "DIONÍSIO",
}

var god: StringName = &"zeus"
var total := 12
var lit := false
var interaction_radius := 1.8
var _hold := 0.0
var _since_hold := 1.0


func _ready() -> void:
	add_to_group(&"god_statues")
	add_to_group(&"interactable")
	collision_layer = PhysicsLayers.WORLD
	collision_mask = 0
	var shape := BoxShape3D.new()
	shape.size = Vector3(1.0, 2.0, 1.0)
	var collision := CollisionShape3D.new()
	collision.shape = shape
	collision.position.y = 1.0
	add_child(collision)
	var art := PropFactory.create("statue_%s" % god)
	add_child(art if art else EventFx.box(Vector3(0.9, 2.0, 0.9), EventFx.glow(Color(0.8, 0.78, 0.72), 1.0, 0.0)))


func _process(delta: float) -> void:
	_since_hold += delta
	if _since_hold > 0.2:
		_hold = 0.0


func get_interaction_prompt(_player: Node3D) -> String:
	if lit:
		return ""
	return "[SEGURE E] ACENDER A ESTÁTUA DE %s  (%d%%)" % [NAMES.get(god, String(god).to_upper()), roundi(_hold / HOLD_TIME * 100.0)]


func interact(_player: Node3D) -> bool:
	return false


func hold_interact(_player: Node3D, delta: float) -> bool:
	if lit:
		return false
	_since_hold = 0.0
	_hold += delta
	if _hold < HOLD_TIME:
		return false
	light_up()
	return true


## Acende a estátua e conta; a 12ª abre o Santuário.
func light_up() -> void:
	if lit:
		return
	lit = true
	remove_from_group(&"interactable")
	var light := EventFx.light(GLOW, 1.2, 4.0)
	light.position.y = 2.2
	add_child(light)
	SpecialFire.flash(get_tree(), global_position + Vector3.UP * 1.5, 1.6, GLOW)
	Audio.play_at("powerup", global_position, "world", 1.1)
	var statues := get_tree().get_nodes_in_group(&"god_statues")
	var found := statues.filter(func(s: Node) -> bool: return (s as GodStatue).lit).size()
	Events.statue_lit.emit(found, total)
	if found < total:
		Events.toast.emit("ESTÁTUA DE %s ACESA (%d/%d)" % [NAMES.get(god, ""), found, total])
		return
	Events.screen_shake.emit(1.2, 0.2)
	Events.power_up_collected.emit(&"statues", "OS DOZE DO OLIMPO", GLOW, "O templo reage... uma passagem se abriu na Floresta.")
	Audio.play("secret_song", "music")
	var world := _find_world()
	if world:
		var gate := world.door_by_id(&"gate_sanctuary")
		if gate:
			gate.open()


func _find_world() -> LayoutMap:
	var node := get_parent()
	while node and not node is LayoutMap:
		node = node.get_parent()
	return node as LayoutMap
