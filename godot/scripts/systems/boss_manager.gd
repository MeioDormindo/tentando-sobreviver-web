class_name BossManager
extends Node
## Round de boss (como no jogo web): aviso, e depois o boss do mapa surge no ponto de boss
## mais longe do jogador, com vida extra a cada nova aparição. O round só termina com o
## boss derrotado. Os zumbis invocados entram na contagem do round.

## Tempo do aviso até o boss surgir (s).
const WARNING_TIME := 3.2

@export var spawn_manager: SpawnManager
@export_dir var bosses_dir: String = "res://data/bosses"

var boss: Boss
var appearances: Dictionary = {}
var defeated: int = 0

var _pending := false


func _ready() -> void:
	Events.boss_defeated.connect(_on_boss_defeated)


## Fração da horda normal que acompanha o boss.
func escort_ratio(boss_id: StringName) -> float:
	var path := "%s/%s.tres" % [bosses_dir, boss_id]
	return (load(path) as BossData).escort_ratio if ResourceLoader.exists(path) else 0.3


## Há boss vivo ou prestes a surgir?
func is_active() -> bool:
	return _pending or (is_instance_valid(boss) and boss.is_alive())


func start(boss_id: StringName, extra_health_mult: float = 1.0) -> void:
	var path := "%s/%s.tres" % [bosses_dir, boss_id]
	if not ResourceLoader.exists(path):
		push_error("BossManager: boss %s não encontrado" % boss_id)
		return
	var data := load(path) as BossData
	_pending = true
	Events.boss_incoming.emit(data.display_name)
	get_tree().create_timer(WARNING_TIME, false).timeout.connect(_spawn.bind(data, extra_health_mult))


func _spawn(data: BossData, extra_health_mult: float) -> void:
	var appearance := int(appearances.get(data.id, 0))
	appearances[data.id] = appearance + 1
	var player := spawn_manager.target
	var points := spawn_manager.world.boss_spawn_points()
	var at := points[0] if not points.is_empty() else player.global_position + Vector3(0, 0, -12)
	for point in points:
		if point.distance_to(player.global_position) > at.distance_to(player.global_position):
			at = point
	boss = data.scene.instantiate() as Boss
	boss.setup(data, player, (1.0 + data.health_per_appearance * appearance) * extra_health_mult, _summon)
	boss.position = spawn_manager.container.to_local(at + Vector3.UP * 0.1)
	spawn_manager.container.add_child(boss)
	_pending = false
	SpecialFire.flash(get_tree(), at, 4.0, Color(1.0, 0.5, 0.3))
	Events.boss_state.emit(data.display_name, boss.health.current, boss.health.max_health, 1)


## Invoca zumbis em volta do boss; eles entram na contagem do round.
func _summon(types: Array, count: int, at: Vector3) -> int:
	var spawned := 0
	for i in count:
		var angle := TAU * float(i) / count + randf() * 0.5
		var spot := at + Vector3(cos(angle), 0.0, sin(angle)) * 2.3
		if spawn_manager.spawn_at(types.pick_random(), spot):
			spawned += 1
	if spawned > 0:
		Events.zombies_summoned.emit(spawned)
	return spawned


func _on_boss_defeated(_id: StringName, _name: String, _reward: int, at: Vector3) -> void:
	defeated += 1
	Events.max_ammo.emit(at)
