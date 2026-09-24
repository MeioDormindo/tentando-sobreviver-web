extends SceneTree
## Executor dos testes isolados (seção 42), sem addons:
##   godot --headless --path godot -s res://tests/run_tests.gd
## Sai com código 1 se algum teste falhar.
##
## A suíte é carregada só aqui dentro: com `-s`, este arquivo é compilado antes de os
## autoloads (Events, InputBindings) existirem, então ele não pode citar os scripts do jogo.


func _initialize() -> void:
	var suite: RefCounted = load("res://tests/system_tests.gd").new()
	var failures: int = suite.call(&"run")
	quit(1 if failures > 0 else 0)
