extends Control
## Visual do personagem (como no jogo web): os trancados mostram a conquista que libera.

const MENU := "res://scenes/ui/main_menu.tscn"

var _skins: SkinCatalog
var _achievements: AchievementCatalog
var _message: Label


func _ready() -> void:
	_skins = load("res://data/configs/skins.tres") as SkinCatalog
	_achievements = load("res://data/configs/achievements.tres") as AchievementCatalog
	_build()


static func is_unlocked(skin: Dictionary) -> bool:
	return String(skin.unlock) == "" or Save.has_achievement(skin.unlock)


func _build() -> void:
	for child in get_children():
		child.queue_free()
	var column := MenuKit.screen(self, 760.0)
	MenuKit.spacer(column, 30)
	MenuKit.title(column, "PERSONAGEM", 48)
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override(&"separation", 18)
	column.add_child(row)
	var selected := String(Save.get_setting("skin"))
	var first: Button = null
	for skin: Dictionary in _skins.skins:
		var card := VBoxContainer.new()
		card.custom_minimum_size = Vector2(170, 0)
		row.add_child(card)
		var swatch := ColorRect.new()
		swatch.custom_minimum_size = Vector2(170, 110)
		swatch.color = skin.jacket if is_unlocked(skin) else Color(0.16, 0.17, 0.18)
		card.add_child(swatch)
		var status := "EM USO" if skin.id == selected else ("USAR" if is_unlocked(skin) else "TRANCADO")
		var button := MenuKit.button(card, "%s\n%s" % [String(skin.name).to_upper(), status], _choose.bind(skin), 16)
		if skin.id == selected:
			button.add_theme_color_override(&"font_color", MenuKit.GOLD)
		if first == null:
			first = button
	_message = MenuKit.label(column, "", 15, MenuKit.DIM, HORIZONTAL_ALIGNMENT_CENTER)
	MenuKit.spacer(column, 12)
	MenuKit.button(column, "VOLTAR", func() -> void: MenuKit.go(self, MENU))
	first.grab_focus.call_deferred()


func _choose(skin: Dictionary) -> void:
	if not is_unlocked(skin):
		var need := _achievements.find(skin.unlock)
		_message.text = "Trancado — libere com a conquista \"%s\": %s" % [need.get("name", ""), need.get("description", "")]
		_message.add_theme_color_override(&"font_color", MenuKit.RED)
		return
	Save.set_setting("skin", skin.id)
	_build.call_deferred()


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed(&"pause"):
		MenuKit.go(self, MENU)
