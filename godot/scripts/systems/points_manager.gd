class_name PointsManager
extends Node
## Pontos do jogador (seção 23): acerto, abate, headshot, faca e bônus de round. Só escuta
## eventos; quem compra algo chama `spend`.

@export var data: PointsData

var points: int = 0
## Total ganho na partida (estatística do fim de jogo).
var earned: int = 0
var _guard := AntiCheat.Guard.new(0)


func _ready() -> void:
	points = data.start_points
	_guard.set_value(points)
	add_to_group(&"points_manager")
	Events.zombie_hit.connect(_on_zombie_hit)
	Events.zombie_killed.connect(_on_zombie_killed)
	Events.boss_defeated.connect(func(_id: StringName, _n: String, reward: int, _at: Vector3) -> void: add(reward))
	Events.round_completed.connect(func(round_number: int) -> void: add(data.round_bonus(round_number)))
	# Depois que a cena inteira estiver pronta (a HUD fica pronta por último).
	call_deferred(&"_emit_initial_state")


func _emit_initial_state() -> void:
	Events.points_changed.emit(points, 0)


func add(amount: int) -> void:
	if amount <= 0:
		return
	points += amount
	_guard.set_value(points)
	earned += amount
	Events.points_changed.emit(points, amount)


## Debita se houver pontos suficientes.
func spend(amount: int) -> bool:
	if amount > points:
		return false
	points -= amount
	_guard.set_value(points)
	Events.points_changed.emit(points, -amount)
	return true


## Os pontos batem com a cópia de verificação (anti-trapaça)?
func intact() -> bool:
	return _guard.matches(points)


func _on_zombie_hit(_zombie: Node3D, info: DamageInfo) -> void:
	if info.kind == DamageInfo.Kind.WEAPON:
		var shooter := info.source as Player
		add(shooter.weapon.data.points_per_hit if shooter else 10)


func _on_zombie_killed(zombie: Node3D, info: DamageInfo) -> void:
	# Abates do jogador pagam (arma, faca e a queima das armas de fogo); o resto não.
	if not info.kind in [DamageInfo.Kind.WEAPON, DamageInfo.Kind.MELEE, DamageInfo.Kind.BURN]:
		return
	var reward := (zombie as ZombieBase).data.points_kill if zombie is ZombieBase else 0
	if info.is_headshot:
		reward += data.headshot_kill_bonus
	if info.kind == DamageInfo.Kind.MELEE:
		reward += data.melee_kill_bonus
	add(reward)
