extends SceneTree
## Executor dos testes isolados (seção 42), sem addons:
##   godot --headless --path godot -s res://tests/run_tests.gd
## Sai com código 1 se algum teste falhar.
##
## A suíte é carregada só aqui dentro: com `-s`, este arquivo é compilado antes de os
## autoloads (Events, InputBindings) existirem, então ele não pode citar os scripts do jogo.


func _initialize() -> void:
	# Espera a árvore ficar ativa (os testes de mapa precisam do _ready dos nós).
	await process_frame
	var script := load("res://tests/system_tests.gd") as GDScript
	if script == null or not script.can_instantiate():
		printerr("A suíte de testes não compilou (veja o erro acima).")
		quit(1)
		return
	var suite: RefCounted = script.new()
	var failures: int = suite.call(&"run", self)
	quit(1 if failures > 0 else 0)
