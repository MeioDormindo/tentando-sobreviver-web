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
	# Save de teste: os testes nunca mexem no save de verdade do jogador.
	var save := root.get_node("Save")
	save.call(&"load_from", "user://test_save.json")
	save.call(&"reset")
	var script := load("res://tests/system_tests.gd") as GDScript
	if script == null or not script.can_instantiate():
		printerr("A suíte de testes não compilou (veja o erro acima).")
		quit(1)
		return
	var suite: RefCounted = script.new()
	var failures: int = suite.call(&"run", self)
	# Testes de cena (armas especiais): precisam de física rodando, então são assíncronos.
	var scene_tests: RefCounted = (load("res://tests/weapon_scene_tests.gd") as GDScript).new()
	failures += await scene_tests.call(&"run", self)
	var zombie_tests: RefCounted = (load("res://tests/zombie_scene_tests.gd") as GDScript).new()
	failures += await zombie_tests.call(&"run", self)
	var boss_tests: RefCounted = (load("res://tests/boss_scene_tests.gd") as GDScript).new()
	failures += await boss_tests.call(&"run", self)
	var menu_tests: RefCounted = (load("res://tests/menu_scene_tests.gd") as GDScript).new()
	failures += await menu_tests.call(&"run", self)
	var power_up_tests: RefCounted = (load("res://tests/power_up_scene_tests.gd") as GDScript).new()
	failures += await power_up_tests.call(&"run", self)
	var online_tests: RefCounted = (load("res://tests/online_tests.gd") as GDScript).new()
	failures += await online_tests.call(&"run", self)
	DirAccess.remove_absolute(ProjectSettings.globalize_path("user://test_save.json"))
	quit(1 if failures > 0 else 0)
