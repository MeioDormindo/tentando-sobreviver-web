class_name ZombieData
extends Resource
## Dados de um tipo de zumbi (seção 38). Os valores base valem para o round 1; o RoundData
## aplica os multiplicadores de cada round.

@export var id: StringName = &""
@export var display_name: String = "Zumbi"
## Cena instanciada pela ZombieFactory (deve ter um ZombieBase na raiz).
@export var scene: PackedScene
@export var max_health: float = 100.0
## Velocidade (m/s).
@export var move_speed: float = 1.9
@export var damage: float = 10.0
## Distância (m) do centro do zumbi ao do jogador para atacar.
@export var attack_range: float = 1.1
## Intervalo entre ataques (s).
@export var attack_interval: float = 1.0
## Pontos ao ser abatido por arma ou faca.
@export var points_kill: int = 100
## Tábuas arrancadas por golpe na barricada.
@export var plank_damage: int = 1
