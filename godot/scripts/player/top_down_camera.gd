class_name TopDownCamera
extends Camera3D
## Câmera de cima, inclinada (estilo twin-stick), que segue o alvo suavemente.
## O ângulo é fixo: só a posição acompanha o alvo.

@export var target: Node3D
## Posição da câmera em relação ao alvo (m).
@export var offset: Vector3 = Vector3(0.0, 15.0, 8.5)
## Quanto maior, mais rápido alcança o alvo.
@export var smoothing: float = 8.0

var _shake_left := 0.0
var _shake_strength := 0.0


func _ready() -> void:
	Events.screen_shake.connect(shake)
	if target:
		look_at_from_position(target.global_position + offset, target.global_position, Vector3.UP)


func _physics_process(delta: float) -> void:
	if target == null:
		return
	var desired := target.global_position + offset
	global_position = global_position.lerp(desired, clampf(smoothing * delta, 0.0, 1.0))
	if _shake_left > 0.0:
		_shake_left -= delta
		h_offset = randf_range(-1.0, 1.0) * _shake_strength
		v_offset = randf_range(-1.0, 1.0) * _shake_strength
		if _shake_left <= 0.0:
			h_offset = 0.0
			v_offset = 0.0


## Tremor de tela (explosões, trem, desabamento); desligado nas configurações.
func shake(duration: float, strength: float) -> void:
	if not bool(Save.get_setting("screenShake")):
		return
	_shake_left = maxf(_shake_left, duration)
	_shake_strength = maxf(strength, _shake_strength if _shake_left > 0.0 else 0.0)
