class_name PauseMenu
extends Control
## Menu de pausa (como no jogo web): CONTINUAR, REINICIAR e MENU, e as configurações que valem
## na hora (volume, som, música, minimapa, tremor...). Aparece com Events.pause_changed.

const MENU := "res://scenes/ui/main_menu.tscn"


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	visible = false
	Events.pause_changed.connect(func(paused: bool) -> void:
		visible = paused
		if paused:
			_build())


func _build() -> void:
	for child in get_children():
		remove_child(child)
		child.queue_free()
	var column := MenuKit.screen(self, 560.0)
	(get_child(0) as ColorRect).color = Color(0, 0, 0, 0.8)
	MenuKit.spacer(column, 20)
	MenuKit.title(column, "PAUSADO", 54)
	var buttons := HBoxContainer.new()
	buttons.alignment = BoxContainer.ALIGNMENT_CENTER
	buttons.add_theme_constant_override(&"separation", 28)
	column.add_child(buttons)
	var resume := MenuKit.button(buttons, "CONTINUAR", func() -> void: Events.resume_requested.emit(), 22)
	resume.name = "Resume"
	MenuKit.button(buttons, "REINICIAR", func() -> void: Events.restart_requested.emit(), 22)
	MenuKit.button(buttons, "MENU", func() -> void:
		get_tree().paused = false
		get_tree().change_scene_to_file(MENU), 22)
	MenuKit.spacer(column, 6)
	SettingsRows.add(column, _build, 18)
	MenuKit.spacer(column, 6)
	MenuKit.label(column, "ESC para continuar  ·  Tab: mapa grande", 13, MenuKit.DIM, HORIZONTAL_ALIGNMENT_CENTER)
	resume.grab_focus.call_deferred()
