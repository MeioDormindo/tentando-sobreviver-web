class_name SkinCatalog
extends Resource
## Visuais do jogador (gerado a partir do jogo web + os só do Godot): cada mapa tem o seu
## personagem (Terminal: o sobrevivente; Hospital: um paciente; Templo: a arqueóloga) com 4
## visuais, liberados por conquistas. Cores da roupa, detalhe e cabelo.

## Chave da configuração do visual escolhido em cada mapa ("skin" é a mesma do jogo web).
const SETTING_KEYS := {"terminal": "skin", "map2": "skinHospital", "temple": "skinTemple"}

## [{id, name, unlock, map, model, style, jacket, pack, hair}] (unlock vazio = sempre disponível).
@export var skins: Array = []


## Os visuais do personagem do mapa (na ordem: o padrão primeiro).
func for_map(map_id: String) -> Array:
	var list := skins.filter(func(s: Dictionary) -> bool: return String(s.get("map", "terminal")) == map_id)
	# O padrão (sem conquista) primeiro; os outros na ordem do arquivo.
	var free := list.filter(func(s: Dictionary) -> bool: return String(s.get("unlock", "")) == "")
	return free + list.filter(func(s: Dictionary) -> bool: return String(s.get("unlock", "")) != "")


## Chave da configuração com o visual escolhido para o mapa ("skin" é a mesma do jogo web).
static func setting_key(map_id: String) -> String:
	return String(SETTING_KEYS.get(map_id, "skin"))


## Visual do mapa: o escolhido, se for dele e estiver liberado; senão o padrão do mapa.
func chosen(map_id: String) -> Dictionary:
	var list := for_map(map_id)
	if list.is_empty():
		return find("default")
	var wanted := String(Save.get_setting(setting_key(map_id)))
	for skin: Dictionary in list:
		if skin.id == wanted and (String(skin.get("unlock", "")) == "" or Save.has_achievement(skin.unlock)):
			return skin
	return list[0]


func find(id: String) -> Dictionary:
	for skin: Dictionary in skins:
		if skin.id == id:
			return skin
	return skins[0] if not skins.is_empty() else {}
