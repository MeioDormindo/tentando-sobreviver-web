class_name MapCatalog
extends Resource
## Mapas do jogo e como cada um é liberado (gerado a partir do jogo web).

## id → {name, description, scene, unlock_boss_round, unlock_on_map} (0 / "" = livre).
@export var maps: Dictionary = {}
## Ordem de exibição na escolha de mapa.
@export var order: PackedStringArray = PackedStringArray()
@export var default_map: String = "terminal"
## Posições do ranking local por mapa e tamanho máximo do nome.
@export var ranking_size: int = 10
@export var player_name_max: int = 14


func info(id: String) -> Dictionary:
	return maps.get(id, {})


func display_name(id: String) -> String:
	return String(info(id).get("name", id))


## Mapas liberados por derrotar o boss do round `round_number` em `on_map`.
func unlocked_by(on_map: String, round_number: int) -> PackedStringArray:
	var result := PackedStringArray()
	for id: String in maps:
		var m: Dictionary = maps[id]
		if String(m.unlock_on_map) == on_map and int(m.unlock_boss_round) > 0 and round_number >= int(m.unlock_boss_round):
			result.append(id)
	return result
