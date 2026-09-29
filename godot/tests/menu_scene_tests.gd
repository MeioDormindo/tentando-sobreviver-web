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
	await _glossary(tree)
	Save.reset()
	await tree.process_frame
	print("\n%d ok, %d falharam (menus)" % [_passed, _failed])
	return _failed


## GLOSSÁRIO: botão no menu; 4 abas; toda entrada aponta para algo que existe e todo inimigo,
## chefe, perk, power-up, elemento, bênção e evento do jogo tem entrada; o que não foi encontrado
## aparece como "???" e, marcado no save, mostra o nome e os números dos dados.
func _glossary(tree: SceneTree) -> void:
	Save.reset()
	var menu := (load("res://scenes/ui/main_menu.tscn") as PackedScene).instantiate()
	tree.root.add_child(menu)
	await tree.process_frame
	check(menu.find_children("*", "Button", true, false).any(func(b: Button) -> bool: return b.text == "GLOSSÁRIO"), "menu principal tem GLOSSÁRIO")
	menu.queue_free()
	var screen := (load("res://scenes/ui/glossary.tscn") as PackedScene).instantiate()
	tree.root.add_child(screen)
	await tree.process_frame
	check(screen.categories.size() == 4, "glossário com 4 abas: %s" % ", ".join(screen.categories.map(func(c: Dictionary) -> String: return String(c.name))))
	var keys: Array[String] = []
	var broken: Array[String] = []
	for category: Dictionary in screen.categories:
		for group: Dictionary in category.groups:
			for entry: Dictionary in group.entries:
				keys.append(String(entry.key))
				var named: bool = screen.entry_name(entry) != String(screen.id_of(entry)) and screen.entry_text(entry) != ""
				var sheet := String(entry.get("sheet", ""))
				var icon := String(entry.get("icon", ""))
				if not named or (sheet != "" and not ResourceLoader.exists("res://assets/sprites/%s.png" % sheet)) or (icon != "" and not ResourceLoader.exists(icon)):
					broken.append(String(entry.key))
	check(broken.is_empty(), "toda entrada do glossário tem nome, texto e imagem que existem (%d entradas%s)" % [keys.size(), "" if broken.is_empty() else "; quebradas: " + ", ".join(broken)])
	var missing: Array[String] = []
	for dir: String in ["zombies", "bosses", "perks"]:
		var kind: String = {"zombies": "zombie", "bosses": "boss", "perks": "perk"}[dir]
		for file in DirAccess.get_files_at("res://data/%s" % dir):
			if file.ends_with(".tres") and not keys.has("%s:%s" % [kind, file.get_basename()]):
				missing.append("%s:%s" % [kind, file.get_basename()])
	for id: StringName in (load("res://data/configs/powerups.tres") as PowerUpData).power_ups:
		if not keys.has("powerup:%s" % id):
			missing.append("powerup:%s" % id)
	for id: StringName in ElementCatalog.shared().elements:
		if not keys.has("element:%s" % id):
			missing.append("element:%s" % id)
	for id: StringName in BlessingSystem.GODS:
		if not keys.has("blessing:%s" % id):
			missing.append("blessing:%s" % id)
	for id: StringName in WorldEventData.shared().events:
		if not keys.has("event:%s" % id):
			missing.append("event:%s" % id)
	check(missing.is_empty(), "todo inimigo, chefe, perk, power-up, elemento, bênção e evento está no glossário%s" % ("" if missing.is_empty() else " — faltam: " + ", ".join(missing)))
	var first: Button = screen._buttons[0]
	check(first.text == "???" and screen._count.text.begins_with("DESCOBERTOS 0 DE"), "sem nada encontrado: tudo \"???\"")
	Save.see(String(screen._entries[0].entry.key))
	screen._open_tab(0)
	await tree.process_frame
	var texts: Array = screen._detail.find_children("*", "Label", true, false).map(func(l: Label) -> String: return l.text)
	check((screen._buttons[0] as Button).text == "WALKER" and texts.any(func(t: String) -> bool: return t.begins_with("VIDA ")) and screen._count.text.begins_with("DESCOBERTOS 1 DE"),
		"encontrado: nome, números dos dados e contagem (%s)" % (screen._buttons[0] as Button).text)
	screen._open_tab(3)
	await tree.process_frame
	check(screen.tab == 3 and not screen._buttons.is_empty(), "aba MECÂNICAS abre (%d entradas)" % screen._buttons.size())
	screen.queue_free()
	await tree.process_frame


func check(condition: bool, description: String) -> void:
	if condition:
		_passed += 1
		print("  ok  ", description)
	else:
		_failed += 1
		printerr("  FALHOU  ", description)
