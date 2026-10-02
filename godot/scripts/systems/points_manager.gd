class_name PointsManager
extends Node
## Pontos de compra (seção 23): acerto, abate, headshot, faca e bônus de round. Uma carteira
## por jogador (no solo, uma só): acertos e abates pagam quem causou (`DamageInfo.source`);
## bônus de round, de chefe e dos power-ups vão para todos. Quem compra algo chama `spend` com
## o jogador que pagou. A HUD vê só a carteira do jogador local (`points`, `points_changed`).

## Um jogador ganhou pontos (anti-trapaça: limite por carteira).
signal gained(peer: int, amount: int)

@export var data: PointsData

## Pontos do jogador local (a HUD e o fim de jogo mostram estes).
var points: int:
	get:
		return _wallet(_local_peer()).points
## Total ganho na partida pelo jogador local (estatística do fim de jogo).
var earned: int:
	get:
		return _wallet(_local_peer()).earned
## Double Cash (power-up).
var multiplier: float = 1.0
## Lua de Sangue (evento do mapa).
var event_multiplier: float = 1.0

## peer → Wallet.
var _wallets: Dictionary = {}


class Wallet:
	var points := 0
	var earned := 0
	var guard := AntiCheat.Guard.new(0)

	func _init(start: int) -> void:
		points = start
		guard.set_value(points)


func _ready() -> void:
	add_to_group(&"points_manager")
	Events.zombie_hit.connect(_on_zombie_hit)
	Events.zombie_killed.connect(_on_zombie_killed)
	Events.reward_multiplier_changed.connect(func(value: float) -> void: event_multiplier = value)
	Events.boss_defeated.connect(func(_id: StringName, _n: String, reward: int, _at: Vector3) -> void: add_all(reward))
	Events.round_completed.connect(func(round_number: int) -> void: add_all(data.round_bonus(round_number)))
	# Depois que a cena inteira estiver pronta (a HUD fica pronta por último).
	call_deferred(&"_emit_initial_state")


func _emit_initial_state() -> void:
	Events.points_changed.emit(points, 0)


## Peer do jogador desta máquina (1 no solo e sem jogador na árvore).
static func _local_peer() -> int:
	var local := Players.local_player()
	return local.peer_id if local else 1


static func _peer(who: Node) -> int:
	var player := who as Player
	return player.peer_id if player else _local_peer()


func _wallet(peer: int) -> Wallet:
	if not _wallets.has(peer):
		_wallets[peer] = Wallet.new(data.start_points if data else 0)
	return _wallets[peer]


## Pontos de um jogador (null = o local).
func points_of(who: Node) -> int:
	return _wallet(_peer(who)).points


## Total ganho por um jogador na partida (null = o local).
func earned_of(who: Node) -> int:
	return _wallet(_peer(who)).earned


## Soma pontos para `who` (null = o jogador local; com o Double Cash, se `apply_multiplier`).
## Devolve o valor efetivamente ganho.
func add(amount: int, apply_multiplier: bool = true, who: Node = null) -> int:
	# Em rede, no colega: os pontos são do host (chegam como aviso de HUD).
	if amount <= 0 or Net.is_client():
		return 0
	amount = roundi(amount * (multiplier * event_multiplier if apply_multiplier else 1.0))
	var peer := _peer(who)
	var wallet := _wallet(peer)
	wallet.points += amount
	wallet.guard.set_value(wallet.points)
	wallet.earned += amount
	gained.emit(peer, amount)
	_tell(peer, wallet.points, amount)
	return amount


## Soma para todos os jogadores (bônus de round, chefe, Nuke, Carpenter). Devolve quanto cada um
## ganhou.
func add_all(amount: int, apply_multiplier: bool = true) -> int:
	if not Players.coop():
		return add(amount, apply_multiplier)
	var each := 0
	for player in Players.all():
		each = add(amount, apply_multiplier, player)
	return each


## Debita de `who` (null = o jogador local) se houver pontos suficientes.
func spend(amount: int, who: Node = null) -> bool:
	if Net.is_client():
		return false
	var peer := _peer(who)
	var wallet := _wallet(peer)
	if amount > wallet.points:
		return false
	wallet.points -= amount
	wallet.guard.set_value(wallet.points)
	_tell(peer, wallet.points, -amount)
	return true


## Avisa a HUD de quem é a carteira (na rede, a máquina dele).
func _tell(peer: int, total: int, delta: int) -> void:
	var owner := Players.by_peer(peer)
	if owner and (owner.net or not owner.is_local):
		owner.hud(&"points_changed", [total, delta])
	elif peer == _local_peer():
		Events.points_changed.emit(total, delta)


## Todas as carteiras batem com a cópia de verificação (anti-trapaça)?
func intact() -> bool:
	for wallet: Wallet in _wallets.values():
		if not wallet.guard.matches(wallet.points):
			return false
	return true


## Mexe nos pontos sem passar pelo sistema (só para o teste do anti-trapaça).
func tamper(peer: int, value: int) -> void:
	_wallet(peer).points = value


func _on_zombie_hit(_zombie: Node3D, info: DamageInfo) -> void:
	if info.kind == DamageInfo.Kind.WEAPON:
		var shooter := info.source as Player
		add(shooter.weapon.data.points_per_hit if shooter and shooter.weapon else 10, true, shooter)


func _on_zombie_killed(zombie: Node3D, info: DamageInfo) -> void:
	# Abates do jogador pagam (arma, faca e a queima das armas de fogo); o resto não.
	if not info.kind in [DamageInfo.Kind.WEAPON, DamageInfo.Kind.MELEE, DamageInfo.Kind.BURN]:
		return
	var reward := (zombie as ZombieBase).data.points_kill if zombie is ZombieBase else 0
	if info.is_headshot:
		reward += data.headshot_kill_bonus
	if info.kind == DamageInfo.Kind.MELEE:
		reward += data.melee_kill_bonus
	add(reward, true, info.source as Player)


## Compra recusada: o aviso ("pontos insuficientes") só aparece para quem tentou comprar.
static func deny(who: Node) -> void:
	var player := who as Player
	if player:
		player.hud(&"purchase_denied")
	else:
		Events.purchase_denied.emit()
