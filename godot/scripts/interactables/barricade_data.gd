class_name BarricadeData
extends Resource
## Barricadas das janelas (gerado a partir do jogo web).

@export var max_planks: int = 5
## Pontos por tábua reposta.
@export var repair_reward: int = 10
## Tempo segurando E para repor uma tábua (s).
@export var repair_time: float = 1.0
## Levar dano há menos que isto interrompe o conserto (s).
@export var repair_interrupt: float = 0.6
