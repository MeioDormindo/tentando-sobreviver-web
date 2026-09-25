extends RefCounted
## Testes das telas de menu: abrem sem erro e mostram o estado do save.

var _passed := 0
var _failed := 0


func run(tree: SceneTree) -> int:
	print("Menus (cena)")
	Save.reset()
	for path in ["res://scenes/ui/main_menu.tscn", "res://scenes/ui/map_select.tscn", "res://scenes/ui/ranking.tscn", "res://scenes/ui/settings.tscn"]:
		var screen := (load(path) as PackedScene).instantiate()
		tree.root.add_child(screen)
		await tree.process_frame
		var buttons := screen.find_children("*", "Button", true, false)
		check(buttons.size() > 0, "%s abre (%d botões)" % [path.get_file(), buttons.size()])
		if path.ends_with("map_select.tscn"):
			var texts := screen.find_children("*", "Label", true, false).map(func(l: Label) -> String: return l.text)
			check(texts.any(func(t: String) -> bool: return t.begins_with("BLOQUEADO")), "Hospital aparece bloqueado no começo")
		screen.queue_free()
		await tree.process_frame
	Save.unlock("map2")
	var select := (load("res://scenes/ui/map_select.tscn") as PackedScene).instantiate()
	tree.root.add_child(select)
	await tree.process_frame
	var plays := select.find_children("*", "Button", true, false).filter(func(b: Button) -> bool: return b.text == "JOGAR").size()
	check(plays == 2, "Hospital liberado: dois mapas jogáveis")
	select.queue_free()
	Save.reset()
	await tree.process_frame
	print("\n%d ok, %d falharam (menus)" % [_passed, _failed])
	return _failed


func check(condition: bool, description: String) -> void:
	if condition:
		_passed += 1
		print("  ok  ", description)
	else:
		_failed += 1
		printerr("  FALHOU  ", description)
