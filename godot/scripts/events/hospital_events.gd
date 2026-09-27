class_name HospitalEvents
extends RefCounted
## Eventos que só acontecem no Hospital (registrados no WorldEventSystem): Contenção Rompida.

const SCRIPTS := [
	preload("res://scripts/events/containment_breach_event.gd"),
]


static func in_hospital(system: WorldEventSystem) -> bool:
	return system != null and system.world != null and system.world.map_id() == "map2"
