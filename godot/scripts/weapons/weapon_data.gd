class_name WeaponData
extends Resource
## Dados de uma arma (seção 21). Nova arma = novo .tres, sem mexer no código.
## Os .tres de data/weapons são gerados a partir do jogo web (npm run godot:data).

@export var id: StringName = &""
@export var display_name: String = "Arma"
## Tipo visual (pose, modelo, desenho na parede): pistol, smg, rifle, shotgun...
@export var kind: StringName = &"pistol"
@export var rarity: StringName = &"common"

@export_group("Tiro")
## Dano por projétil (nas espingardas, por chumbo).
@export var damage: float = 35.0
## Tiros por segundo.
@export var fire_rate: float = 4.0
## Segurar o gatilho continua atirando.
@export var automatic: bool = false
## Projéteis por disparo (espingardas > 1).
@export var pellets: int = 1
## Zumbis extras que o tiro atravessa (0 = para no primeiro).
@export var pierce: int = 0
## Desvio máximo do tiro para cada lado (graus).
@export_range(0.0, 45.0) var spread_degrees: float = 2.0
## Coice: desvio extra somado a cada tiro seguido (graus).
@export_range(0.0, 10.0) var recoil_degrees: float = 0.0
## Alcance do tiro (m).
@export var max_range: float = 22.0
## Velocidade do projétil (m/s) das armas especiais que disparam algo visível (granada,
## plasma). 0 = tiro instantâneo.
@export var projectile_speed: float = 0.0
## Multiplicador do dano na cabeça.
@export var headshot_multiplier: float = 1.5
## Tempo (s) girando o cano com o gatilho seguro antes do primeiro tiro (minigun).
@export var spin_up_time: float = 0.0
## Velocidade do jogador enquanto atira (1 = normal).
@export var move_multiplier_while_firing: float = 1.0
## Duas armas: os tiros alternam entre os canos.
@export var akimbo: bool = false
@export var tracer_color: Color = Color(1.0, 0.85, 0.45)

@export_group("Munição")
@export var magazine_size: int = 8
## Munição de reserva ao pegar a arma (máximo).
@export var reserve_ammo: int = 80
## Tempo de recarga (s).
@export var reload_time: float = 1.4

@export_group("Economia")
## Preço na parede (0 = arma inicial).
@export var price: int = 0
## Preço para reabastecer a munição na parede.
@export var ammo_price: int = 0
## Pontos por acerto (estilo CoD).
@export var points_per_hit: int = 10
## Só sai na Mystery Box.
@export var box_only: bool = false
## Só aparece na Mystery Box destes mapas (vazio = todos).
@export var maps: PackedStringArray = PackedStringArray()
## Elemento vendido na parede desta arma (Fase 5/6).
@export var element: StringName = &""
## Nome da versão Mk II quando é especial (Canhão de Vento → Tornado).
@export var upgrade_name: String = ""

@export_group("Especial")
## Mecânica especial das armas da Mystery Box: grenade, flame, arc, plasma, gust.
## Vazio = tiro comum. (As mecânicas especiais entram junto com a Mystery Box.)
@export var special_type: StringName = &""
## Parâmetros da mecânica especial (distâncias em m, tempos em s).
@export var special_params: Dictionary = {}
