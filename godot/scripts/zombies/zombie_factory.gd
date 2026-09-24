class_name ZombieFactory
extends RefCounted
## Cria zumbis a partir dos dados (seção 18: RoundManager → SpawnManager → ZombieFactory → Zombie).
## Ponto único para, no futuro, reaproveitar zumbis (pooling) ou montar variantes visuais.


static func create(data: ZombieData, target: CharacterBase, health_mult: float, damage_mult: float, speed_mult: float) -> ZombieBase:
	if data == null or data.scene == null:
		push_error("ZombieFactory: ZombieData sem cena")
		return null
	var zombie := data.scene.instantiate() as ZombieBase
	if zombie == null:
		push_error("ZombieFactory: a cena de %s não tem ZombieBase na raiz" % data.id)
		return null
	zombie.setup(data, target, health_mult, damage_mult, speed_mult)
	return zombie
