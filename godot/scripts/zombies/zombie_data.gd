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
## Raio do corpo (m).
@export var body_radius: float = 0.375
## Pode ser empurrado (faca, explosões, vento). Tank e Blindado não.
@export var pushable: bool = true

@export_group("Habilidades")
## Explode perto do alvo e ao morrer (Exploder): damage, radius, trigger_range, fuse_time.
@export var explosive: Dictionary = {}
## Cospe à distância (Cuspidor): min_range, max_range, cooldown_time, windup_time,
## projectile_speed e pool {radius, duration_time, dps}.
@export var ranged: Dictionary = {}
## Armadura (Blindado): hp e body_factor (fração do dano no corpo que passa).
@export var armor: Dictionary = {}
## Nuvem de gás ao morrer (Rastejante): radius, duration_time, dps.
@export var death_cloud: Dictionary = {}
## Pega fogo ao morrer e não deixa corpo (Cão Infernal).
@export var burns_on_death: bool = false

@export_group("Aparência (provisória)")
@export var shirt_color: Color = Color(0.37, 0.33, 0.26)
@export var skin_color: Color = Color(0.42, 0.46, 0.37)
@export var model_scale: float = 1.0
## Anda rastejando (corpo e cabeça baixos).
@export var crawls: bool = false
