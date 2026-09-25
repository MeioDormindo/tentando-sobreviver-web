extends Control
## Conquistas (como no jogo web): liberadas em dourado com a data, trancadas em cinza, progresso
## das acumuladas e segredos escondidos; no fim, as estatísticas por mapa e da carreira.

const MENU := "res://scenes/ui/main_menu.tscn"


func _ready() -> void:
	var catalog := load("res://data/configs/achievements.tres") as AchievementCatalog
	var column := MenuKit.screen(self, 760.0)
	MenuKit.spacer(column, 30)
	MenuKit.title(column, "CONQUISTAS", 48)
	var unlocked := catalog.achievements.filter(func(a: Dictionary) -> bool: return Save.has_achievement(a.id)).size()
	MenuKit.label(column, "%d / %d LIBERADAS" % [unlocked, catalog.achievements.size()], 16, MenuKit.GOLD, HORIZONTAL_ALIGNMENT_CENTER)
	for a: Dictionary in catalog.achievements:
		var done := Save.has_achievement(a.id)
		var hidden := bool(a.secret) and not done
		var title := "???" if hidden else String(a.name).to_upper()
		var detail := "Segredo — continue explorando" if hidden else String(a.description)
		if done:
			detail += "  ·  " + String(Save.data.achievements[a.id]).substr(0, 10)
		elif String(a.total_key) != "":
			var key := "totalKills" if a.total_key == "kills" else String(a.total_key)
			detail += "  ·  %d / %d" % [mini(int(Save.lifetime.get(key, 0)), int(a.total_target)), a.total_target]
		MenuKit.label(column, title, 20, MenuKit.GOLD if done else MenuKit.DIM)
		MenuKit.label(column, detail, 14, MenuKit.TEXT if done else MenuKit.DIM)
	MenuKit.spacer(column, 16)
	MenuKit.label(column, "ESTATÍSTICAS", 24, MenuKit.TEXT, HORIZONTAL_ALIGNMENT_CENTER)
	for id in Save.catalog.order:
		var r := Save.records(id)
		MenuKit.label(column, "%s — melhor round %d · recorde %d pts · %d abates" % [Save.catalog.display_name(id).to_upper(), r.bestWave, r.bestScore, r.bestKills],
			14, MenuKit.TEXT, HORIZONTAL_ALIGNMENT_CENTER)
	var l := Save.lifetime
	var minutes := int(l.playTimeMs) / 60000
	MenuKit.label(column, "Partidas %d · Abates %d · Faca %d · Headshots %d · Bosses %d · Tempo %dh%02d" % [
		l.gamesPlayed, l.totalKills, l.knifeKills, l.headshots, l.bossesDefeated, minutes / 60, minutes % 60], 14, MenuKit.DIM, HORIZONTAL_ALIGNMENT_CENTER)
	MenuKit.spacer(column, 16)
	MenuKit.button(column, "VOLTAR", func() -> void: MenuKit.go(self, MENU)).grab_focus()


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed(&"pause"):
		MenuKit.go(self, MENU)
