class_name QuestStep
extends RefCounted
## Uma etapa da missão (como no jogo web): texto do objetivo, onde fica (minimapa) e quando
## termina. As funções são Callables para cada missão montar as etapas no próprio arquivo.

## () -> String: objetivo mostrado na HUD (pode mudar durante a etapa, ex.: "1/3").
var objective: Callable
## () -> Variant: ponto do objetivo (Vector3) ou null.
var target: Callable
## (delta: float) -> bool: chamado a cada quadro; true quando a etapa terminou.
var update: Callable
## Chamados ao entrar e ao sair da etapa (criam e limpam o que a etapa usa).
var enter: Callable
var exit: Callable


static func make(p_objective: Callable, p_target: Callable, p_update: Callable, p_enter := Callable(), p_exit := Callable()) -> QuestStep:
	var step := QuestStep.new()
	step.objective = p_objective
	step.target = p_target
	step.update = p_update
	step.enter = p_enter
	step.exit = p_exit
	return step
