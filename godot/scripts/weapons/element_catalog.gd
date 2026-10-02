class_name ElementCatalog
extends Resource
## Elementos especiais das armas de parede (gerado a partir do jogo web): comprados segurando E
## na parede da própria arma. id → {name, icon, color, price, description} e os parâmetros de
## cada efeito (distâncias em m, tempos em s).

@export var elements: Dictionary = {}
@export var params: Dictionary = {}


static func shared() -> ElementCatalog:
	return load("res://data/configs/elements.tres") as ElementCatalog


func info(id: StringName) -> Dictionary:
	return elements.get(String(id), {})


func param(id: StringName) -> Dictionary:
	return params.get(String(id), {})


## "✹ FOGO" (ícone e nome).
func label(id: StringName) -> String:
	var e := info(id)
	return "%s %s" % [e.get("icon", ""), Loc.t(String(e.get("name", "")))] if not e.is_empty() else ""


## O mesmo nome para mandar pela rede ou para a HUD de outro jogador (traduzido em quem lê).
func label_msg(id: StringName) -> String:
	var e := info(id)
	return Loc.cat([String(e.get("icon", "")) + " ", String(e.get("name", ""))]) if not e.is_empty() else ""
