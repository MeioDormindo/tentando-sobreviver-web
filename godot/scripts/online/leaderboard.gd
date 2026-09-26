class_name Leaderboard
extends RefCounted
## Ranking global (o mesmo do jogo web): temporadas de 15 dias calculadas igual ao servidor;
## a view `leaderboard` guarda a melhor pontuação de cada nome por temporada e mapa.

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


## Envia uma pontuação. Devolve "" se deu certo, ou a mensagem do erro.
static func submit(online: Node, map_id: String, player: String, score: int, wave: int, kills: int) -> String:
	if not online.is_configured():
		return "ranking global indisponível"
	var result: Dictionary = await online.request(HTTPClient.METHOD_POST, "/rest/v1/scores",
		{"map": map_id, "name": player, "score": score, "wave": wave, "kills": kills}, "", PackedStringArray(["Prefer: return=minimal"]))
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


## Top da temporada atual no mapa (melhor de cada nome), ou null se falhou.
static func fetch_top(online: Node, map_id: String) -> Variant:
	if not online.is_configured():
		return null
	var query := "select=name,score,wave,kills&season=eq.%d&map=eq.%s&order=score.desc&limit=%d" % [
		current_season(online), map_id.uri_encode(), online.data.global_rank_size]
	var result: Dictionary = await online.request(HTTPClient.METHOD_GET, "/rest/v1/leaderboard?" + query)
	return result.data if result.ok and result.data is Array else null
