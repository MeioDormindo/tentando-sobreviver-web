extends Control
## Ranking por mapa (top 10 deste aparelho). O ranking global entra com o online.

const MENU := "res://scenes/ui/main_menu.tscn"

var _map_id := ""
var _table: VBoxContainer
var _tabs: Dictionary = {}


func _ready() -> void:
	var catalog := Save.catalog
	_map_id = Session.map_id if catalog.maps.has(Session.map_id) else catalog.default_map
	var column := MenuKit.screen(self, 680.0)
	MenuKit.spacer(column, 30)
	MenuKit.title(column, "RANKING", 52)
	var tabs := HBoxContainer.new()
	tabs.alignment = BoxContainer.ALIGNMENT_CENTER
	tabs.add_theme_constant_override(&"separation", 30)
	column.add_child(tabs)
	for id in catalog.order:
		_tabs[id] = MenuKit.button(tabs, catalog.display_name(id).to_upper(), _show.bind(id), 18)
	_table = VBoxContainer.new()
	column.add_child(_table)
	MenuKit.spacer(column, 16)
	var back := MenuKit.button(column, "VOLTAR", func() -> void: MenuKit.go(self, MENU))
	back.grab_focus()
	_show(_map_id)


func _show(id: String) -> void:
	_map_id = id
	for tab_id: String in _tabs:
		(_tabs[tab_id] as Button).add_theme_color_override(&"font_color", MenuKit.GOLD if tab_id == id else MenuKit.DIM)
	for child in _table.get_children():
		child.queue_free()
	_row(["#", "NOME", "ROUND", "PONTOS"], MenuKit.DIM)
	var list := Save.ranking(id)
	if list.is_empty():
		MenuKit.label(_table, "Nenhuma partida ainda — jogue para entrar no ranking!" if Save.is_unlocked(id) else "Mapa bloqueado", 16, MenuKit.DIM, HORIZONTAL_ALIGNMENT_CENTER)
		return
	var medals := [MenuKit.GOLD, Color(0.78, 0.78, 0.78), Color(0.78, 0.54, 0.31)]
	for i in list.size():
		var row: Dictionary = list[i]
		_row(["%d" % (i + 1), row.name, "%d" % row.wave, "%d" % row.score], medals[i] if i < medals.size() else MenuKit.TEXT)


func _row(cells: Array, color: Color) -> void:
	var row := HBoxContainer.new()
	_table.add_child(row)
	var widths := [60, 320, 120, 160]
	for i in cells.size():
		var l := MenuKit.label(row, cells[i], 17, color, HORIZONTAL_ALIGNMENT_RIGHT if i >= 2 else HORIZONTAL_ALIGNMENT_LEFT)
		l.custom_minimum_size = Vector2(widths[i], 0)
		l.autowrap_mode = TextServer.AUTOWRAP_OFF


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed(&"pause"):
		MenuKit.go(self, MENU)
