class_name ScoreData
extends Resource
## Pontuação do ranking (gerado a partir do jogo web). Separada dos pontos de compra:
## recompensa risco e habilidade.

## Pontos por abate de cada tipo (os outros usam kill_default).
@export var kill_points: Dictionary = {}
@export var kill_default: int = 10
## Cada round vale mais: pontos de abate × (1 + round × isto).
@export var per_round_multiplier: float = 0.1
@export var headshot: int = 5
@export var knife_kill: int = 15
## Abate a queima-roupa (m do jogador).
@export var close_range_distance: float = 2.2
@export var close_range_bonus: int = 5
## Abates seguidos dentro da janela rendem um bônus crescente.
@export var multi_kill_window: float = 1.5
@export var multi_kill_bonus_per_step: int = 10
@export var multi_kill_max_steps: int = 5
## Mortes que não são de arma (explosão, gás, trem) valem esta fração.
@export var indirect_factor: float = 0.5
## Round completo: isto × número do round.
@export var round_complete: int = 50
@export var boss: int = 1000
@export var power_up: int = 25
