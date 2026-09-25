class_name PropFactory
extends RefCounted
## Objetos do cenário em pixel art 2.5D (npm run godot:scenery → assets/tiles): monta cada
## objeto a partir da receita (caixas e cilindros) do props.json; cada face usa a sua região
## do atlas do objeto, com pixels nítidos. Partes "tint" recebem a cor pedida (máquina de
## perk); partes com "glow" brilham (telas, vitrines). Cada parte é um nó (a tampa da Mystery
## Box se chama "lid").

const DIR := "res://assets/tiles/"
const SEGMENTS := 12

static var _index: Dictionary = {}
static var _materials: Dictionary = {}


static func has(prop_name: String) -> bool:
	return _recipes().has(prop_name)


static func _recipes() -> Dictionary:
	if _index.is_empty() and FileAccess.file_exists(DIR + "props.json"):
		var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(DIR + "props.json"))
		_index = parsed if parsed is Dictionary else {}
	return _index


## Monta o objeto (pés no chão, centro na origem); null se não houver receita.
static func create(prop_name: String, tint := Color.WHITE) -> Node3D:
	var recipe: Dictionary = _recipes().get(prop_name, {})
	if recipe.is_empty() or not ResourceLoader.exists(DIR + "prop_%s.png" % prop_name):
		return null
	var texture := load(DIR + "prop_%s.png" % prop_name) as Texture2D
	var atlas := Vector2(recipe.atlas[0], recipe.atlas[1])
	var root := Node3D.new()
	root.name = "Prop_" + prop_name
	var parts: Array = recipe.parts
	for i in parts.size():
		var part: Dictionary = parts[i]
		var mesh := _box_mesh(part, atlas) if part.shape == "box" else _cylinder_mesh(part, atlas)
		var node := MeshInstance3D.new()
		node.name = String(part.name) if String(part.name) != "" else "Part%d" % i
		node.mesh = mesh
		node.material_override = _material(texture, prop_name, tint if bool(part.tint) else Color.WHITE, part.glow)
		node.position = Vector3(part.at[0], part.at[1], part.at[2])
		var rot: Array = part.rot
		node.rotation_degrees = Vector3(rot[0], rot[1], rot[2])
		root.add_child(node)
	return root


static func _material(texture: Texture2D, prop_name: String, tint: Color, glow: Variant) -> StandardMaterial3D:
	var key := "%s|%s|%s" % [prop_name, tint.to_html(), str(glow)]
	if _materials.has(key):
		return _materials[key]
	var material := StandardMaterial3D.new()
	material.albedo_texture = texture
	material.albedo_color = tint
	material.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST_WITH_MIPMAPS
	material.roughness = 0.9
	# Sem descartar faces: as malhas não dependem do sentido dos triângulos.
	material.cull_mode = BaseMaterial3D.CULL_DISABLED
	if glow is Array:
		material.emission_enabled = true
		material.emission_texture = texture
		material.emission = Color(glow[0], glow[1], glow[2]) * tint
		material.emission_energy_multiplier = 0.35
	_materials[key] = material
	return material


static func _uv(rect: Array, atlas: Vector2, u: float, v: float) -> Vector2:
	return Vector2((float(rect[0]) + u * float(rect[2])) / atlas.x, (float(rect[1]) + v * float(rect[3])) / atlas.y)


## Caixa centrada: topo, frente/trás e laterais com as regiões do atlas (sem o fundo).
static func _box_mesh(part: Dictionary, atlas: Vector2) -> ArrayMesh:
	var w := float(part.size[0]) * 0.5
	var h := float(part.size[1]) * 0.5
	var d := float(part.size[2]) * 0.5
	var faces: Dictionary = part.faces
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	# Cada face: 4 cantos (sentido anti-horário visto de fora), normal, região, (u,v) dos cantos.
	var quads := [
		[[Vector3(-w, h, -d), Vector3(w, h, -d), Vector3(w, h, d), Vector3(-w, h, d)], Vector3.UP, faces.get("top")],
		[[Vector3(-w, h, d), Vector3(w, h, d), Vector3(w, -h, d), Vector3(-w, -h, d)], Vector3.BACK, faces.get("front")],
		[[Vector3(w, h, -d), Vector3(-w, h, -d), Vector3(-w, -h, -d), Vector3(w, -h, -d)], Vector3.FORWARD, faces.get("front")],
		[[Vector3(w, h, d), Vector3(w, h, -d), Vector3(w, -h, -d), Vector3(w, -h, d)], Vector3.RIGHT, faces.get("side")],
		[[Vector3(-w, h, -d), Vector3(-w, h, d), Vector3(-w, -h, d), Vector3(-w, -h, -d)], Vector3.LEFT, faces.get("side")],
	]
	for quad: Array in quads:
		var rect: Variant = quad[2]
		if not rect is Array:
			continue
		var c: Array = quad[0]
		var uvs := [Vector2(0, 0), Vector2(1, 0), Vector2(1, 1), Vector2(0, 1)]
		for index in [0, 1, 2, 0, 2, 3]:
			st.set_normal(quad[1])
			st.set_uv(_uv(rect, atlas, uvs[index].x, uvs[index].y))
			st.add_vertex(c[index])
	return st.commit()


## Cilindro de pé (eixo y), lateral enrolada na região "side" e tampa em cima.
static func _cylinder_mesh(part: Dictionary, atlas: Vector2) -> ArrayMesh:
	var radius := float(part.size[0]) * 0.5
	var h := float(part.size[1]) * 0.5
	var faces: Dictionary = part.faces
	var side: Array = faces.get("side", [0, 0, 1, 1])
	var top: Array = faces.get("top", side)
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in SEGMENTS:
		var a0 := TAU * i / SEGMENTS
		var a1 := TAU * (i + 1) / SEGMENTS
		var p0 := Vector3(cos(a0) * radius, 0, sin(a0) * radius)
		var p1 := Vector3(cos(a1) * radius, 0, sin(a1) * radius)
		var n0 := Vector3(cos(a0), 0, sin(a0))
		var n1 := Vector3(cos(a1), 0, sin(a1))
		var u0 := float(i) / SEGMENTS
		var u1 := float(i + 1) / SEGMENTS
		var verts := [[p0 + Vector3.UP * h, n0, u0, 0.0], [p1 + Vector3.UP * h, n1, u1, 0.0], [p1 - Vector3.UP * h, n1, u1, 1.0],
			[p0 + Vector3.UP * h, n0, u0, 0.0], [p1 - Vector3.UP * h, n1, u1, 1.0], [p0 - Vector3.UP * h, n0, u0, 1.0]]
		for v: Array in verts:
			st.set_normal(v[1])
			st.set_uv(_uv(side, atlas, v[2], v[3]))
			st.add_vertex(v[0])
		# Tampa (leque a partir do centro).
		for v: Array in [[Vector3(0, h, 0), 0.5, 0.5], [Vector3(p1.x, h, p1.z), 0.5 + cos(a1) * 0.5, 0.5 + sin(a1) * 0.5], [Vector3(p0.x, h, p0.z), 0.5 + cos(a0) * 0.5, 0.5 + sin(a0) * 0.5]]:
			st.set_normal(Vector3.UP)
			st.set_uv(_uv(top, atlas, v[1], v[2]))
			st.add_vertex(v[0])
	return st.commit()
