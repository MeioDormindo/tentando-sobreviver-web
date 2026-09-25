class_name SkinCatalog
extends Resource
## Visuais do jogador (gerado a partir do jogo web): cores da jaqueta, mochila e cabelo e a
## conquista que libera cada um.

## [{id, name, unlock, jacket, pack, hair}] (unlock vazio = sempre disponível).
@export var skins: Array = []


func find(id: String) -> Dictionary:
	for skin: Dictionary in skins:
		if skin.id == id:
			return skin
	return skins[0] if not skins.is_empty() else {}
