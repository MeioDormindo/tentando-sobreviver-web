class_name AntiCheat
extends Node
## Anti-trapaça da partida (como no jogo web):
## 1. ganho único ou soma em 10s de pontos/score muito acima do possível para o round;
## 2. pontos/score alterados por fora (depurador, editor de memória): a cópia mascarada não bate.
## Na primeira detecção a partida fica invalidada (não vale save nem ranking) e a HUD zoa.

@export var data: AntiCheatData
@export var points_manager: PointsManager
@export var score_manager: ScoreManager

var flagged: bool = false
var taunt: String = ""

var _round := 1
var _clock := 0.0
var _points_gains: Array = []
var _score_gains: Array = []
var _next_check := 0.0


func _ready() -> void:
	Events.round_started.connect(func(n: int, _t: int) -> void: _round = maxi(1, n))
	Events.points_changed.connect(func(_total: int, delta: int) -> void:
		_check_gain(delta, _points_gains, data.points_event_base, data.points_event_per_round, data.points_window_base, data.points_window_per_round))
	Events.score_changed.connect(func(_total: int, delta: int) -> void:
		_check_gain(delta, _score_gains, data.score_event_base, data.score_event_per_round, data.score_window_base, data.score_window_per_round))


func _process(delta: float) -> void:
	_clock += delta
	if _clock >= _next_check:
		_next_check = _clock + data.integrity_check_interval
		_check_integrity()


func _check_gain(delta: int, gains: Array, event_base: int, event_per_round: int, window_base: int, window_per_round: int) -> void:
	_check_integrity()
	if delta <= 0 or flagged:
		return
	gains.append([_clock, delta])
	while not gains.is_empty() and gains[0][0] < _clock - data.window:
		gains.pop_front()
	var sum := 0
	for gain in gains:
		sum += int(gain[1])
	if delta > event_base + event_per_round * _round or sum > window_base + window_per_round * _round:
		_flag()


func _check_integrity() -> void:
	if flagged:
		return
	if (points_manager and not points_manager.intact()) or (score_manager and not score_manager.intact()):
		_flag()


func _flag() -> void:
	flagged = true
	taunt = data.taunts[randi() % data.taunts.size()] if not data.taunts.is_empty() else "HACKER DETECTADO"
	Events.cheat_detected.emit(taunt, data.taunt_subtitle)


## Cópia de verificação de um inteiro (XOR com uma chave sorteada por partida).
class Guard:
	var _key := randi() & 0x3fffffff
	var _mirror := 0

	func _init(value: int) -> void:
		set_value(value)

	func set_value(value: int) -> void:
		_mirror = value ^ _key

	func matches(value: int) -> bool:
		return (value ^ _key) == _mirror
