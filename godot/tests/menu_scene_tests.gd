extends RefCounted
## Testes das telas de menu: abrem sem erro e mostram o estado do save.

var _passed := 0
var _failed := 0


func run(tree: SceneTree) -> int:
	print("Menus (cena)")
	Save.reset()
	for path in ["res://scenes/ui/main_menu.tscn", "res://scenes/ui/map_select.tscn", "res://scenes/ui/ranking.tscn", "res://scenes/ui/settings.tscn",
			"res://scenes/ui/account.tscn", "res://scenes/ui/achievements.tscn", "res://scenes/ui/character.tscn"]:
		var screen := (load(path) as PackedScene).instantiate()
		tree.root.add_child(screen)
		await tree.process_frame
		var buttons := screen.find_children("*", "Button", true, false)
		check(buttons.size() > 0, "%s abre (%d botões)" % [path.get_file(), buttons.size()])
		if path.ends_with("main_menu.tscn"):
			check(not buttons.any(func(b: Button) -> bool: return b.text == "PERSONAGEM"), "o menu principal não tem mais PERSONAGEM (vem depois do mapa)")
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
	check(select.CHARACTER == "res://scenes/ui/character.tscn", "JOGAR na escolha de mapa leva à tela de personagem")
	select.queue_free()
	# Tela de personagem do Hospital: só os 4 visuais do paciente, com JOGAR.
	Session.map_id = "map2"
	var character := (load("res://scenes/ui/character.tscn") as PackedScene).instantiate()
	tree.root.add_child(character)
	await tree.process_frame
	var labels := character.find_children("*", "Button", true, false).map(func(b: Button) -> String: return b.text)
	check(labels.any(func(t: String) -> bool: return t.begins_with("PACIENTE
")) and not labels.any(func(t: String) -> bool: return t.begins_with("SOBREVIVENTE")) and character.find_child("Play", true, false) != null,
		"personagem do Hospital: só os visuais do paciente e o botão JOGAR")
	character.queue_free()
	Session.map_id = "terminal"
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
