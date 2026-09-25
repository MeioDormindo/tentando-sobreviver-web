class_name BossData
extends Resource
## Um boss (gerado a partir do jogo web). Cada ataque é um dicionário com os números dele
## (distâncias em m, tempos em s); ataque vazio = o boss não o tem.

@export var id: StringName = &""
@export var display_name: String = "Boss"
@export var scene: PackedScene
@export var max_health: float = 6000.0
## Vida extra a cada nova aparição do mesmo boss (0.6 = +60%).
@export var health_per_appearance: float = 0.6
@export var move_speed: float = 2.25
@export var body_radius: float = 0.75
## Pontos ao derrotar.
@export var reward: int = 2000
## Frações de vida que iniciam as fases 2, 3 e 4.
@export var phase_thresholds: PackedFloat32Array = PackedFloat32Array([0.75, 0.5, 0.25])
## Multiplicadores por fase (índice 0 = fase 1).
@export var phase_speed: PackedFloat32Array = PackedFloat32Array([1, 1, 1, 1])
@export var phase_cooldown: PackedFloat32Array = PackedFloat32Array([1, 1, 1, 1])
## Rugido (entrada e troca de fase), invulnerável (s).
@export var roar_time: float = 1.1

@export_group("Ataques")
## range, damage, cooldown_time.
@export var melee: Dictionary = {}
## windup_time, speed, max_distance, damage, cooldown_time, stun_time, min_range, max_range.
@export var charge: Dictionary = {}
## from_phase, radius, expand_time, damage, cooldown_time, windup_time.
@export var shockwave: Dictionary = {}
## from_phase, count, types, cooldown_time.
@export var summon: Dictionary = {}
## from_phase, count, radius, telegraph_time, damage, cooldown_time, spread, pool.
@export var area: Dictionary = {}
## A área vira poça de ácido (Paciente Zero) em vez de explodir.
@export var area_acid: bool = false
## from_phase, range, arc_deg, count, windup_time, cooldown_time, pool.
@export var vomit: Dictionary = {}
## from_phase, radius, slow_time, slow_factor, cooldown_time, summon_count, types.
@export var scream: Dictionary = {}
## Esferas de alma em leque (Entidade do Submundo): from_phase, count, spread_deg, speed,
## range, damage, windup_time, cooldown_time.
@export var volley: Dictionary = {}

@export_group("Outros")
## Lanterna acesa na mão (The Conductor).
@export var lantern: bool = false
## Fração da horda normal que acompanha o boss.
@export var escort_ratio: float = 0.3
## Extras só do Godot: rubble_time e breaks_pillars (Minotauro); fire_pools (vômito e área
## viram chamas), combo_bite (morde logo depois da investida), charge_from_phase,
## phase_sheets {"3": folha} (troca de forma) e lore (mensagem ao ser derrotado).
@export var extras: Dictionary = {}
