class_name MenuKit
extends RefCounted
## Peças comuns das telas de menu (mesmo visual da HUD): fundo, título, botões, textos.
## Controles com foco para teclado e controle (seção 27/28).

const BG := Color(0.035, 0.04, 0.045)
const TEXT := Color(0.91, 0.89, 0.78)
const DIM := Color(0.6, 0.6, 0.56)
const GOLD := Color(0.89, 0.78, 0.48)
const RED := Color(0.72, 0.18, 0.16)
## Altura da célula da fonte pixel (npm run godot:font): os tamanhos são múltiplos dela.
const FONT_CELL := 13


## Tamanho de fonte nítido para a fonte pixel (escala inteira): o múltiplo da célula mais
## perto do tamanho pedido, no mínimo 2× (1× fica miúdo demais na tela).
static func px(size: int) -> int:
	return maxi(2, roundi(float(size) / float(FONT_CELL))) * FONT_CELL


## Fundo escuro de tela cheia + coluna central com rolagem; devolve a coluna.
static func screen(root: Control, width: float = 720.0) -> VBoxContainer:
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var bg := ColorRect.new()
	bg.color = BG
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.add_child(bg)
	var scroll := ScrollContainer.new()
	scroll.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	root.add_child(scroll)
	var center := CenterContainer.new()
	center.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	center.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.add_child(center)
	var column := VBoxContainer.new()
	column.custom_minimum_size = Vector2(width, 0)
	column.add_theme_constant_override(&"separation", 14)
	center.add_child(column)
	return column


static func title(parent: Control, text: String, size: int = 64, color: Color = TEXT) -> Label:
	return label(parent, text, size, color, HORIZONTAL_ALIGNMENT_CENTER)


static func label(parent: Control, text: String, size: int = 18, color: Color = TEXT, align: HorizontalAlignment = HORIZONTAL_ALIGNMENT_LEFT) -> Label:
	var l := Label.new()
	l.text = text
	l.horizontal_alignment = align
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.add_theme_font_size_override(&"font_size", px(size))
	l.add_theme_color_override(&"font_color", color)
	parent.add_child(l)
	return l


static func button(parent: Control, text: String, on_press: Callable, size: int = 24) -> Button:
	var b := Button.new()
	b.text = text
	style_button(b, size)
	b.pressed.connect(func() -> void: Audio.play("ui_beep", "ui", 0.8, 0.0))
	b.pressed.connect(on_press)
	parent.add_child(b)
	return b


## Visual pixel dos botões: texto em escala inteira, moldura dourada no foco e ao passar o
## mouse, painel escuro ao apertar; sem fundo no resto.
static func style_button(b: Button, size: int = 24) -> void:
	b.focus_mode = Control.FOCUS_ALL
	b.add_theme_font_size_override(&"font_size", px(size))
	b.add_theme_color_override(&"font_color", TEXT)
	b.add_theme_color_override(&"font_hover_color", GOLD)
	b.add_theme_color_override(&"font_focus_color", GOLD)
	b.add_theme_color_override(&"font_pressed_color", GOLD)
	b.add_theme_color_override(&"font_disabled_color", DIM)
	var empty := StyleBoxEmpty.new()
	empty.set_content_margin_all(10.0)
	b.add_theme_stylebox_override(&"normal", empty)
	b.add_theme_stylebox_override(&"disabled", empty)
	b.add_theme_stylebox_override(&"hover", PixelSkin.panel(true, 10.0))
	b.add_theme_stylebox_override(&"focus", PixelSkin.panel(true, 10.0))
	b.add_theme_stylebox_override(&"pressed", PixelSkin.panel(false, 10.0))


## Campo de texto com moldura pixel (dourada quando em foco).
static func style_edit(e: LineEdit, size: int = 24) -> void:
	e.add_theme_font_size_override(&"font_size", px(size))
	e.add_theme_color_override(&"font_color", TEXT)
	e.add_theme_color_override(&"font_placeholder_color", DIM)
	e.add_theme_stylebox_override(&"normal", PixelSkin.panel(false, 10.0))
	e.add_theme_stylebox_override(&"focus", PixelSkin.panel(true, 10.0))


static func spacer(parent: Control, height: float) -> void:
	var s := Control.new()
	s.custom_minimum_size = Vector2(0, height)
	parent.add_child(s)


static func go(node: Node, scene: String) -> void:
	node.get_tree().change_scene_to_file(scene)
