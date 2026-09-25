class_name ElectricTrap
extends MapPanel
## Armadilha elétrica (como no jogo web): paga para eletrificar a grade no chão por um tempo;
## zumbis que passam por ela morrem. Depois recarrega.

var zone: Rect2
var price: int
var active_time: float
var cooldown: float
var tick_time: float

var active_left := 0.0
var _ready_in := 0.0
var _tick := 0.0
var _grate_material: StandardMaterial3D
var _light: OmniLight3D


## `p_zone`: retângulo da grade no plano x/z (m). O painel fica em `position`.
func setup(p_zone: Rect2) -> void:
	var cfg: Dictionary = WorldEventData.shared().interactions.get("trap", {})
	price = int(cfg.get("price", 1000))
	active_time = float(cfg.get("active_time", 15.0))
	cooldown = float(cfg.get("cooldown_time", 45.0))
	tick_time = float(cfg.get("tick_time", 0.18))
	zone = p_zone
	name = "ElectricTrap"
	build("ARMADILHA", Color(0.5, 0.85, 1.0), "panel_trap")


func _ready() -> void:
	# A grade fica no mundo (fora do painel), sobre o retângulo da zona.
	var grate := MeshInstance3D.new()
	grate.name = "Grate"
	var mesh := BoxMesh.new()
	mesh.size = Vector3(zone.size.x, 0.04, zone.size.y)
	_grate_material = StandardMaterial3D.new()
	_grate_material.albedo_color = Color(0.25, 0.27, 0.28)
	_grate_material.emission_enabled = true
	_grate_material.emission = Color(0.5, 0.85, 1.0) * 0.05
	# Grade com faixas zebradas (arte do jogo web).
	if ResourceLoader.exists("res://assets/web/props/trap_grate.png"):
		_grate_material.albedo_color = Color.WHITE
		_grate_material.albedo_texture = load("res://assets/web/props/trap_grate.png")
		_grate_material.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	mesh.material = _grate_material
	grate.mesh = mesh
	add_child(grate)
	grate.top_level = true
	grate.global_position = Vector3(zone.get_center().x, 0.03, zone.get_center().y)
	_light = OmniLight3D.new()
	_light.light_color = Color(0.5, 0.85, 1.0)
	_light.light_energy = 0.0
	_light.omni_range = maxf(zone.size.x, zone.size.y) + 2.0
	grate.add_child(_light)
	_light.position.y = 0.8


func is_active() -> bool:
	return active_left > 0.0


func get_interaction_prompt(_player: Node3D) -> String:
	if is_active():
		return "ARMADILHA ELÉTRICA LIGADA — %ds" % ceili(active_left)
	if _ready_in > 0.0:
		return "ARMADILHA RECARREGANDO — %ds" % ceili(_ready_in)
	return "[E] LIGAR ARMADILHA ELÉTRICA  ·  %d pontos" % price


func interact(_player: Node3D) -> bool:
	if is_active() or _ready_in > 0.0 or not pay(price):
		return false
	activate()
	return true


## Liga sem cobrar (testes).
func activate() -> void:
	active_left = active_time
	_ready_in = active_time + cooldown


func _physics_process(delta: float) -> void:
	_ready_in = maxf(0.0, _ready_in - delta)
	if not is_active():
		return
	active_left -= delta
	if active_left <= 0.0:
		_light.light_energy = 0.0
		_grate_material.emission = Color(0.5, 0.85, 1.0) * 0.05
		return
	_tick -= delta
	if _tick > 0.0:
		return
	_tick = tick_time
	_light.light_energy = randf_range(1.0, 2.2)
	_grate_material.emission = Color(0.62, 0.91, 1.0) * randf_range(0.6, 1.4)
	for node in get_tree().get_nodes_in_group(&"zombies"):
		var zombie := node as ZombieBase
		if zombie == null or not zombie.is_alive():
			continue
		if zone.grow(0.2).has_point(Vector2(zombie.global_position.x, zombie.global_position.z)):
			zombie.take_damage(DamageInfo.new(zombie.health.current + 1.0, DamageInfo.Kind.ENVIRONMENT, self, false, zombie.global_position))
