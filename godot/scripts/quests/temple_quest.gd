class_name TempleQuest
extends QuestSystem
## "O Portão do Submundo" (Templo dos Mortos): ligar o gerador dos arqueólogos → juntar os 3
## Fragmentos de Alma (Necrópole, Floresta e um Esqueleto que carrega o terceiro) → levar um a
## cada altar do Portão do Templo (abre o Templo da Górgona) → o Minotauro, guardião, vem no
## próximo round → pegar a chave do Submundo onde ele caiu → abrir o Portão do Submundo.
## Prêmio: todos os perks + Raio de Zeus (Mk II). Só existe no mapa "temple".

const MAP_ID := "temple"
const RETRY := 2.0
const SOUL := Color(0.6, 0.5, 1.0)
const FRAGMENT_HOLD := 2.0
const ALTAR_HOLD := 1.5
const GATE_HOLD := 3.0
const BOSS_HEALTH := 1.4

var cfg: Dictionary = {}
## Fragmentos: onde estão (necropolis, forest) e o do Esqueleto portador (carrier).
var got := {"necropolis": false, "forest": false, "carrier": false}
var altars_lit := 0
var carrier: ZombieBase
var boss_round := 0
var boss_down: Variant = null
var has_key := false
var gate_open := false

var _carrier_last: Variant = null
var _next_carrier := 0.0
var _carrier_spot: QuestSpot


func _ready() -> void:
	set_physics_process(false)
	_start.call_deferred()


func _start() -> void:
	if world == null or world.map_id() != MAP_ID:
		return
	cfg = _merge_map_spots({}, "gate")
	Events.boss_defeated.connect(func(id: StringName, _n: String, _r: int, at: Vector3) -> void:
		if id == &"minotaur" and boss_round > 0 and boss_down == null:
			boss_down = at)
	set_physics_process(true)
	var power_step := QuestStep.make(
		func() -> String: return "Ligue o gerador dos arqueólogos (Necrópole)",
		func() -> Variant: return _breaker_position(),
		func(_d: float) -> bool: return _power_on())
	var fragments := QuestStep.make(_fragments_text, _fragments_target, _fragments_update, _fragments_enter, _clear_spots)
	var altars := QuestStep.make(
		func() -> String: return "Leve os Fragmentos aos altares do Portão do Templo (%d/3)" % altars_lit,
		_altar_target, func(_d: float) -> bool: return altars_lit >= 3, _altars_enter, _altars_exit)
	var boss := QuestStep.make(
		func() -> String: return "O guardião despertou: derrote o Minotauro (round %d)" % boss_round,
		func() -> Variant: return null,
		func(_d: float) -> bool: return boss_down != null,
		func() -> void: boss_round = round_manager.force_boss_next_round(BOSS_HEALTH, &"minotaur"))
	var key := QuestStep.make(
		func() -> String: return "Pegue a chave do Submundo onde o Minotauro caiu",
		func() -> Variant: return boss_down,
		func(_d: float) -> bool: return has_key, _key_enter, _clear_spots)
	var gate := QuestStep.make(
		func() -> String: return "Abra o Portão do Submundo (sul das Ruínas)",
		func() -> Variant: return _gate_position(&"gate_underworld"),
		func(_d: float) -> bool: return gate_open, _gate_enter, _clear_spots)
	begin("O PORTÃO DO SUBMUNDO", [power_step, fragments, altars, boss, key, gate], _complete)


# ── 2. Fragmentos de Alma ──

func _count() -> int:
	return int(got.necropolis) + int(got.forest) + int(got.carrier)


func _fragments_text() -> String:
	return "Fragmentos de Alma %d/3 — Necrópole · Floresta · um Esqueleto os carrega" % _count()


func _fragments_target() -> Variant:
	for key: String in ["necropolis", "forest"]:
		if not got[key] and cfg.get("fragments", {}).has(key):
			return _at(cfg.fragments[key])
	if _carrier_spot and is_instance_valid(_carrier_spot):
		return _carrier_spot.global_position
	if carrier and is_instance_valid(carrier) and carrier.is_alive():
		return carrier.global_position
	return null


func _fragments_enter() -> void:
	var spots: Dictionary = cfg.get("fragments", {})
	for key: String in spots:
		var spot := _spot("PEGAR O FRAGMENTO DE ALMA", _at(spots[key]), _collect.bind(key), FRAGMENT_HOLD)
		spot.name = "Fragment_%s" % key
		spot.add_prop(Vector3(0.3, 0.45, 0.3), SOUL, 1.2, PropFactory.create("soul_fragment"))


func _collect(key: String) -> void:
	got[key] = true
	Events.toast.emit("FRAGMENTO DE ALMA (%d/3)" % _count())
	Audio.play("powerup", "ui", 0.7)


func _fragments_update(delta: float) -> bool:
	# Esqueleto portador: surge quando dá e deixa o fragmento onde morrer.
	if not got.carrier and _carrier_spot == null:
		if carrier and is_instance_valid(carrier) and carrier.is_alive():
			_carrier_last = carrier.global_position
		elif carrier != null and _carrier_last is Vector3:
			carrier = null
			_carrier_spot = _spot("PEGAR O FRAGMENTO DE ALMA", _carrier_last, _collect.bind("carrier"), FRAGMENT_HOLD)
			_carrier_spot.name = "Fragment_carrier"
			_carrier_spot.add_prop(Vector3(0.3, 0.45, 0.3), SOUL, 1.2, PropFactory.create("soul_fragment"))
		else:
			_next_carrier -= delta
			if _next_carrier <= 0.0:
				_next_carrier = RETRY
				carrier = _spawn_carrier("", "UM ESQUELETO CARREGA UM FRAGMENTO DE ALMA", &"skeleton", PropFactory.create("soul_fragment"))
				if carrier:
					_carrier_last = carrier.global_position
	return _count() == 3


# ── 3. Altares do Portão do Templo ──

func _altar_nodes() -> Array:
	return get_tree().get_nodes_in_group(&"soul_altars").filter(func(a: Node) -> bool: return world.is_ancestor_of(a))


func _altar_target() -> Variant:
	for altar: SoulAltar in _altar_nodes():
		if not altar.active:
			return altar.global_position
	return null


func _altars_enter() -> void:
	for altar: SoulAltar in _altar_nodes():
		var spot := _spot("DEPOSITAR UM FRAGMENTO NO ALTAR", altar.global_position + Vector3(0, 0, 1.1), func() -> void:
			altar.activate()
			altars_lit += 1
			Events.toast.emit("ALTAR ACESO (%d/3)" % altars_lit), ALTAR_HOLD)
		spot.interaction_radius = 1.7


func _altars_exit() -> void:
	_clear_spots()
	var gate := (world as LayoutMap).door_by_id(&"gate_temple") if world is LayoutMap else null
	if gate:
		gate.open()
	Events.screen_shake.emit(0.8, 0.16)
	Events.toast.emit("O PORTÃO DO TEMPLO SE ABRIU... ALGO ACORDOU NO LABIRINTO")


# ── 5. Chave do Submundo ──

func _key_enter() -> void:
	var at: Vector3 = boss_down if boss_down is Vector3 else player.global_position
	var spot := _spot("PEGAR A CHAVE DO SUBMUNDO", Vector3(at.x, 0.0, at.z), func() -> void:
		has_key = true
		Events.toast.emit("CHAVE DO SUBMUNDO — abra o portão ao sul das Ruínas"), 1.0)
	spot.name = "UnderworldKey"
	spot.interaction_radius = 2.2
	spot.add_prop(Vector3(0.3, 0.6, 0.1), Color(1.0, 0.5, 0.2), 1.2, PropFactory.create("underworld_key"))


# ── 6. Portão do Submundo ──

func _gate_position(id: StringName) -> Variant:
	var gate := (world as LayoutMap).door_by_id(id) if world is LayoutMap else null
	return gate.global_position if gate else null


func _gate_enter() -> void:
	var at: Variant = _gate_position(&"gate_underworld")
	if not at is Vector3:
		gate_open = true
		return
	var spot := _spot("ABRIR O PORTÃO DO SUBMUNDO", (at as Vector3) + Vector3(0, 0, -2.6), func() -> void:
		var gate := (world as LayoutMap).door_by_id(&"gate_underworld")
		if gate:
			gate.open()
		gate_open = true, GATE_HOLD)
	spot.interaction_radius = 2.4


## Fim: todos os perks, o Raio de Zeus (já no Mk II) e a conquista.
func _complete() -> void:
	_grant_rewards(reward_weapon, 1)
	SpecialFire.flash(get_tree(), player.global_position + Vector3.UP, 8.0, Color(0.6, 0.85, 1.0))
	Events.screen_shake.emit(1.0, 0.18)
	Events.quest_completed.emit(&"temple", "O PORTÃO DO SUBMUNDO ESTÁ ABERTO", "Todos os perks + Raio de Zeus. O que espera lá embaixo?")
