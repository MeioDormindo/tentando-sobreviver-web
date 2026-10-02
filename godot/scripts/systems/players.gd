class_name Players
## Registro dos jogadores da partida (grupo "player"): no solo há um só; no cooperativo, um por
## pessoa. Quem precisa "do jogador" pergunta aqui em vez de guardar um nó fixo: o mais perto
## de pé (zumbis, chefes), todos (dano em área, bônus) ou o local (câmera, HUD, áudio).

## Cor de cada vaga da sala (como no CoD): nome no painel do time, sobre a cabeça e no minimapa.
const COLORS: Array[Color] = [Color(0.95, 0.95, 0.9), Color(0.42, 0.72, 1.0), Color(1.0, 0.8, 0.28), Color(0.95, 0.5, 0.82)]


static func _tree() -> SceneTree:
	return Engine.get_main_loop() as SceneTree


## A partida é em grupo (Session.roster com mais de um)? No solo, nada muda: um jogador, alvo
## fixo, uma carteira.
static func coop() -> bool:
	return Session.is_coop()


static func _group() -> Array[Player]:
	var list: Array[Player] = []
	var tree := _tree()
	if tree == null:
		return list
	for node in tree.get_nodes_in_group(&"player"):
		var player := node as Player
		if player and not player.is_queued_for_deletion():
			list.append(player)
	return list


## Todos os jogadores na árvore, na ordem de peer (o host primeiro).
static func all() -> Array[Player]:
	var list := _group()
	list.sort_custom(func(a: Player, b: Player) -> bool: return a.peer_id < b.peer_id)
	return list


## Vivos (caídos sangrando contam: ainda podem ser revividos).
static func alive() -> Array[Player]:
	return all().filter(func(p: Player) -> bool: return p.is_alive() or p.bleeding)


## De pé: vivos e não caídos (os que os zumbis perseguem e que podem pegar coisas).
static func standing() -> Array[Player]:
	return all().filter(func(p: Player) -> bool: return p.is_standing())


## O jogador desta máquina (câmera, HUD, áudio). No solo, o único.
static func local_player() -> Player:
	for player in _group():
		if player.is_local:
			return player
	return null


## O jogador de um peer (1 = host).
static func by_peer(peer: int) -> Player:
	for player in _group():
		if player.peer_id == peer:
			return player
	return null


## O mais perto de `at` (só os de pé com `standing_only`). null se não houver nenhum.
static func nearest(at: Vector3, standing_only := true) -> Player:
	var best: Player = null
	var best_distance := INF
	for player in (standing() if standing_only else alive()):
		var offset := player.global_position - at
		offset.y = 0.0
		var distance := offset.length_squared()
		if distance < best_distance:
			best = player
			best_distance = distance
	return best


## Um jogador de pé ao acaso (eventos que miram alguém). null se não houver nenhum.
static func random_standing() -> Player:
	var list := standing()
	return list.pick_random() if not list.is_empty() else null


## Quem um efeito de área atinge: no cooperativo, todos os jogadores vivos; no solo, só
## `fallback` (o alvo de sempre).
static func victims(fallback: Node3D) -> Array[Node3D]:
	var list: Array[Node3D] = []
	if coop():
		for player in all():
			list.append(player)
	if is_instance_valid(fallback) and not list.has(fallback):
		list.append(fallback)
	return list


## O dano/abate veio de um colega (jogador de outra máquina)? Estatísticas e conquistas de
## cada um contam só o que ele mesmo fez.
static func is_remote(source: Object) -> bool:
	return is_instance_valid(source) and source is Player and not (source as Player).is_local


## Cor da vaga do jogador (a ordem da sala; fora dela, a ordem de peer).
static func color_of(player: Player) -> Color:
	var slot := -1
	for i in Session.roster.size():
		if int(Session.roster[i].get("peer", 0)) == player.peer_id:
			slot = i
	if slot < 0:
		slot = maxi(0, all().find(player))
	return COLORS[slot % COLORS.size()]


## Cooperativo: conta ao time quem fez o quê ("ANA abriu a porta"). Só no host (os colegas
## recebem pela rede); no solo, nada.
static func feed(text: String) -> void:
	if coop() and not Net.is_client():
		Events.team_feed.emit(text)


## Nome para os avisos do time (o do jogador, ou "ALGUÉM").
static func name_of(who: Node) -> String:
	var player := who as Player
	return player.player_name if player and player.player_name != "" else "ALGUÉM"
