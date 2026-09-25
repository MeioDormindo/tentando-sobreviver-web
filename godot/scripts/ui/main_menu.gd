extends Control
## Menu principal (como no jogo web): jogar (escolha de mapa), ranking, configurações, sair.
## Enter pula direto para o mapa padrão.

const MAP_SELECT := "res://scenes/ui/map_select.tscn"
const RANKING := "res://scenes/ui/ranking.tscn"
const SETTINGS := "res://scenes/ui/settings.tscn"
const ACCOUNT := "res://scenes/ui/account.tscn"
const GAME := "res://scenes/main.tscn"


func _ready() -> void:
	var column := MenuKit.screen(self, 560.0)
	MenuKit.spacer(column, 40)
	MenuKit.title(column, "TENTANDO\nSOBREVIVER", 72)
	var best := Save.records(Save.catalog.default_map)
	if int(best.bestScore) > 0:
		MenuKit.label(column, "RECORDE: %d PONTOS · ROUND %d" % [best.bestScore, best.bestWave], 16, MenuKit.GOLD, HORIZONTAL_ALIGNMENT_CENTER)
	MenuKit.spacer(column, 24)
	var play := MenuKit.button(column, "JOGAR", func() -> void: MenuKit.go(self, MAP_SELECT))
	MenuKit.button(column, "RANKING", func() -> void: MenuKit.go(self, RANKING))
	var user := Account.current_user()
	MenuKit.button(column, ("CONTA: " + user.to_upper()) if user != "" else "CONTA / SALVAR NA NUVEM", func() -> void: MenuKit.go(self, ACCOUNT))
	MenuKit.button(column, "CONFIGURAÇÕES", func() -> void: MenuKit.go(self, SETTINGS))
	if not OS.has_feature("web"):
		MenuKit.button(column, "SAIR", func() -> void: get_tree().quit())
	MenuKit.spacer(column, 30)
	MenuKit.label(column, "WASD mover · mouse mirar · clique atirar · R recarregar · Q trocar arma · V faca · E usar · ESC pausa",
		13, MenuKit.DIM, HORIZONTAL_ALIGNMENT_CENTER)
	play.grab_focus()


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and (event as InputEventKey).keycode == KEY_ENTER:
		Session.map_id = Save.catalog.default_map
		MenuKit.go(self, GAME)
