class_name LayoutMap
extends GameWorld
## Mapa migrado do jogo web: lê data/maps/<id>.json (gerado por `npm run godot:data`) e
## monta o mapa 3D. Tiles vizinhos iguais viram um bloco só (poucos corpos e malhas):
## chão por tipo de piso, paredes, o trem parado, portas compráveis, janelas (só o jogador
## não passa), props com colisão, luzes e pontos de spawn por área. Depois gera a navegação.
## 1 tile = 1 m; x do jogo web = x, y do jogo web = z.

const WALL_HEIGHT := 3.0
const TRAIN_HEIGHT := 2.6
const WINDOW_HEIGHT := 1.1
const PROP_HEIGHT := 0.9
const LAMP_HEIGHT := 3.2

## Cores dos pisos (letras da grade → cor).
const FLOOR_COLORS := {
	"t": Color(0.34, 0.33, 0.3), "c": Color(0.27, 0.27, 0.26), "m": Color(0.3, 0.32, 0.34),
	"r": Color(0.22, 0.2, 0.18), "u": Color(0.2, 0.21, 0.2), "w": Color(0.28, 0.3, 0.32),
	"h": Color(0.62, 0.64, 0.6), "l": Color(0.45, 0.5, 0.48), "g": Color(0.5, 0.55, 0.58),
}
const WALL_COLOR := Color(0.16, 0.16, 0.15)
## Cenário em pixel art (npm run godot:scenery → assets/tiles): textura de cada piso e das
## paredes, a 48 px/m (a mesma densidade dos personagens).
const FLOOR_ART := {
	"t": "floor_terminal", "c": "floor_concrete", "m": "floor_metal", "r": "floor_tracks", "u": "floor_tunnel",
	"w": "floor_wagon", "h": "floor_hospital", "l": "floor_linoleum", "g": "floor_morgue",
}
const WEB_ART := "res://assets/tiles/%s.png"
const PIXELS_PER_METER := 48.0
## Estilo da parede de cada mapa.
const WALL_STYLE := {"terminal": "wall_terminal", "map2": "wall_hospital"}
const TRAIN_COLOR := Color(0.23, 0.33, 0.4)
const WINDOW_COLOR := Color(0.55, 0.7, 0.8, 0.35)
const PROP_COLOR := Color(0.4, 0.33, 0.24)

@export_file("*.json") var map_file: String = "res://data/maps/terminal.json"
@export var door_scene: PackedScene
@export var barricade_scene: PackedScene
@export var barricade_data: BarricadeData
@export var wall_buy_scene: PackedScene
@export var mystery_box_scene: PackedScene
@export var mystery_box_data: MysteryBoxData
@export var weapon_catalog: WeaponCatalog
@export var weapon_lab_scene: PackedScene
@export var weapon_lab_data: WeaponLabData
@export var perk_machine_scene: PackedScene
@export_dir var perks_dir: String = "res://data/perks"
@export var breaker_scene: PackedScene
## Pasta dos WeaponData (compras na parede pelo id da arma).
@export_dir var weapons_dir: String = "res://data/weapons"

var data: Dictionary = {}
var width: int = 0
var height: int = 0

var _cells: PackedStringArray
var _materials: Dictionary = {}
var _area_names: Dictionary = {}
## Ambiente sem efeitos (luz ambiente e névoa), a névoa dos cães ativa e os eventos com visual.
var _base_env: Dictionary = {}
var _hound: Dictionary = {}
var _moods: Dictionary = {}
var _clock := 0.0

# ── Luz por área (seção "lighting" das áreas do mapa) ──
## Luz → [multiplicador da luz ambiente, quanto puxa para o tom quente das lâmpadas].
const AREA_LIGHT := {"lit": [1.6, 0.55], "dim": [0.85, 0.18], "dark": [0.26, 0.0]}
const WARM_LIGHT := Color(0.66, 0.55, 0.4)
## Luz da área onde o jogador está agora.
var lighting := "dim"
var _light_energy := 1.0
var _light_warm := 0.18
var _light_check := 0.0
## Luminárias que falham: [luz, chance]. Quebradas: onde soltam faísca.
var _flickers: Array = []
var _broken: Array[Vector3] = []
var _spark_in := 3.0
## Área de cada tile (índice em data.areas, -1 = nenhuma), calculada uma vez para o minimapa.
var _tile_areas := PackedInt32Array()
## Letra do piso → tipo (legenda do mapa), para os passos.
var _surfaces: Dictionary = {}

@onready var nav_region: NavigationRegion3D = $NavigationRegion3D
## Energia do mapa (luzes fracas e máquinas desligadas até o disjuntor).
@onready var power: PowerSystem = get_node_or_null("PowerSystem")


func _ready() -> void:
	data = _load(map_file)
	if data.is_empty():
		return
	width = data.width
	height = data.height
	_cells = PackedStringArray(data.cells)
	for area: Dictionary in data.areas:
		_area_names[StringName(area.id)] = area.name
	_build_floor()
	_build_solids("#", WALL_HEIGHT, WALL_COLOR, PhysicsLayers.WORLD, "Wall")
	_build_solids("T", TRAIN_HEIGHT, TRAIN_COLOR, PhysicsLayers.WORLD, "Train")
	_build_barricades()
	_build_doors()
	_build_wall_buys()
	_build_machines()
	_build_interactions()
	_build_secrets()
	_build_station()
	_build_props()
	_build_decor()
	_build_lamps()
	_build_spawns()
	open_area(StringName(data.start_area))
	Events.hound_round_changed.connect(_on_hound_round)
	nav_region.bake_navigation_mesh(false)


## Névoa azulada e mais escuro durante a rodada dos cães.
func _on_hound_round(active: bool, config: Dictionary) -> void:
	_hound = config if active else {}
	_apply_environment()


## Visual dos eventos: Apagão (luminárias apagam, mais escuro), Alarme (luz vermelha pulsando),
## Lua de Sangue (escuridão avermelhada) e Neblina (névoa cinza e mais escuro).
func set_event_mood(id: StringName, on: bool, config: Dictionary) -> void:
	if on:
		_moods[id] = config
	else:
		_moods.erase(id)
	if id == &"blackout" and power:
		power.set_blackout(on, float(config.get("flicker_time", 1.4)))
	_apply_environment()


func _process(delta: float) -> void:
	_clock += delta
	_update_area_light(delta)
	_update_lamps(delta)
	if _moods.has(&"emergency_alarm"):
		var env := _environment()
		if env:
			var base: Color = _base_env.get("area_color", _base_env.get("color", env.ambient_light_color))
			env.ambient_light_color = base.lerp(Color(1.0, 0.12, 0.08), 0.35 + 0.35 * sin(_clock * 6.0))


func _environment() -> Environment:
	var node := get_node_or_null("WorldEnvironment") as WorldEnvironment
	return node.environment if node else null


## Junta o ambiente base, a névoa dos cães e os eventos ativos.
func _apply_environment() -> void:
	var env := _environment()
	if env == null:
		return
	if _base_env.is_empty():
		_base_env = {"energy": env.ambient_light_energy, "color": env.ambient_light_color}
	var energy: float = _base_env.energy
	var color: Color = _base_env.color
	var fog := false
	if not _hound.is_empty():
		fog = true
		env.fog_light_color = Color(0.1, 0.16, 0.3)
		env.fog_density = 0.035
		energy *= 1.0 - float(_hound.get("fog_darkness", 0.0)) * 3.0
	if _moods.has(&"blackout"):
		energy *= 1.0 - float(_moods.blackout.get("extra_darkness", 0.2)) * 2.5
	if _moods.has(&"fog"):
		fog = true
		env.fog_light_color = Color(0.62, 0.66, 0.7)
		env.fog_density = 0.07
		energy *= 1.0 - float(_moods.fog.get("extra_darkness", 0.14)) * 2.5
	if _moods.has(&"blood_moon"):
		color = color.lerp(Color(0.75, 0.16, 0.12), 0.55)
		if not fog:
			fog = true
			env.fog_light_color = Color(0.3, 0.04, 0.03)
			env.fog_density = 0.008
	env.fog_enabled = fog
	# Luz da área do jogador: salas bem iluminadas mais claras e quentes, escuras mais fundas.
	env.ambient_light_energy = energy * _light_energy
	env.ambient_light_color = color.lerp(WARM_LIGHT, _light_warm)
	_base_env["area_color"] = env.ambient_light_color


func is_open_floor(point: Vector3) -> bool:
	var tx := floori(point.x)
	var tz := floori(point.z)
	for dz in range(-1, 2):
		for dx in range(-1, 2):
			if not _is_floor(cell(tx + dx, tz + dz)):
				return false
	var area := area_of(point)
	return area != &"" and is_area_open(area)


func surface_at(point: Vector3) -> String:
	if _surfaces.is_empty():
		var floors: Dictionary = data.get("legend", {}).get("floors", {})
		for surface: String in floors:
			_surfaces[String(floors[surface])] = surface
	return String(_surfaces.get(cell(floori(point.x), floori(point.z)), "concrete"))


func facing_toward_open(point: Vector3) -> float:
	var tx := floori(point.x)
	var tz := floori(point.z)
	var best := Vector2i(0, 1)
	var best_score := -1
	for dir: Vector2i in [Vector2i(0, 1), Vector2i(0, -1), Vector2i(1, 0), Vector2i(-1, 0)]:
		var score := 0
		for step in range(1, 4):
			if _is_floor(cell(tx + dir.x * step, tz + dir.y * step)):
				score += 1
		# Parede atrás conta a favor (a máquina fica de costas para ela).
		if not _is_floor(cell(tx - dir.x * 2, tz - dir.y * 2)):
			score += 2
		if score > best_score:
			best_score = score
			best = dir
	# A frente dos modelos é -Z.
	return atan2(-float(best.x), -float(best.y))


func station() -> Dictionary:
	var value: Variant = data.get("station")
	return value if value is Dictionary else {}


## Pistola inicial do mapa (seção "start_weapon"), ou null para a padrão do jogador.
func start_weapon() -> WeaponData:
	var id := String(data.get("start_weapon", ""))
	var path := "res://data/weapons/%s.tres" % id
	return load(path) as WeaponData if id != "" and ResourceLoader.exists(path) else null


func map_id() -> String:
	return String(data.get("id", ""))


func boss_spawn_points() -> Array[Vector3]:
	var points: Array[Vector3] = []
	for spot: Dictionary in data.get("boss_spawns", []):
		points.append(Vector3(spot.x, 0.1, spot.z))
	return points


func get_player_spawn() -> Vector3:
	var start: Dictionary = data.get("player_start", {"x": 0.0, "z": 0.0})
	return Vector3(start.x, 0.1, start.z)


func active_spawn_points(round_number: int) -> Array[Vector3]:
	var points: Array[Vector3] = []
	for node in get_tree().get_nodes_in_group(&"zombie_spawn"):
		var marker := node as Marker3D
		if marker == null or not is_ancestor_of(marker):
			continue
		if is_area_open(marker.get_meta(&"area", &"")) and round_number >= int(marker.get_meta(&"min_round", 1)):
			points.append(marker.global_position)
	return points


func area_of(point: Vector3) -> StringName:
	for area: Dictionary in data.areas:
		for r: Dictionary in area.rects:
			if Rect2(r.x, r.y, r.w, r.h).has_point(Vector2(point.x, point.z)):
				return StringName(area.id)
	return &""


func area_display_name(area_id: StringName) -> String:
	return _area_names.get(area_id, String(area_id))


func rebake_navigation() -> void:
	if not nav_region.is_baking():
		nav_region.bake_navigation_mesh(true)


func minimap_size() -> Vector2i:
	return Vector2i(width, height)


func minimap_cells() -> PackedByteArray:
	_index_tile_areas()
	var cells := PackedByteArray()
	cells.resize(width * height)
	for z in height:
		for x in width:
			var ch := cell(x, z)
			var code := 0
			if _is_floor(ch):
				var area := _tile_areas[z * width + x]
				code = 1 if area >= 0 and is_area_open(StringName(data.areas[area].id)) else 2
			elif ch == "D":
				code = 3
			elif ch == "T":
				code = 4
			elif ch == "W":
				code = 5
			cells[z * width + x] = code
	return cells


## Índice da área de cada tile (-1 = fora das áreas), montado uma vez.
func _index_tile_areas() -> void:
	if not _tile_areas.is_empty():
		return
	_tile_areas.resize(width * height)
	_tile_areas.fill(-1)
	for i in data.areas.size():
		for r: Dictionary in data.areas[i].rects:
			for z in range(int(r.y), int(r.y) + int(r.h)):
				for x in range(int(r.x), int(r.x) + int(r.w)):
					if x >= 0 and z >= 0 and x < width and z < height and _tile_areas[z * width + x] < 0:
						_tile_areas[z * width + x] = i


## Luz da área ("lit", "dim" ou "dark"): nas bem iluminadas a lanterna sobra.
func area_lighting(area_id: StringName) -> String:
	for area: Dictionary in data.areas:
		if StringName(area.id) == area_id:
			return String(area.get("lighting", "dim"))
	return "dark"


## Acompanha a área do jogador: avisa quando a luz muda e ajusta o ambiente aos poucos
## (como os olhos se acostumando).
func _update_area_light(delta: float) -> void:
	_light_check -= delta
	if _light_check <= 0.0:
		_light_check = 0.25
		var player := get_tree().get_first_node_in_group(&"player") as Node3D
		if player:
			var area := area_of(player.global_position)
			var now := area_lighting(area) if area != &"" else "dark"
			if now != lighting:
				lighting = now
				Events.lighting_changed.emit(now)
	var target: Array = AREA_LIGHT.get(lighting, AREA_LIGHT.dim)
	var k := clampf(delta * 1.6, 0.0, 1.0)
	var energy := lerpf(_light_energy, float(target[0]), k)
	var warm := lerpf(_light_warm, float(target[1]), k)
	if absf(energy - _light_energy) > 0.001 or absf(warm - _light_warm) > 0.001:
		_light_energy = energy
		_light_warm = warm
		_apply_environment()


## Luminárias que falham piscam de vez em quando; as quebradas soltam faísca perto do jogador.
func _update_lamps(delta: float) -> void:
	for entry: Array in _flickers:
		var light := entry[0] as OmniLight3D
		if is_instance_valid(light) and light.visible and randf() < float(entry[1]) * delta * 0.5:
			_blink(light)
	_spark_in -= delta
	if _spark_in > 0.0 or _broken.is_empty():
		return
	_spark_in = randf_range(2.0, 6.0)
	var player := get_tree().get_first_node_in_group(&"player") as Node3D
	var at := _broken[randi() % _broken.size()]
	if player == null or Vector2(at.x - player.global_position.x, at.z - player.global_position.z).length() > 16.0:
		return
	PixelFx.spawn(get_tree(), "spark", at + Vector3.UP * 2.7, 0.8)
	var flash := OmniLight3D.new()
	flash.light_color = Color(0.75, 0.88, 1.0)
	flash.light_energy = 1.6
	flash.omni_range = 3.5
	add_child(flash)
	flash.position = at + Vector3.UP * 2.6
	get_tree().create_timer(0.08).timeout.connect(flash.queue_free)


## Falha da lâmpada: apaga por um instante (às vezes duas vezes seguidas).
func _blink(light: OmniLight3D) -> void:
	light.visible = false
	var tween := create_tween()
	tween.tween_interval(randf_range(0.04, 0.12))
	tween.tween_callback(func() -> void: light.visible = true)
	if randf() < 0.5:
		tween.tween_interval(0.06)
		tween.tween_callback(func() -> void: light.visible = false)
		tween.tween_interval(randf_range(0.04, 0.1))
		tween.tween_callback(func() -> void: light.visible = true)


## Densidade da decoração no tile (por área, do mapa; fora das áreas = 1).
func _decor_density(x: int, z: int) -> float:
	var area := _tile_areas[z * width + x] if x >= 0 and z >= 0 and x < width and z < height else -1
	if area < 0:
		return 1.0
	var density: Dictionary = data.get("decor", {}).get("density", {})
	return float(density.get(String(data.areas[area].id), 1.0))


## Letra da grade no tile (fora do mapa = parede).
func cell(x: int, z: int) -> String:
	if x < 0 or z < 0 or x >= width or z >= height:
		return "#"
	return _cells[z][x]


# ───────────────────────── Montagem ─────────────────────────

func _load(path: String) -> Dictionary:
	var text := FileAccess.get_file_as_string(path)
	var parsed: Variant = JSON.parse_string(text)
	if parsed is Dictionary:
		return parsed
	push_error("LayoutMap: não foi possível ler %s" % path)
	return {}


func _build_floor() -> void:
	# Um colisor único para o chão todo (as paredes limitam onde se anda).
	var ground := StaticBody3D.new()
	ground.name = "Ground"
	ground.collision_layer = PhysicsLayers.WORLD
	ground.collision_mask = 0
	var shape := BoxShape3D.new()
	shape.size = Vector3(width, 1.0, height)
	var collision := CollisionShape3D.new()
	collision.shape = shape
	ground.add_child(collision)
	nav_region.add_child(ground)
	ground.position = Vector3(width * 0.5, -0.5, height * 0.5)
	# Visual por tipo de piso (portas e janelas usam o piso de concreto).
	var visuals := Node3D.new()
	visuals.name = "FloorVisuals"
	add_child(visuals)
	for ch: String in FLOOR_COLORS:
		var match_chars := ch + ("DW" if ch == "c" else "")
		for rect in _merge(func(c: String) -> bool: return match_chars.contains(c)):
			visuals.add_child(_box_mesh(rect, -0.05, 0.05, _art_material(FLOOR_ART.get(ch, ""), FLOOR_COLORS[ch])))


func _build_solids(ch: String, box_height: float, color: Color, layer: int, label: String) -> void:
	var group := Node3D.new()
	group.name = label + "s"
	nav_region.add_child(group)
	var material: Material = _wall_material(color) if ch == "#" else (train_material(false, color) if ch == "T" else _material(color))
	for rect in _merge(func(c: String) -> bool: return c == ch):
		var body := StaticBody3D.new()
		body.collision_layer = layer
		body.collision_mask = 0
		var shape := BoxShape3D.new()
		shape.size = Vector3(rect.size.x, box_height, rect.size.y)
		var collision := CollisionShape3D.new()
		collision.shape = shape
		body.add_child(collision)
		body.add_child(_box_mesh(Rect2(-rect.size * 0.5, rect.size), 0.0, box_height, material, true))
		group.add_child(body)
		body.position = Vector3(rect.get_center().x, box_height * 0.5, rect.get_center().y)


func _build_doors() -> void:
	if door_scene == null:
		return
	for door_data: Dictionary in data.doors:
		var door := door_scene.instantiate() as Door
		var rect := Rect2(door_data.rect.x, door_data.rect.y, door_data.rect.w, door_data.rect.h)
		door.setup(StringName(door_data.id), int(door_data.cost), PackedStringArray(door_data.areas), rect.size, self)
		nav_region.add_child(door)
		door.position = Vector3(rect.get_center().x, 0.0, rect.get_center().y)


func _build_barricades() -> void:
	if barricade_scene == null or barricade_data == null:
		return
	for window: Dictionary in data.windows:
		var rect := Rect2(window.rect.x, window.rect.y, window.rect.w, window.rect.h)
		var barricade := barricade_scene.instantiate() as Barricade
		barricade.setup(StringName(window.id), rect.size, _inside_direction(rect, StringName(window.area)), barricade_data)
		nav_region.add_child(barricade)
		barricade.position = Vector3(rect.get_center().x, 0.0, rect.get_center().y)


## Para que lado da janela fica a área protegida.
func _inside_direction(rect: Rect2, area_id: StringName) -> Vector3:
	var center := rect.get_center()
	var candidates := [Vector2.RIGHT, Vector2.LEFT] if rect.size.y >= rect.size.x else [Vector2.DOWN, Vector2.UP]
	for dir: Vector2 in candidates:
		# Meio tile além da borda da janela, do lado testado.
		var half := (rect.size.x if dir.x != 0.0 else rect.size.y) * 0.5
		var probe := center + dir * (half + 0.5)
		if _area_contains(area_id, probe):
			return Vector3(dir.x, 0.0, dir.y)
	return Vector3(candidates[0].x, 0.0, candidates[0].y)


func _area_contains(area_id: StringName, point: Vector2) -> bool:
	for area: Dictionary in data.areas:
		if StringName(area.id) != area_id:
			continue
		for r: Dictionary in area.rects:
			if Rect2(r.x, r.y, r.w, r.h).has_point(point):
				return true
	return false


func _build_wall_buys() -> void:
	if wall_buy_scene == null:
		return
	var taken: Array[Vector2i] = []
	for station: Dictionary in data.stations:
		var weapon: WeaponData = null
		if station.type == "weapon":
			var path := "%s/%s.tres" % [weapons_dir, station.weaponId]
			if not ResourceLoader.exists(path):
				push_warning("LayoutMap: arma %s não encontrada" % station.weaponId)
				continue
			weapon = load(path)
		var spot := _wall_spot(Vector2i(int(station.tx), int(station.ty)), taken)
		taken.append(spot.tile)
		var buy := wall_buy_scene.instantiate() as WallBuy
		buy.setup(weapon, spot.normal)
		add_child(buy)
		buy.position = Vector3(spot.tile.x + 0.5, 0.0, spot.tile.y + 0.5)


## Como no jogo web: a compra vai para o chão livre mais perto, encostado numa parede
## (de preferência a de cima, que a câmera vê de frente). Devolve o tile e a normal da parede.
func _wall_spot(start: Vector2i, taken: Array[Vector2i]) -> Dictionary:
	var sides := [Vector2i.UP, Vector2i.LEFT, Vector2i.RIGHT, Vector2i.DOWN]
	var best := {"tile": start, "normal": Vector3.BACK, "cost": INF}
	for dz in range(-8, 9):
		for dx in range(-8, 9):
			var tile := start + Vector2i(dx, dz)
			if not _is_floor(cell(tile.x, tile.y)) or tile in taken or _near_opening(tile):
				continue
			for i in sides.size():
				var side: Vector2i = sides[i]
				# A parede do vagão parado também serve (a Combat Shotgun fica dentro do trem).
				if not "#T".contains(cell(tile.x + side.x, tile.y + side.y)):
					continue
				var cost := Vector2(dx, dz).length() + (0.0 if i == 0 else 3.0)
				if cost < best.cost:
					best = {"tile": tile, "normal": Vector3(-side.x, 0.0, -side.y), "cost": cost}
	return best


func _is_floor(ch: String) -> bool:
	return FLOOR_COLORS.has(ch)


## Tile colado numa porta ou janela (a compra não fica na frente delas).
func _near_opening(tile: Vector2i) -> bool:
	for dz in range(-1, 2):
		for dx in range(-1, 2):
			var ch := cell(tile.x + dx, tile.y + dz)
			if ch == "D" or ch == "W":
				return true
	return false


## Mystery Box (no primeiro local, com os outros para onde ela muda) e Weapon Lab.
## Os perks entram no próximo bloco.
func _build_machines() -> void:
	var spots: Array[Vector3] = []
	for spot: Dictionary in data.box_spots:
		spots.append(Vector3(spot.x, 0.0, spot.z))
	for machine: Dictionary in data.machines:
		var at := Vector3(machine.x, 0.0, machine.z)
		match machine.type:
			"mystery_box":
				if mystery_box_scene and mystery_box_data and weapon_catalog:
					var box := mystery_box_scene.instantiate() as MysteryBox
					box.setup(mystery_box_data, weapon_catalog, data.id, spots, self)
					nav_region.add_child(box)
					box.position = at
					box.rotation.y = facing_toward_open(at)
			"perk":
				var path := "%s/%s.tres" % [perks_dir, machine.perkId]
				if perk_machine_scene and ResourceLoader.exists(path):
					var machine_node := perk_machine_scene.instantiate() as PerkMachine
					machine_node.setup(load(path))
					nav_region.add_child(machine_node)
					machine_node.position = at
					machine_node.rotation.y = facing_toward_open(at)
					if power and not machine_node.perk.works_without_power:
						power.register_light(machine_node.get_light())
			"weapon_lab":
				if weapon_lab_scene and weapon_lab_data:
					var lab := weapon_lab_scene.instantiate() as WeaponLab
					lab.setup(weapon_lab_data)
					nav_region.add_child(lab)
					lab.position = at
					lab.rotation.y = facing_toward_open(at)


## Painéis do mapa: disjuntor principal, painéis de energia e do alarme (encerram o evento
## pagando), painel do trem e armadilhas elétricas.
func _build_interactions() -> void:
	for item: Dictionary in data.interactions:
		var node: Node3D = null
		match String(item.type):
			"breaker":
				if breaker_scene and power:
					var breaker := breaker_scene.instantiate() as Breaker
					breaker.setup(power)
					node = breaker
			"power", "alarm":
				var panel := EventSwitch.new()
				panel.setup(String(item.type))
				node = panel
			"train":
				var train_panel := TrainPanel.new()
				train_panel.setup()
				node = train_panel
			"trap":
				var trap := ElectricTrap.new()
				var zone: Dictionary = item.zone
				trap.setup(Rect2(float(zone.x), float(zone.y), float(zone.w), float(zone.h)))
				node = trap
		if node:
			nav_region.add_child(node)
			node.position = Vector3(float(item.tx) + 0.5, 0.0, float(item.ty) + 0.5)
			# Painéis e disjuntor: de costas para a parede mais perto e encostados nela.
			node.rotation.y = facing_toward_open(node.position)
			node.position = _against_wall(node.position, node.rotation.y, 0.28)


## Recua o ponto (de costas, eixo +Z local depois do giro) até `depth` m da parede de trás.
func _against_wall(at: Vector3, angle: float, depth: float) -> Vector3:
	var back := Vector3(sin(angle), 0.0, cos(angle))
	for step in 30:
		var probe := at + back * (step * 0.05)
		if not _is_floor(cell(floori(probe.x), floori(probe.z))):
			return at + back * maxf(0.0, step * 0.05 - depth)
	return at


## Segredos do mapa: ursinhos escondidos, rádio (ou gravador) com a história e a placa.
func _build_secrets() -> void:
	var secrets: Variant = data.get("secrets")
	if not secrets is Dictionary:
		return
	var teddies: Array = secrets.get("teddies", [])
	for i in teddies.size():
		var teddy := Teddy.new()
		teddy.name = "Teddy%d" % (i + 1)
		teddy.set_meta(&"total", teddies.size())
		teddy.position = Vector3(float(teddies[i].tx) + 0.5, 0.0, float(teddies[i].ty) + 0.5)
		add_child(teddy)
	var radio_data: Variant = secrets.get("radio")
	if radio_data is Dictionary:
		var radio := LoreRadio.new()
		radio.setup(String(radio_data.label), float(radio_data.holdMs) / 1000.0, PackedStringArray(secrets.get("loreMessages", [])))
		radio.position = Vector3(float(radio_data.tx) + 0.5, 0.0, float(radio_data.ty) + 0.5)
		add_child(radio)
	var sign_data: Variant = secrets.get("creditsSign")
	if sign_data is Dictionary:
		var credits := CreditsSign.new()
		credits.position = Vector3(float(sign_data.tx) + 0.5, 0.0, float(sign_data.ty) + 0.5)
		add_child(credits)


## Estação de trem (só o Terminal): túneis, semáforos e painel de horários.
func _build_station() -> void:
	var value := station()
	if value.is_empty():
		return
	var board := StationBoard.new()
	board.setup(value)
	add_child(board)


func _build_props() -> void:
	var group := Node3D.new()
	group.name = "Props"
	nav_region.add_child(group)
	var material := _material(PROP_COLOR)
	for prop: Dictionary in data.props:
		var center := Vector3(prop.x, 0.0, prop.z)
		var body_data: Variant = prop.body
		if body_data is Dictionary:
			var body := StaticBody3D.new()
			body.name = prop.type
			# Móveis que param bala contam como parede; os outros só bloqueiam a passagem.
			body.collision_layer = PhysicsLayers.WORLD if prop.blocks_bullets else PhysicsLayers.PROPS
			body.collision_mask = 0
			var size := Vector3(body_data.w, PROP_HEIGHT, body_data.d)
			var shape := BoxShape3D.new()
			shape.size = size
			var collision := CollisionShape3D.new()
			collision.shape = shape
			body.add_child(collision)
			# Visual em pixel art 2.5D (PropFactory); sem receita, uma caixa simples.
			var visual := PropFactory.create(String(prop.type))
			if visual:
				visual.position.y = -PROP_HEIGHT * 0.5
				visual.rotation.y = deg_to_rad(-float(prop.angle))
				body.add_child(visual)
			else:
				body.add_child(_box_mesh(Rect2(-size.x * 0.5, -size.z * 0.5, size.x, size.z), -PROP_HEIGHT * 0.5, PROP_HEIGHT * 0.5, material))
			group.add_child(body)
			body.position = center + Vector3(body_data.ox, PROP_HEIGHT * 0.5, body_data.oz)
		else:
			# Decorativo (mala, cadeira...): sem colisão.
			var mesh: Node3D = PropFactory.create(String(prop.type))
			if mesh == null:
				mesh = _box_mesh(Rect2(-0.3, -0.2, 0.6, 0.4), 0.0, 0.3, material)
			group.add_child(mesh)
			mesh.position = center
			mesh.rotation.y = deg_to_rad(-float(prop.angle))
		var light_data: Variant = prop.light
		if light_data is Dictionary:
			_add_light(center + Vector3.UP * 1.2, light_data.radius, light_data.intensity, int(light_data.color))


# ───────────────────────── Decoração ─────────────────────────

## Peças de parede: nome → [chance por metro de parede, altura do centro (m)].
const WALL_DECOR := {
	"lamp": [0.06, 2.45], "lamp_broken": [0.025, 2.45], "vent": [0.04, 2.15], "exit_sign": [0.015, 2.35],
	"board": [0.03, 1.45], "fusebox": [0.02, 1.35], "poster": [0.035, 1.45], "graffiti": [0.03, 0.85],
	"blood_smear": [0.025, 1.0],
}
## Decalques de chão: nome → peso no sorteio.
const FLOOR_DECOR := {
	"paper": 4, "papers": 3, "can": 3, "bottle": 2, "trash": 3, "debris": 2, "puddle": 1, "crack": 2, "blood_trail": 1, "casings": 2,
}
## Chance de um metro de chão ganhar um decalque.
const FLOOR_DECOR_CHANCE := 0.06

var _decor_materials: Dictionary = {}


## Decoração em pixel art (npm run godot:scenery): nas faces de parede que a câmera vê
## (as viradas para o sul, de frente para ela) e decalques no chão, mais densos nas áreas
## largadas (densidade por área no mapa). Mesma semente por mapa: sai igual toda partida.
func _build_decor() -> void:
	var index_path := "res://assets/tiles/decor.json"
	if not FileAccess.file_exists(index_path):
		return
	var index: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(index_path))
	var rng := RandomNumberGenerator.new()
	rng.seed = hash(String(data.get("decor", {}).get("seed", map_id() + "_decor")))
	_index_tile_areas()
	var group := Node3D.new()
	group.name = "Decor"
	add_child(group)
	var pipe_run := {}
	for z in height:
		for x in width:
			if cell(x, z) != "#":
				continue
			# Face visível: a do sul (+Z), com chão na frente.
			for dir: Vector2i in [Vector2i(0, 1)]:
				var floor_ch := cell(x + dir.x, z + dir.y)
				if not _is_floor(floor_ch):
					continue
				var normal := Vector3(dir.x, 0, dir.y)
				var face := Vector3(x + 0.5 + dir.x * 0.5, 0.0, z + 0.5 + dir.y * 0.5) + normal * 0.012
				# Canos em trechos contínuos, no alto.
				var key := "%d" % (z if dir.x != 0 else x)
				var along := z if dir.x != 0 else x
				var running: bool = pipe_run.get(key + ("x" if dir.x != 0 else "z"), -99) == along - 1
				if (running and rng.randf() < 0.85) or rng.randf() < 0.05:
					pipe_run[key + ("x" if dir.x != 0 else "z")] = along
					_add_decor(group, index.wall, "pipes", face + Vector3.UP * 2.78, normal, 1.0)
				var density := _decor_density(x + dir.x, z + dir.y)
				for decor_name: String in WALL_DECOR:
					var entry: Array = WALL_DECOR[decor_name]
					if rng.randf() < float(entry[0]) * density:
						_add_decor(group, index.wall, decor_name, face + Vector3.UP * float(entry[1]), normal)
						break
	# Chão: decalques espalhados (fora das portas).
	var total := 0.0
	for decor_name: String in FLOOR_DECOR:
		total += float(FLOOR_DECOR[decor_name])
	for z in height:
		for x in width:
			if not _is_floor(cell(x, z)) or rng.randf() >= FLOOR_DECOR_CHANCE * _decor_density(x, z):
				continue
			var roll := rng.randf() * total
			var chosen := ""
			for decor_name: String in FLOOR_DECOR:
				roll -= float(FLOOR_DECOR[decor_name])
				if roll < 0.0:
					chosen = decor_name
					break
			var at := Vector3(x + rng.randf_range(0.2, 0.8), 0.012, z + rng.randf_range(0.2, 0.8))
			var node := _add_decor(group, index.floor, chosen, at, Vector3.UP)
			if node:
				node.rotate_y(rng.randf() * TAU)


## Um quadro de decoração: na parede (de pé, virado para `normal`) ou no chão (deitado).
func _add_decor(group: Node3D, table: Dictionary, decor_name: String, at: Vector3, normal: Vector3, width_scale := 0.0) -> MeshInstance3D:
	var info: Dictionary = table.get(decor_name, {})
	var path := "res://assets/tiles/decor_%s.png" % decor_name
	if info.is_empty() or not ResourceLoader.exists(path):
		return null
	var on_floor := normal == Vector3.UP
	var quad := QuadMesh.new()
	quad.size = Vector2(info.size[0] if width_scale <= 0.0 else width_scale, info.size[1])
	var node := MeshInstance3D.new()
	node.mesh = quad
	node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	if not _decor_materials.has(decor_name):
		var material := ShaderMaterial.new()
		material.shader = load("res://shaders/decor.gdshader")
		material.set_shader_parameter(&"tex", load(path))
		material.set_shader_parameter(&"occlude", not on_floor)
		var glow: Variant = info.get("glow")
		if glow is Array:
			material.set_shader_parameter(&"glow", Vector3(glow[0], glow[1], glow[2]))
		_decor_materials[decor_name] = material
	node.material_override = _decor_materials[decor_name]
	group.add_child(node)
	node.position = at
	if on_floor:
		node.rotation.x = -PI * 0.5
	else:
		node.rotation.y = atan2(normal.x, normal.z)
	return node


func _build_lamps() -> void:
	for lamp: Dictionary in data.lamps:
		# Luminária quebrada: não acende, só solta faísca de vez em quando.
		if lamp.get("broken", false):
			_broken.append(Vector3(lamp.x, 0.0, lamp.z))
			continue
		var light := _add_light(Vector3(lamp.x, LAMP_HEIGHT, lamp.z), lamp.radius, lamp.intensity, int(lamp.color))
		if float(lamp.get("flicker", 0.0)) >= 0.3:
			_flickers.append([light, float(lamp.flicker)])


func _add_light(position_3d: Vector3, radius: float, intensity: float, color_hex: int) -> OmniLight3D:
	var light := OmniLight3D.new()
	light.light_color = Color.hex((color_hex << 8) | 0xff)
	light.light_energy = intensity * 2.4
	light.omni_range = maxf(3.0, radius * 1.6)
	add_child(light)
	light.position = position_3d
	if power:
		power.register_light(light)
	return light


func _build_spawns() -> void:
	var group := Node3D.new()
	group.name = "ZombieSpawns"
	add_child(group)
	for spawn: Dictionary in data.spawns:
		var marker := Marker3D.new()
		marker.name = spawn.id
		marker.set_meta(&"area", StringName(spawn.area))
		marker.set_meta(&"min_round", int(spawn.min_round))
		marker.add_to_group(&"zombie_spawn")
		group.add_child(marker)
		marker.position = Vector3(spawn.x, 0.1, spawn.z)


## Junta tiles vizinhos que passam no filtro em retângulos (varredura gulosa por linhas).
func _merge(accept: Callable) -> Array[Rect2]:
	var used := PackedByteArray()
	used.resize(width * height)
	var rects: Array[Rect2] = []
	for z in height:
		for x in width:
			if used[z * width + x] or not accept.call(cell(x, z)):
				continue
			var w := 1
			while x + w < width and not used[z * width + x + w] and accept.call(cell(x + w, z)):
				w += 1
			var h := 1
			while z + h < height and _row_free(x, z + h, w, accept, used):
				h += 1
			for zz in range(z, z + h):
				for xx in range(x, x + w):
					used[zz * width + xx] = 1
			rects.append(Rect2(x, z, w, h))
	return rects


func _row_free(x: int, z: int, w: int, accept: Callable, used: PackedByteArray) -> bool:
	for xx in range(x, x + w):
		if used[z * width + xx] or not accept.call(cell(xx, z)):
			return false
	return true


## Malha de caixa cobrindo o retângulo (no plano XZ) entre as alturas `bottom` e `top`.
func _box_mesh(rect: Rect2, bottom: float, top: float, material: Material, centered := false) -> MeshInstance3D:
	# (material pode ser um StandardMaterial3D ou o shader das paredes)
	var mesh := BoxMesh.new()
	mesh.size = Vector3(rect.size.x, top - bottom, rect.size.y)
	var instance := MeshInstance3D.new()
	instance.mesh = mesh
	instance.material_override = material
	if centered:
		instance.position = Vector3.ZERO
	else:
		instance.position = Vector3(rect.get_center().x, (top + bottom) * 0.5, rect.get_center().y)
	return instance


## Paredes: arte do web (lateral e topo) e oclusão em volta do jogador (shaders/wall.gdshader).
## Trem em pixel art (npm run godot:scenery): lateral com janelas e faixa, teto com o ar;
## object_space prende a textura ao vagão (o trem do evento anda).
static func train_material(object_space: bool, fallback := TRAIN_COLOR) -> Material:
	var side := WEB_ART % "train_side"
	var top := WEB_ART % "train_roof"
	if not ResourceLoader.exists(side) or not ResourceLoader.exists(top):
		var plain := StandardMaterial3D.new()
		plain.albedo_color = fallback
		return plain
	var material := ShaderMaterial.new()
	material.shader = load("res://shaders/wall.gdshader")
	material.set_shader_parameter(&"side_texture", load(side))
	material.set_shader_parameter(&"top_texture", load(top))
	material.set_shader_parameter(&"side_size", Vector2(2.0, 2.6))
	material.set_shader_parameter(&"object_space", object_space)
	return material


func _wall_material(fallback: Color) -> Material:
	var side := WEB_ART % String(WALL_STYLE.get(map_id(), "wall_concrete"))
	var top := WEB_ART % "wall_cap"
	if not ResourceLoader.exists(side) or not ResourceLoader.exists(top):
		return _material(fallback)
	var material := ShaderMaterial.new()
	material.shader = load("res://shaders/wall.gdshader")
	var side_texture := load(side) as Texture2D
	var top_texture := load(top) as Texture2D
	material.set_shader_parameter(&"side_texture", side_texture)
	material.set_shader_parameter(&"top_texture", top_texture)
	material.set_shader_parameter(&"side_size", side_texture.get_size() / PIXELS_PER_METER)
	material.set_shader_parameter(&"top_size", top_texture.get_size() / PIXELS_PER_METER)
	return material


## Material com uma imagem da arte do web, repetindo em coordenadas do mundo (a imagem cobre
## largura/32 × altura/32 metros) com pixels nítidos. Sem a imagem, cai na cor lisa.
func _art_material(art: String, fallback: Color) -> StandardMaterial3D:
	var path := WEB_ART % art
	if art == "" or not ResourceLoader.exists(path):
		return _material(fallback)
	if _materials.has(path):
		return _materials[path]
	var texture := load(path) as Texture2D
	var material := StandardMaterial3D.new()
	material.albedo_texture = texture
	material.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST_WITH_MIPMAPS
	material.roughness = 0.95
	material.uv1_triplanar = true
	material.uv1_world_triplanar = true
	var size := texture.get_size() / PIXELS_PER_METER
	material.uv1_scale = Vector3(1.0 / size.x, 1.0 / size.y, 1.0 / size.x)
	_materials[path] = material
	return material


func _material(color: Color) -> StandardMaterial3D:
	var key := color.to_html()
	if not _materials.has(key):
		var material := StandardMaterial3D.new()
		material.albedo_color = color
		material.roughness = 0.9
		if color.a < 1.0:
			material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		_materials[key] = material
	return _materials[key]
