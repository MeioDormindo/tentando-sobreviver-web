class_name Hurtbox
extends Area3D
## Região que recebe tiros (camada "hurtboxes"). Um personagem tem uma para o corpo e outra
## para a cabeça: o raio da arma acerta a primeira que encontrar e a hurtbox entrega o dano
## (com o multiplicador de headshot) ao HealthComponent.

## Instant Kill (power-up): golpes do jogador matam qualquer zumbi (não o boss) de uma vez.
static var insta_kill: bool = false

@export var health: HealthComponent
@export var is_head: bool = false


## Dano final de um acerto (função pura, usada também nos testes).
static func compute_damage(base_damage: float, headshot: bool, headshot_multiplier: float) -> float:
	return base_damage * (headshot_multiplier if headshot else 1.0)


func receive_hit(base_damage: float, headshot_multiplier: float, kind: DamageInfo.Kind, source: Node, hit_position: Vector3) -> DamageInfo:
	var damage := compute_damage(base_damage, is_head, headshot_multiplier)
	if insta_kill and health and kind in [DamageInfo.Kind.WEAPON, DamageInfo.Kind.MELEE] and health.get_parent() is ZombieBase:
		damage = health.current + 1.0
	var info := DamageInfo.new(damage, kind, source, is_head, hit_position)
	info.target = health.get_parent() if health else get_parent()
	if health:
		health.apply_damage(info)
	return info


## Desliga a hurtbox (personagem morto não bloqueia nem recebe tiros).
func disable() -> void:
	set_deferred("collision_layer", 0)
	set_deferred("monitorable", false)
