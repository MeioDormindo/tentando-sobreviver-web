class_name WeaponCatalog
extends Resource
## Todas as armas do jogo (gerado a partir do jogo web). Usado pelo sorteio da Mystery Box.

@export var weapons: Array[Resource] = []


func find(id: StringName) -> WeaponData:
	for weapon in weapons:
		if (weapon as WeaponData).id == id:
			return weapon
	return null
