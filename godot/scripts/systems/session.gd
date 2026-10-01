extends Node
## Escolhas da partida atual (autoload "Session"): qual mapa jogar e quem joga. Não é salvo.

var map_id: String = "terminal"
## Jogadores da partida, um dicionário por pessoa: `peer` (1 = host), `name`, `skin` e `bot`
## (testes: controlado por código). Vazio = solo, só o jogador local (peer 1).
var roster: Array[Dictionary] = []
## Peer do jogador desta máquina (1 = host ou solo).
var local_peer: int = 1


## Quantos jogadores a partida tem (1 no solo).
func player_count() -> int:
	return maxi(1, roster.size())


## Opção de desenvolvimento para testar o cooperativo sem rede: `-- --coop=N` (2 a 4) começa as
## partidas com N-1 colegas controlados pelo computador (CompanionBot).
func _ready() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--coop="):
			var count := clampi(int(arg.trim_prefix("--coop=")), 2, 4)
			roster.assign([{"peer": 1, "name": "VOCÊ"}])
			for peer in range(2, count + 1):
				roster.append({"peer": peer, "name": "BOT %d" % (peer - 1), "bot": true, "ai": true})


## A partida é em grupo (mais de um jogador)?
func is_coop() -> bool:
	return roster.size() > 1
