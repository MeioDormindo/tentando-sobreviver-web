class_name CharacterModel
extends Node3D
## Modelo 3D de um personagem (glb gerado no Blender por tools/blender/build_models.py):
## instancia a cena, toca as animações com transição e troca as cores pelo nome do material
## (Shirt, Skin, Jacket, Fur...). Cada instância tem os próprios materiais (o piscar de dano
## de um zumbi não pinta os outros).

## Animações que repetem.
const LOOPS: Array[StringName] = [&"Idle", &"Walk", &"Run", &"Crawl", &"Charge", &"Closed"]

var animation_player: AnimationPlayer
var skeleton: Skeleton3D
var current: StringName = &""
## Materiais próprios desta instância (para trocar cor e piscar).
var materials: Array[StandardMaterial3D] = []

var _instance: Node3D


## Cria o modelo a partir do glb importado (ou devolve null se não houver cena).
static func create(scene: PackedScene) -> CharacterModel:
	if scene == null:
		return null
	var model := CharacterModel.new()
	model.name = "Model"
	model._instance = scene.instantiate() as Node3D
	model.add_child(model._instance)
	model.animation_player = model._instance.find_child("AnimationPlayer", true, false) as AnimationPlayer
	for node in model._instance.find_children("*", "Skeleton3D", true, false):
		model.skeleton = node as Skeleton3D
		break
	if model.animation_player:
		for anim_name in LOOPS:
			if model.animation_player.has_animation(anim_name):
				model.animation_player.get_animation(anim_name).loop_mode = Animation.LOOP_LINEAR
	model._own_materials()
	return model


## Modelo de um objeto (máquinas): carrega o glb se existir, na escala pedida por eixo.
static func prop(path: String, scale_by := Vector3.ONE) -> CharacterModel:
	if not ResourceLoader.exists(path):
		return null
	var model := create(load(path))
	if model:
		model.scale = scale_by
	return model


## Cor e brilho de um material (vidro da máquina de perk).
func glow(material_name: String, color: Color, energy := 1.0) -> void:
	var material := find_material(material_name)
	if material:
		material.albedo_color = color
		material.emission_enabled = true
		material.emission = color
		material.emission_energy_multiplier = energy


func meshes() -> Array[MeshInstance3D]:
	var list: Array[MeshInstance3D] = []
	for node in _instance.find_children("*", "MeshInstance3D", true, false):
		list.append(node as MeshInstance3D)
	return list


## Troca a cor dos materiais pelo nome: {"Shirt": Color, "Skin": Color}.
func recolor(colors: Dictionary) -> void:
	for material in materials:
		if colors.has(material.resource_name):
			material.albedo_color = colors[material.resource_name]


func find_material(material_name: String) -> StandardMaterial3D:
	for material in materials:
		if material.resource_name == material_name:
			return material
	return null


func has_animation(anim_name: StringName) -> bool:
	return animation_player != null and animation_player.has_animation(anim_name)


## Toca com transição curta, se já não for a atual (uma que não repete fica parada no fim).
func play(anim_name: StringName, blend := 0.15, speed := 1.0) -> void:
	if not has_animation(anim_name):
		return
	animation_player.speed_scale = speed
	if current == anim_name:
		return
	current = anim_name
	animation_player.play(anim_name, blend)


## Toca do começo mesmo se for a mesma (golpe, rugido).
func play_once(anim_name: StringName, blend := 0.08, speed := 1.0) -> void:
	if not has_animation(anim_name):
		return
	current = anim_name
	animation_player.speed_scale = speed
	animation_player.play(anim_name, blend)
	animation_player.seek(0.0, true)


## Escala de um osso (modo cabeção: cabeça gigante).
func scale_bone(bone_name: String, factor: float) -> void:
	if skeleton == null:
		return
	var index := skeleton.find_bone(bone_name)
	if index >= 0:
		skeleton.set_bone_pose_scale(index, Vector3.ONE * factor)


func _own_materials() -> void:
	var copies := {}
	for mesh_instance in meshes():
		var mesh := mesh_instance.mesh
		if mesh == null:
			continue
		for i in mesh.get_surface_count():
			var original := mesh.surface_get_material(i) as StandardMaterial3D
			if original == null:
				continue
			if not copies.has(original):
				var copy := original.duplicate() as StandardMaterial3D
				copy.resource_name = original.resource_name
				# Texturas pixeladas (como a arte do jogo web).
				copy.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST_WITH_MIPMAPS
				copies[original] = copy
				materials.append(copy)
			mesh_instance.set_surface_override_material(i, copies[original])
