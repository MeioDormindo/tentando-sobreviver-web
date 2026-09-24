class_name MysteryBoxData
extends Resource
## Mystery Box (gerado a partir do jogo web).

@export var price: int = 950
@export var fire_sale_price: int = 10
## Duração da roleta (s) e tempo para pegar a arma sorteada (s).
@export var roll_time: float = 3.0
@export var take_time: float = 8.0
## Peso de cada raridade no sorteio.
@export var rarity_weights: Dictionary = {}
## Usos no mesmo lugar antes de a caixa mudar de lugar.
@export var uses_before_move: int = 3
@export var move_out_time: float = 1.6
@export var move_gap_time: float = 1.4
