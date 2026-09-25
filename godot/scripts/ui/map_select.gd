extends Control
## Escolha de mapa (como no jogo web): nome, descrição e recorde de cada mapa; os trancados
## dizem como liberar.

const GAME := "res://scenes/main.tscn"
const MENU := "res://scenes/ui/main_menu.tscn"


func _ready() -> void:
	var catalog := Save.catalog
	var column := MenuKit.screen(self, 760.0)
	MenuKit.spacer(column, 30)
	MenuKit.title(column, "ESCOLHA O MAPA", 48)
	var first: Button = null
	for id in catalog.order:
		var info := catalog.info(id)
		MenuKit.spacer(column, 10)
		MenuKit.label(column, String(info.name).to_upper(), 28, MenuKit.GOLD)
		MenuKit.label(column, String(info.description), 15, MenuKit.DIM)
		if Save.is_unlocked(id):
			var best := Save.records(id)
			if int(best.bestScore) > 0:
				MenuKit.label(column, "Recorde: %d pontos · round %d" % [best.bestScore, best.bestWave], 14, MenuKit.TEXT)
			var button := MenuKit.button(column, "JOGAR", _play.bind(id), 22)
			button.alignment = HORIZONTAL_ALIGNMENT_LEFT
			if first == null:
				first = button
		else:
			MenuKit.label(column, "BLOQUEADO — derrote o boss do round %d no %s" % [info.unlock_boss_round, catalog.display_name(info.unlock_on_map)], 15, MenuKit.RED)
	MenuKit.spacer(column, 20)
	var back := MenuKit.button(column, "VOLTAR", func() -> void: MenuKit.go(self, MENU))
	(first if first else back).grab_focus()


func _play(id: String) -> void:
	Session.map_id = id
	MenuKit.go(self, GAME)


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed(&"pause"):
		MenuKit.go(self, MENU)
