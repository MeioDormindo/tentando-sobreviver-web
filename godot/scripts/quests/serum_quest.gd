class_name SerumQuest
extends QuestSystem
## "O Soro do Dr. Almeida" (Hospital, como no jogo web): ligar a energia → três componentes
## (amostras da UTI, reagente do armário trancado da Farmácia — atire no cadeado —, e o
## catalisador da gaveta do Necrotério, que abre com o cartão de um Blindado) → defender a
## centrífuga → Paciente Zero enfurecido → aplicar o soro. Prêmio: todos os perks + Tornado.
## Só existe no mapa "map2" (Hospital).

const MAP_ID := "map2"
const RETRY := 2.0
const SERUM_GREEN := Color(0.61, 0.81, 0.16)


var cfg: Dictionary = {}
## Componentes coletados.
var got := {"fridge": false, "cabinet": false, "drawer": false}
var has_card := false
var lock: Node3D
var armored: ZombieBase
var centrifuge_running := false
var centrifuge_progress := 0.0
var under_attack := false
var boss_round := 0
var boss_down: Variant = null
var applied := false

var _armored_last: Variant = null
var _next_armored := 0.0
var _card_spot: QuestSpot
var _centrifuge: Node3D
var _centrifuge_light: OmniLight3D


func _ready() -> void:
	set_physics_process(false)
	# Depois do mapa montado (o mapa trocado pelo menu fica pronto depois deste nó).
	_start.call_deferred()


func _start() -> void:
	if world == null or world.map_id() != MAP_ID or data == null:
		return
	# Onde fica cada peça vem do mapa (seção "quest"); tempos e regras, do quests.tres.
	cfg = _merge_map_spots(data.serum, "serum")
	Events.boss_defeated.connect(func(id: StringName, _n: String, _r: int, at: Vector3) -> void:
		if id == &"patient_zero" and boss_round > 0:
			boss_down = at)
	set_physics_process(true)
	var power_step := QuestStep.make(
		func() -> String: return "Ligue a energia (disjuntor no Necrotério)",
		func() -> Variant: return _breaker_position(),
		func(_d: float) -> bool: return _power_on())
	var components := QuestStep.make(_components_text, _components_target, _components_update, _components_enter, _clear_spots)
	var defense := QuestStep.make(_defense_text, func() -> Variant: return _at(cfg.centrifuge), _defense_update, _defense_enter, _defense_exit)
	var boss := QuestStep.make(
		func() -> String: return "Derrote o Paciente Zero enfurecido (round %d)" % boss_round,
		func() -> Variant: return null,
		func(_d: float) -> bool: return boss_down != null,
		func() -> void: boss_round = round_manager.force_boss_next_round(float(cfg.get("boss_health_multiplier", 1.5))))
	var apply := QuestStep.make(
		func() -> String: return "Aplique o soro no Paciente Zero",
		func() -> Variant: return boss_down,
		func(_d: float) -> bool: return applied,
		_apply_enter, _clear_spots)
	begin(String(cfg.get("title", "O SORO")), [power_step, components, defense, boss, apply], _complete)


func _count() -> int:
	return int(got.fridge) + int(got.cabinet) + int(got.drawer)


func _collected(what: String) -> void:
	Events.toast.emit("%s (%d/3)" % [what, _count()])


# ── 2. Componentes (1. Energia usa as peças do QuestSystem) ──

func _components_text() -> String:
	return "Componentes do soro %d/3 — UTI · Farmácia · cartão do Blindado" % _count()


func _components_target() -> Variant:
	if not got.fridge:
		return _at(cfg.fridge)
	if not got.cabinet:
		return _at(cfg.cabinet)
	if has_card or got.drawer:
		return _at(cfg.drawer)
	if _card_spot and is_instance_valid(_card_spot):
		return _card_spot.global_position
	if armored and is_instance_valid(armored) and armored.is_alive():
		return armored.global_position
	return _at(cfg.drawer)


func _components_enter() -> void:
	var fridge := _spot("PEGAR AS AMOSTRAS", _at(cfg.fridge), func() -> void:
		got.fridge = true
		_collected("AMOSTRAS COLETADAS"), float(cfg.fridge.get("hold_time", 4.0)))
	fridge.name = "SampleFridge"
	fridge.add_prop(Vector3(0.9, 1.6, 0.6), Color(0.8, 0.85, 0.9), 0.15, PropFactory.create("sample_fridge"))
	# Armário trancado: o cadeado só abre com tiro.
	var cabinet := _spot("PEGAR O REAGENTE", _at(cfg.cabinet), func() -> void:
		got.cabinet = true
		_collected("REAGENTE COLETADO"))
	cabinet.name = "MedCabinet"
	cabinet.locked_label = "ARMÁRIO TRANCADO — ATIRE NO CADEADO"
	cabinet.enabled = func() -> bool: return lock == null
	cabinet.add_prop(Vector3(1.0, 1.4, 0.5), Color(0.75, 0.78, 0.74), 0.05, PropFactory.create("med_cabinet"))
	lock = _make_lock(cabinet, func() -> void: lock = null)
	var drawer := _spot("ABRIR A GAVETA COM O CARTÃO", _at(cfg.drawer), func() -> void:
		got.drawer = true
		_collected("CATALISADOR COLETADO"))
	drawer.name = "MorgueDrawer"
	drawer.locked_label = "GAVETA TRANCADA — PRECISA DO CARTÃO DE ACESSO"
	drawer.enabled = func() -> bool: return has_card


func _components_update(delta: float) -> bool:
	# Blindado com o cartão: surge quando dá e deixa o cartão onde morrer.
	if not has_card and not got.drawer and _card_spot == null:
		if armored and is_instance_valid(armored) and armored.is_alive():
			_armored_last = armored.global_position
		elif armored != null and _armored_last is Vector3:
			armored = null
			_card_spot = _spot("PEGAR O CARTÃO DE ACESSO", _armored_last, func() -> void:
				has_card = true
				Events.toast.emit("CARTÃO DE ACESSO — abra a gaveta do Necrotério"))
			_card_spot.name = "Keycard"
			_card_spot.add_prop(Vector3(0.3, 0.04, 0.2), Color(0.3, 0.6, 1.0), 0.8, PixelShapes.standing("res://assets/web/props/keycard.png", 56.0))
		else:
			_next_armored -= delta
			if _next_armored <= 0.0:
				_next_armored = RETRY
				_spawn_armored()
	return _count() == 3


func _spawn_armored() -> void:
	armored = _spawn_carrier("res://assets/web/props/keycard.png", "UM SEGURANÇA BLINDADO ESTÁ COM O CARTÃO DE ACESSO")
	if armored:
		_armored_last = armored.global_position


# ── 3. Centrífuga ──

func _defense_text() -> String:
	if not centrifuge_running:
		return "Leve os componentes à centrífuga do Laboratório"
	var left := ceili(float(cfg.centrifuge.get("defend_time", 60.0)) - centrifuge_progress)
	return "CENTRÍFUGA SOB ATAQUE! Afaste os zumbis (%ds)" % left if under_attack else "Defenda a centrífuga: %ds" % left


func _defense_enter() -> void:
	var at := _at(cfg.centrifuge)
	_centrifuge = Node3D.new()
	_centrifuge.name = "Centrifuge"
	world.add_child(_centrifuge)
	_centrifuge.global_position = at
	# Centrífuga em pixel art (PropFactory) num nó "Drum" que gira; sem a arte, um cilindro.
	var mesh := Node3D.new()
	mesh.name = "Drum"
	_centrifuge.add_child(mesh)
	var art := PropFactory.create("centrifuge")
	if art:
		mesh.add_child(art)
	else:
		var drum := CylinderMesh.new()
		drum.top_radius = 0.45
		drum.bottom_radius = 0.55
		drum.height = 1.0
		drum.material = EventFx.glow(Color(0.7, 0.72, 0.7), 1.0, 0.05)
		var cylinder := MeshInstance3D.new()
		cylinder.mesh = drum
		cylinder.position.y = 0.5
		mesh.add_child(cylinder)
	var bar := EventFx.box(Vector3(1.2, 0.08, 0.12), EventFx.glow(SERUM_GREEN, 1.0, 0.6))
	bar.position.y = 1.05
	mesh.add_child(bar)
	var spot := _spot("COLOCAR OS COMPONENTES NA CENTRÍFUGA", at + Vector3(0, 0, 1.0), func() -> void:
		centrifuge_running = true
		var spawn: Dictionary = cfg.centrifuge.get("spawn", {})
		round_manager.set_spawn_modifier(&"serum", {"spawn_interval_multiplier": spawn.get("interval_multiplier", 0.55), "max_alive_bonus": spawn.get("max_alive_bonus", 6)})
		_centrifuge_light = EventFx.light(SERUM_GREEN, 1.5, 5.0)
		_centrifuge_light.position.y = 1.4
		_centrifuge.add_child(_centrifuge_light)
		Events.toast.emit("A CENTRÍFUGA ESTÁ GIRANDO — DEFENDA!"))
	spot.interaction_radius = 1.9


func _defense_update(delta: float) -> bool:
	if not centrifuge_running:
		return false
	var at := _at(cfg.centrifuge)
	var threat := float(cfg.centrifuge.get("threat_radius", 2.2))
	under_attack = false
	for node in get_tree().get_nodes_in_group(&"zombies"):
		var zombie := node as CharacterBase
		if zombie and zombie.is_alive() and Vector2(zombie.global_position.x - at.x, zombie.global_position.z - at.z).length() <= threat:
			under_attack = true
			break
	if not under_attack:
		centrifuge_progress += delta
	var drum := _centrifuge.get_node("Drum") as Node3D
	drum.rotation.y += (0.6 if under_attack else 7.0) * delta
	if _centrifuge_light:
		_centrifuge_light.light_energy = 0.4 + 1.0 * absf(sin(centrifuge_progress * 12.0)) if under_attack else 1.5
	return centrifuge_progress >= float(cfg.centrifuge.get("defend_time", 60.0))


func _defense_exit() -> void:
	round_manager.set_spawn_modifier(&"serum", {})
	if _centrifuge_light:
		_centrifuge_light.light_energy = 0.6
	_clear_spots()
	Events.toast.emit("SORO PRONTO! O Paciente Zero sentiu o cheiro...")


# ── 5. Aplicar o soro ──

func _apply_enter() -> void:
	var at: Vector3 = boss_down if boss_down is Vector3 else player.global_position
	var spot := _spot("APLICAR O SORO", Vector3(at.x, 0.0, at.z), func() -> void: applied = true, float(cfg.get("apply_hold_time", 3.0)))
	spot.name = "SerumVial"
	spot.interaction_radius = 2.2
	spot.add_prop(Vector3(0.12, 0.3, 0.12), SERUM_GREEN, 1.0, PixelShapes.standing("res://assets/web/props/serum_vial.png", 56.0))


## Fim: todos os perks, o Tornado (Canhão de Vento já no Mk II, como no jogo web) e a conquista.
func _complete() -> void:
	_grant_rewards(reward_weapon, 1)
	SpecialFire.flash(get_tree(), player.global_position + Vector3.UP, 8.0, SERUM_GREEN)
	Events.quest_completed.emit(&"serum", "VOCÊ CUROU O PACIENTE ZERO", "Todos os perks + Tornado. A luta continua...")
