class_name PixelSkin
extends RefCounted
## Molduras em pixel art da interface (npm run godot:font → assets/ui): painel escuro com
## borda e cantos recortados, painel dourado (foco/destaque) e barra segmentada com moldura.
## Sem as imagens, cai para caixas lisas.

const DIR := "res://assets/ui/%s.png"


static func _texture(file_name: String) -> Texture2D:
	var path := DIR % file_name
	return load(path) if ResourceLoader.exists(path) else null


## Painel 9-slice (focus = borda dourada). padding: margem interna em px.
static func panel(focus := false, padding := 10.0) -> StyleBox:
	var texture := _texture("panel_focus" if focus else "panel")
	if texture == null:
		var flat := StyleBoxFlat.new()
		flat.bg_color = Color(0.06, 0.065, 0.075, 0.85)
		flat.set_content_margin_all(padding)
		return flat
	var style := StyleBoxTexture.new()
	style.texture = texture
	style.set_texture_margin_all(8.0)
	style.set_content_margin_all(padding)
	return style


## Barra segmentada com moldura: devolve [moldura (Control para o layout), ProgressBar].
static func bar(color: Color, width: float, height := 12.0) -> Array:
	var frame := PanelContainer.new()
	frame.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var progress := ProgressBar.new()
	progress.show_percentage = false
	progress.custom_minimum_size = Vector2(width, height)
	progress.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var frame_texture := _texture("bar_frame")
	var segment := _texture("bar_segment")
	if frame_texture and segment:
		var back := StyleBoxTexture.new()
		back.texture = frame_texture
		back.set_texture_margin_all(4.0)
		back.set_content_margin_all(4.0)
		frame.add_theme_stylebox_override(&"panel", back)
		var fill := StyleBoxTexture.new()
		fill.texture = segment
		fill.axis_stretch_horizontal = StyleBoxTexture.AXIS_STRETCH_MODE_TILE
		fill.modulate_color = color
		progress.add_theme_stylebox_override(&"fill", fill)
		progress.add_theme_stylebox_override(&"background", StyleBoxEmpty.new())
	else:
		var flat := StyleBoxFlat.new()
		flat.bg_color = color
		progress.add_theme_stylebox_override(&"fill", flat)
	frame.add_child(progress)
	return [frame, progress]


## Muda a cor do preenchimento de uma barra criada por bar().
static func tint_bar(progress: ProgressBar, color: Color) -> void:
	var fill := progress.get_theme_stylebox(&"fill")
	if fill is StyleBoxTexture:
		(fill as StyleBoxTexture).modulate_color = color
	elif fill is StyleBoxFlat:
		(fill as StyleBoxFlat).bg_color = color
