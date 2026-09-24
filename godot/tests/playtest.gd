extends SceneTree
## Teste jogado (em janela, para renderizar e tirar prints):
##   godot --path godot -s res://tests/playtest.gd
## Um bot joga a cena principal e confere o critério do MVP. Prints em tests/output/.
## O bot é carregado só aqui dentro (os autoloads ainda não existem quando este arquivo compila).


func _initialize() -> void:
	var script := load("res://tests/playtest_bot.gd") as GDScript
	if script == null or not script.can_instantiate():
		printerr("O bot do teste não compilou (veja o erro acima).")
		quit(1)
		return
	var bot: Node = script.new()
	root.add_child(bot)
