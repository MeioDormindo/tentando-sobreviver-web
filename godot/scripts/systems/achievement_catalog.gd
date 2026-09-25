class_name AchievementCatalog
extends Resource
## Conquistas (gerado a partir do jogo web): id, nome, descrição, meta acumulada e segredo.

## [{id, name, description, icon, total_key, total_target, secret}]. icon: textura (res://).
## total_key: kills, knifeKills,
## headshots (totais do save) ou vazio (conquista de um momento).
@export var achievements: Array = []
@export var survivor_round: int = 10
@export var veteran_round: int = 20
@export var train_kills: int = 10


func find(id: String) -> Dictionary:
	for a: Dictionary in achievements:
		if a.id == id:
			return a
	return {}
