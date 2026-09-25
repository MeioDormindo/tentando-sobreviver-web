class_name Hud
extends CanvasLayer
## HUD (seção 27): vida, munição, arma, pontos, round, interação, marcador de acerto e as
## telas de pausa e de fim de jogo. Só escuta o barramento Events; não conhece os sistemas.
## Monta os controles em código com âncoras, para se ajustar a qualquer resolução.

const RED := Color(0.72, 0.18, 0.16)
const GOLD := Color(0.89, 0.78, 0.48)
const TEXT := Color(0.91, 0.89, 0.78)
const DIM := Color(0.6, 0.6, 0.56)
const MARGIN := 24

var _round_label: Label
var _remaining_label: Label
var _points_label: Label
var _points_delta: Label
var _score_label: Label
var _invalid_label: Label
var _health_bar: ProgressBar
var _health_label: Label
var _weapon_label: Label
var _ammo_label: Label
var _other_weapon_label: Label
var _weapon_icon: TextureRect
var _other_weapon_icon: TextureRect
var _prompt_label: Label
var _banner: Label
var _toast: Label
var _perks_label: Label
var _armor_bar: ProgressBar
var _timers_label: Label
var _event_label: Label
var _quest_title: Label
var _quest_text: Label
var _boss_bar: ProgressBar
var _boss_label: Label
var _hit_marker: Label
var _pause_menu: PauseMenu
var minimap: Minimap
var _game_over_panel: Control
## Vinheta (mais forte no escuro) e o indicador da lanterna.
const VIGNETTE := {"lit": 0.3, "dim": 0.5, "dark": 0.75}
var _vignette: ColorRect
var _flashlight_label: Label
var _ammo_box: VBoxContainer
## Rótulos dos painéis que somem quando ficam vazios.
var _auto_hide: Array[Label] = []
var _flashlight_on := true
var _lighting := "dim"
var _game_over_text: Label


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_build()
	Events.round_started.connect(_on_round_started)
	Events.round_remaining_changed.connect(func(remaining: int) -> void: _remaining_label.text = "ZUMBIS RESTANTES  %d" % remaining)
	Events.round_completed.connect(func(n: int) -> void: _show_banner("ROUND %d COMPLETO" % n, GOLD))
	Events.points_changed.connect(_on_points_changed)
	Events.player_health_changed.connect(_on_health_changed)
	Events.ammo_changed.connect(_on_ammo_changed)
	Events.weapon_visual_changed.connect(func(weapon_id: StringName, level: int, other_id: StringName, other_level: int) -> void:
		_set_icon(_weapon_icon, weapon_id, level)
		_set_icon(_other_weapon_icon, other_id, other_level))
	Events.weapon_changed.connect(func(_current: String, other: String) -> void: _other_weapon_label.text = ("[Q] " + other.to_upper()) if other != "" else "")
	Events.interaction_prompt.connect(func(text: String) -> void: _prompt_label.text = text)
	Events.zombie_hit.connect(func(_z: Node3D, info: DamageInfo) -> void: if info.kind != DamageInfo.Kind.BURN: _flash_hit(TEXT))
	Events.zombie_killed.connect(func(_z: Node3D, info: DamageInfo) -> void: _flash_hit(RED if info.is_headshot else GOLD))
	Events.area_opened.connect(func(_id: StringName, area_name: String) -> void: _show_banner("ÁREA LIBERADA: " + area_name.to_upper(), GOLD))
	Events.purchase_denied.connect(func() -> void: _flash_points_denied())
	Events.toast.connect(_show_toast)
	Events.cheat_detected.connect(_on_cheat_detected)
	Events.player_armor_changed.connect(func(current: float, maximum: float) -> void:
		_armor_bar.get_parent().visible = current > 0.0
		_armor_bar.max_value = maximum
		_armor_bar.value = current)
	Events.power_up_timers.connect(func(active: Dictionary, definitions: Dictionary) -> void:
		var parts: Array[String] = []
		for id: StringName in active:
			var info: Dictionary = definitions.get(id, {"name": "Fúria"})
			parts.append("%s %ds" % [String(info.get("name", id)).to_upper(), ceili(float(active[id]))])
		_timers_label.text = "   ".join(parts))
	Events.power_up_collected.connect(func(_id: StringName, power_up_name: String, color: Color, detail: String) -> void:
		_show_banner(power_up_name.to_upper(), color)
		if detail != "":
			_show_toast(detail))
	Events.achievement_unlocked.connect(func(_id: String, achievement_name: String, _d: String) -> void:
		_show_toast("CONQUISTA DESBLOQUEADA: " + achievement_name.to_upper()))
	Events.score_changed.connect(func(total: int, _delta: int) -> void: _score_label.text = "SCORE %d" % total)
	Events.map_unlocked.connect(func(_id: String, map_name: String) -> void: _show_banner(map_name.to_upper() + " DESBLOQUEADO!", GOLD))
	Events.boss_incoming.connect(func(boss_name: String) -> void: _show_banner(boss_name.to_upper() + " SE APROXIMA", RED))
	Events.boss_state.connect(_on_boss_state)
	Events.boss_phase.connect(func(_n: String, phase: int) -> void: _show_toast("FASE %d" % phase))
	Events.boss_defeated.connect(func(_id: StringName, boss_name: String, reward: int, _at: Vector3) -> void:
		_boss_bar.visible = false
		_boss_label.text = ""
		_show_banner("%s DERROTADO  +%d" % [boss_name.to_upper(), reward], GOLD))
	Events.hound_round_changed.connect(_on_hound_round)
	Events.max_ammo.connect(func(_at: Vector3) -> void: _show_toast("MAX AMMO"))
	Events.power_changed.connect(func(on: bool) -> void: if on: _show_banner("ENERGIA LIGADA", GOLD))
	Events.perks_changed.connect(func(names: Array[String]) -> void: _perks_label.text = "  ·  ".join(names).to_upper())
	Events.world_event_started.connect(func(_id: StringName, event_name: String, hint: String, color: Color) -> void:
		_show_banner(event_name, color)
		_show_toast(hint))
	Events.world_event_state.connect(func(state: Dictionary) -> void:
		if state.is_empty():
			_event_label.text = ""
			return
		var remaining := float(state.remaining)
		_event_label.text = String(state.name) + ("  %ds" % ceili(remaining) if remaining >= 0.0 else "")
		_event_label.add_theme_color_override(&"font_color", state.color))
	Events.quest_state.connect(func(state: Dictionary) -> void:
		if state.is_empty():
			_quest_title.text = ""
			_quest_text.text = ""
			return
		_quest_title.text = "◆ %s  %d/%d" % [state.title, state.step, state.total]
		_quest_text.text = String(state.objective))
	Events.quest_completed.connect(func(_id: StringName, title: String, subtitle: String) -> void:
		_show_banner(title, GOLD)
		_show_toast(subtitle))
	Events.settings_changed.connect(func() -> void: minimap.apply_settings())
	Events.game_over.connect(_on_game_over)
	Events.flashlight_toggled.connect(func(on: bool) -> void:
		_flashlight_on = on
		_update_flashlight_label())
	Events.lighting_changed.connect(_on_lighting_changed)
	# O jogador pode ter anunciado a arma antes de a HUD existir: pede de novo.
	(func() -> void:
		var player := get_tree().get_first_node_in_group(&"player")
		if player and player.has_method(&"announce_weapon"):
			player.announce_weapon()).call_deferred()


func _process(_delta: float) -> void:
	for label in _auto_hide:
		label.visible = label.text != ""
	# Ícones das armas empilhados acima do painel de munição (a altura dele muda).
	var screen := get_viewport().get_visible_rect().size
	var icons_top := screen.y - 12.0 - (_ammo_box.get_parent() as Control).size.y - 8.0
	_weapon_icon.position = Vector2(screen.x - 12.0 - _weapon_icon.size.x, icons_top - _weapon_icon.size.y)
	_other_weapon_icon.position = Vector2(screen.x - 12.0 - _other_weapon_icon.size.x, _weapon_icon.position.y - 8.0 - _other_weapon_icon.size.y)
	if _quest_title.text != "":
		var top := Minimap.CORNER.y + minimap.screen_height() + 36.0 if minimap.visible and not minimap.expanded else Minimap.CORNER.y
		_quest_title.position = Vector2(MARGIN, top)
		_quest_text.position = Vector2(MARGIN, top + 28.0)
	# O marcador de acerto acompanha a mira do mouse.
	_hit_marker.position = get_viewport().get_mouse_position() - _hit_marker.size * 0.5


# ───────────────────────── Montagem ─────────────────────────

func _build() -> void:
	var root := Control.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)

	# Vinheta atrás de tudo da HUD.
	_vignette = ColorRect.new()
	_vignette.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_vignette.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var vignette_material := ShaderMaterial.new()
	vignette_material.shader = load("res://shaders/vignette.gdshader")
	vignette_material.set_shader_parameter(&"strength", VIGNETTE.dim)
	_vignette.material = vignette_material
	root.add_child(_vignette)

	# Cantos em painéis de pixel art (como a referência): ROUND, PONTOS, VIDA e MUNIÇÃO.
	var round_box := _corner_panel(root, Control.PRESET_TOP_LEFT)
	_round_label = _text(round_box, "ROUND", 39, RED)
	_remaining_label = _text(round_box, "", 26, TEXT)

	var points_box := _corner_panel(root, Control.PRESET_TOP_RIGHT)
	_points_label = _text(points_box, "0", 39, GOLD, HORIZONTAL_ALIGNMENT_RIGHT)
	_score_label = _text(points_box, "SCORE 0", 26, DIM, HORIZONTAL_ALIGNMENT_RIGHT)
	_invalid_label = _text(points_box, "", 26, RED, HORIZONTAL_ALIGNMENT_RIGHT)
	# Ganho de pontos: fora do painel, logo abaixo (some sozinho).
	_points_delta = _label(root, "", 26, GOLD, Control.PRESET_TOP_RIGHT, HORIZONTAL_ALIGNMENT_RIGHT, 108)

	var health_box := _corner_panel(root, Control.PRESET_BOTTOM_LEFT)
	_perks_label = _text(health_box, "", 26, GOLD)
	_health_label = _text(health_box, "VIDA", 26, TEXT)
	var health: Array = PixelSkin.bar(RED, 260.0)
	health_box.add_child(health[0])
	_health_bar = health[1]
	var armor: Array = PixelSkin.bar(Color(0.24, 0.56, 0.84), 260.0, 6.0)
	health_box.add_child(armor[0])
	_armor_bar = armor[1]
	(armor[0] as Control).visible = false
	_flashlight_label = _text(health_box, "", 26, GOLD)
	_update_flashlight_label()
	_timers_label = _label(root, "", 16, TEXT, Control.PRESET_CENTER_BOTTOM, HORIZONTAL_ALIGNMENT_CENTER, -70)
	_event_label = _label(root, "", 18, TEXT, Control.PRESET_CENTER_TOP, HORIZONTAL_ALIGNMENT_CENTER, 48)

	_ammo_box = _corner_panel(root, Control.PRESET_BOTTOM_RIGHT)
	_other_weapon_label = _text(_ammo_box, "", 26, DIM, HORIZONTAL_ALIGNMENT_RIGHT)
	_weapon_label = _text(_ammo_box, "", 26, TEXT, HORIZONTAL_ALIGNMENT_RIGHT)
	_ammo_label = _text(_ammo_box, "", 39, TEXT, HORIZONTAL_ALIGNMENT_RIGHT)
	# Ícones em pixel art da arma em mãos (grande) e da reserva (pequeno, apagado), acima do painel.
	_weapon_icon = _icon_rect(root, 2.0, Vector2(-MARGIN, -100))
	_other_weapon_icon = _icon_rect(root, 1.0, Vector2(-MARGIN, -100))
	_other_weapon_icon.modulate = Color(1, 1, 1, 0.55)

	_prompt_label = _label(root, "", 20, TEXT, Control.PRESET_CENTER_BOTTOM, HORIZONTAL_ALIGNMENT_CENTER, -110)

	_banner = _label(root, "", 36, RED, Control.PRESET_CENTER_TOP, HORIZONTAL_ALIGNMENT_CENTER, 130)
	_banner.modulate.a = 0.0
	_toast = _label(root, "", 20, GOLD, Control.PRESET_CENTER_TOP, HORIZONTAL_ALIGNMENT_CENTER, 220)
	_boss_label = _label(root, "", 18, RED, Control.PRESET_CENTER_TOP, HORIZONTAL_ALIGNMENT_CENTER, 4)
	var boss: Array = PixelSkin.bar(RED, 420.0)
	var boss_frame := boss[0] as Control
	root.add_child(boss_frame)
	boss_frame.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP, Control.PRESET_MODE_MINSIZE, MARGIN)
	boss_frame.grow_horizontal = Control.GROW_DIRECTION_BOTH
	boss_frame.offset_top += 34
	boss_frame.offset_bottom += 34
	_boss_bar = boss[1]
	_boss_bar.visibility_changed.connect(func() -> void: boss_frame.visible = _boss_bar.visible)
	boss_frame.visible = false
	_boss_bar.visible = false
	_toast.modulate.a = 0.0

	_hit_marker = _label(root, "✕", 26, TEXT, Control.PRESET_TOP_LEFT, HORIZONTAL_ALIGNMENT_CENTER)
	_hit_marker.modulate.a = 0.0

	minimap = Minimap.new()
	minimap.name = "Minimap"
	root.add_child(minimap)
	# Missão principal: logo abaixo do minimapa.
	_quest_title = _label(root, "", 13, GOLD, Control.PRESET_TOP_LEFT)
	_quest_text = _label(root, "", 15, TEXT, Control.PRESET_TOP_LEFT)
	_quest_text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_quest_text.custom_minimum_size.x = 260
	_pause_menu = PauseMenu.new()
	_pause_menu.name = "PauseMenu"
	root.add_child(_pause_menu)
	_game_over_panel = _overlay(root, "GAME OVER", "")
	_game_over_text = _game_over_panel.get_node("Box/Subtitle") as Label


## Ícone pixel art (sem suavização) preso ao canto de baixo à direita.
func _icon_rect(root: Control, zoom: float, offset: Vector2) -> TextureRect:
	var rect := TextureRect.new()
	rect.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT
	rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	rect.set_meta(&"zoom", zoom)
	rect.set_meta(&"offset", offset)
	root.add_child(rect)
	return rect


func _set_icon(rect: TextureRect, weapon_id: StringName, level: int) -> void:
	var path := "res://assets/sprites/icons/%s.png" % Player.gun_sheet(weapon_id, level)
	if weapon_id == &"" or not ResourceLoader.exists(path):
		rect.texture = null
		return
	rect.texture = load(path)
	var size: Vector2 = rect.texture.get_size() * float(rect.get_meta(&"zoom"))
	rect.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	rect.size = size


## Painel de pixel art preso a um canto (cresce para dentro da tela); devolve a coluna.
func _corner_panel(root: Control, preset: Control.LayoutPreset) -> VBoxContainer:
	var panel := PanelContainer.new()
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	panel.add_theme_stylebox_override(&"panel", PixelSkin.panel(false, 10.0))
	root.add_child(panel)
	panel.set_anchors_and_offsets_preset(preset, Control.PRESET_MODE_MINSIZE, 12)
	if preset in [Control.PRESET_TOP_RIGHT, Control.PRESET_BOTTOM_RIGHT]:
		panel.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	if preset in [Control.PRESET_BOTTOM_LEFT, Control.PRESET_BOTTOM_RIGHT]:
		panel.grow_vertical = Control.GROW_DIRECTION_BEGIN
	var column := VBoxContainer.new()
	column.add_theme_constant_override(&"separation", 2)
	column.mouse_filter = Control.MOUSE_FILTER_IGNORE
	panel.add_child(column)
	return column


## Texto dentro de um painel (some sozinho quando fica vazio).
func _text(parent: Control, text: String, size: int, color: Color, align: HorizontalAlignment = HORIZONTAL_ALIGNMENT_LEFT) -> Label:
	var label := Label.new()
	label.text = text
	label.horizontal_alignment = align
	label.add_theme_font_size_override(&"font_size", MenuKit.px(size))
	label.add_theme_color_override(&"font_color", color)
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(label)
	_auto_hide.append(label)
	return label


## Rótulo preso a um canto (preset) com a margem padrão; `dy` desloca na vertical.
func _label(parent: Control, text: String, size: int, color: Color, preset: Control.LayoutPreset, align: HorizontalAlignment = HORIZONTAL_ALIGNMENT_LEFT, dy: float = 0.0) -> Label:
	var label := Label.new()
	label.text = text
	label.horizontal_alignment = align
	label.add_theme_font_size_override(&"font_size", MenuKit.px(size))
	label.add_theme_color_override(&"font_color", color)
	label.add_theme_color_override(&"font_outline_color", Color.BLACK)
	label.add_theme_constant_override(&"outline_size", maxi(4, size / 8))
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	if align != HORIZONTAL_ALIGNMENT_LEFT:
		label.grow_horizontal = Control.GROW_DIRECTION_BEGIN if align == HORIZONTAL_ALIGNMENT_RIGHT else Control.GROW_DIRECTION_BOTH
	parent.add_child(label)
	label.set_anchors_and_offsets_preset(preset, Control.PRESET_MODE_KEEP_SIZE, MARGIN)
	label.offset_top += dy
	label.offset_bottom += dy
	return label


func _overlay(parent: Control, title: String, subtitle: String) -> Control:
	var panel := ColorRect.new()
	panel.color = Color(0, 0, 0, 0.72)
	panel.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	panel.visible = false
	parent.add_child(panel)
	var box := VBoxContainer.new()
	box.name = "Box"
	box.alignment = BoxContainer.ALIGNMENT_CENTER
	box.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	box.add_theme_constant_override(&"separation", 18)
	panel.add_child(box)
	var title_label := Label.new()
	title_label.text = title
	title_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title_label.add_theme_font_size_override(&"font_size", MenuKit.px(64))
	title_label.add_theme_color_override(&"font_color", RED)
	box.add_child(title_label)
	var subtitle_label := Label.new()
	subtitle_label.name = "Subtitle"
	subtitle_label.text = subtitle
	subtitle_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	subtitle_label.add_theme_font_size_override(&"font_size", MenuKit.px(20))
	subtitle_label.add_theme_color_override(&"font_color", TEXT)
	box.add_child(subtitle_label)
	return panel


func _flat(color: Color) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = color
	return style


# ───────────────────────── Eventos ─────────────────────────

func _on_round_started(round_number: int, total: int) -> void:
	_round_label.text = "ROUND %d" % round_number
	_remaining_label.text = "ZUMBIS RESTANTES  %d" % total
	_show_banner("ROUND %d" % round_number, RED)


func _on_boss_state(boss_name: String, current: float, maximum: float, phase: int) -> void:
	_boss_bar.visible = current > 0.0
	_boss_bar.max_value = maximum
	_boss_bar.value = current
	_boss_label.text = "%s  ·  FASE %d" % [boss_name.to_upper(), phase] if current > 0.0 else ""


func _on_hound_round(active: bool, _config: Dictionary) -> void:
	if active:
		_show_banner("RODADA DOS CÃES", Color(0.55, 0.75, 1.0))


func _on_points_changed(total: int, delta: int) -> void:
	_points_label.text = str(total)
	if delta == 0:
		return
	_points_delta.text = ("+%d" % delta) if delta > 0 else str(delta)
	_points_delta.add_theme_color_override(&"font_color", GOLD if delta > 0 else RED)
	_points_delta.modulate.a = 1.0
	create_tween().tween_property(_points_delta, "modulate:a", 0.0, 0.8).set_delay(0.4)


func _on_health_changed(current: float, maximum: float) -> void:
	_health_bar.max_value = maximum
	_health_bar.value = current
	_health_label.text = "VIDA  %d / %d" % [roundi(current), roundi(maximum)]


func _on_ammo_changed(weapon_name: String, magazine: int, reserve: int, reloading: bool) -> void:
	_weapon_label.text = weapon_name.to_upper() + ("  ·  RECARREGANDO" if reloading else "")
	_ammo_label.text = "%d / %d" % [magazine, reserve]
	_ammo_label.add_theme_color_override(&"font_color", RED if magazine == 0 else TEXT)


## Fim de jogo (como no jogo web): score, estatísticas em duas colunas, recorde e, se entrou
## no top do mapa, o nome para o ranking.
func _on_game_over(summary: Dictionary) -> void:
	var box := _game_over_panel.get_node("Box") as VBoxContainer
	_game_over_text.text = "SCORE %d" % summary.score
	_game_over_text.add_theme_font_size_override(&"font_size", MenuKit.px(32))
	var accuracy := roundi(100.0 * summary.shots_hit / summary.shots_fired) if summary.shots_fired > 0 else 0
	var rows := [
		["ROUND", str(summary.round)], ["ZUMBIS ABATIDOS", str(summary.kills)], ["HEADSHOTS", str(summary.headshots)],
		["PONTOS GANHOS", str(summary.points_earned)], ["TEMPO", "%d:%02d" % [summary.time_seconds / 60, summary.time_seconds % 60]],
		["BOSSES", str(summary.bosses)], ["DANO CAUSADO", str(summary.damage)], ["DISPAROS / ACERTOS", "%d / %d" % [summary.shots_fired, summary.shots_hit]],
		["PRECISÃO", "%d%%" % accuracy], ["ABATES NA FACA", str(summary.knife_kills)],
	]
	var grid := GridContainer.new()
	grid.columns = 4
	grid.add_theme_constant_override(&"h_separation", 28)
	grid.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	for row in rows:
		for i in 2:
			var cell := Label.new()
			cell.text = row[i]
			cell.add_theme_font_size_override(&"font_size", MenuKit.px(15 if i == 0 else 17))
			cell.add_theme_color_override(&"font_color", DIM if i == 0 else TEXT)
			grid.add_child(cell)
	box.add_child(grid)
	var record := Label.new()
	record.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	record.text = "NOVO RECORDE!" if summary.new_record else "RECORDE: %d PONTOS · ROUND %d" % [summary.best_score, summary.best_wave]
	record.add_theme_font_size_override(&"font_size", MenuKit.px(26 if summary.new_record else 15))
	record.add_theme_color_override(&"font_color", GOLD if summary.new_record else DIM)
	box.add_child(record)
	if summary.cheat_taunt != "":
		record.text = "PARTIDA INVALIDADA — NÃO VALE SAVE NEM RANKING"
		record.add_theme_color_override(&"font_color", RED)
		var taunt := Label.new()
		taunt.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		taunt.text = summary.cheat_taunt
		taunt.add_theme_font_size_override(&"font_size", MenuKit.px(26))
		taunt.add_theme_color_override(&"font_color", Color(1.0, 0.48, 0.36))
		box.add_child(taunt)
	elif summary.score > 0 and (summary.rank_eligible or Online.is_configured()):
		_add_ranking_entry(box, summary)
	var buttons := HBoxContainer.new()
	buttons.alignment = BoxContainer.ALIGNMENT_CENTER
	buttons.add_theme_constant_override(&"separation", 24)
	box.add_child(buttons)
	var again := _menu_button(buttons, "JOGAR NOVAMENTE", func() -> void: Events.restart_requested.emit())
	_menu_button(buttons, "RANKING", func() -> void:
		Session.map_id = summary.map_id
		get_tree().paused = false
		get_tree().change_scene_to_file("res://scenes/ui/ranking.tscn"))
	_menu_button(buttons, "MENU", func() -> void:
		get_tree().paused = false
		get_tree().change_scene_to_file("res://scenes/ui/main_menu.tscn"))
	again.grab_focus.call_deferred()
	_game_over_panel.visible = true
	_game_over_panel.modulate.a = 0.0
	create_tween().tween_property(_game_over_panel, "modulate:a", 1.0, 0.8).set_delay(0.6)


## Anti-trapaça: zoa o jogador e deixa um aviso fixo de partida invalidada.
func _on_cheat_detected(taunt: String, subtitle: String) -> void:
	_invalid_label.text = "PARTIDA INVALIDADA"
	var message := _label(_banner.get_parent() as Control, "%s\n%s" % [taunt, subtitle], 30, Color(1.0, 0.48, 0.36), Control.PRESET_CENTER, HORIZONTAL_ALIGNMENT_CENTER, -60)
	message.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	message.custom_minimum_size = Vector2(900, 0)
	message.set_anchors_and_offsets_preset(Control.PRESET_CENTER, Control.PRESET_MODE_KEEP_SIZE)
	var tween := create_tween()
	tween.tween_interval(5.0)
	tween.tween_property(message, "modulate:a", 0.0, 0.8)
	tween.tween_callback(message.queue_free)


## Campo do nome (abre o teclado no celular) e botão para gravar no ranking local.
func _add_ranking_entry(box: VBoxContainer, summary: Dictionary) -> void:
	var line := HBoxContainer.new()
	line.alignment = BoxContainer.ALIGNMENT_CENTER
	box.add_child(line)
	var hint := Label.new()
	hint.text = "ENTROU NO TOP! SEU NOME:" if summary.rank_eligible else "SEU NOME PARA O RANKING GLOBAL:"
	hint.add_theme_color_override(&"font_color", GOLD)
	line.add_child(hint)
	var edit := LineEdit.new()
	MenuKit.style_edit(edit)
	edit.name = "RankName"
	edit.text = Account.current_user().to_upper().substr(0, Save.catalog.player_name_max) if Account.current_user() != "" else Save.player_name
	edit.max_length = Save.catalog.player_name_max
	edit.custom_minimum_size = Vector2(220, 0)
	line.add_child(edit)
	var submit := func() -> void:
		var player := edit.text.strip_edges().substr(0, Save.catalog.player_name_max).to_upper()
		if player == "":
			player = "SOBREVIVENTE"
		Save.set_setting("playerName", player)
		var position := Save.add_ranking(summary.map_id, player, summary.score, summary.round, summary.kills)
		var index := line.get_index()
		line.queue_free()
		var result := Label.new()
		result.name = "RankResult"
		result.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		result.text = "%dº LUGAR NO RANKING DE %s!" % [position, Save.catalog.display_name(summary.map_id).to_upper()] if position > 0 else ""
		result.add_theme_color_override(&"font_color", GOLD)
		box.add_child(result)
		box.move_child(result, index)
		if Online.is_configured():
			var global := Label.new()
			global.name = "GlobalResult"
			global.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			global.text = "ENVIANDO AO RANKING GLOBAL..."
			global.add_theme_color_override(&"font_color", DIM)
			box.add_child(global)
			box.move_child(global, index + 1)
			var error_text: String = await Leaderboard.submit(Online, summary.map_id, player, summary.score, summary.round, summary.kills)
			if is_instance_valid(global):
				global.text = ("RANKING GLOBAL: " + error_text.to_upper()) if error_text != "" else "ENVIADO AO RANKING GLOBAL DA TEMPORADA!"
				global.add_theme_color_override(&"font_color", RED if error_text != "" else GOLD)
	edit.text_submitted.connect(func(_t: String) -> void: submit.call())
	_menu_button(line, "SALVAR", submit)


func _menu_button(parent: Control, text: String, on_press: Callable) -> Button:
	var button := Button.new()
	button.text = text
	button.custom_minimum_size = Vector2(180, 44)
	MenuKit.style_button(button)
	button.pressed.connect(on_press)
	parent.add_child(button)
	return button


func _show_banner(text: String, color: Color) -> void:
	_banner.text = text
	_banner.add_theme_color_override(&"font_color", color)
	var tween := create_tween()
	tween.tween_property(_banner, "modulate:a", 1.0, 0.3)
	tween.tween_interval(1.6)
	tween.tween_property(_banner, "modulate:a", 0.0, 0.6)


func _update_flashlight_label() -> void:
	_flashlight_label.text = "LANTERNA %s  [F]" % ("LIGADA" if _flashlight_on else "DESLIGADA")
	_flashlight_label.modulate = GOLD if _flashlight_on else DIM


## Luz da área mudou: vinheta mais forte no escuro e, com a lanterna desligada, o aviso.
func _on_lighting_changed(lighting: String) -> void:
	var was := _lighting
	_lighting = lighting
	var tween := create_tween()
	tween.tween_property(_vignette.material, "shader_parameter/strength", float(VIGNETTE.get(lighting, VIGNETTE.dim)), 1.2)
	if lighting == "dark" and was != "dark" and not _flashlight_on:
		_show_toast("ESTÁ ESCURO — [F] LIGA A LANTERNA")


func _show_toast(text: String) -> void:
	_toast.text = text
	create_tween().kill()
	var tween := create_tween()
	tween.tween_property(_toast, "modulate:a", 1.0, 0.2)
	tween.tween_interval(2.4)
	tween.tween_property(_toast, "modulate:a", 0.0, 0.5)


func _flash_points_denied() -> void:
	_points_label.add_theme_color_override(&"font_color", RED)
	var tween := create_tween()
	tween.tween_interval(0.35)
	tween.tween_callback(func() -> void: _points_label.add_theme_color_override(&"font_color", GOLD))


func _flash_hit(color: Color) -> void:
	_hit_marker.add_theme_color_override(&"font_color", color)
	_hit_marker.modulate.a = 1.0
	create_tween().tween_property(_hit_marker, "modulate:a", 0.0, 0.18)
