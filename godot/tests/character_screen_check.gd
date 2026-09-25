class_name CharacterScreenCheck
extends RefCounted
## Regra de liberação dos visuais (a mesma da tela PERSONAGEM), para os testes.


static func unlocked(skin: Dictionary) -> bool:
	return String(skin.get("unlock", "")) == "" or Save.has_achievement(skin.unlock)
