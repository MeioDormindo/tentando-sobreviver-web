extends Control
## Menu principal (como no jogo web): jogar (escolha de mapa), ranking, configurações, sair.
## Enter pula direto para o mapa padrão.

const MAP_SELECT := "res://scenes/ui/map_select.tscn"
const RANKING := "res://scenes/ui/ranking.tscn"
const ARMORY := "res://scenes/ui/armory.tscn"
const SETTINGS := "res://scenes/ui/settings.tscn"
const ACCOUNT := "res://scenes/ui/account.tscn"
const ACHIEVEMENTS := "res://scenes/ui/achievements.tscn"
const GLOSSARY := "res://scenes/ui/glossary.tscn"
const LOBBY := "res://scenes/ui/lobby.tscn"
const SUPPORT := "res://scenes/ui/support.tscn"
## Código Konami (↑↑↓↓←→←→BA): libera o "modo cabeção", como no jogo web.
const KONAMI := [KEY_UP, KEY_UP, KEY_DOWN, KEY_DOWN, KEY_LEFT, KEY_RIGHT, KEY_LEFT, KEY_RIGHT, KEY_B, KEY_A]

var _konami_step := 0
var _secret_label: Label
const GAME := "res://scenes/main.tscn"
const KEYBOARD_HINT := "%s mover · mouse mirar · clique atirar · %s recarregar · %s trocar arma · %s faca · %s usar · %s pausa"
## Mesma dica do jogo web para o celular.
const TOUCH_HINT := "Analógico: mover · ATIRAR: mira sozinho no zumbi mais perto e atira · FACA: golpe corpo a corpo"


func _ready() -> void:
	var column := MenuKit.screen(self, 560.0)
	MenuKit.spacer(column, 40)
	MenuKit.title(column, "TENTANDO\nSOBREVIVER", 72)
	MenuKit.label(column, SupportInfo.credit_line(), 14, MenuKit.DIM, HORIZONTAL_ALIGNMENT_CENTER).name = "Credit"
	var best := Save.records(Save.catalog.default_map)
	if int(best.bestScore) > 0:
		MenuKit.label(column, Loc.t("RECORDE: %d PONTOS · ROUND %d") % [best.bestScore, best.bestWave], 16, MenuKit.GOLD, HORIZONTAL_ALIGNMENT_CENTER)
	# A partida em grupo caiu (o host saiu, sem conexão): diz o porquê uma vez.
	if Net.last_error != "":
		MenuKit.label(column, Loc.text(Net.last_error).to_upper(), 16, MenuKit.RED, HORIZONTAL_ALIGNMENT_CENTER)
		Net.last_error = ""
	MenuKit.spacer(column, 24)
	var play := MenuKit.button(column, "JOGAR", func() -> void: MenuKit.go(self, MAP_SELECT))
	MenuKit.button(column, "JOGAR EM GRUPO", func() -> void: MenuKit.go(self, LOBBY))
	MenuKit.button(column, "RANKING", func() -> void: MenuKit.go(self, RANKING))
	MenuKit.button(column, "ARMAS", func() -> void: MenuKit.go(self, ARMORY))
	MenuKit.button(column, "CONQUISTAS", func() -> void: MenuKit.go(self, ACHIEVEMENTS))
	MenuKit.button(column, "GLOSSÁRIO", func() -> void: MenuKit.go(self, GLOSSARY))
	var user := Account.current_user()
	MenuKit.button(column, (Loc.t("CONTA: %s") % user.to_upper()) if user != "" else "CONTA / SALVAR NA NUVEM", func() -> void: MenuKit.go(self, ACCOUNT))
	MenuKit.button(column, "CONFIGURAÇÕES", func() -> void: MenuKit.go(self, SETTINGS))
	MenuKit.button(column, "APOIE O PROJETO (PIX)", func() -> void: MenuKit.go(self, SUPPORT)).name = "Support"
	if not OS.has_feature("web"):
		MenuKit.button(column, "SAIR", func() -> void: get_tree().quit())
	MenuKit.spacer(column, 30)
	var touch := InputBindings.touch_wanted(String(Save.get_setting("touchMode")), InputBindings.is_touch_device())
	MenuKit.label(column, TOUCH_HINT if touch else _keyboard_hint(),
		13, MenuKit.DIM, HORIZONTAL_ALIGNMENT_CENTER)
	_secret_label = MenuKit.label(column, "", 18, Color(0.72, 0.88, 0.29), HORIZONTAL_ALIGNMENT_CENTER)
	play.grab_focus()
	# Convite pelo link (?sala=ABCDE, na Web): direto para a sala, que entra sozinha.
	if Net.invite_code != "":
		MenuKit.go.call_deferred(self, LOBBY)


func _input(event: InputEvent) -> void:
	if not (event is InputEventKey and event.pressed and not event.is_echo()):
		return
	var key := (event as InputEventKey).keycode
	_konami_step = _konami_step + 1 if key == KONAMI[_konami_step] else (1 if key == KONAMI[0] else 0)
	if _konami_step == KONAMI.size():
		_konami_step = 0
		var first := Save.discover("konami")
		Save.set_setting("bigHeads", true)
		_secret_label.text = "MODO CABEÇÃO LIBERADO! (liga/desliga em Configurações)" if first else "MODO CABEÇÃO LIGADO!"


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and (event as InputEventKey).keycode == KEY_ENTER:
		Session.map_id = Save.catalog.default_map
		MenuKit.go(self, GAME)


## Dica dos controles com as teclas escolhidas nas Configurações.
static func _keyboard_hint() -> String:
	var move := "".join(PackedStringArray([&"move_up", &"move_left", &"move_down", &"move_right"].map(func(a: StringName) -> String: return InputBindings.hint_label(a))))
	return Loc.t(KEYBOARD_HINT) % [move, InputBindings.hint_label(&"reload"), InputBindings.hint_label(&"switch_weapon"), InputBindings.hint_label(&"melee"),
		InputBindings.hint_label(&"interact"), InputBindings.hint_label(&"pause")]
