class_name Hud
extends CanvasLayer
## HUD (seção 27): vida, munição, arma, pontos, round, interação, marcador de acerto e as
## telas de pausa e de fim de jogo. Só escuta o barramento Events; não conhece os sistemas.
## Monta os controles em código com âncoras, para se ajustar a qualquer resolução.

const RED := Color(0.72, 0.18, 0.16)
const GOLD := Color(0.89, 0.78, 0.48)
const TEXT := Color(0.91, 0.89, 0.78)
const DIM := Color(0.6, 0.6, 0.56)
## Dinheiro (o seu e o dos colegas), em verde com cifrão.
const MONEY := Color(0.45, 0.88, 0.38)
const MARGIN := 24

## Selo hexagonal dos ícones de power-up/perk (scripts/godot/pixel/badge.mjs): moldura metálica
## neutra + anel tingido na cor do power-up/perk + placa escura onde o ícone entra por cima.
const BADGE_FRAME := "res://assets/sprites/ui/badge_frame.png"
const BADGE_RING := "res://assets/sprites/ui/badge_ring.png"
const BADGE_BACK := "res://assets/sprites/ui/badge_back.png"
const POWER_BADGE_SIZE := 40.0
const PERK_BADGE_SIZE := 32.0
const BLESSING_BADGE_SIZE := 36.0

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
## Moldura atrás dos ícones de arma (antes ficavam pelados) — acompanha o tamanho de cada
## arma (a arte já vem recortada rente à silhueta, então o tamanho varia por arma).
var _weapon_icon_bg: Panel
var _other_weapon_icon_bg: Panel
const WEAPON_ICON_PAD := 6.0
var _prompt_row: HBoxContainer
var _prompt_label: Label
var _prompt_icon: TextureRect
var _prompt_bar_frame: Control
var _prompt_bar: ProgressBar
const PROMPT_ICON_SIZE := 26.0
var _banner: Label
var _toast_row: HBoxContainer
var _toast: Label
var _toast_icon: TextureRect
var _boss_row: HBoxContainer
var _event_row: HBoxContainer
var _event_badge: Control
const SMALL_BADGE_SIZE := 20.0
## Ícones dos perks comprados (não expiram: sem contagem, ao contrário dos power-ups).
var _perks_row: HBoxContainer
var _armor_bar: ProgressBar
## Faixa embaixo-centro (bênção, power-ups, prompt de interação), um VBoxContainer só — antes
## cada um tinha seu próprio deslocamento fixo "no olho" e podiam se sobrepor.
var _bottom_center: VBoxContainer
## Bênção ativa (Templo dos Mortos): selo do deus (troca a cada bênção) + texto.
var _blessing_row: HBoxContainer
var _blessing_label: Label
var _blessing_badge: Control
## Ícones dos power-ups com tempo ativos (id → ícone + contagem), no lugar do texto antigo:
## bem menos poluído, igual ao jogo web.
var _power_row: HBoxContainer
var _power_icons: Dictionary
var _event_label: Label
var _quest_title: Label
var _quest_text: Label
var _boss_bar: ProgressBar
var _boss_label: Label
## Marcador de acerto (só os seus acertos) e onde ele está no mundo (toque e controle).
var _hit_marker: HitMarker
var _hit_at := Vector3.ZERO
var _damage_numbers: DamageNumbers
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
## Controles de toque (celular); ficam escondidos no PC.
var touch: TouchControls


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_build()
	Events.round_started.connect(_on_round_started)
	Events.round_remaining_changed.connect(func(remaining: int) -> void: _remaining_label.text = Loc.t("ZUMBIS RESTANTES  %d") % remaining)
	Events.round_completed.connect(func(n: int) -> void: _show_banner(Loc.t("ROUND %d COMPLETO") % n, GOLD))
	Events.points_changed.connect(_on_points_changed)
	Events.player_health_changed.connect(_on_health_changed)
	Events.ammo_changed.connect(_on_ammo_changed)
	Events.weapon_visual_changed.connect(func(weapon_id: StringName, level: int, other_id: StringName, other_level: int) -> void:
		_set_icon(_weapon_icon, weapon_id, level)
		_set_icon(_other_weapon_icon, other_id, other_level))
	Events.weapon_changed.connect(func(_current: String, other: String) -> void: _other_weapon_label.text = ("[%s] " % InputBindings.hint_label(&"switch_weapon") + Loc.t(other).to_upper()) if other != "" else "")
	Events.interaction_prompt.connect(func(text: String, icon: String, progress: float) -> void:
		_prompt_label.text = Loc.text(text)
		# Celular: o USAR pulsa quando a dica pede ele (a mensagem leva a ação "interact").
		touch.set_highlight(&"interact", text.contains(Loc.KEY + "interact"))
		_prompt_icon.visible = icon != "" and ResourceLoader.exists(icon)
		if _prompt_icon.visible:
			_prompt_icon.texture = load(icon)
		_prompt_bar_frame.visible = progress >= 0.0
		if _prompt_bar_frame.visible:
			_prompt_bar.value = progress * 100.0)
	Events.hit_confirmed.connect(_on_hit_confirmed)
	Events.area_opened.connect(func(_id: StringName, area_name: String) -> void: _show_banner(Loc.t("ÁREA LIBERADA: %s") % Loc.t(area_name).to_upper(), GOLD))
	Events.purchase_denied.connect(func() -> void: _flash_points_denied())
	Events.toast.connect(_show_toast)
	Events.team_feed.connect(_on_team_feed)
	Events.player_downed.connect(_on_player_downed)
	Events.player_revived.connect(_on_player_revived)
	Events.cheat_detected.connect(_on_cheat_detected)
	Events.player_armor_changed.connect(func(current: float, maximum: float) -> void:
		_armor_bar.get_parent().visible = current > 0.0
		_armor_bar.max_value = maximum
		_armor_bar.value = current)
	Events.power_up_timers.connect(_on_power_up_timers)
	Events.power_up_collected.connect(func(_id: StringName, power_up_name: String, color: Color, detail: String) -> void:
		_show_banner(Loc.text(power_up_name).to_upper(), color)
		if detail != "":
			_show_toast(detail))
	Events.achievement_unlocked.connect(func(id: String, achievement_name: String, _d: String) -> void:
		var catalog := load("res://data/configs/achievements.tres") as AchievementCatalog
		var info := catalog.find(id) if catalog else {}
		_show_toast(Loc.t("CONQUISTA DESBLOQUEADA: %s") % Loc.t(achievement_name).to_upper(), String(info.get("icon", ""))))
	Events.score_changed.connect(func(total: int, _delta: int) -> void: _score_label.text = Loc.t("SCORE %d") % total)
	Events.map_unlocked.connect(func(_id: String, map_name: String) -> void: _show_banner(Loc.t("%s DESBLOQUEADO!") % Loc.t(map_name).to_upper(), GOLD))
	Events.boss_incoming.connect(func(boss_name: String) -> void: _show_banner(Loc.t("%s SE APROXIMA") % Loc.t(boss_name).to_upper(), RED))
	Events.boss_state.connect(_on_boss_state)
	Events.boss_phase.connect(func(_n: String, phase: int) -> void: _show_toast(Loc.t("FASE %d") % phase))
	Events.boss_defeated.connect(func(_id: StringName, boss_name: String, reward: int, _at: Vector3) -> void:
		_boss_bar.visible = false
		_boss_row.visible = false
		_boss_label.text = ""
		_show_banner(Loc.t("%s DERROTADO  +%d") % [Loc.t(boss_name).to_upper(), reward], GOLD))
	Events.hound_round_changed.connect(_on_hound_round)
	Events.max_ammo.connect(func(_at: Vector3) -> void: _show_toast("MAX AMMO"))
	Events.power_changed.connect(func(on: bool) -> void: if on: _show_banner("ENERGIA LIGADA", GOLD))
	Events.perks_changed.connect(_on_perks_changed)
	Events.blessing_changed.connect(func(god: StringName, text: String, color: Color) -> void:
		_blessing_row.visible = text != ""
		_blessing_label.text = Loc.t("BÊNÇÃO DE %s") % Loc.text(text)
		_blessing_label.add_theme_color_override(&"font_color", color)
		if _blessing_badge:
			_blessing_badge.queue_free()
			_blessing_badge = null
		if text != "":
			_blessing_badge = _badge(BLESSING_BADGE_SIZE, color, "res://assets/sprites/blessings/blessing_%s.png" % god)
			_blessing_row.add_child(_blessing_badge)
			_blessing_row.move_child(_blessing_badge, 0))
	Events.world_event_started.connect(func(_id: StringName, event_name: String, hint: String, color: Color) -> void:
		_show_banner(event_name, color)
		_show_toast(hint))
	Events.world_event_state.connect(func(state: Dictionary) -> void:
		_event_row.visible = not state.is_empty()
		if state.is_empty():
			_event_label.text = ""
			return
		var remaining := float(state.remaining)
		_event_label.text = Loc.text(String(state.name)) + ("  %ds" % ceili(remaining) if remaining >= 0.0 else "")
		_event_label.add_theme_color_override(&"font_color", state.color)
		var ring := _event_badge.find_child("Ring", true, false) as TextureRect
		if ring:
			ring.self_modulate = state.color)
	Events.quest_state.connect(func(state: Dictionary) -> void:
		if state.is_empty():
			_quest_title.text = ""
			_quest_text.text = ""
			return
		_quest_title.text = "◆ %s  %d/%d" % [Loc.text(String(state.title)), state.step, state.total]
		_quest_text.text = Loc.text(String(state.objective)))
	Events.quest_completed.connect(func(_id: StringName, title: String, subtitle: String) -> void:
		_show_banner(title, GOLD)
		_show_toast(subtitle))
	Events.settings_changed.connect(func() -> void: minimap.apply_settings())
	Events.game_over.connect(_on_game_over)
	Events.flashlight_toggled.connect(func(on: bool) -> void:
		_flashlight_on = on
		_update_flashlight_label())
	Events.lighting_changed.connect(_on_lighting_changed)
	# Comprou elemento: o nome da arma na HUD ganha o ícone na hora.
	Events.weapon_element_changed.connect(func(_id: StringName, _e: StringName) -> void:
		var player := Players.local_player()
		if player and player.weapon:
			_on_ammo_changed(player.weapon.data.display_name, player.weapon.magazine, player.weapon.reserve, player.weapon.reloading))
	# O jogador pode ter anunciado a arma antes de a HUD existir: pede de novo.
	(func() -> void:
		var player := Players.local_player()
		if player and player.has_method(&"announce_weapon"):
			player.announce_weapon()).call_deferred()


func _process(delta: float) -> void:
	_update_team(delta)
	_update_down_marks()
	_update_crosshair()
	_update_target_mark()
	_fps_label.visible = Save.get_setting("showFps") == true
	if _fps_label.visible:
		_fps_label.text = "%d FPS" % Engine.get_frames_per_second()
	for label in _auto_hide:
		label.visible = label.text != ""
	var screen := get_viewport().get_visible_rect().size
	_update_touch()
	# Painel de munição no canto; com os controles de toque, sobe para cima dos botões. No modo
	# canhoto os botões ficam à esquerda (onde a missão aparece embaixo do minimapa): a vida vai
	# para a direita, empilhada em cima da munição, e o feed para o centro (ver _update_team).
	var ammo_panel := _ammo_box.get_parent() as Control
	var health_panel := _health_label.get_parent().get_parent() as Control
	var left_handed := touch.visible and TouchControls.left_handed()
	if left_handed:
		ammo_panel.position.y = screen.y - 12.0 - ammo_panel.size.y
		health_panel.position = Vector2(screen.x - 12.0 - health_panel.size.x, ammo_panel.position.y - 8.0 - health_panel.size.y)
	else:
		var ammo_bottom := touch.buttons_top() - 8.0 if touch.visible else screen.y - 12.0
		ammo_panel.position.y = ammo_bottom - ammo_panel.size.y
		health_panel.position = Vector2(12.0, screen.y - 12.0 - health_panel.size.y)
	# Ícones das armas empilhados acima do painel de munição (ou da vida, no canhoto).
	var icons_top := (health_panel.position.y if left_handed else ammo_panel.position.y) - 8.0
	_weapon_icon.position = Vector2(screen.x - 12.0 - _weapon_icon.size.x, icons_top - _weapon_icon.size.y)
	_other_weapon_icon.position = Vector2(screen.x - 12.0 - _other_weapon_icon.size.x, _weapon_icon.position.y - 8.0 - _other_weapon_icon.size.y)
	_frame_icon(_weapon_icon_bg, _weapon_icon)
	_frame_icon(_other_weapon_icon_bg, _other_weapon_icon)
	if _quest_title.text != "":
		var top := Minimap.CORNER.y + minimap.screen_height() + 36.0 if minimap.visible and not minimap.expanded else Minimap.CORNER.y
		_quest_title.position = Vector2(MARGIN, top)
		_quest_text.position = Vector2(MARGIN, top + 28.0)
	# O marcador de acerto acompanha a mira do mouse.
	_place_hit_marker()


func _exit_tree() -> void:
	InputBindings.set_touch_active(false)
	_set_cursor_hidden(false)


## Controles de toque: aparecem conforme a configuração (auto = celular) e somem na pausa,
## na morte e no fim de jogo (soltando tudo).
func _update_touch() -> void:
	var wanted := InputBindings.touch_wanted(String(Save.get_setting("touchMode")), InputBindings.is_touch_device())
	if wanted != InputBindings.touch_active:
		InputBindings.set_touch_active(wanted)
		_update_flashlight_label()  # sem o atalho [F] no toque
	var player := Players.local_player()
	touch.visible = wanted and not get_tree().paused and player != null and player.is_alive() and not _game_over_panel.visible


# ───────────────────────── Montagem ─────────────────────────

func _build() -> void:
	var root := Control.new()
	_root = root
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
	_points_label = _text(points_box, money_text(0), 39, MONEY, HORIZONTAL_ALIGNMENT_RIGHT)
	_score_label = _text(points_box, "SCORE 0", 26, DIM, HORIZONTAL_ALIGNMENT_RIGHT)
	_invalid_label = _text(points_box, "", 26, RED, HORIZONTAL_ALIGNMENT_RIGHT)
	# Ganho de pontos: fora do painel, logo abaixo (some sozinho).
	_points_delta = _label(root, "", 26, MONEY, Control.PRESET_TOP_RIGHT, HORIZONTAL_ALIGNMENT_RIGHT, 108)

	var health_box := _corner_panel(root, Control.PRESET_BOTTOM_LEFT)
	_perks_row = HBoxContainer.new()
	_perks_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_perks_row.add_theme_constant_override(&"separation", 6)
	health_box.add_child(_perks_row)
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

	# Faixa embaixo-centro: bênção, power-ups e prompt de interação, um por baixo do outro num
	# VBoxContainer só — cada um empilha pela altura de verdade dos outros, sem números fixos
	# "no olho" que podiam se sobrepor (o power-up e o prompt já tinham colidido assim antes).
	_bottom_center = VBoxContainer.new()
	_bottom_center.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_bottom_center.alignment = BoxContainer.ALIGNMENT_CENTER
	_bottom_center.add_theme_constant_override(&"separation", 6)
	root.add_child(_bottom_center)
	_bottom_center.set_anchors_and_offsets_preset(Control.PRESET_CENTER_BOTTOM, Control.PRESET_MODE_KEEP_SIZE, MARGIN)
	_bottom_center.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_bottom_center.grow_vertical = Control.GROW_DIRECTION_BEGIN

	_blessing_row = HBoxContainer.new()
	_blessing_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_blessing_row.alignment = BoxContainer.ALIGNMENT_CENTER
	_blessing_row.add_theme_constant_override(&"separation", 8)
	_blessing_row.visible = false
	_bottom_center.add_child(_blessing_row)
	_blessing_label = _text(_blessing_row, "", 26, GOLD, HORIZONTAL_ALIGNMENT_CENTER)

	_power_row = HBoxContainer.new()
	_power_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_power_row.alignment = BoxContainer.ALIGNMENT_CENTER
	_power_row.add_theme_constant_override(&"separation", 10)
	_bottom_center.add_child(_power_row)

	_prompt_row = HBoxContainer.new()
	_prompt_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_prompt_row.alignment = BoxContainer.ALIGNMENT_CENTER
	_prompt_row.add_theme_constant_override(&"separation", 6)
	_bottom_center.add_child(_prompt_row)
	_prompt_icon = TextureRect.new()
	_prompt_icon.custom_minimum_size = Vector2(PROMPT_ICON_SIZE, PROMPT_ICON_SIZE)
	_prompt_icon.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	_prompt_icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_prompt_icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_prompt_icon.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_prompt_icon.visible = false
	_prompt_row.add_child(_prompt_icon)
	_prompt_label = _text(_prompt_row, "", 20, TEXT, HORIZONTAL_ALIGNMENT_CENTER)
	# Barra de segurar-E (barricada, disjuntor, estátua...), no lugar do texto "(42%)" de antes.
	var prompt_bar: Array = PixelSkin.bar(GOLD, 200.0, 8.0)
	_prompt_bar_frame = prompt_bar[0]
	_prompt_bar_frame.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_prompt_bar_frame.visible = false
	_bottom_center.add_child(_prompt_bar_frame)
	_prompt_bar = prompt_bar[1]

	_event_row = _label_row(root, Control.PRESET_CENTER_TOP, 48)
	_event_row.visible = false
	_event_badge = _badge(SMALL_BADGE_SIZE, TEXT, "")
	_event_row.add_child(_event_badge)
	_event_label = _text(_event_row, "", 18, TEXT, HORIZONTAL_ALIGNMENT_CENTER)

	_ammo_box = _corner_panel(root, Control.PRESET_BOTTOM_RIGHT)
	_other_weapon_label = _text(_ammo_box, "", 26, DIM, HORIZONTAL_ALIGNMENT_RIGHT)
	_weapon_label = _text(_ammo_box, "", 26, TEXT, HORIZONTAL_ALIGNMENT_RIGHT)
	_ammo_label = _text(_ammo_box, "", 39, TEXT, HORIZONTAL_ALIGNMENT_RIGHT)
	# Ícones em pixel art da arma em mãos (grande) e da reserva (pequeno, apagado), acima do
	# painel, cada um com uma moldura atrás (como os selos e os cantos da HUD).
	_weapon_icon_bg = _icon_panel(root)
	_weapon_icon = _icon_rect(root, 2.0, Vector2(-MARGIN, -100))
	_other_weapon_icon_bg = _icon_panel(root)
	_other_weapon_icon = _icon_rect(root, 1.0, Vector2(-MARGIN, -100))
	_other_weapon_icon.modulate = Color(1, 1, 1, 0.55)

	_banner = _label(root, "", 36, RED, Control.PRESET_CENTER_TOP, HORIZONTAL_ALIGNMENT_CENTER, 130)
	_banner.modulate.a = 0.0
	_toast_row = _label_row(root, Control.PRESET_CENTER_TOP, 220)
	_toast_icon = TextureRect.new()
	_toast_icon.custom_minimum_size = Vector2(22.0, 22.0)
	_toast_icon.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	_toast_icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_toast_icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_toast_icon.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_toast_icon.visible = false
	_toast_row.add_child(_toast_icon)
	_toast = _text(_toast_row, "", 20, GOLD, HORIZONTAL_ALIGNMENT_CENTER)

	_boss_row = _label_row(root, Control.PRESET_CENTER_TOP, 4)
	_boss_row.visible = false
	_boss_row.add_child(_badge(SMALL_BADGE_SIZE, RED, ""))
	_boss_label = _text(_boss_row, "", 18, RED, HORIZONTAL_ALIGNMENT_CENTER)
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
	_toast_row.modulate.a = 0.0

	_damage_numbers = DamageNumbers.new()
	root.add_child(_damage_numbers)
	_hit_marker = HitMarker.new()
	root.add_child(_hit_marker)
	_hit_marker.visible = false
	_crosshair = Crosshair.new()
	root.add_child(_crosshair)
	_crosshair.visible = false
	_target_mark = TargetMark.new()
	root.add_child(_target_mark)
	_target_mark.visible = false
	# Contador de FPS (Configurações → VÍDEO → MOSTRAR FPS).
	_fps_label = _label(root, "", 13, DIM, Control.PRESET_CENTER_TOP, HORIZONTAL_ALIGNMENT_CENTER, -16)
	_fps_label.name = "Fps"

	minimap = Minimap.new()
	minimap.name = "Minimap"
	root.add_child(minimap)
	touch = TouchControls.new()
	touch.name = "TouchControls"
	touch.visible = false
	root.add_child(touch)
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
## Moldura atrás de um ícone de arma (painel de pixel art, como os cantos da HUD); o tamanho e
## a posição são ajustados a cada quadro em _process(), porque cada arma tem um tamanho.
func _icon_panel(root: Control) -> Panel:
	var panel := Panel.new()
	panel.add_theme_stylebox_override(&"panel", PixelSkin.panel(false, 6.0))
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	panel.visible = false
	root.add_child(panel)
	return panel


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


## Encaixa a moldura no ícone (some junto quando não há arma, ex. sem arma reserva).
func _frame_icon(panel: Panel, icon: TextureRect) -> void:
	panel.visible = icon.texture != null
	if not panel.visible:
		return
	panel.position = icon.position - Vector2.ONE * WEAPON_ICON_PAD
	panel.size = icon.size + Vector2.ONE * WEAPON_ICON_PAD * 2.0


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
	# Sem contorno do Godot: a fonte pixel já tem o dela (o extra virava blocos escuros).
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	if align != HORIZONTAL_ALIGNMENT_LEFT:
		label.grow_horizontal = Control.GROW_DIRECTION_BEGIN if align == HORIZONTAL_ALIGNMENT_RIGHT else Control.GROW_DIRECTION_BOTH
	parent.add_child(label)
	label.set_anchors_and_offsets_preset(preset, Control.PRESET_MODE_KEEP_SIZE, MARGIN)
	label.offset_top += dy
	label.offset_bottom += dy
	return label


## Uma linha (selo + texto) presa a um canto, como _label() — pra grudar um ícone/selo ao lado
## de um texto que hoje é preso direto num canto (banner de boss/evento, toast).
func _label_row(parent: Control, preset: Control.LayoutPreset, dy: float = 0.0) -> HBoxContainer:
	var row := HBoxContainer.new()
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override(&"separation", 6)
	parent.add_child(row)
	row.set_anchors_and_offsets_preset(preset, Control.PRESET_MODE_KEEP_SIZE, MARGIN)
	row.offset_top += dy
	row.offset_bottom += dy
	return row


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
	_round_label.text = Loc.t("ROUND %d") % round_number
	_remaining_label.text = Loc.t("ZUMBIS RESTANTES  %d") % total
	_show_banner(Loc.t("ROUND %d") % round_number, RED)


func _on_boss_state(boss_name: String, current: float, maximum: float, phase: int) -> void:
	_boss_bar.visible = current > 0.0
	_boss_bar.max_value = maximum
	_boss_bar.value = current
	_boss_row.visible = current > 0.0
	_boss_label.text = Loc.t("%s  ·  FASE %d") % [Loc.t(boss_name).to_upper(), phase] if current > 0.0 else ""


func _on_hound_round(active: bool, _config: Dictionary) -> void:
	if active:
		_show_banner("RODADA DOS CÃES", Color(0.55, 0.75, 1.0))


func _on_points_changed(total: int, delta: int) -> void:
	_points_label.text = money_text(total)
	if delta == 0:
		return
	_points_delta.text = money_text(delta, true)
	_points_delta.add_theme_color_override(&"font_color", MONEY if delta > 0 else RED)
	_points_delta.modulate.a = 1.0
	create_tween().tween_property(_points_delta, "modulate:a", 0.0, 0.8).set_delay(0.4)


func _on_health_changed(current: float, maximum: float) -> void:
	if _last_health >= 0.0 and current < _last_health - 0.5:
		Haptics.pulse(&"hurt")
	_last_health = current
	_health_bar.max_value = maximum
	_health_bar.value = current
	_health_label.text = Loc.t("VIDA  %d / %d") % [roundi(current), roundi(maximum)]


## Um ícone por power-up ativo (Max Ammo, Fúria...), com a contagem regressiva e piscando nos
## últimos 5s — mesmo padrão do jogo web. Só cria/remove ícone quando o conjunto muda; a cada
## chamada (a cada física, enquanto algo estiver ativo) só atualiza o número.
func _on_power_up_timers(active: Dictionary, definitions: Dictionary) -> void:
	for id: StringName in _power_icons.keys():
		if not active.has(id):
			(_power_icons[id].icon as Control).queue_free()
			_power_icons.erase(id)
	for id: StringName in active:
		if not _power_icons.has(id):
			_power_icons[id] = _power_icon(id, definitions)
		var seconds := ceili(float(active[id]))
		var slot: Dictionary = _power_icons[id]
		(slot.label as Label).text = str(seconds)
		var icon := slot.icon as Control
		icon.modulate.a = (0.45 if seconds % 2 == 0 else 1.0) if seconds <= 5 else 1.0


## Selo hexagonal (badge.mjs): moldura + anel tingido em `color` + o ícone (se existir) centrado
## na placa escura. Sem ícone, a placa fica só com o anel colorido (ainda dá pra identificar).
func _badge(size: float, color: Color, icon_path: String) -> Control:
	var box := Control.new()
	box.custom_minimum_size = Vector2(size, size)
	box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var back := TextureRect.new()
	back.texture = load(BADGE_BACK)
	back.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	back.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	back.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	back.mouse_filter = Control.MOUSE_FILTER_IGNORE
	box.add_child(back)
	if icon_path != "" and ResourceLoader.exists(icon_path):
		var icon := TextureRect.new()
		icon.texture = load(icon_path)
		icon.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		icon.mouse_filter = Control.MOUSE_FILTER_IGNORE
		icon.anchor_left = 0.5; icon.anchor_right = 0.5; icon.anchor_top = 0.5; icon.anchor_bottom = 0.5
		var half := size * 0.28
		icon.offset_left = -half; icon.offset_right = half; icon.offset_top = -half; icon.offset_bottom = half
		box.add_child(icon)
	var ring := TextureRect.new()
	ring.name = &"Ring"
	ring.texture = load(BADGE_RING)
	ring.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	ring.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	ring.self_modulate = color
	ring.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	ring.mouse_filter = Control.MOUSE_FILTER_IGNORE
	box.add_child(ring)
	var frame := TextureRect.new()
	frame.texture = load(BADGE_FRAME)
	frame.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	frame.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	frame.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	frame.mouse_filter = Control.MOUSE_FILTER_IGNORE
	box.add_child(frame)
	return box


## Monta o selo do power-up com o número por cima.
func _power_icon(id: StringName, definitions: Dictionary) -> Dictionary:
	var info: Dictionary = definitions.get(id, {"name": "Fúria", "color": GOLD})
	var box := VBoxContainer.new()
	box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	box.alignment = BoxContainer.ALIGNMENT_CENTER
	box.add_theme_constant_override(&"separation", 0)
	box.add_child(_badge(POWER_BADGE_SIZE, info.get("color", GOLD), PowerUpSystem.icon_path(id)))
	# A fonte pixel só fica nítida em múltiplos de 13px (mínimo 26): não cabe como selo
	# minúsculo no canto do ícone, então o número fica embaixo, colado nele.
	var label := Label.new()
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.add_theme_font_size_override(&"font_size", MenuKit.px(14))
	label.add_theme_color_override(&"font_color", TEXT)
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	box.add_child(label)
	_power_row.add_child(box)
	return {"icon": box, "label": label}


## Um selo por perk comprado (Quick Revive, Deadeye...), na cor do próprio perk (PerkData.color)
## — eles não expiram, então sem contagem, só o ícone (`assets/web/machines/perk_<id>.png`).
func _on_perks_changed(ids: Array[StringName]) -> void:
	for child in _perks_row.get_children():
		child.queue_free()
	for id: StringName in ids:
		var color := GOLD
		var data_path := "res://data/perks/%s.tres" % id
		if ResourceLoader.exists(data_path):
			color = (load(data_path) as PerkData).color
		_perks_row.add_child(_badge(PERK_BADGE_SIZE, color, "res://assets/web/machines/perk_%s.png" % id))


func _on_ammo_changed(weapon_name: String, magazine: int, reserve: int, reloading: bool) -> void:
	# Elemento comprado na parede: ícone e nome ao lado da arma (ex.: "M4 ✹ FOGO").
	var element := ""
	var player := Players.local_player()
	if player and player.weapon and player.weapon.element != &"":
		element = "  " + Loc.t(ElementCatalog.shared().label(player.weapon.element))
	_weapon_label.text = Loc.t(weapon_name).to_upper() + element + (("  ·  " + Loc.t("RECARREGANDO")) if reloading else "")
	_ammo_label.text = "%d / %d" % [magazine, reserve]
	_ammo_label.add_theme_color_override(&"font_color", RED if magazine == 0 else TEXT)


## Fim de jogo (como no jogo web): score, estatísticas em duas colunas, recorde e, se entrou
## no top do mapa, o nome para o ranking.
func _on_game_over(summary: Dictionary) -> void:
	var box := _game_over_panel.get_node("Box") as VBoxContainer
	_game_over_text.text = Loc.t("SCORE %d") % summary.score
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
	var team_game := int(summary.get("players", 1)) > 1
	var record := Label.new()
	record.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	record.text = "NOVO RECORDE!" if summary.new_record else Loc.t("RECORDE: %d PONTOS · ROUND %d") % [summary.best_score, summary.best_wave]
	if team_game:
		record.text = Loc.t("TIME: %s") % String(summary.get("team", ""))
	record.add_theme_font_size_override(&"font_size", MenuKit.px(26 if summary.new_record else 15))
	record.add_theme_color_override(&"font_color", GOLD if summary.new_record else DIM)
	box.add_child(record)
	if summary.cheat_taunt != "":
		record.text = "PARTIDA INVALIDADA — NÃO VALE SAVE NEM RANKING"
		record.add_theme_color_override(&"font_color", RED)
		var taunt := Label.new()
		taunt.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		taunt.text = Loc.text(String(summary.cheat_taunt))
		taunt.add_theme_font_size_override(&"font_size", MenuKit.px(26))
		taunt.add_theme_color_override(&"font_color", Color(1.0, 0.48, 0.36))
		box.add_child(taunt)
	elif team_game:
		_add_team_result(box, summary)
	elif summary.score > 0 and (summary.rank_eligible or Online.is_configured()):
		_add_ranking_entry(box, summary)
	var buttons := HBoxContainer.new()
	buttons.alignment = BoxContainer.ALIGNMENT_CENTER
	buttons.add_theme_constant_override(&"separation", 24)
	box.add_child(buttons)
	var again := _menu_button(buttons, "JOGAR NOVAMENTE" if not Net.is_online() else "VOLTAR À SALA", func() -> void: Events.restart_requested.emit())
	# Em rede, quem leva todos de volta à sala é o host.
	again.disabled = Net.is_client()
	_menu_button(buttons, "RANKING", func() -> void:
		Session.map_id = summary.map_id
		get_tree().paused = false
		get_tree().change_scene_to_file("res://scenes/ui/ranking.tscn"))
	_menu_button(buttons, "MENU", func() -> void:
		Net.leave()
		get_tree().paused = false
		get_tree().change_scene_to_file("res://scenes/ui/main_menu.tscn"))
	again.grab_focus.call_deferred()
	_game_over_panel.visible = true
	_game_over_panel.modulate.a = 0.0
	create_tween().tween_property(_game_over_panel, "modulate:a", 1.0, 0.8).set_delay(0.6)


## Anti-trapaça: zoa o jogador e deixa um aviso fixo de partida invalidada.
func _on_cheat_detected(taunt: String, subtitle: String) -> void:
	_invalid_label.text = "PARTIDA INVALIDADA"
	var message := _label(_banner.get_parent() as Control, "%s\n%s" % [Loc.text(taunt), Loc.text(subtitle)], 30, Color(1.0, 0.48, 0.36), Control.PRESET_CENTER, HORIZONTAL_ALIGNMENT_CENTER, -60)
	message.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	message.custom_minimum_size = Vector2(900, 0)
	message.set_anchors_and_offsets_preset(Control.PRESET_CENTER, Control.PRESET_MODE_KEEP_SIZE)
	var tween := create_tween()
	tween.tween_interval(5.0)
	tween.tween_property(message, "modulate:a", 0.0, 0.8)
	tween.tween_callback(message.queue_free)


## Partida em grupo: o time já entrou no ranking local do modo (sem pedir nome) e o host envia ao
## global pelo time.
func _add_team_result(box: VBoxContainer, summary: Dictionary) -> void:
	var mode: String = Leaderboard.MODES[clampi(int(summary.players), 1, 4) - 1]
	var position := int(summary.get("coop_rank", 0))
	var result := Label.new()
	result.name = "RankResult"
	result.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	result.text = Loc.t("%dº LUGAR NO RANKING %s DE %s!") % [position, Loc.t(mode), Loc.t(Save.catalog.display_name(summary.map_id)).to_upper()] if position > 0 else ""
	result.add_theme_color_override(&"font_color", GOLD)
	box.add_child(result)
	if not bool(summary.get("global_submit", false)):
		return
	var global := Label.new()
	global.name = "GlobalResult"
	global.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	global.text = "ENVIANDO O TIME AO RANKING GLOBAL..."
	global.add_theme_color_override(&"font_color", DIM)
	box.add_child(global)
	var host_name := String(Net.players.get(1, {}).get("name", Save.player_name))
	var error_text: String = await Leaderboard.submit(Online, summary.map_id, host_name, summary.score, summary.round, int(summary.get("team_kills", summary.kills)), int(summary.players), String(summary.team))
	if is_instance_valid(global):
		global.text = (Loc.t("RANKING GLOBAL: %s") % Loc.t(error_text).to_upper()) if error_text != "" else Loc.t("TIME ENVIADO AO RANKING GLOBAL (%s)!") % Loc.t(mode)
		global.add_theme_color_override(&"font_color", RED if error_text != "" else GOLD)


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
		result.text = Loc.t("%dº LUGAR NO RANKING DE %s!") % [position, Loc.t(Save.catalog.display_name(summary.map_id)).to_upper()] if position > 0 else ""
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
				global.text = (Loc.t("RANKING GLOBAL: %s") % Loc.t(error_text).to_upper()) if error_text != "" else "ENVIADO AO RANKING GLOBAL DA TEMPORADA!"
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
	_banner.text = Loc.text(text)
	_banner.add_theme_color_override(&"font_color", color)
	var tween := create_tween()
	tween.tween_property(_banner, "modulate:a", 1.0, 0.3)
	tween.tween_interval(1.6)
	tween.tween_property(_banner, "modulate:a", 0.0, 0.6)


func _update_flashlight_label() -> void:
	_flashlight_label.text = Loc.t("LANTERNA %s%s") % [Loc.t("LIGADA" if _flashlight_on else "DESLIGADA"), "" if InputBindings.touch_active else "  [%s]" % InputBindings.hint_label(&"flashlight")]
	_flashlight_label.modulate = GOLD if _flashlight_on else DIM


## Luz da área mudou: vinheta mais forte no escuro e, com a lanterna desligada, o aviso.
func _on_lighting_changed(lighting: String) -> void:
	var was := _lighting
	_lighting = lighting
	var tween := create_tween()
	tween.tween_property(_vignette.material, "shader_parameter/strength", float(VIGNETTE.get(lighting, VIGNETTE.dim)), 1.2)
	if lighting == "dark" and was != "dark" and not _flashlight_on:
		_show_toast(Loc.fmt("ESTÁ ESCURO — [%s] LIGA A LANTERNA", [Loc.key(&"flashlight")]))


func _show_toast(text: String, icon := "") -> void:
	_toast.text = Loc.text(text)
	_toast_icon.visible = icon != "" and ResourceLoader.exists(icon)
	if _toast_icon.visible:
		_toast_icon.texture = load(icon)
	create_tween().kill()
	var tween := create_tween()
	tween.tween_property(_toast_row, "modulate:a", 1.0, 0.2)
	tween.tween_interval(2.4)
	tween.tween_property(_toast_row, "modulate:a", 0.0, 0.5)


func _flash_points_denied() -> void:
	_points_label.add_theme_color_override(&"font_color", RED)
	var tween := create_tween()
	tween.tween_interval(0.35)
	tween.tween_callback(func() -> void: _points_label.add_theme_color_override(&"font_color", MONEY))


## Um acerto seu (já somado no quadro): marcador, número de dano e, no abate, o tranco de câmera
## (só quem abateu sente; respeita TREMOR DE TELA). O som é do AudioManager.
func _on_hit_confirmed(key: int, at: Vector3, amount: float, headshot: bool, kill: bool, blocked: bool) -> void:
	_hit_at = at
	_hit_marker.show_hit(HitMarker.kind_of(headshot, kill, blocked))
	_place_hit_marker()
	if Save.get_setting("damageNumbers") != false:
		_damage_numbers.add_hit(key, at, amount, headshot, kill, blocked)
	if kill:
		Events.screen_shake.emit(0.12 if headshot else 0.06, 0.08 if headshot else 0.035)


## Mirando com o mouse, o marcador fica na mira; no toque e no controle, no ponto do acerto.
func _place_hit_marker() -> void:
	if not _hit_marker.visible:
		return
	var player := Players.local_player()
	var camera := get_viewport().get_camera_3d()
	if player and player.mouse_aim and not InputBindings.touch_active:
		_hit_marker.position = get_viewport().get_mouse_position()
	elif camera and not camera.is_position_behind(_hit_at):
		_hit_marker.position = camera.unproject_position(_hit_at).round()


# ───────────────────────── Cooperativo ─────────────────────────

## Raiz dos controles da HUD.
var _root: Control
## Colegas no canto direito, logo abaixo do seu dinheiro (como no CoD e no L4D): um cartão por
## colega com nome na cor da vaga, dinheiro, vida, "CAÍDO 23s"/"FORA" e latência. Montado aos
## poucos: os colegas podem ficar prontos depois da HUD.
var _team_box: VBoxContainer
## Player → {panel, name, cash, bar, state, ping}.
var _team_rows: Dictionary = {}
var _team_check := 0.0
## Player caído → marca (seta na borda da tela quando ele está fora dela; cruz sobre ele quando
## está na tela).
var _down_marks: Dictionary = {}
## Quem fez o quê (cooperativo): lista curta embaixo, à esquerda, logo acima da vida.
var _feed: VBoxContainer
const FEED_LINES := 4
const FEED_TIME := 4.0
var _crosshair: Crosshair
## Celular: marcador do alvo travado pela mira automática.
var _target_mark: TargetMark
## Última vida vista (a vibração só quando ela cai).
var _last_health := -1.0
var _fps_label: Label
const TEAM_WIDTH := 230.0


func _update_team(delta: float) -> void:
	if _team_box and Players.coop():
		_place_team_box()
	if _feed:
		if touch.visible and TouchControls.left_handed():
			# Canhoto: no centro, acima das dicas (à esquerda ficam os botões e a missão).
			var screen := get_viewport().get_visible_rect().size
			_feed.position = Vector2((screen.x - _feed.size.x) * 0.5, _bottom_center.position.y - 8.0 - _feed.size.y)
		else:
			var health_panel := _health_label.get_parent().get_parent() as Control
			_feed.position = Vector2(MARGIN, health_panel.position.y - 8.0 - _feed.size.y)
	_team_check -= delta
	if _team_check > 0.0:
		return
	_team_check = 0.2
	if not Players.coop():
		return
	if _team_box == null:
		_team_box = VBoxContainer.new()
		_team_box.name = "Team"
		_team_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_team_box.add_theme_constant_override(&"separation", 6)
		_root.add_child(_team_box)
	var local := Players.local_player()
	for someone in Players.all():
		if someone == local:
			continue
		if not _team_rows.has(someone):
			_team_rows[someone] = _team_card(someone)
		var row: Dictionary = _team_rows[someone]
		(row.bar as ProgressBar).value = 100.0 * someone.health.current / maxf(1.0, someone.health.max_health)
		(row.cash as Label).text = money_text(someone.money)
		var state := ""
		if someone.bleeding:
			state = Loc.t("CAÍDO %ds") % ceili(maxf(0.0, someone.bleed_left))
		elif not someone.is_alive():
			state = "FORA"
		(row.state as Label).text = state
		(row.panel as Control).modulate.a = 0.55 if state == "FORA" else 1.0
		var ms := Net.ping_of(someone.peer_id) if Net.is_online() and someone.peer_id != 1 else -1
		(row.ping as Label).text = ("%d ms" % ms) if ms >= 0 else ""
		(row.ping as Label).add_theme_color_override(&"font_color", Net.ping_color(ms))
	for gone: Variant in _team_rows.keys():
		if not is_instance_valid(gone) or not (gone as Player).is_inside_tree():
			var panel: Variant = _team_rows[gone].panel
			if is_instance_valid(panel):
				(panel as Control).queue_free()
			_team_rows.erase(gone)


## Cartão de um colega: faixa na cor da vaga | nome ............ $1.250
##                                            | [vida]
##                                            | CAÍDO 23s ......... 42 ms
func _team_card(someone: Player) -> Dictionary:
	var panel := PanelContainer.new()
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	panel.add_theme_stylebox_override(&"panel", PixelSkin.panel(false, 8.0))
	panel.custom_minimum_size.x = TEAM_WIDTH
	_team_box.add_child(panel)
	var row := HBoxContainer.new()
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_theme_constant_override(&"separation", 8)
	panel.add_child(row)
	var stripe := ColorRect.new()
	stripe.color = Players.color_of(someone)
	stripe.custom_minimum_size = Vector2(4, 0)
	stripe.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(stripe)
	var column := VBoxContainer.new()
	column.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	column.add_theme_constant_override(&"separation", 2)
	row.add_child(column)
	var top := HBoxContainer.new()
	top.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.add_child(top)
	var title := _plain(top, someone.player_name if someone.player_name != "" else "COLEGA", 20, Players.color_of(someone))
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var cash := _plain(top, money_text(someone.money), 20, MONEY, HORIZONTAL_ALIGNMENT_RIGHT)
	var bar: Array = PixelSkin.bar(RED, TEAM_WIDTH - 30.0, 6.0)
	column.add_child(bar[0])
	var bottom := HBoxContainer.new()
	bottom.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.add_child(bottom)
	var state := _plain(bottom, "", 16, RED)
	state.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var ping := _plain(bottom, "", 14, DIM, HORIZONTAL_ALIGNMENT_RIGHT)
	return {"panel": panel, "name": title, "cash": cash, "bar": bar[1], "state": state, "ping": ping}


## Logo abaixo do painel do dinheiro, encostado na direita.
func _place_team_box() -> void:
	var money_panel := _points_label.get_parent().get_parent() as Control
	var screen := get_viewport().get_visible_rect().size
	_team_box.position = Vector2(screen.x - 12.0 - _team_box.size.x, money_panel.position.y + money_panel.size.y + 8.0)


## Rótulo simples (fora da lista dos que somem quando vazios).
func _plain(parent: Control, text: String, size: int, color: Color, align: HorizontalAlignment = HORIZONTAL_ALIGNMENT_LEFT) -> Label:
	var label := Label.new()
	label.text = text
	label.horizontal_alignment = align
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	label.add_theme_font_size_override(&"font_size", MenuKit.px(size))
	label.add_theme_color_override(&"font_color", color)
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(label)
	return label


## Dinheiro como no jogo ("$1.250", milhar com ponto); `signed` põe o + nos ganhos.
static func money_text(amount: int, signed := false) -> String:
	var digits := str(absi(amount))
	var grouped := ""
	while digits.length() > 3:
		grouped = "." + digits.right(3) + grouped
		digits = digits.left(digits.length() - 3)
	grouped = digits + grouped
	var prefix := "-" if amount < 0 else ("+" if signed else "")
	return "%s$%s" % [prefix, grouped]


## Colega caído: na tela, uma cruz vermelha sobre ele com os segundos; fora dela, uma seta na
## borda apontando para onde ele está, com o nome e os segundos.
func _update_down_marks() -> void:
	var camera := get_viewport().get_camera_3d()
	var local := Players.local_player()
	var screen := get_viewport().get_visible_rect().size
	for someone in Players.all():
		var down := Players.coop() and someone != local and someone.bleeding
		if not down:
			if _down_marks.has(someone):
				(_down_marks[someone] as Node).queue_free()
				_down_marks.erase(someone)
			continue
		if not _down_marks.has(someone):
			var mark := DownMark.new()
			mark.name = "DownMark"
			_root.add_child(mark)
			mark.label = _plain(mark, "", 16, DownMark.COLOR, HORIZONTAL_ALIGNMENT_CENTER)
			_down_marks[someone] = mark
		var marker := _down_marks[someone] as DownMark
		marker.visible = camera != null and not get_tree().paused
		if camera == null:
			continue
		var head := someone.global_position + Vector3.UP * 3.1
		var behind := camera.is_position_behind(head)
		var at := camera.unproject_position(head)
		var free := _free_area(screen)
		var inside := not behind and free.has_point(at)
		var seconds := ceili(maxf(0.0, someone.bleed_left))
		if inside:
			marker.point(at, NAN)
			marker.label.text = "%ds" % seconds
		else:
			var center := free.get_center()
			var toward := (center - at) if behind else (at - center)
			if toward.length_squared() < 1.0:
				toward = Vector2.DOWN
			marker.point(_edge_point(center, toward.normalized(), free), toward.angle())
			marker.label.text = Loc.t("%s %ds") % [someone.player_name, seconds]
	for gone: Variant in _down_marks.keys():
		if not is_instance_valid(gone):
			(_down_marks[gone] as Node).queue_free()
			_down_marks.erase(gone)


## Onde a reta do centro na direção `dir` cruza a borda da área `area`.
static func _edge_point(center: Vector2, dir: Vector2, area: Rect2) -> Vector2:
	var half := area.size * 0.5
	var scale_x := half.x / absf(dir.x) if absf(dir.x) > 0.0001 else INF
	var scale_y := half.y / absf(dir.y) if absf(dir.y) > 0.0001 else INF
	return center + dir * minf(scale_x, scale_y)


## Parte da tela sem painéis (as setas dos caídos ficam dentro dela): sem os cartões do time à
## direita e sem os painéis de baixo.
func _free_area(screen: Vector2) -> Rect2:
	var right := screen.x - 48.0
	if _team_box and _team_box.visible:
		right = _team_box.position.x - 24.0
	return Rect2(Vector2(48, 60), Vector2(right - 48.0, screen.y - 60.0 - 150.0))


## Marca de colega caído: cruz (na tela) ou seta (na borda, apontando para ele), piscando, com um
## texto embaixo.
class DownMark extends Control:
	const COLOR := Color(1.0, 0.32, 0.26)
	var label: Label
	## Direção da seta (rad); NAN = cruz sobre o colega.
	var angle := NAN

	func _init() -> void:
		mouse_filter = Control.MOUSE_FILTER_IGNORE

	func point(at: Vector2, new_angle: float) -> void:
		position = at.round()
		angle = new_angle
		if label == null:
			return
		label.size = Vector2(180, 20)
		if is_nan(angle):
			# Cruz: os segundos em cima dela (embaixo fica o nome do colega).
			label.position = Vector2(-90, -40)
			label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		else:
			# Seta: o texto do lado de dentro da tela (oposto ao que ela aponta).
			var side := cos(angle)
			label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT if side > 0.4 else (HORIZONTAL_ALIGNMENT_LEFT if side < -0.4 else HORIZONTAL_ALIGNMENT_CENTER)
			label.position = Vector2(-196.0 if side > 0.4 else (16.0 if side < -0.4 else -90.0), 16)

	func _process(_delta: float) -> void:
		queue_redraw()

	func _draw() -> void:
		var color := Color(COLOR, 0.55 + 0.45 * sin(Time.get_ticks_msec() / 160.0))
		var shade := Color(0, 0, 0, 0.8)
		if is_nan(angle):
			draw_rect(Rect2(-4, -12, 8, 24), shade)
			draw_rect(Rect2(-12, -4, 24, 8), shade)
			draw_rect(Rect2(-2, -10, 4, 20), color)
			draw_rect(Rect2(-10, -2, 20, 4), color)
			return
		var forward := Vector2.RIGHT.rotated(angle)
		var side := forward.orthogonal()
		draw_colored_polygon(PackedVector2Array([forward * 16.0, -forward * 6.0 + side * 11.0, -forward * 6.0 - side * 11.0]), shade)
		draw_colored_polygon(PackedVector2Array([forward * 12.0, -forward * 4.0 + side * 8.0, -forward * 4.0 - side * 8.0]), color)


## Quem fez o quê: uma linha nova embaixo; as velhas somem em `FEED_TIME` s (no máximo
## `FEED_LINES` na tela).
func _on_team_feed(text: String) -> void:
	if _feed == null:
		_feed = VBoxContainer.new()
		_feed.name = "Feed"
		_feed.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_feed.add_theme_constant_override(&"separation", 2)
		_root.add_child(_feed)
	while _feed.get_child_count() >= FEED_LINES:
		var oldest := _feed.get_child(0)
		_feed.remove_child(oldest)
		oldest.queue_free()
	var line := _plain(_feed, Loc.text(text), 16, TEXT)
	var tween := line.create_tween()
	tween.tween_interval(FEED_TIME)
	tween.tween_property(line, "modulate:a", 0.0, 0.6)
	tween.tween_callback(line.queue_free)


## Um colega caiu: alerta curto (a seta e o painel mostram onde e quanto tempo falta).
func _on_player_downed(who: Node3D) -> void:
	if Players.coop() and who != Players.local_player():
		Audio.play("boss_warning", "ui", 0.55, 0.0, 1.3)
	elif who == Players.local_player():
		Haptics.pulse(&"down")


## Vibra ao ser levantado, ou ao levantar um colega (perto e segurando USAR).
func _on_player_revived(who: Node3D) -> void:
	var me := Players.local_player()
	if me == null:
		return
	if who == me or (me.is_standing() and Input.is_action_pressed(&"interact") and me.global_position.distance_to(who.global_position) <= 3.0):
		Haptics.pulse(&"revive")


## Mini mira do PC: na posição do mouse enquanto se mira com ele (não no toque, nem com o
## analógico, nem na pausa ou no fim de jogo). O cursor do sistema some enquanto ela aparece.
func _update_crosshair() -> void:
	var player := Players.local_player()
	var wanted: bool = Save.get_setting("crosshair") != false and not InputBindings.touch_active and player != null \
		and player.mouse_aim and player.is_alive() and not get_tree().paused and not _game_over_panel.visible \
		and not (_pause_menu and _pause_menu.visible)
	_crosshair.visible = wanted
	_set_cursor_hidden(wanted)
	if not wanted:
		return
	_crosshair.position = get_viewport().get_mouse_position()
	_crosshair.show_state(player.weapon.current_spread() if player.weapon else 0.0, player.aiming_at_enemy)


## Celular: cantoneiras em volta do alvo da mira automática (vermelhas enquanto atira nele).
func _update_target_mark() -> void:
	var player := Players.local_player()
	var camera := get_viewport().get_camera_3d()
	var target: Node3D = player.assist_lock if player != null and is_instance_valid(player.assist_lock) else null
	var wanted := InputBindings.touch_active and target != null and camera != null and player.is_standing() \
		and not get_tree().paused and not _game_over_panel.visible and not camera.is_position_behind(target.global_position)
	_target_mark.visible = wanted
	if not wanted:
		return
	_target_mark.position = camera.unproject_position(target.global_position + Vector3.UP * 1.0).round()
	_target_mark.show_target(target, player.auto_firing or Input.is_action_pressed(&"fire"))


func _set_cursor_hidden(hidden: bool) -> void:
	var mode := Input.MOUSE_MODE_HIDDEN if hidden else Input.MOUSE_MODE_VISIBLE
	if Input.mouse_mode != mode and Input.mouse_mode in [Input.MOUSE_MODE_VISIBLE, Input.MOUSE_MODE_HIDDEN]:
		Input.mouse_mode = mode
