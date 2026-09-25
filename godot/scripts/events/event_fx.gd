class_name EventFx
extends RefCounted
## Peças visuais simples dos eventos do mapa (blockout, até os modelos do Blender).


## Material brilhante (transparente se alpha < 1).
static func glow(color: Color, alpha: float = 1.0, energy: float = 1.0) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = Color(color, alpha)
	material.emission_enabled = true
	material.emission = color * energy
	if alpha < 1.0:
		material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	return material


## Disco de aviso no chão em pixel art (anel e miolo pontilhado), com o raio em m. A
## transparência muda pelo modulate.
static func disc(color: Color, radius: float, alpha: float = 0.35) -> Sprite3D:
	return PixelShapes.flat("disc", Color(color, clampf(alpha * 2.2, 0.0, 1.0)), radius)


static func box(size: Vector3, material: Material) -> MeshInstance3D:
	var mesh := BoxMesh.new()
	mesh.size = size
	mesh.material = material
	var node := MeshInstance3D.new()
	node.mesh = mesh
	return node


static func light(color: Color, energy: float, reach: float) -> OmniLight3D:
	var omni := OmniLight3D.new()
	omni.light_color = color
	omni.light_energy = energy
	omni.omni_range = reach
	return omni
