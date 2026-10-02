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
	await _lobby(tree)
	await _support(tree)
	await _settings_tabs(tree)
	await _ranking_modes(tree)
	Save.reset()
	await tree.process_frame
	print("\n%d ok, %d falharam (menus)" % [_passed, _failed])
	return _failed


## RANKING: abas SOLO, DUPLA, TRIO e QUARTETO; na DUPLA aparece o time (coluna TIME).
func _ranking_modes(tree: SceneTree) -> void:
	Save.reset()
	Save.add_ranking_coop("terminal", 2, "ANA · BETO", 900, 6, 40)
	var screen := (load("res://scenes/ui/ranking.tscn") as PackedScene).instantiate()
	tree.root.add_child(screen)
	await tree.process_frame
	var modes := screen.find_child("Modes", true, false)
	var labels: Array = modes.get_children().map(func(b: Node) -> String: return (b as Button).text) if modes else []
	check(labels == ["SOLO", "DUPLA", "TRIO", "QUARTETO"], "ranking: abas dos modos (%s)" % [labels])
	var texts := func() -> Array: return screen.find_children("*", "Label", true, false).filter(func(l: Label) -> bool: return not l.is_queued_for_deletion()).map(func(l: Label) -> String: return l.text)
	check(not texts.call().has("ANA · BETO"), "no SOLO o time não aparece")
	if modes:
		(modes.get_child(1) as Button).pressed.emit()
	await tree.process_frame
	check(texts.call().has("ANA · BETO") and texts.call().has("TIME"), "na DUPLA: o time no ranking local")
	screen.queue_free()
	Save.reset()
	await tree.process_frame


## JOGAR EM GRUPO: botão no menu; a tela de entrada (nome, criar, código, entrar) e, numa sala
## local (ENet, sem internet), o código, o host na lista e o COMEÇAR esperando os amigos.
func _lobby(tree: SceneTree) -> void:
	var menu := (load("res://scenes/ui/main_menu.tscn") as PackedScene).instantiate()
	tree.root.add_child(menu)
	await tree.process_frame
	check(menu.find_children("*", "Button", true, false).any(func(b: Button) -> bool: return b.text == "JOGAR EM GRUPO"), "menu principal tem JOGAR EM GRUPO")
	menu.queue_free()
	var lobby := (load("res://scenes/ui/lobby.tscn") as PackedScene).instantiate()
	tree.root.add_child(lobby)
	await tree.process_frame
	check(lobby.find_child("Create", true, false) != null and lobby.find_child("Code", true, false) != null and lobby.find_child("Join", true, false) != null, "sala: criar ou entrar com código")
	var code_edit := lobby.find_child("Code", true, false) as LineEdit
	code_edit.text = "abc"
	(lobby.find_child("Join", true, false) as Button).pressed.emit()
	check(not Net.is_online() and (lobby.find_child("Status", true, false) as Label).text.contains("5 letras"), "código curto não tenta entrar")
	Net.host_local("ANA", "", 24690)
	await tree.process_frame
	await tree.process_frame
	var code_label := lobby.find_child("RoomCode", true, false) as Label
	var start := lobby.find_child("Start", true, false) as Button
	check(Net.is_host() and code_label != null and code_label.text == "LOCAL", "sala aberta: o código aparece grande")
	check(start != null and start.disabled and (lobby.find_child("Players", true, false) as Node).get_child_count() == Net.MAX_PLAYERS, "sozinho: COMEÇAR espera os amigos (host + 3 vagas)")
	# Visual na sala e passar o código.
	var skin_before := String(Net.players[1].skin)
	var next := lobby.find_child("SkinNext", true, false) as Button
	var had_next := next != null
	if had_next:
		next.pressed.emit()
	await tree.process_frame
	var catalog := load("res://data/configs/skins.tres") as SkinCatalog
	var unlocked := catalog.for_map(Net.map_id).filter(func(s: Dictionary) -> bool: return String(s.unlock) == "" or Save.has_achievement(s.unlock))
	check(had_next and lobby.find_child("SkinName", true, false) != null and (unlocked.size() < 2 or String(Net.players[1].skin) != skin_before),
		"sala: escolhe o visual (← →) só entre os liberados (%s → %s)" % [skin_before, Net.players[1].skin])
	check(lobby.find_child("CopyCode", true, false) == null, "sala local: sem copiar código (os amigos entram pelo IP)")
	Net.code = "QWERT"
	lobby.call(&"_rebuild")
	await tree.process_frame
	(lobby.find_child("CopyCode", true, false) as Button).pressed.emit()
	var copied_code := String(lobby.get(&"last_copied"))
	(lobby.find_child("CopyInvite", true, false) as Button).pressed.emit()
	var copied_invite := String(lobby.get(&"last_copied"))
	check(copied_code == "QWERT" and copied_invite.contains("?sala=QWERT") and Net.code_from_text(copied_invite) == "QWERT", "sala pela internet: copia o código e o convite com o link (%s)" % copied_invite)
	Net.code = "LOCAL"
	Save.unlock("map2")
	var map_button := lobby.find_child("Map", true, false) as Button
	var had_button := map_button != null
	if had_button:
		map_button.pressed.emit()
	await tree.process_frame
	check(had_button and Net.map_id == "map2" and (lobby.find_child("Map", true, false) as Button).text.contains("HOSPITAL"), "o host troca o mapa da sala (só os liberados)")
	(lobby.find_child("Leave", true, false) as Button).pressed.emit()
	await tree.process_frame
	check(not Net.is_online() and lobby.find_child("Create", true, false) != null, "SAIR DA SALA volta para criar ou entrar")
	lobby.queue_free()
	await tree.process_frame


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


## Crédito no topo do menu e a tela APOIE O PROJETO com o PIX.
func _support(tree: SceneTree) -> void:
	var menu := (load("res://scenes/ui/main_menu.tscn") as PackedScene).instantiate()
	tree.root.add_child(menu)
	await tree.process_frame
	var credit := menu.find_child("Credit", true, false) as Label
	check(credit != null and credit.text.contains("Siryus Canuto") and credit.text.contains("siryuscanuto@gmail.com"), "menu: desenvolvido por Siryus Canuto, com o e-mail")
	check(menu.find_child("Support", true, false) is Button, "menu: botão APOIE O PROJETO (PIX)")
	menu.queue_free()
	var support := (load("res://scenes/ui/support.tscn") as PackedScene).instantiate()
	tree.root.add_child(support)
	await tree.process_frame
	var qr := support.find_child("PixQr", true, false) as TextureRect
	var key := support.find_child("PixKey", true, false) as Label
	check(qr != null and qr.texture != null and key != null and key.text.contains(SupportInfo.PIX_KEY), "APOIE: QR Code e a chave PIX na tela")
	(support.find_child("CopyPayload", true, false) as Button).pressed.emit()
	var payload := String(support.get(&"last_copied"))
	(support.find_child("CopyKey", true, false) as Button).pressed.emit()
	check(payload == SupportInfo.PIX_PAYLOAD and String(support.get(&"last_copied")) == SupportInfo.PIX_KEY, "APOIE: copia o PIX copia e cola e a chave")
	support.queue_free()
	await tree.process_frame


## Configurações em abas: JOGO (idioma), VÍDEO, ÁUDIO e CONTROLES (trocar uma tecla de verdade).
func _settings_tabs(tree: SceneTree) -> void:
	var screen := (load("res://scenes/ui/settings.tscn") as PackedScene).instantiate()
	tree.root.add_child(screen)
	await tree.process_frame
	check(screen.find_child("Tabs", true, false) != null and screen.find_child("Language", true, false) != null and screen.find_child("PlayerName", true, false) != null,
		"Configurações: abas e, na JOGO, idioma e nome no ranking")
	# Trocar o idioma refaz a tela na hora (o idioma fixo dos testes sai e volta).
	var forced := Loc.forced
	var language_before: Variant = Save.get_setting("language")
	Loc.forced = ""
	Save.set_setting("language", "en")
	Loc.apply()
	await tree.process_frame
	await tree.process_frame
	var language := screen.find_child("Language", true, false) as Button
	check(TranslationServer.get_locale() == "en" and language != null and language.text == "LANGUAGE: English",
		"trocar para English refaz as Configurações em inglês (%s)" % [language.text if language else "?"])
	Save.set_setting("language", language_before)
	Loc.forced = forced
	Loc.apply()
	await tree.process_frame
	await tree.process_frame
	(screen.find_child("Tab_video", true, false) as Button).pressed.emit()
	await tree.process_frame
	await tree.process_frame
	check(["MaxFps", "UiScale", "Brightness", "shadows", "showFps"].all(func(n: String) -> bool: return screen.find_child(n, true, false) != null), "aba VÍDEO: FPS, escala, brilho, sombras, contador")
	(screen.find_child("Tab_audio", true, false) as Button).pressed.emit()
	await tree.process_frame
	await tree.process_frame
	check(["Volume", "MusicVolume", "SfxVolume", "UiVolume", "VoiceVolume"].all(func(n: String) -> bool: return screen.find_child(n, true, false) != null), "aba ÁUDIO: geral, música, efeitos, interface, vozes")
	(screen.find_child("Tab_controls", true, false) as Button).pressed.emit()
	await tree.process_frame
	await tree.process_frame
	var row := screen.find_child("Bind_reload", true, false)
	var kb := row.find_child("kb", true, false) as Button if row else null
	check(kb != null and kb.text == "R", "aba CONTROLES: recarregar no R")
	if kb:
		kb.pressed.emit()
		var key := InputEventKey.new()
		key.physical_keycode = KEY_G
		key.keycode = KEY_G
		key.pressed = true
		Input.parse_input_event(key)
		await tree.process_frame
		await tree.process_frame
		var again := screen.find_child("Bind_reload", true, false)
		var new_kb := again.find_child("kb", true, false) as Button if again else null
		check(InputBindings.binding_of(&"reload", InputBindings.KEYBOARD) == ["key", KEY_G] and new_kb != null and new_kb.text == "G", "clicar e apertar G: recarregar passa para o G")
	var reset := screen.find_child("ResetBindings", true, false) as Button
	if reset:
		reset.pressed.emit()
	await tree.process_frame
	check(InputBindings.binding_of(&"reload", InputBindings.KEYBOARD) == ["key", KEY_R], "restaurar padrões")
	screen.queue_free()
	await tree.process_frame
