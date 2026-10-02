extends Control
## GLOSSÁRIO: tudo o que dá para encontrar numa partida — inimigos, itens, eventos e mecânicas —
## em abas, com a lista à esquerda e os detalhes à direita (imagem, descrição e os números lidos
## dos dados do jogo, então nunca ficam desatualizados). O que o jogador ainda não encontrou
## aparece como "???" em silhueta (o GlossaryTracker marca no save o que foi encontrado).
## Textos em data/configs/glossary.json.

const MENU := "res://scenes/ui/main_menu.tscn"
const DATA := "res://data/configs/glossary.json"
const PICTURE := 150.0
## Como revelar cada tipo de entrada (mostrado enquanto ela é "???").
const REVEAL := {
	"zombie": "Aparece quando você enfrentar esse inimigo.",
	"boss": "Aparece quando você enfrentar esse chefe.",
	"perk": "Chegue perto da máquina desse perk.",
	"powerup": "Pegue esse power-up numa partida.",
	"element": "Compre esse elemento numa parede de arma.",
	"blessing": "Receba essa bênção num altar do Templo.",
	"event": "Aparece quando esse evento acontecer numa partida.",
	"mechanic": "Descubra jogando.",
}

## [{id, name, groups: [{name, entries: [{key, text?, name?, icon?, sheet?, maps?}]}]}].
var categories: Array = []
var tab := 0
var selected := 0

## Entradas da aba atual, em ordem: {entry, group}.
var _entries: Array[Dictionary] = []
var _tabs: Array[Button] = []
var _buttons: Array[Button] = []
var _list: VBoxContainer
var _detail: VBoxContainer
var _count: Label
var _power_ups: PowerUpData


func _ready() -> void:
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(DATA))
	categories = parsed.get("categories", []) if parsed is Dictionary else []
	_power_ups = load("res://data/configs/powerups.tres") as PowerUpData
	_build()


func _build() -> void:
	var column := MenuKit.screen(self, 1120.0)
	MenuKit.spacer(column, 10)
	MenuKit.title(column, "GLOSSÁRIO", 48)
	_count = MenuKit.label(column, "", 14, MenuKit.DIM, HORIZONTAL_ALIGNMENT_CENTER)
	var tabs := HBoxContainer.new()
	tabs.alignment = BoxContainer.ALIGNMENT_CENTER
	tabs.add_theme_constant_override(&"separation", 18)
	column.add_child(tabs)
	for i in categories.size():
		var button := MenuKit.button(tabs, "", _open_tab.bind(i), 18)
		button.name = "Tab%d" % i
		_tabs.append(button)
	var row := HBoxContainer.new()
	row.add_theme_constant_override(&"separation", 16)
	column.add_child(row)
	var list_panel := PanelContainer.new()
	list_panel.add_theme_stylebox_override(&"panel", PixelSkin.panel(false, 8.0))
	list_panel.custom_minimum_size = Vector2(360, 520)
	row.add_child(list_panel)
	var scroll := ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	list_panel.add_child(scroll)
	_list = VBoxContainer.new()
	_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(_list)
	var detail_panel := PanelContainer.new()
	detail_panel.add_theme_stylebox_override(&"panel", PixelSkin.panel(true, 14.0))
	detail_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(detail_panel)
	_detail = VBoxContainer.new()
	_detail.custom_minimum_size.x = 700
	_detail.add_theme_constant_override(&"separation", 6)
	detail_panel.add_child(_detail)
	MenuKit.spacer(column, 6)
	MenuKit.button(column, "VOLTAR", func() -> void: MenuKit.go(self, MENU))
	_open_tab(0)


## Abre uma aba: refaz a lista e mostra a primeira entrada.
func _open_tab(index: int) -> void:
	if categories.is_empty():
		return
	tab = index
	selected = 0
	_entries.clear()
	_buttons.clear()
	for child in _list.get_children():
		child.queue_free()
	for group: Dictionary in categories[tab].groups:
		MenuKit.label(_list, String(group.name), 14, MenuKit.DIM)
		for entry: Dictionary in group.entries:
			var i := _entries.size()
			_entries.append({"entry": entry, "group": group})
			var seen := Save.has_seen(entry.key)
			var button := MenuKit.button(_list, Loc.t(entry_name(entry)).to_upper() if seen else "???", _select.bind(i), 16)
			button.alignment = HORIZONTAL_ALIGNMENT_LEFT
			button.add_theme_color_override(&"font_color", entry_color(entry) if seen else MenuKit.DIM)
			button.focus_entered.connect(_select.bind(i))
			_buttons.append(button)
	_refresh_counts()
	_show()
	if not _buttons.is_empty():
		_buttons[0].grab_focus.call_deferred()


func _select(index: int) -> void:
	if index == selected:
		return
	selected = index
	_show()


## Descobertas no total e por aba (a aba aberta em dourado).
func _refresh_counts() -> void:
	var seen_all := 0
	var total_all := 0
	for i in categories.size():
		var seen := 0
		var total := 0
		for group: Dictionary in categories[i].groups:
			for entry: Dictionary in group.entries:
				total += 1
				seen += 1 if Save.has_seen(entry.key) else 0
		seen_all += seen
		total_all += total
		_tabs[i].text = "%s %d/%d" % [categories[i].name, seen, total]
		_tabs[i].add_theme_color_override(&"font_color", MenuKit.GOLD if i == tab else MenuKit.TEXT)
	_count.text = Loc.t("DESCOBERTOS %d DE %d") % [seen_all, total_all]


# ───────────────────────── Detalhe ─────────────────────────

func _show() -> void:
	for child in _detail.get_children():
		child.queue_free()
	if _entries.is_empty():
		return
	var entry: Dictionary = _entries[selected].entry
	var group: Dictionary = _entries[selected].group
	var seen := Save.has_seen(entry.key)
	var head := HBoxContainer.new()
	head.add_theme_constant_override(&"separation", 16)
	_detail.add_child(head)
	var picture := entry_picture(entry)
	if not seen:
		picture.modulate = Color(0.05, 0.05, 0.06)
	head.add_child(picture)
	var names := VBoxContainer.new()
	names.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	names.alignment = BoxContainer.ALIGNMENT_CENTER
	head.add_child(names)
	MenuKit.label(names, Loc.t(entry_name(entry)).to_upper() if seen else "???", 30, entry_color(entry) if seen else MenuKit.DIM)
	var subtitle := entry_subtitle(entry)
	MenuKit.label(names, Loc.t(String(group.name)) + (" · " + Loc.t(subtitle) if seen and subtitle != "" else ""), 14, MenuKit.DIM)
	if not seen:
		MenuKit.label(_detail, Loc.t("Ainda não encontrado.") + " " + Loc.t(String(REVEAL.get(kind_of(entry), REVEAL.mechanic))), 16, MenuKit.TEXT)
		if entry.has("maps"):
			MenuKit.label(_detail, Loc.t("Onde: %s") % Loc.t(String(entry.maps)), 14, MenuKit.DIM)
		return
	MenuKit.label(_detail, entry_text(entry), 16, MenuKit.TEXT)
	for line: String in entry_stats(entry):
		MenuKit.label(_detail, line, 14, MenuKit.GOLD)
	if entry.has("maps"):
		MenuKit.label(_detail, Loc.t("Onde: %s") % Loc.t(String(entry.maps)), 14, MenuKit.DIM)


## "zombie", "boss", "perk", "powerup", "element", "blessing", "event" ou "mechanic".
static func kind_of(entry: Dictionary) -> String:
	return String(entry.key).get_slice(":", 0)


static func id_of(entry: Dictionary) -> StringName:
	return StringName(String(entry.key).get_slice(":", 1))


func entry_name(entry: Dictionary) -> String:
	var id := id_of(entry)
	match kind_of(entry):
		"zombie":
			return _zombie(id).display_name if _zombie(id) else String(id)
		"boss":
			return _boss(id).display_name if _boss(id) else String(id)
		"perk":
			return _perk(id).display_name if _perk(id) else String(id)
		"powerup":
			return String(_power_ups.power_ups.get(id, {}).get("name", id))
		"element":
			return String(ElementCatalog.shared().info(id).get("name", id))
		"blessing":
			return String(BlessingSystem.GODS.get(id, {}).get("name", id))
		"event":
			return String(WorldEventData.shared().info(id).get("name", id))
	return String(entry.get("name", id))


func entry_color(entry: Dictionary) -> Color:
	var id := id_of(entry)
	match kind_of(entry):
		"boss":
			return MenuKit.GOLD
		"perk":
			return _perk(id).color if _perk(id) else MenuKit.TEXT
		"powerup":
			return _power_ups.power_ups.get(id, {}).get("color", MenuKit.TEXT)
		"element":
			return ElementCatalog.shared().info(id).get("color", MenuKit.TEXT)
		"blessing":
			return BlessingSystem.GODS.get(id, {}).get("color", MenuKit.TEXT)
		"event":
			return WorldEventData.shared().info(id).get("color", MenuKit.TEXT)
	return MenuKit.TEXT


## Complemento do nome: o título da bênção, a dica do evento...
func entry_subtitle(entry: Dictionary) -> String:
	match kind_of(entry):
		"blessing":
			return String(BlessingSystem.GODS.get(id_of(entry), {}).get("title", ""))
	return ""


## Descrição: a do glossário; perks e elementos já têm a sua nos dados do jogo.
func entry_text(entry: Dictionary) -> String:
	if String(entry.get("text", "")) != "":
		return String(entry.text)
	var id := id_of(entry)
	match kind_of(entry):
		"perk":
			return _perk(id).description if _perk(id) else ""
		"element":
			return String(ElementCatalog.shared().info(id).get("description", ""))
	return ""


## Números lidos dos dados do jogo (vida, preço, duração...).
func entry_stats(entry: Dictionary) -> Array[String]:
	var id := id_of(entry)
	var lines: Array[String] = []
	match kind_of(entry):
		"zombie":
			var zombie := _zombie(id)
			if zombie:
				lines.append(Loc.t("VIDA %d · VELOCIDADE %.1f m/s · DANO %d · %d PONTOS") % [zombie.max_health, zombie.move_speed, zombie.damage, zombie.points_kill])
		"boss":
			var boss := _boss(id)
			if boss:
				lines.append(Loc.t("VIDA %d · VELOCIDADE %.1f m/s · GOLPE %d") % [boss.max_health, boss.move_speed, int(boss.melee.get("damage", 0))])
		"perk":
			var perk := _perk(id)
			if perk:
				var extra := (Loc.t(" · ATÉ %d POR PARTIDA") % perk.max_purchases) if perk.max_purchases > 1 else ""
				lines.append(Loc.t("%d PONTOS · %s%s") % [perk.price, Loc.t("FUNCIONA SEM ENERGIA" if perk.works_without_power else "PRECISA DE ENERGIA"), extra])
		"powerup":
			var duration := int(_power_ups.power_ups.get(id, {}).get("duration", 0))
			lines.append((Loc.t("DURA %d s") % duration) if duration > 0 else Loc.t("EFEITO NA HORA"))
		"element":
			lines.append(Loc.t("%d PONTOS NA PAREDE DA ARMA") % int(ElementCatalog.shared().info(id).get("price", 0)))
		"blessing":
			lines.append(Loc.t("%d PONTOS NO ALTAR") % BlessingAltar.PRICE)
		"event":
			var data := WorldEventData.shared()
			var info := data.info(id)
			var parts: Array[String] = []
			var duration := float(data.config(id).get("duration_time", 0.0))
			if duration > 0.0:
				parts.append(Loc.t("DURA %d s") % roundi(duration))
			if int(info.get("min_round", 0)) > 1:
				parts.append(Loc.t("A PARTIR DO ROUND %d") % int(info.min_round))
			if not parts.is_empty():
				lines.append(" · ".join(parts))
			if String(info.get("hint", "")) != "":
				lines.append(Loc.t("DICA: %s") % Loc.t(String(info.hint)).to_upper())
	return lines


# ───────────────────────── Imagem ─────────────────────────

## Quadro da imagem: o sprite (parado, de frente) dos inimigos, o ícone dos itens ou, sem
## nenhum dos dois, um símbolo na cor da entrada.
func entry_picture(entry: Dictionary) -> Control:
	var box := Control.new()
	box.custom_minimum_size = Vector2(PICTURE, PICTURE)
	var sheet := String(entry.get("sheet", ""))
	var icon := String(entry.get("icon", _default_icon(entry)))
	if sheet != "" and _add_sprite(box, sheet):
		return box
	if icon != "" and ResourceLoader.exists(icon):
		var picture := TextureRect.new()
		picture.texture = load(icon)
		picture.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		picture.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		picture.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		picture.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		box.add_child(picture)
		return box
	var glyph := "?"
	if kind_of(entry) == "element":
		glyph = String(ElementCatalog.shared().info(id_of(entry)).get("icon", "?"))
	elif kind_of(entry) == "event":
		glyph = "!"
	var label := MenuKit.label(box, glyph, 117, entry_color(entry), HORIZONTAL_ALIGNMENT_CENTER)
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	label.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	return box


func _default_icon(entry: Dictionary) -> String:
	var id := id_of(entry)
	match kind_of(entry):
		"perk":
			return "res://assets/web/perks/%s.png" % id
		"powerup":
			return "res://assets/web/powerups/%s.png" % id
		"blessing":
			return "res://assets/sprites/blessings/blessing_%s.png" % id
	return ""


## Sprite parado, de frente (Idle, direção 0), do tamanho do quadro: o recorte do AtlasTexture
## posto no lugar pela célula, em escala inteira quando cabe.
func _add_sprite(box: Control, sheet: String) -> bool:
	var meta_path := "res://assets/sprites/%s.json" % sheet
	if not ResourceLoader.exists("res://assets/sprites/%s.png" % sheet) or not FileAccess.file_exists(meta_path):
		return false
	var meta: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(meta_path))
	var animations: Dictionary = meta.get("animations", {})
	var anim: Dictionary = animations.get("Idle", animations.values()[0] if not animations.is_empty() else {})
	var index := int(anim.get("start", 0))
	var cell: Array = meta.cells[index]
	var fit := minf(PICTURE / float(cell[2]), PICTURE / float(cell[3]))
	var zoom := floorf(fit) if fit >= 1.0 else fit
	var picture := TextureRect.new()
	picture.texture = CharacterSprite.make_atlas(meta, load("res://assets/sprites/%s.png" % sheet), index)
	picture.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	picture.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	picture.stretch_mode = TextureRect.STRETCH_SCALE
	picture.size = Vector2(cell[2], cell[3]) * zoom
	picture.position = (Vector2(PICTURE, PICTURE) - picture.size) * 0.5
	box.add_child(picture)
	return true


# ───────────────────────── Dados ─────────────────────────

func _zombie(id: StringName) -> ZombieData:
	var path := "res://data/zombies/%s.tres" % id
	return load(path) as ZombieData if ResourceLoader.exists(path) else null


func _boss(id: StringName) -> BossData:
	var path := "res://data/bosses/%s.tres" % id
	return load(path) as BossData if ResourceLoader.exists(path) else null


func _perk(id: StringName) -> PerkData:
	var path := "res://data/perks/%s.tres" % id
	return load(path) as PerkData if ResourceLoader.exists(path) else null


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed(&"pause"):
		MenuKit.go(self, MENU)
