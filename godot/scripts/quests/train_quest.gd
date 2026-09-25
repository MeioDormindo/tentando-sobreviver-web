class_name TrainQuest
extends QuestSystem
## "O Último Trem" (Terminal, só do Godot): o rádio avisa que o trem das 23h40 não pode parar
## e que o Condutor "voltou diferente" dos túneis. Ligar a energia → três peças do sinal da
## estação (fusível no armário da Manutenção, chave no cofre da Bilheteria — atire no cadeado —
## e a manivela que um Blindado carrega) → consertar o sinal da Plataforma e segurá-lo → o
## Condutor enfurecido → pegar a lanterna dele. Prêmio: todos os perks + Lanterna do Condutor.
## Posições na seção "quest.train" do mapa; tempos aqui.

const MAP_ID := "terminal"
const RETRY := 2.0
const AMBER := Color(1.0, 0.72, 0.3)
const CONFIG := {
	"title": "O ÚLTIMO TREM",
	"fuse": {"hold_time": 3.0},
	"signal": {"defend_time": 60.0, "threat_radius": 2.4, "spawn": {"interval_multiplier": 0.55, "max_alive_bonus": 6}},
	"boss_health_multiplier": 1.5,
	"pickup_hold_time": 2.0,
}

var cfg: Dictionary = {}
## Peças coletadas.
var got := {"fuse": false, "key": false, "crank": false}
var lock: Node3D
var carrier: ZombieBase
var signal_running := false
var signal_progress := 0.0
var under_attack := false
var boss_round := 0
var boss_down: Variant = null
var lantern_taken := false

var _carrier_last: Variant = null
var _next_carrier := 0.0
var _crank_spot: QuestSpot
var _signal: Node3D
var _signal_light: OmniLight3D


func _ready() -> void:
	set_physics_process(false)
	# Depois do mapa montado (o mapa trocado pelo menu fica pronto depois deste nó).
	_start.call_deferred()


func _start() -> void:
	if world == null or world.map_id() != MAP_ID:
		return
	cfg = _merge_map_spots(CONFIG, "train")
	if not cfg.has("safe") or not cfg.has("signal") or not cfg.fuse.has("tx"):
		push_warning("TrainQuest: o mapa não tem as posições da missão (quest.train)")
		return
	Events.boss_defeated.connect(func(id: StringName, _n: String, _r: int, at: Vector3) -> void:
		if id == &"conductor" and boss_round > 0:
			boss_down = at)
	set_physics_process(true)
	var power_step := QuestStep.make(
		func() -> String: return "Ligue a energia (disjuntor na Área Técnica)",
		func() -> Variant: return _breaker_position(),
		func(_d: float) -> bool: return _power_on())
	var parts := QuestStep.make(_parts_text, _parts_target, _parts_update, _parts_enter, _clear_spots)
	var defense := QuestStep.make(_signal_text, func() -> Variant: return _at(cfg.signal), _signal_update, _signal_enter, _signal_exit)
	var boss := QuestStep.make(
		func() -> String: return "Derrote o Condutor enfurecido (round %d)" % boss_round,
		func() -> Variant: return null,
		func(_d: float) -> bool: return boss_down != null,
		func() -> void: boss_round = round_manager.force_boss_next_round(float(cfg.get("boss_health_multiplier", 1.5))))
	var lantern := QuestStep.make(
		func() -> String: return "Pegue a Lanterna do Condutor",
		func() -> Variant: return boss_down,
		func(_d: float) -> bool: return lantern_taken,
		_lantern_enter, _clear_spots)
	begin(String(cfg.get("title", "O ÚLTIMO TREM")), [power_step, parts, defense, boss, lantern], _complete)


func _count() -> int:
	return int(got.fuse) + int(got.key) + int(got.crank)


func _collected(what: String) -> void:
	Events.toast.emit("%s (%d/3)" % [what, _count()])


# ── 2. Peças do sinal ──

func _parts_text() -> String:
	return "Peças do sinal %d/3 — fusível (Manutenção) · chave (Bilheteria) · manivela (Blindado)" % _count()


func _parts_target() -> Variant:
	if not got.fuse:
		return _at(cfg.fuse)
	if not got.key:
		return _at(cfg.safe)
	if _crank_spot and is_instance_valid(_crank_spot):
		return _crank_spot.global_position
	if carrier and is_instance_valid(carrier) and carrier.is_alive():
		return carrier.global_position
	return null


func _parts_enter() -> void:
	var fuse := _spot("PEGAR O FUSÍVEL DO SINAL", _at(cfg.fuse), func() -> void:
		got.fuse = true
		_collected("FUSÍVEL COLETADO"), float(cfg.fuse.get("hold_time", 3.0)))
	fuse.name = "SignalFuse"
	fuse.add_prop(Vector3(0.8, 1.8, 0.5), Color(0.3, 0.35, 0.4), 0.05, PropFactory.create("locker"))
	# Cofre da Bilheteria: o cadeado só abre com tiro.
	var safe := _spot("PEGAR A CHAVE DO PAINEL", _at(cfg.safe), func() -> void:
		got.key = true
		_collected("CHAVE DO PAINEL COLETADA"))
	safe.name = "TicketSafe"
	safe.locked_label = "COFRE TRANCADO — ATIRE NO CADEADO"
	safe.enabled = func() -> bool: return lock == null
	safe.add_prop(Vector3(0.8, 0.95, 0.6), Color(0.25, 0.27, 0.3), 0.05, PropFactory.create("safe"))
	lock = _make_lock(safe, func() -> void: lock = null)


func _parts_update(delta: float) -> bool:
	# Blindado com a manivela: surge quando dá e deixa a manivela onde morrer.
	if not got.crank and _crank_spot == null:
		if carrier and is_instance_valid(carrier) and carrier.is_alive():
			_carrier_last = carrier.global_position
		elif carrier != null and _carrier_last is Vector3:
			carrier = null
			_crank_spot = _spot("PEGAR A MANIVELA DO SINAL", _carrier_last, func() -> void:
				got.crank = true
				_collected("MANIVELA COLETADA"))
			_crank_spot.name = "SignalCrank"
			_crank_spot.add_prop(Vector3(0.4, 0.06, 0.1), Color(0.6, 0.45, 0.2), 0.3, PixelShapes.standing("res://assets/sprites/icons/crank.png", 90.0))
		else:
			_next_carrier -= delta
			if _next_carrier <= 0.0:
				_next_carrier = RETRY
				carrier = _spawn_carrier("res://assets/sprites/icons/crank.png", "UM BLINDADO ESTÁ COM A MANIVELA DO SINAL")
				if carrier:
					_carrier_last = carrier.global_position
	return _count() == 3


# ── 3. Sinal da Plataforma ──

func _signal_text() -> String:
	if not signal_running:
		return "Leve as peças ao sinal da Plataforma e conserte"
	var left := ceili(float(cfg.signal.get("defend_time", 60.0)) - signal_progress)
	return "SINAL SOB ATAQUE! Afaste os zumbis (%ds)" % left if under_attack else "Segure o sinal até o trem passar: %ds" % left


func _signal_enter() -> void:
	var at := _at(cfg.signal)
	_signal = Node3D.new()
	_signal.name = "StationSignal"
	world.add_child(_signal)
	_signal.global_position = at
	var art := PropFactory.create("signal_cabinet")
	if art:
		_signal.add_child(art)
	else:
		_signal.add_child(EventFx.box(Vector3(0.8, 1.6, 0.5), EventFx.glow(Color(0.2, 0.3, 0.22), 1.0, 0.05)))
	var spot := _spot("CONSERTAR O SINAL", at + Vector3(0, 0, 1.0), func() -> void:
		signal_running = true
		var spawn: Dictionary = cfg.signal.get("spawn", {})
		round_manager.set_spawn_modifier(&"train_quest", {"spawn_interval_multiplier": spawn.get("interval_multiplier", 0.55), "max_alive_bonus": spawn.get("max_alive_bonus", 6)})
		_signal_light = EventFx.light(AMBER, 1.5, 6.0)
		_signal_light.position.y = 2.4
		_signal.add_child(_signal_light)
		Events.toast.emit("O SINAL ESTÁ LIGADO — SEGURE ATÉ O TREM PASSAR!"))
	spot.name = "SignalRepair"
	spot.interaction_radius = 1.9


func _signal_update(delta: float) -> bool:
	if not signal_running:
		return false
	var at := _at(cfg.signal)
	var threat := float(cfg.signal.get("threat_radius", 2.4))
	under_attack = false
	for node in get_tree().get_nodes_in_group(&"zombies"):
		var zombie := node as CharacterBase
		if zombie and zombie.is_alive() and Vector2(zombie.global_position.x - at.x, zombie.global_position.z - at.z).length() <= threat:
			under_attack = true
			break
	if not under_attack:
		signal_progress += delta
	if _signal_light:
		_signal_light.light_color = Color(1.0, 0.25, 0.2) if under_attack else AMBER
		_signal_light.light_energy = 0.5 + absf(sin(signal_progress * 6.0)) * 1.4
	return signal_progress >= float(cfg.signal.get("defend_time", 60.0))


func _signal_exit() -> void:
	round_manager.set_spawn_modifier(&"train_quest", {})
	if _signal_light:
		_signal_light.light_color = Color(0.3, 1.0, 0.45)
		_signal_light.light_energy = 1.2
	_clear_spots()
	# O trem passa pela estação consertada (se a Plataforma estiver aberta).
	var events := get_tree().get_first_node_in_group(&"world_events") as WorldEventSystem
	if events:
		events.call_train()
	Events.toast.emit("O TREM PASSOU! O Condutor saiu dos túneis...")


# ── 5. Lanterna do Condutor ──

func _lantern_enter() -> void:
	var at: Vector3 = boss_down if boss_down is Vector3 else player.global_position
	var spot := _spot("PEGAR A LANTERNA DO CONDUTOR", Vector3(at.x, 0.0, at.z), func() -> void: lantern_taken = true, float(cfg.get("pickup_hold_time", 2.0)))
	spot.name = "ConductorLantern"
	spot.interaction_radius = 2.2
	spot.add_prop(Vector3(0.3, 0.3, 0.3), AMBER, 1.0, PixelShapes.standing("res://assets/sprites/icons/weapon_conductor_lantern.png", 70.0))


## Fim: todos os perks, a Lanterna do Condutor e a conquista.
func _complete() -> void:
	_grant_rewards(reward_weapon)
	SpecialFire.flash(get_tree(), player.global_position + Vector3.UP, 8.0, AMBER)
	Events.quest_completed.emit(&"train", "O ÚLTIMO TREM PASSOU", "Todos os perks + Lanterna do Condutor. A estação é sua...")
