extends Control
## ARMAS (como no jogo web, ArmoryScene, em pixel): lista de todas as armas à esquerda, por
## raridade e preço, e os detalhes da escolhida à direita — ícone, raridade, barras de dano,
## cadência, pente, reserva, recarga e alcance, onde achar, elemento, efeito especial e o
## Weapon Lab (com o botão para ver o Mk II e o Mk III).

const MENU := "res://scenes/ui/main_menu.tscn"
const RARITY_ORDER := [&"common", &"uncommon", &"rare", &"epic", &"legendary"]
const RARITY_NAMES := {&"common": "COMUM", &"uncommon": "INCOMUM", &"rare": "RARA", &"epic": "ÉPICA", &"legendary": "LENDÁRIA"}
## Armas fora do catálogo da caixa que também aparecem aqui.
const EXTRA := ["res://data/weapons/conductor_lantern.tres", "res://data/weapons/zeus_bolt.tres",
	"res://data/weapons/artemis_bow.tres", "res://data/weapons/poseidon_trident.tres"]
## Como se ganha cada prêmio (armas que nunca saem na Mystery Box).
const PRIZES := {
	&"conductor_lantern": "Prêmio da missão O Último Trem (Terminal) — nunca sai na Mystery Box",
	&"zeus_bolt": "Prêmio da missão O Portão do Submundo (Templo) — nunca sai na Mystery Box",
	&"artemis_bow": "Santuário do Olimpo: ative as 12 estátuas dos deuses no Templo",
	&"poseidon_trident": "Evento Portão do Submundo (Templo): destrua o portal",
}
## [rótulo, valor (para a barra), máximo, texto].
const STATS := ["DANO", "CADÊNCIA", "PENTE", "RESERVA", "RECARGA", "ALCANCE"]

var weapons: Array[WeaponData] = []
var selected := 0
## 0 = normal, 1 = Mk II, 2 = Mk III.
var level := 0

var _list: VBoxContainer
var _detail: VBoxContainer
var _buttons: Array[Button] = []
var _lab: WeaponLabData
var _maps: Dictionary = {}


func _ready() -> void:
	_lab = load("res://data/configs/weapon_lab.tres") as WeaponLabData
	for map_id: String in Save.catalog.order:
		var path := "res://data/maps/%s.json" % map_id
		if FileAccess.file_exists(path):
			_maps[map_id] = JSON.parse_string(FileAccess.get_file_as_string(path))
	var catalog := load("res://data/weapons/catalog.tres") as WeaponCatalog
	for weapon: WeaponData in catalog.weapons:
		weapons.append(weapon)
	for path: String in EXTRA:
		if ResourceLoader.exists(path):
			weapons.append(load(path))
	weapons.sort_custom(func(a: WeaponData, b: WeaponData) -> bool:
		var ra := RARITY_ORDER.find(a.rarity)
		var rb := RARITY_ORDER.find(b.rarity)
		return ra < rb if ra != rb else a.price < b.price)
	_build()


func _build() -> void:
	var column := MenuKit.screen(self, 1120.0)
	MenuKit.spacer(column, 10)
	MenuKit.title(column, "ARMAS", 48)
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
	for i in weapons.size():
		var button := MenuKit.button(_list, weapons[i].display_name.to_upper(), _select.bind(i), 16)
		button.alignment = HORIZONTAL_ALIGNMENT_LEFT
		button.add_theme_color_override(&"font_color", MysteryBox.RARITY_COLORS.get(weapons[i].rarity, MenuKit.TEXT))
		button.focus_entered.connect(_select.bind(i))
		_buttons.append(button)
	var detail_panel := PanelContainer.new()
	detail_panel.add_theme_stylebox_override(&"panel", PixelSkin.panel(true, 14.0))
	detail_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(detail_panel)
	_detail = VBoxContainer.new()
	_detail.custom_minimum_size.x = 700
	_detail.add_theme_constant_override(&"separation", 4)
	detail_panel.add_child(_detail)
	MenuKit.spacer(column, 6)
	MenuKit.button(column, "VOLTAR", func() -> void: MenuKit.go(self, MENU))
	_show()
	if not _buttons.is_empty():
		_buttons[0].grab_focus.call_deferred()


func _select(index: int) -> void:
	if index == selected:
		return
	selected = index
	level = 0
	_show()


## Arma mostrada: a escolhida no nível do botão (normal, Mk II ou Mk III).
func shown() -> WeaponData:
	var weapon := weapons[selected]
	if level >= 1:
		weapon = WeaponUpgrade.mk2(weapon, _lab)
	if level >= 2:
		weapon = WeaponUpgrade.mk3(weapon, _lab)
	return weapon


func _show() -> void:
	for child in _detail.get_children():
		child.queue_free()
	var base := weapons[selected]
	var weapon := shown()
	var head := HBoxContainer.new()
	head.add_theme_constant_override(&"separation", 14)
	_detail.add_child(head)
	var icon_path := "res://assets/sprites/icons/%s.png" % Player.gun_sheet(base.id, level)
	if ResourceLoader.exists(icon_path):
		var icon := TextureRect.new()
		icon.texture = load(icon_path)
		icon.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		icon.custom_minimum_size = Vector2(180, 90)
		head.add_child(icon)
	var names := VBoxContainer.new()
	names.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(names)
	MenuKit.label(names, weapon.display_name.to_upper(), 30, MysteryBox.RARITY_COLORS.get(base.rarity, MenuKit.TEXT))
	MenuKit.label(names, "%s · %s" % [RARITY_NAMES.get(base.rarity, ""), "AUTOMÁTICA" if weapon.automatic else "SEMIAUTOMÁTICA"], 14, MenuKit.DIM)
	for i in STATS.size():
		_stat_row(STATS[i], weapon)
	MenuKit.label(_detail, source_text(base), 14, MenuKit.TEXT)
	if base.element != &"":
		var catalog := ElementCatalog.shared()
		var info := catalog.info(base.element)
		MenuKit.label(_detail, "Elemento %s (%d, segure E na parede): %s" % [catalog.label(base.element), int(info.get("price", 0)), info.get("description", "")], 14, info.get("color", MenuKit.TEXT))
	var special := special_text(weapon)
	if special != "":
		MenuKit.label(_detail, special, 14, MenuKit.GOLD)
	MenuKit.label(_detail, "Weapon Lab: Mk II %d · Mk III %d%s" % [_lab.price_mk2, _lab.price_mk3, ("  (vira %s)" % base.upgrade_name) if base.upgrade_name != "" else ""], 14, MenuKit.DIM)
	var toggle := MenuKit.button(_detail, ["VER MK II", "VER MK III", "VER NORMAL"][level], func() -> void:
		level = (level + 1) % 3
		_show(), 16)
	toggle.name = "MkToggle"


func _stat_row(stat: String, weapon: WeaponData) -> void:
	var line := HBoxContainer.new()
	line.add_theme_constant_override(&"separation", 10)
	_detail.add_child(line)
	var label := MenuKit.label(line, stat, 14, MenuKit.TEXT)
	label.autowrap_mode = TextServer.AUTOWRAP_OFF
	label.custom_minimum_size.x = 150
	var value := 0.0
	var maximum := 1.0
	var text := ""
	match stat:
		"DANO":
			value = weapon.damage * maxi(1, weapon.pellets)
			maximum = 420.0
			text = ("%d × %d" % [weapon.damage, weapon.pellets]) if weapon.pellets > 1 else "%d" % weapon.damage
		"CADÊNCIA":
			value = weapon.fire_rate
			maximum = 22.0
			text = "%.1f/s" % weapon.fire_rate
		"PENTE":
			value = weapon.magazine_size
			maximum = 120.0
			text = "%d" % weapon.magazine_size
		"RESERVA":
			value = weapon.reserve_ammo
			maximum = 480.0
			text = "%d" % weapon.reserve_ammo
		"RECARGA":
			value = 4.0 - weapon.reload_time
			maximum = 3.0
			text = "%.1f s" % weapon.reload_time
		"ALCANCE":
			value = weapon.max_range
			maximum = 44.0
			text = "%.0f m" % weapon.max_range
	var bar: Array = PixelSkin.bar(MenuKit.GOLD, 300.0, 8.0)
	(bar[1] as ProgressBar).max_value = maximum
	(bar[1] as ProgressBar).value = clampf(value, 0.0, maximum)
	line.add_child(bar[0])
	MenuKit.label(line, text, 14, MenuKit.DIM).autowrap_mode = TextServer.AUTOWRAP_OFF


## Onde conseguir: arma inicial, parede (preço, mapa e área), Mystery Box ou prêmio da missão.
func source_text(weapon: WeaponData) -> String:
	if PRIZES.has(weapon.id):
		return PRIZES[weapon.id]
	var parts: Array[String] = []
	for map_id: String in _maps:
		var data: Dictionary = _maps[map_id]
		var start := String(data.get("start_weapon", ""))
		if start == "":
			start = "m1911"
		if start == String(weapon.id):
			parts.append("Arma inicial do %s" % Save.catalog.display_name(map_id))
		for station: Dictionary in data.get("stations", []):
			if station.get("weaponId", "") == String(weapon.id):
				parts.append("Parede: %d · %s · %s" % [weapon.price, Save.catalog.display_name(map_id), _area_name(data, float(station.tx), float(station.ty))])
	if weapon.box_only and not weapon.maps.is_empty():
		parts.append("Mystery Box só no %s" % ", ".join(Array(weapon.maps).map(func(m: String) -> String: return Save.catalog.display_name(m))))
	else:
		parts.append("Mystery Box (em todos os mapas)" if parts.is_empty() else "também na Mystery Box")
	return " · ".join(parts)


func _area_name(data: Dictionary, tx: float, ty: float) -> String:
	for area: Dictionary in data.get("areas", []):
		for r: Dictionary in area.rects:
			if tx >= float(r.x) and tx < float(r.x) + float(r.w) and ty >= float(r.y) and ty < float(r.y) + float(r.h):
				return String(area.name)
	return ""


## Mecânica especial (como no jogo web) ou o quanto atravessa.
func special_text(weapon: WeaponData) -> String:
	var p := weapon.special_params
	match weapon.special_type:
		&"grenade":
			return "Granada explode no impacto: %d de dano em área (raio %.1f m). Não fere você." % [p.get("blast_damage", 0), p.get("blast_radius", 0)]
		&"flame":
			return "Jato contínuo que incendeia: %d de dano por segundo durante %.1f s." % [p.get("burn_dps", 0), p.get("burn_time", 0)]
		&"arc":
			return "Raio instantâneo que salta entre até %d zumbis e os atordoa." % p.get("chains", 0)
		&"plasma":
			return "Esfera que atravessa a horda e explode numa descarga elétrica (%d em área)." % p.get("blast_damage", 0)
		&"gust":
			return "Rajada de vento em cone (%d°, alcance %.0f m) que arremessa e destrói a horda à frente." % [p.get("arc_deg", 0), p.get("range", 0)]
	return ("Atravessa até %d zumbis por tiro." % weapon.pierce) if weapon.pierce > 0 else ""


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed(&"pause"):
		MenuKit.go(self, MENU)
