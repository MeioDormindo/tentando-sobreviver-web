class_name ScoreManager
extends Node
## Pontuação do ranking (como no jogo web; separada dos pontos de compra): abates por tipo
## valendo mais a cada round, headshot, faca, queima-roupa, sequência de abates, round
## completo e boss. Mortes indiretas (explosão, gás) valem uma fração.

@export var data: ScoreData
## Para o bônus de abate a queima-roupa.
@export var player: Node3D

var score: int = 0

var _round := 1
var _streak := 0
var _last_kill_at := -INF
var _clock := 0.0


func _ready() -> void:
	Events.zombie_killed.connect(_on_kill)
	Events.round_started.connect(func(n: int, _total: int) -> void: _round = maxi(1, n))
	Events.round_completed.connect(func(n: int) -> void: add(data.round_complete * n))
	Events.boss_defeated.connect(func(_id: StringName, _n: String, _r: int, _at: Vector3) -> void: add(data.boss))


func _process(delta: float) -> void:
	_clock += delta


func add(points: float) -> void:
	var delta := roundi(points)
	if delta <= 0:
		return
	score += delta
	Events.score_changed.emit(score, delta)


func _on_kill(zombie: Node3D, info: DamageInfo) -> void:
	var type: StringName = (zombie as ZombieBase).data.id if zombie is ZombieBase else &""
	var points := float(data.kill_points.get(type, data.kill_default)) * (1.0 + _round * data.per_round_multiplier)
	if info.kind in [DamageInfo.Kind.WEAPON, DamageInfo.Kind.MELEE, DamageInfo.Kind.BURN]:
		if info.is_headshot:
			points += data.headshot
		if info.kind == DamageInfo.Kind.MELEE:
			points += data.knife_kill
		if player and zombie.global_position.distance_to(player.global_position) <= data.close_range_distance:
			points += data.close_range_bonus
		# Sequência: abates seguidos dentro da janela rendem um bônus crescente.
		_streak = _streak + 1 if _clock - _last_kill_at <= data.multi_kill_window else 0
		_last_kill_at = _clock
		if _streak > 0:
			points += mini(_streak, data.multi_kill_max_steps) * data.multi_kill_bonus_per_step
			if _streak >= 2:
				Events.toast.emit("MULTI x%d" % (_streak + 1))
	else:
		points *= data.indirect_factor
	add(points)
