class_name WeaponData
extends Resource
## Dados de uma arma (seção 21). Nova arma = novo .tres, sem mexer no código.

@export var id: StringName = &""
@export var display_name: String = "Arma"
## Dano por tiro no corpo.
@export var damage: float = 35.0
## Tiros por segundo.
@export var fire_rate: float = 4.0
## Segurar o gatilho continua atirando.
@export var automatic: bool = false
@export var magazine_size: int = 8
## Munição de reserva ao pegar a arma (máximo).
@export var reserve_ammo: int = 80
## Tempo de recarga (s).
@export var reload_time: float = 1.4
## Desvio máximo do tiro para cada lado (graus).
@export_range(0.0, 45.0) var spread_degrees: float = 2.0
## Coice: desvio extra somado a cada tiro seguido (graus).
@export_range(0.0, 10.0) var recoil_degrees: float = 0.0
## Alcance do tiro (m).
@export var max_range: float = 22.0
## Multiplicador do dano na cabeça.
@export var headshot_multiplier: float = 1.5
## Pontos por acerto (estilo CoD).
@export var points_per_hit: int = 10
