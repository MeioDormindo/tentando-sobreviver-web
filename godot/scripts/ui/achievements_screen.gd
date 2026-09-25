extends Control
## Conquistas (como no jogo web, em pixel): grade de cartões com ícone. Liberadas com borda
## dourada, ícone colorido e a data; trancadas em cinza, com o ícone em silhueta e a barra
## das acumuladas; segredos escondidos. No fim, as estatísticas por mapa e da carreira.

const MENU := "res://scenes/ui/main_menu.tscn"
const COLUMNS := 3
const CARD_WIDTH := 372.0


func _ready() -> void:
	var catalog := load("res://data/configs/achievements.tres") as AchievementCatalog
	var column := MenuKit.screen(self, CARD_WIDTH * COLUMNS + 24.0)
	MenuKit.spacer(column, 20)
	MenuKit.title(column, "CONQUISTAS", 48)
	var unlocked := catalog.achievements.filter(func(a: Dictionary) -> bool: return Save.has_achievement(a.id)).size()
	MenuKit.label(column, "%d / %d LIBERADAS" % [unlocked, catalog.achievements.size()], 16, MenuKit.GOLD, HORIZONTAL_ALIGNMENT_CENTER)
	var grid := GridContainer.new()
	grid.columns = COLUMNS
	grid.add_theme_constant_override(&"h_separation", 12)
	grid.add_theme_constant_override(&"v_separation", 12)
	column.add_child(grid)
	var first: Control = null
	for a: Dictionary in catalog.achievements:
		var card := _card(a)
		grid.add_child(card)
		if first == null:
			first = card
	MenuKit.spacer(column, 12)
	_stats(column)
	MenuKit.spacer(column, 12)
	MenuKit.button(column, "VOLTAR", func() -> void: MenuKit.go(self, MENU)).grab_focus()


## Cartão de uma conquista: ícone à esquerda; nome, descrição e progresso (ou data) à direita.
func _card(a: Dictionary) -> Control:
	var done := Save.has_achievement(a.id)
	var hidden := bool(a.secret) and not done
	var card := PanelContainer.new()
	card.custom_minimum_size = Vector2(CARD_WIDTH, 0)
	card.add_theme_stylebox_override(&"panel", PixelSkin.panel(done, 10.0))
	var row := HBoxContainer.new()
	row.add_theme_constant_override(&"separation", 12)
	card.add_child(row)
	var slot := CenterContainer.new()
	slot.custom_minimum_size = Vector2(72, 72)
	row.add_child(slot)
	var icon_path := String(a.get("icon", ""))
	if icon_path != "" and ResourceLoader.exists(icon_path) and not hidden:
		var icon := TextureRect.new()
		icon.texture = load(icon_path)
		icon.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		icon.custom_minimum_size = Vector2(64, 64)
		# Trancada: silhueta escura, como no jogo web.
		if not done:
			icon.modulate = Color(0.22, 0.23, 0.25, 0.8)
		slot.add_child(icon)
	else:
		var mystery := MenuKit.label(slot, "?", 48, MenuKit.DIM, HORIZONTAL_ALIGNMENT_CENTER)
		mystery.autowrap_mode = TextServer.AUTOWRAP_OFF
	var text := VBoxContainer.new()
	text.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	text.add_theme_constant_override(&"separation", 2)
	row.add_child(text)
	MenuKit.label(text, "???" if hidden else String(a.name).to_upper(), 20, MenuKit.GOLD if done else MenuKit.TEXT)
	MenuKit.label(text, "Segredo — continue explorando" if hidden else String(a.description), 14, MenuKit.TEXT if done else MenuKit.DIM)
	if done:
		MenuKit.label(text, "✓ " + String(Save.data.achievements[a.id]).substr(0, 10), 14, MenuKit.GOLD)
	elif String(a.total_key) != "":
		var key := "totalKills" if a.total_key == "kills" else String(a.total_key)
		var have := mini(int(Save.lifetime.get(key, 0)), int(a.total_target))
		var bar: Array = PixelSkin.bar(MenuKit.GOLD, 200.0, 8.0)
		(bar[1] as ProgressBar).max_value = float(a.total_target)
		(bar[1] as ProgressBar).value = float(have)
		text.add_child(bar[0])
		MenuKit.label(text, "%d / %d" % [have, a.total_target], 14, MenuKit.DIM)
	return card


## Estatísticas por mapa e da carreira, num painel.
func _stats(column: VBoxContainer) -> void:
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override(&"panel", PixelSkin.panel(false, 14.0))
	column.add_child(panel)
	var box := VBoxContainer.new()
	panel.add_child(box)
	MenuKit.label(box, "ESTATÍSTICAS", 24, MenuKit.TEXT, HORIZONTAL_ALIGNMENT_CENTER)
	for id in Save.catalog.order:
		var r := Save.records(id)
		MenuKit.label(box, "%s — melhor round %d · recorde %d pts · %d abates" % [Save.catalog.display_name(id).to_upper(), r.bestWave, r.bestScore, r.bestKills],
			14, MenuKit.TEXT, HORIZONTAL_ALIGNMENT_CENTER)
	var l := Save.lifetime
	var minutes := int(l.playTimeMs) / 60000
	MenuKit.label(box, "Partidas %d · Abates %d · Faca %d · Headshots %d · Bosses %d · Tempo %dh%02d" % [
		l.gamesPlayed, l.totalKills, l.knifeKills, l.headshots, l.bossesDefeated, minutes / 60, minutes % 60], 14, MenuKit.DIM, HORIZONTAL_ALIGNMENT_CENTER)


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed(&"pause"):
		MenuKit.go(self, MENU)
