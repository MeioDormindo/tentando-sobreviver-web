class_name CameraOcclusion
extends Node
## Oclusão das paredes (especificação 2.5D, §13): informa aos shaders (parâmetros globais)
## onde o alvo está na tela e a que profundidade, para as paredes na frente dele abrirem
## um círculo pontilhado. Filho da câmera; sem alvo, o círculo fica fora da tela.

@export var target: Node3D
## Altura do ponto do alvo que precisa ficar visível (m): mais ou menos o peito.
@export var target_height: float = 1.0


func _process(_delta: float) -> void:
	var camera := get_parent() as Camera3D
	if camera == null or target == null or not is_instance_valid(target):
		RenderingServer.global_shader_parameter_set(&"occlusion_screen", Vector2(-10.0, -10.0))
		return
	var point := target.global_position + Vector3.UP * target_height
	var size := camera.get_viewport().get_visible_rect().size
	if camera.is_position_behind(point) or size.y <= 0.0:
		RenderingServer.global_shader_parameter_set(&"occlusion_screen", Vector2(-10.0, -10.0))
		return
	var screen := camera.unproject_position(point) / size
	var view := camera.global_transform.affine_inverse() * point
	RenderingServer.global_shader_parameter_set(&"occlusion_screen", screen)
	RenderingServer.global_shader_parameter_set(&"occlusion_view_z", view.z)
	RenderingServer.global_shader_parameter_set(&"occlusion_aspect", size.x / size.y)
