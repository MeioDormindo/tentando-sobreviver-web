class_name Haptics
extends RefCounted
## Vibração do celular (configuração "vibration", ligada por padrão): só com os controles de toque
## ativos. A HUD chama `pulse()` nos avisos do jogador desta máquina. No Android precisa da
## permissão de vibrar (preset de exportação); no navegador usa a vibração do aparelho, se houver.

## Tipo → [duração (ms), intensidade 0..1, repetições].
const PATTERNS := {
	&"hurt": [40, 0.6, 1],
	&"down": [300, 1.0, 1],
	&"revive": [60, 0.8, 2],
}
## Intervalo mínimo entre duas vibrações do mesmo tipo (s): levar vários golpes seguidos não vira
## uma vibração contínua.
const MIN_GAP := {&"hurt": 0.3, &"down": 1.0, &"revive": 0.5}
## Quando cada tipo vibrou pela última vez (s, relógio do motor).
static var _last := {}


## Pode vibrar este tipo agora (função pura: o intervalo mínimo desde a última vez)?
static func allowed(kind: StringName, now: float, last: float) -> bool:
	return now - last >= float(MIN_GAP.get(kind, 0.0))


static func enabled() -> bool:
	return InputBindings.touch_active and Save.get_setting("vibration") != false


## Vibra (se ligado e se já passou o intervalo do tipo). Devolve se vibrou.
static func pulse(kind: StringName) -> bool:
	if not enabled() or not PATTERNS.has(kind):
		return false
	var now := Time.get_ticks_msec() / 1000.0
	if not allowed(kind, now, float(_last.get(kind, -INF))):
		return false
	_last[kind] = now
	var pattern: Array = PATTERNS[kind]
	Input.vibrate_handheld(int(pattern[0]), float(pattern[1]))
	if int(pattern[2]) > 1:
		# Segunda batida depois de uma pausa curta (a primeira ainda está vibrando).
		var tree := Engine.get_main_loop() as SceneTree
		if tree:
			tree.create_timer((int(pattern[0]) + 70) / 1000.0, true).timeout.connect(func() -> void:
				Input.vibrate_handheld(int(pattern[0]), float(pattern[1])))
	return true
