extends SceneTree
## Executor dos testes isolados (seção 42), sem addons:
##   godot --headless --path godot -s res://tests/run_tests.gd
##   godot --headless --path godot -s res://tests/run_tests.gd -- --only=events
## Sai com código 1 se algum teste falhar. `--only=` roda uma suíte só (o save de teste vale
## do mesmo jeito): unit, weapons, zombies, bosses, menus, powerups, match, events, quest, audio, models, online.
##
## A suíte é carregada só aqui dentro: com `-s`, este arquivo é compilado antes de os
## autoloads (Events, InputBindings) existirem, então ele não pode citar os scripts do jogo.

## Nome → suíte de cena (assíncronas: precisam de física rodando).
const SCENE_SUITES := {
	"weapons": "res://tests/weapon_scene_tests.gd",
	"zombies": "res://tests/zombie_scene_tests.gd",
	"bosses": "res://tests/boss_scene_tests.gd",
	"menus": "res://tests/menu_scene_tests.gd",
	"powerups": "res://tests/power_up_scene_tests.gd",
	"match": "res://tests/hud_scene_tests.gd",
	"events": "res://tests/world_event_scene_tests.gd",
	"quest": "res://tests/quest_scene_tests.gd",
	"audio": "res://tests/audio_scene_tests.gd",
	"models": "res://tests/model_scene_tests.gd",
	"online": "res://tests/online_tests.gd",
}


func _initialize() -> void:
	# Espera a árvore ficar ativa (os testes de mapa precisam do _ready dos nós).
	await process_frame
	# Save de teste: os testes nunca mexem no save de verdade do jogador.
	var save := root.get_node("Save")
	save.call(&"load_from", "user://test_save.json")
	save.call(&"reset")
	var only := ""
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--only="):
			only = arg.trim_prefix("--only=")
	var failures := 0
	if only == "" or only == "unit":
		var script := load("res://tests/system_tests.gd") as GDScript
		if script == null or not script.can_instantiate():
			printerr("A suíte de testes não compilou (veja o erro acima).")
			quit(1)
			return
		var suite: RefCounted = script.new()
		failures += suite.call(&"run", self)
	for key: String in SCENE_SUITES:
		if only != "" and only != key:
			continue
		var scene_suite: RefCounted = (load(SCENE_SUITES[key]) as GDScript).new()
		failures += await scene_suite.call(&"run", self)
	DirAccess.remove_absolute(ProjectSettings.globalize_path("user://test_save.json"))
	quit(1 if failures > 0 else 0)
