class_name PerkCatalog
extends RefCounted
## Todos os perks do jogo (uma pasta de PerkData), lidos uma vez por pasta. Usa
## `ResourceLoader.list_directory`, que no jogo exportado lista os recursos com o nome original
## (a pasta exportada só tem os `.remap`); o `DirAccess` fica de reserva.

const DIR := "res://data/perks"

static var _by_dir: Dictionary = {}


## Os perks da pasta, em ordem de id.
static func all(dir := DIR) -> Array[PerkData]:
	if _by_dir.has(dir):
		return _by_dir[dir]
	var files := ResourceLoader.list_directory(dir)
	if files.is_empty():
		files = DirAccess.get_files_at(dir)
	var list: Array[PerkData] = []
	var seen := {}
	for file in files:
		var clean := file.trim_suffix(".remap")
		if seen.has(clean) or not (clean.ends_with(".tres") or clean.ends_with(".res")):
			continue
		seen[clean] = true
		var perk := load("%s/%s" % [dir, clean]) as PerkData
		if perk:
			list.append(perk)
	list.sort_custom(func(a: PerkData, b: PerkData) -> bool: return String(a.id) < String(b.id))
	_by_dir[dir] = list
	return list
