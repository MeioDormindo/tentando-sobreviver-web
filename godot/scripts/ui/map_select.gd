extends Control
## Escolha de mapa (como no jogo web, melhorada): cartões lado a lado com a miniatura da
## planta, nome, descrição, recorde, o 1º do ranking e a missão do mapa. Os trancados ficam
## escurecidos e dizem como liberar.

const GAME := "res://scenes/main.tscn"
## Depois do mapa, a escolha do visual do personagem daquele mapa (e dali, a partida).
const CHARACTER := "res://scenes/ui/character.tscn"
const MENU := "res://scenes/ui/main_menu.tscn"
const CARD_WIDTH := 520.0
## Conquista da missão de cada mapa (selo de missão concluída).
const QUESTS := {"terminal": ["last_train", "O Último Trem"], "map2": ["serum", "O Soro do Dr. Almeida"],
	"temple": ["underworld_gate", "O Portão do Submundo"]}


func _ready() -> void:
	var catalog := Save.catalog
	var column := MenuKit.screen(self, CARD_WIDTH * 2.0 + 40.0)
	MenuKit.spacer(column, 20)
	MenuKit.title(column, "ESCOLHA O MAPA", 48)
	var row := HFlowContainer.new()
	row.alignment = FlowContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override(&"h_separation", 24)
	row.add_theme_constant_override(&"v_separation", 24)
	column.add_child(row)
	var first: Button = null
	for id in catalog.order:
		var button := _card(row, id)
		if button and first == null:
			first = button
	MenuKit.spacer(column, 12)
	var back := MenuKit.button(column, "VOLTAR", func() -> void: MenuKit.go(self, MENU))
	(first if first else back).grab_focus()


## Cartão de um mapa; devolve o botão JOGAR (null se trancado).
func _card(parent: Control, id: String) -> Button:
	var catalog := Save.catalog
	var info := catalog.info(id)
	var unlocked := Save.is_unlocked(id)
	var card := PanelContainer.new()
	card.custom_minimum_size = Vector2(CARD_WIDTH, 0)
	card.add_theme_stylebox_override(&"panel", PixelSkin.panel(unlocked, 14.0))
	parent.add_child(card)
	var box := VBoxContainer.new()
	box.add_theme_constant_override(&"separation", 6)
	card.add_child(box)
	var thumb_path := "res://assets/ui/map_%s.png" % id
	if ResourceLoader.exists(thumb_path):
		var thumb := TextureRect.new()
		thumb.texture = load(thumb_path)
		thumb.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		thumb.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		thumb.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		thumb.custom_minimum_size = Vector2(CARD_WIDTH - 28.0, 250)
		if not unlocked:
			thumb.modulate = Color(0.25, 0.25, 0.28)
		box.add_child(thumb)
	MenuKit.label(box, String(info.name).to_upper(), 28, MenuKit.GOLD if unlocked else MenuKit.DIM)
	MenuKit.label(box, String(info.description), 15, MenuKit.TEXT if unlocked else MenuKit.DIM)
	if not unlocked:
		MenuKit.label(box, unlock_text(info), 15, MenuKit.RED)
		return null
	var best := Save.records(id)
	MenuKit.label(box, ("Recorde: %d pontos · round %d" % [best.bestScore, best.bestWave]) if int(best.bestScore) > 0 else "Sem recorde ainda", 14, MenuKit.TEXT)
	var ranking := Save.ranking(id)
	if not ranking.is_empty():
		MenuKit.label(box, "1º no ranking: %s · %d pts" % [String(ranking[0].get("name", "?")), int(ranking[0].get("score", 0))], 14, MenuKit.DIM)
	var quest: Array = QUESTS.get(id, [])
	if not quest.is_empty():
		var done := Save.has_achievement(quest[0])
		MenuKit.label(box, ("✓ MISSÃO CONCLUÍDA: " if done else "◆ MISSÃO: ") + String(quest[1]).to_upper(), 14, MenuKit.GOLD if done else MenuKit.DIM)
	return MenuKit.button(box, "JOGAR", _play.bind(id), 26)


## Como liberar um mapa trancado: boss de um round noutro mapa, ou a missão de outro mapa.
static func unlock_text(info: Dictionary) -> String:
	var catalog := Save.catalog
	var by_quest: Array = info.get("unlock_achievements", [])
	if not by_quest.is_empty():
		var names: Array[String] = []
		for id: String in catalog.order:
			if QUESTS.has(id) and by_quest.has(QUESTS[id][0]):
				names.append(catalog.display_name(id))
		return "BLOQUEADO — conclua a missão do %s" % " ou do ".join(names)
	return "BLOQUEADO — derrote o boss do round %d no %s" % [int(info.unlock_boss_round), catalog.display_name(String(info.unlock_on_map))]


func _play(id: String) -> void:
	Session.map_id = id
	MenuKit.go(self, CHARACTER)


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed(&"pause"):
		MenuKit.go(self, MENU)
