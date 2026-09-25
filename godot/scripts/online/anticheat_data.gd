class_name AntiCheatData
extends Resource
## Anti-trapaça (gerado a partir do jogo web): ganhos de pontos/score muito acima do possível
## para o round invalidam a partida.

@export var points_event_base: int = 15000
@export var points_event_per_round: int = 300
@export var points_window_base: int = 60000
@export var points_window_per_round: int = 1500
@export var score_event_base: int = 5000
@export var score_event_per_round: int = 200
@export var score_window_base: int = 30000
@export var score_window_per_round: int = 2000
## Janela deslizante (s) e intervalo da checagem de integridade (s).
@export var window: float = 10.0
@export var integrity_check_interval: float = 1.0
@export var taunts: PackedStringArray = PackedStringArray()
@export var taunt_subtitle: String = ""
