class_name WorldEvent
extends RefCounted
## Evento do mapa (como no jogo web): id, duração, condições, start/update/end. O
## WorldEventSystem decide quando começa e chama end() ao fim da duração, quando update()
## devolve false ou quando o round acaba (se `ends_with_round`).

var id: StringName
## Duração (s); negativa = até o fim do round ou até o próprio evento terminar.
var duration: float = -1.0
## Termina junto com o round (Horda, Alarme).
var ends_with_round: bool = false
## Começa junto com o round (em vez de depois de um atraso).
var at_round_start: bool = false
var system: WorldEventSystem
## Números do evento (WorldEventData.configs[id]).
var config: Dictionary = {}


func can_start() -> bool:
	return true


func start() -> void:
	pass


## Devolve false para encerrar antes do tempo.
func update(_delta: float) -> bool:
	return true


func end() -> void:
	pass


# ───────────────────────── Rede ─────────────────────────

## Host: o que os colegas precisam para mostrar o evento igual (o que foi sorteado aqui).
func net_params() -> Dictionary:
	return {}


## Colega: só o que se vê e ouve (o host faz o resto e avisa quando acaba).
func client_start(_params: Dictionary) -> void:
	pass


func client_update(_delta: float) -> void:
	pass


func client_end() -> void:
	pass


## Colega: um momento do evento sorteado no host (uma pedra do desabamento).
func client_fx(_args: Array) -> void:
	pass
