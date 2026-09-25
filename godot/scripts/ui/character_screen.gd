extends Control
## Personagem do mapa escolhido (etapa entre a escolha de mapa e a partida): os 4 visuais do
## personagem daquele mapa; os trancados mostram a conquista que libera. JOGAR começa.

const MAP_SELECT := "res://scenes/ui/map_select.tscn"
const GAME := "res://scenes/main.tscn"

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
	var column := MenuKit.screen(self, 820.0)
	MenuKit.spacer(column, 10)
	var map := Session.map_id if Save.catalog.maps.has(Session.map_id) else Save.catalog.default_map
	MenuKit.title(column, "PERSONAGEM", 48)
	MenuKit.label(column, Save.catalog.display_name(map).to_upper(), 20, MenuKit.GOLD, HORIZONTAL_ALIGNMENT_CENTER)
	MenuKit.label(column, "Libere os visuais com as conquistas.", 14, MenuKit.DIM, HORIZONTAL_ALIGNMENT_CENTER)
	for map_id: String in [map]:
		var skins := _skins.for_map(map_id)
		if skins.is_empty():
			continue
		var row := HBoxContainer.new()
		row.alignment = BoxContainer.ALIGNMENT_CENTER
		row.add_theme_constant_override(&"separation", 14)
		column.add_child(row)
		var selected := String(_skins.chosen(map_id).id)
		for skin: Dictionary in skins:
			var card := VBoxContainer.new()
			card.custom_minimum_size = Vector2(190, 0)
			row.add_child(card)
			card.add_child(_portrait(skin))
			var status := "EM USO" if skin.id == selected else ("USAR" if is_unlocked(skin) else "TRANCADO")
			var button := MenuKit.button(card, "%s\n%s" % [String(skin.name).to_upper(), status], _choose.bind(skin), 16)
			if skin.id == selected:
				button.add_theme_color_override(&"font_color", MenuKit.GOLD)
	_message = MenuKit.label(column, "", 15, MenuKit.DIM, HORIZONTAL_ALIGNMENT_CENTER)
	var play := MenuKit.button(column, "JOGAR", func() -> void: MenuKit.go(self, GAME), 26)
	play.name = "Play"
	MenuKit.button(column, "VOLTAR", func() -> void: MenuKit.go(self, MAP_SELECT))
	play.grab_focus.call_deferred()


## Retrato: o sprite do visual (parado, de frente, com a pistola) num painel pixel; os
## trancados aparecem em silhueta. Sem a folha, a cor da jaqueta.
func _portrait(skin: Dictionary) -> Control:
	var frame := PanelContainer.new()
	frame.custom_minimum_size = Vector2(190, 170)
	frame.add_theme_stylebox_override(&"panel", PixelSkin.panel(false, 6.0))
	var sheet := "player_%s" % skin.id
	var meta_path := "res://assets/sprites/%s.json" % sheet
	if not ResourceLoader.exists("res://assets/sprites/%s.png" % sheet) or not FileAccess.file_exists(meta_path):
		var swatch := ColorRect.new()
		swatch.color = skin.jacket if is_unlocked(skin) else Color(0.16, 0.17, 0.18)
		frame.add_child(swatch)
		return frame
	var meta: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(meta_path))
	var size := Vector2(meta.frame[0], meta.frame[1])
	var stack := Control.new()
	stack.custom_minimum_size = size * 2.0
	frame.add_child(stack)
	var idle: int = int(meta.animations.get("Idle_pistol", meta.animations.Idle).start)
	# Com a pistola inicial do mapa do visual (M1911 no Terminal, Beretta no Hospital).
	var pistol := "weapon_beretta" if String(skin.get("map", "")) == "map2" else "weapon_m1911"
	for layer: String in [sheet, pistol]:
		if not ResourceLoader.exists("res://assets/sprites/%s.png" % layer):
			continue
		var atlas := AtlasTexture.new()
		atlas.atlas = load("res://assets/sprites/%s.png" % layer)
		atlas.region = Rect2(Vector2(idle * size.x, 0.0), size)
		var picture := TextureRect.new()
		picture.texture = atlas
		picture.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		picture.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		picture.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		picture.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		if not is_unlocked(skin):
			picture.modulate = Color(0.05, 0.05, 0.06)
		stack.add_child(picture)
	return frame


func _choose(skin: Dictionary) -> void:
	if not is_unlocked(skin):
		var need := _achievements.find(skin.unlock)
		_message.text = "Trancado — libere com a conquista \"%s\": %s" % [need.get("name", ""), need.get("description", "")]
		_message.add_theme_color_override(&"font_color", MenuKit.RED)
		return
	Save.set_setting(SkinCatalog.setting_key(String(skin.get("map", "terminal"))), skin.id)
	_build.call_deferred()


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed(&"pause"):
		MenuKit.go(self, MAP_SELECT)
