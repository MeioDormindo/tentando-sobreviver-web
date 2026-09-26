class_name TempleEvents
extends RefCounted
## Eventos que só acontecem no Templo dos Mortos (registrados no WorldEventSystem):
## Ira de Zeus, Levante dos Mortos, Caçada de Artemis, Portão do Submundo e Sangue dos Deuses.

const SCRIPTS := [
	preload("res://scripts/events/zeus_wrath_event.gd"),
	preload("res://scripts/events/rise_of_dead_event.gd"),
	preload("res://scripts/events/artemis_hunt_event.gd"),
	preload("res://scripts/events/underworld_portal_event.gd"),
	preload("res://scripts/events/blood_of_gods_event.gd"),
]


static func in_temple(system: WorldEventSystem) -> bool:
	return system != null and system.world != null and system.world.map_id() == "temple"
