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
var _health_bar: ProgressBar
var _health_label: Label
var _weapon_label: Label
var _ammo_label: Label
var _prompt_label: Label
var _banner: Label
var _hit_marker: Label
var _pause_panel: Control
var _game_over_panel: Control
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
	Events.interaction_prompt.connect(func(text: String) -> void: _prompt_label.text = text)
	Events.zombie_hit.connect(func(_z: Node3D, _i: DamageInfo) -> void: _flash_hit(TEXT))
	Events.zombie_killed.connect(func(_z: Node3D, info: DamageInfo) -> void: _flash_hit(RED if info.is_headshot else GOLD))
	Events.pause_changed.connect(func(paused: bool) -> void: _pause_panel.visible = paused)
	Events.game_over.connect(_on_game_over)


func _process(_delta: float) -> void:
	# O marcador de acerto acompanha a mira do mouse.
	_hit_marker.position = get_viewport().get_mouse_position() - _hit_marker.size * 0.5


# ───────────────────────── Montagem ─────────────────────────

func _build() -> void:
	var root := Control.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)

	_round_label = _label(root, "ROUND", 54, RED, Control.PRESET_TOP_LEFT, HORIZONTAL_ALIGNMENT_LEFT, -8)
	_remaining_label = _label(root, "", 16, TEXT, Control.PRESET_TOP_LEFT, HORIZONTAL_ALIGNMENT_LEFT, 62)

	_points_label = _label(root, "0", 40, GOLD, Control.PRESET_TOP_RIGHT, HORIZONTAL_ALIGNMENT_RIGHT, -6)
	_points_delta = _label(root, "", 18, GOLD, Control.PRESET_TOP_RIGHT, HORIZONTAL_ALIGNMENT_RIGHT, 44)

	_health_bar = ProgressBar.new()
	_health_bar.show_percentage = false
	_health_bar.custom_minimum_size = Vector2(240, 14)
	_health_bar.add_theme_stylebox_override(&"fill", _flat(RED))
	_health_bar.add_theme_stylebox_override(&"background", _flat(Color(0.1, 0.1, 0.1, 0.8)))
	root.add_child(_health_bar)
	_health_bar.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT, Control.PRESET_MODE_KEEP_SIZE, MARGIN)
	_health_label = _label(root, "VIDA", 15, TEXT, Control.PRESET_BOTTOM_LEFT, HORIZONTAL_ALIGNMENT_LEFT, -22)

	_weapon_label = _label(root, "", 18, TEXT, Control.PRESET_BOTTOM_RIGHT, HORIZONTAL_ALIGNMENT_RIGHT, -46)
	_ammo_label = _label(root, "", 36, TEXT, Control.PRESET_BOTTOM_RIGHT, HORIZONTAL_ALIGNMENT_RIGHT)

	_prompt_label = _label(root, "", 20, TEXT, Control.PRESET_CENTER_BOTTOM, HORIZONTAL_ALIGNMENT_CENTER, -110)

	_banner = _label(root, "", 56, RED, Control.PRESET_CENTER_TOP, HORIZONTAL_ALIGNMENT_CENTER, 130)
	_banner.modulate.a = 0.0

	_hit_marker = _label(root, "✕", 26, TEXT, Control.PRESET_TOP_LEFT, HORIZONTAL_ALIGNMENT_CENTER)
	_hit_marker.modulate.a = 0.0

	_pause_panel = _overlay(root, "PAUSADO", "ESC para continuar")
	_game_over_panel = _overlay(root, "VOCÊ MORREU", "")
	_game_over_text = _game_over_panel.get_node("Box/Subtitle") as Label
	var button := Button.new()
	button.text = "JOGAR NOVAMENTE"
	button.custom_minimum_size = Vector2(260, 48)
	button.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	button.pressed.connect(func() -> void: Events.restart_requested.emit())
	_game_over_panel.get_node("Box").add_child(button)


## Rótulo preso a um canto (preset) com a margem padrão; `dy` desloca na vertical.
func _label(parent: Control, text: String, size: int, color: Color, preset: Control.LayoutPreset, align: HorizontalAlignment = HORIZONTAL_ALIGNMENT_LEFT, dy: float = 0.0) -> Label:
	var label := Label.new()
	label.text = text
	label.horizontal_alignment = align
	label.add_theme_font_size_override(&"font_size", size)
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
	title_label.add_theme_font_size_override(&"font_size", 64)
	title_label.add_theme_color_override(&"font_color", RED)
	box.add_child(title_label)
	var subtitle_label := Label.new()
	subtitle_label.name = "Subtitle"
	subtitle_label.text = subtitle
	subtitle_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	subtitle_label.add_theme_font_size_override(&"font_size", 20)
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


func _on_game_over(summary: Dictionary) -> void:
	_game_over_text.text = "Round %d  ·  %d abates (%d na cabeça)  ·  %d pontos  ·  %ds" % [
		summary.round, summary.kills, summary.headshots, summary.points, summary.time_seconds]
	_game_over_panel.visible = true
	_game_over_panel.modulate.a = 0.0
	create_tween().tween_property(_game_over_panel, "modulate:a", 1.0, 0.8).set_delay(0.6)


func _show_banner(text: String, color: Color) -> void:
	_banner.text = text
	_banner.add_theme_color_override(&"font_color", color)
	var tween := create_tween()
	tween.tween_property(_banner, "modulate:a", 1.0, 0.3)
	tween.tween_interval(1.6)
	tween.tween_property(_banner, "modulate:a", 0.0, 0.6)


func _flash_hit(color: Color) -> void:
	_hit_marker.add_theme_color_override(&"font_color", color)
	_hit_marker.modulate.a = 1.0
	create_tween().tween_property(_hit_marker, "modulate:a", 0.0, 0.18)
