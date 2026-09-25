class_name MapCatalog
extends Resource
## Mapas do jogo e como cada um é liberado (gerado a partir do jogo web).

## id → {name, description, scene, unlock_boss_round, unlock_on_map, unlock_achievements}
## (0 / "" / [] = livre). unlock_achievements: libera com qualquer uma dessas conquistas.
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


## Começa liberado (sem boss nem conquista pedidos).
func starts_unlocked(id: String) -> bool:
	var m := info(id)
	return int(m.get("unlock_boss_round", 0)) == 0 and (m.get("unlock_achievements", []) as Array).is_empty()


## Mapas liberados pela conquista `achievement` (ex.: missão do Terminal ou do Hospital → Templo).
func unlocked_by_achievement(achievement: String) -> PackedStringArray:
	var result := PackedStringArray()
	for id: String in maps:
		if (maps[id].get("unlock_achievements", []) as Array).has(achievement):
			result.append(id)
	return result


## Mapas liberados por derrotar o boss do round `round_number` em `on_map`.
func unlocked_by(on_map: String, round_number: int) -> PackedStringArray:
	var result := PackedStringArray()
	for id: String in maps:
		var m: Dictionary = maps[id]
		if String(m.unlock_on_map) == on_map and int(m.unlock_boss_round) > 0 and round_number >= int(m.unlock_boss_round):
			result.append(id)
	return result
