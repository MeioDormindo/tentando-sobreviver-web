class_name HoldProgress
extends RefCounted
## "Segurar E" por jogador (barricada, disjuntor, estátua, válvula, missão...): no cooperativo
## cada um enche a própria barra, e dois segurando juntos não somam. No solo, uma barra só.

## id do jogador → segundos segurando.
var _by: Dictionary = {}


## Soma `delta` ao progresso de `who` e devolve o total dele.
func add(who: Node, delta: float) -> float:
	var key := _key(who)
	var value := float(_by.get(key, 0.0)) + delta
	_by[key] = value
	return value


## Progresso de `who` (s).
func of(who: Node) -> float:
	return float(_by.get(_key(who), 0.0))


## Zera o progresso de `who` (null = de todos).
func reset(who: Node = null) -> void:
	if who == null:
		_by.clear()
	else:
		_by.erase(_key(who))


static func _key(who: Node) -> int:
	return who.get_instance_id() if who else 0
