class_name ScoreManager
extends Node
## Pontuação do ranking (como no jogo web; separada dos pontos de compra): abates por tipo
## valendo mais a cada round, headshot, faca, queima-roupa, sequência de abates, round
## completo e boss. Mortes indiretas (explosão, gás) valem uma fração. Cada jogador soma o seu
## (abates pagam quem matou; round, chefe e power-up, todos); o score do time é a soma.

## Um jogador ganhou score (anti-trapaça: limite por jogador).
signal gained(peer: int, amount: int)

@export var data: ScoreData

## Score do time (no solo, o do jogador). Atribuir mexe no do jogador local sem passar pelo
## sistema — é o que um editor de memória faria, e o anti-trapaça percebe.
var score: int:
	get:
		var total := 0
		for value: int in _scores.values():
			total += value
		return total
	set(value):
		var peer := PointsManager._local_peer()
		_scores[peer] = value - (score - int(_scores.get(peer, 0)))

## peer → score, cópia de verificação e sequência de abates [quantos, quando foi o último].
var _scores: Dictionary = {}
var _guards: Dictionary = {}
var _streaks: Dictionary = {}

var _round := 1
var _clock := 0.0
## Lua de Sangue: score multiplicado.
var _event_multiplier := 1.0


func _ready() -> void:
	Events.reward_multiplier_changed.connect(func(value: float) -> void: _event_multiplier = value)
	Events.zombie_killed.connect(_on_kill)
	Events.round_started.connect(func(n: int, _total: int) -> void: _round = maxi(1, n))
	Events.round_completed.connect(func(n: int) -> void: add_all(data.round_complete * n))
	Events.power_up_collected.connect(func(_id: StringName, _n: String, _c: Color, _d: String) -> void: add_all(data.power_up))
	Events.boss_defeated.connect(func(_id: StringName, _n: String, _r: int, _at: Vector3) -> void: add_all(data.boss))


func _process(delta: float) -> void:
	_clock += delta


## Score de um jogador (null = o local).
func score_of(who: Node) -> int:
	return int(_scores.get(PointsManager._peer(who), 0))


## Soma para `who` (null = o jogador local).
func add(points: float, who: Node = null) -> void:
	var delta := roundi(points * _event_multiplier)
	if delta <= 0:
		return
	var peer := PointsManager._peer(who)
	var value := int(_scores.get(peer, 0)) + delta
	_scores[peer] = value
	if not _guards.has(peer):
		_guards[peer] = AntiCheat.Guard.new(0)
	(_guards[peer] as AntiCheat.Guard).set_value(value)
	gained.emit(peer, delta)
	# A HUD mostra o score do time.
	Events.score_changed.emit(score, delta)


## Soma para cada jogador (round completo, chefe, power-up).
func add_all(points: float) -> void:
	if not Players.coop():
		add(points)
		return
	for player in Players.all():
		add(points, player)


## Os scores batem com as cópias de verificação (anti-trapaça)?
func intact() -> bool:
	for peer: int in _scores:
		var guard := _guards.get(peer) as AntiCheat.Guard
		if guard == null:
			if int(_scores[peer]) != 0:
				return false
		elif not guard.matches(int(_scores[peer])):
			return false
	return true


func _on_kill(zombie: Node3D, info: DamageInfo) -> void:
	var type: StringName = (zombie as ZombieBase).data.id if zombie is ZombieBase else &""
	var points := float(data.kill_points.get(type, data.kill_default)) * (1.0 + _round * data.per_round_multiplier)
	var killer := info.source as Player
	if info.kind in [DamageInfo.Kind.WEAPON, DamageInfo.Kind.MELEE, DamageInfo.Kind.BURN]:
		if info.is_headshot:
			points += data.headshot
		if info.kind == DamageInfo.Kind.MELEE:
			points += data.knife_kill
		var shooter: Node3D = killer if killer else Players.local_player()
		if shooter and zombie.global_position.distance_to(shooter.global_position) <= data.close_range_distance:
			points += data.close_range_bonus
		# Sequência (de cada jogador): abates seguidos dentro da janela rendem um bônus crescente.
		var peer := PointsManager._peer(killer)
		var streak: Array = _streaks.get(peer, [0, -INF])
		streak[0] = int(streak[0]) + 1 if _clock - float(streak[1]) <= data.multi_kill_window else 0
		streak[1] = _clock
		_streaks[peer] = streak
		if int(streak[0]) > 0:
			points += mini(int(streak[0]), data.multi_kill_max_steps) * data.multi_kill_bonus_per_step
			if int(streak[0]) >= 2 and (killer == null or killer.is_local):
				Events.toast.emit("MULTI x%d" % (int(streak[0]) + 1))
	else:
		points *= data.indirect_factor
	add(points, killer)
