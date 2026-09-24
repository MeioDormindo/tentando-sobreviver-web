class_name DamageInfo
extends RefCounted
## Um golpe: quanto dano, de onde veio e como. Criado por quem acerta (arma, zumbi, faca) e
## entregue ao HealthComponent do alvo. Serve para pontuação, efeitos e estatísticas.

## Tipo do golpe (define pontos e efeitos): arma, faca, zumbi, ambiente...
enum Kind { WEAPON, MELEE, ZOMBIE, ENVIRONMENT }

var amount: float
var kind: Kind
## Quem causou (jogador, zumbi...). Pode ser nulo.
var source: Node
var is_headshot: bool
var hit_position: Vector3


func _init(p_amount: float = 0.0, p_kind: Kind = Kind.WEAPON, p_source: Node = null, p_headshot: bool = false, p_position: Vector3 = Vector3.ZERO) -> void:
	amount = p_amount
	kind = p_kind
	source = p_source
	is_headshot = p_headshot
	hit_position = p_position
