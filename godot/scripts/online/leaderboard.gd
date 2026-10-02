class_name Leaderboard
extends RefCounted
## Ranking global (o mesmo do jogo web): temporadas de 15 dias calculadas igual ao servidor;
## a view `leaderboard` guarda a melhor pontuação de cada nome por temporada e mapa. Partidas em
## grupo têm ranking próprio por modo (dupla, trio, quarteto): coluna `players`, com o time.

## Nomes dos modos (1 a 4 jogadores).
const MODES := ["SOLO", "DUPLA", "TRIO", "QUARTETO"]

## Mapas aceitos pelo servidor (check `scores_map_check` em supabase/schema.sql). Mapa novo
## precisa entrar aqui E no banco, senão o envio é recusado.
const MAPS := ["terminal", "map2", "temple"]


## Temporada atual: blocos de 15 dias desde 1970 (a mesma conta do servidor).
static func current_season(online: Node) -> int:
	return floori(Time.get_unix_time_from_system() / float(online.data.season_seconds))


## Dias (arredondados para cima) até a temporada virar.
static func season_days_left(online: Node) -> int:
	var end: int = (current_season(online) + 1) * int(online.data.season_seconds)
	return maxi(1, ceili((end - Time.get_unix_time_from_system()) / 86400.0))


## Envia uma pontuação. Devolve "" se deu certo, ou a mensagem do erro. Partida em grupo:
## `players` (2 a 4) e `team` (os nomes do time; `player` é o host, que envia pelo time).
static func submit(online: Node, map_id: String, player: String, score: int, wave: int, kills: int, players: int = 1, team: String = "") -> String:
	if not online.is_configured():
		return "ranking global indisponível"
	var row := {"map": map_id, "name": player, "score": score, "wave": wave, "kills": kills}
	# Solo sem as colunas novas: funciona também antes da migração supabase/coop_ranking.sql.
	if players > 1:
		row.players = players
		row.team = team.substr(0, 64)
	var result: Dictionary = await online.request(HTTPClient.METHOD_POST, "/rest/v1/scores", row, "", PackedStringArray(["Prefer: return=minimal"]))
	if result.ok:
		return ""
	if int(result.status) == 0:
		return "sem conexão"
	var message := String(result.message)
	if message.containsn("scores_map_check"):
		return "mapa ainda não aceito no ranking global"
	if message.containsn("check constraint") or message.containsn("row-level security"):
		return "pontuação recusada"
	return message


## Top da temporada atual no mapa e no modo (`players`: 1 solo, 2 a 4 em grupo; melhor de cada
## nome ou time), ou null se falhou.
static func fetch_top(online: Node, map_id: String, players: int = 1) -> Variant:
	if not online.is_configured():
		return null
	var query := "select=name,score,wave,kills%s&season=eq.%d&map=eq.%s&players=eq.%d&order=score.desc&limit=%d" % [
		",team" if players > 1 else "", current_season(online), map_id.uri_encode(), players, online.data.global_rank_size]
	var result: Dictionary = await online.request(HTTPClient.METHOD_GET, "/rest/v1/leaderboard?" + query)
	# Banco sem a migração do modo (supabase/coop_ranking.sql): o solo continua como antes.
	if not result.ok and players == 1 and int(result.status) == 400:
		query = "select=name,score,wave,kills&season=eq.%d&map=eq.%s&order=score.desc&limit=%d" % [
			current_season(online), map_id.uri_encode(), online.data.global_rank_size]
		result = await online.request(HTTPClient.METHOD_GET, "/rest/v1/leaderboard?" + query)
	return result.data if result.ok and result.data is Array else null
