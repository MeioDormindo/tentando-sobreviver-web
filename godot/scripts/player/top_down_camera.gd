class_name TopDownCamera
extends Camera3D
## Câmera top-down 3/4 (especificação 2.5D pixel): inclinação fixa e perspectiva controlada
## (FOV baixo, pouca distorção), seguindo o alvo com suavização e adiantando um pouco na
## direção da mira. O enquadramento é o do jogo web: cerca de 12 m de altura visível e pelo
## menos 20 m de largura. Também faz o tremor de tela e o zoom configurável.

@export var target: Node3D
## Inclinação da câmera (graus a partir do chão) e distância até o alvo (m).
@export_range(35.0, 85.0) var pitch_degrees: float = 55.0
@export var distance: float = 19.0
@export var field_of_view: float = 35.0
## Zoom (1 = padrão; maior aproxima).
@export var zoom: float = 1.0
## Quanto maior, mais rápido alcança o alvo.
@export var smoothing: float = 8.0
## Antecipação na direção da mira (como no jogo web): fração da distância até a mira, com limite.
@export var look_ahead: float = 0.28
@export var max_look_ahead: float = 4.0
@export var look_ahead_smoothing: float = 5.0

var _look := Vector3.ZERO
var _shake_left := 0.0
var _shake_strength := 0.0


func _ready() -> void:
	Events.screen_shake.connect(shake)
	fov = field_of_view
	# Olhando para o "norte" do mapa (-Z), inclinada: a tela tem x à direita e z para baixo,
	# como o mapa do jogo web e o minimapa.
	rotation = Vector3(-deg_to_rad(pitch_degrees), 0.0, 0.0)
	if target:
		global_position = _desired_position()


## Posição da câmera em relação ao ponto que ela enquadra.
func offset() -> Vector3:
	var pitch := deg_to_rad(pitch_degrees)
	var reach := distance / maxf(0.25, zoom)
	return Vector3(0.0, sin(pitch) * reach, cos(pitch) * reach)


func _desired_position() -> Vector3:
	return target.global_position + _look + offset()


func _physics_process(delta: float) -> void:
	if target == null:
		return
	# Antecipação: para onde o jogador mira (mouse ou analógico), um pouco à frente.
	var wanted := Vector3.ZERO
	var aim: Variant = target.get(&"aim_point")
	if aim is Vector3:
		wanted = (aim as Vector3) - target.global_position
		wanted.y = 0.0
		wanted = (wanted * look_ahead).limit_length(max_look_ahead)
	_look = _look.lerp(wanted, clampf(look_ahead_smoothing * delta, 0.0, 1.0))
	global_position = global_position.lerp(_desired_position(), clampf(smoothing * delta, 0.0, 1.0))
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
