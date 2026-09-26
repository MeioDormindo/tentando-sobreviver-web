class_name BlessingSystem
extends Node
## Bênçãos dos Deuses (Templo dos Mortos): uma bênção por vez, recebida num altar de bênção;
## trocar substitui a anterior; cair (ou morrer) perde a bênção. Separada dos perks.
##   Zeus — Fúria do Trovão: 12% dos tiros soltam um raio que salta entre os zumbis.
##   Ares — Sede de Sangue: cada abate em sequência soma +8% de dano (até +40%); zera 3 s sem abater.
##   Atena — Sabedoria: −40% de dispersão e 15% de chance de crítico (dano ×2).
##   Hermes — Velocidade: anda, recarrega e interage 20% mais rápido.
##   Poseidon — Maré: os tiros empurram os zumbis.
##   Hades — Pacto dos Mortos: 10% dos abatidos voltam como espírito aliado por 10 s.

const GODS := {
	&"zeus": {"name": "ZEUS", "title": "Fúria do Trovão", "hint": "12% dos tiros soltam um raio", "color": Color(0.6, 0.85, 1.0)},
	&"ares": {"name": "ARES", "title": "Sede de Sangue", "hint": "abates seguidos aumentam o dano", "color": Color(1.0, 0.35, 0.3)},
	&"athena": {"name": "ATENA", "title": "Sabedoria", "hint": "mira precisa e golpes críticos", "color": Color(0.85, 0.8, 0.55)},
	&"hermes": {"name": "HERMES", "title": "Velocidade", "hint": "anda, recarrega e interage mais rápido", "color": Color(1.0, 0.85, 0.35)},
	&"poseidon": {"name": "POSEIDON", "title": "Maré", "hint": "os tiros empurram os zumbis", "color": Color(0.35, 0.75, 1.0)},
	&"hades": {"name": "HADES", "title": "Pacto dos Mortos", "hint": "abatidos voltam como aliados", "color": Color(0.7, 0.45, 1.0)},
}
const ZEUS_CHANCE := 0.12
const ZEUS_CHAINS := 3
const ZEUS_REACH := 5.0
const ARES_STEP := 0.08
const ARES_MAX := 5
const ARES_WINDOW := 3.0
const ATHENA_SPREAD := 0.6
const ATHENA_CRIT := 0.15
const HERMES_BONUS := 1.2
const POSEIDON_PUSH := 5.0
const HADES_CHANCE := 0.10

var player: Player
var active: StringName = &""
var streak := 0
var _streak_left := 0.0


func _ready() -> void:
	name = "Blessings"
	Events.zombie_hit.connect(_on_hit)
	Events.zombie_killed.connect(_on_killed)


func _process(delta: float) -> void:
	if active == &"":
		return
	if player and (player.is_down or not player.is_alive()):
		clear()
		return
	if streak > 0:
		_streak_left -= delta
		if _streak_left <= 0.0:
			streak = 0
			_apply()


## Recebe a bênção de um deus (substitui a anterior).
func grant(god: StringName) -> void:
	if not GODS.has(god):
		return
	active = god
	streak = 0
	_apply()
	var info: Dictionary = GODS[god]
	Events.blessing_changed.emit(god, "%s · %s" % [info.name, String(info.title).to_upper()], info.color)


func clear() -> void:
	if active == &"":
		return
	active = &""
	streak = 0
	_apply()
	Events.blessing_changed.emit(&"", "", Color.WHITE)


## Multiplicadores no jogador e nas armas conforme a bênção ativa.
func _apply() -> void:
	if player == null:
		return
	player.blessing_damage = 1.0 + ARES_STEP * streak if active == &"ares" else 1.0
	player.blessing_speed = HERMES_BONUS if active == &"hermes" else 1.0
	player.blessing_reload = 1.0 / HERMES_BONUS if active == &"hermes" else 1.0
	player.blessing_spread = ATHENA_SPREAD if active == &"athena" else 1.0
	player.blessing_crit = ATHENA_CRIT if active == &"athena" else 0.0
	player.refresh_weapon_modifiers()


func _on_hit(zombie: Node3D, info: DamageInfo) -> void:
	if active == &"" or info.source != player or info.kind != DamageInfo.Kind.WEAPON or not is_instance_valid(zombie):
		return
	match active:
		&"zeus":
			if randf() < ZEUS_CHANCE and zombie is CharacterBase and player.weapon:
				ElementEffects._chain(player.weapon, zombie as CharacterBase, info.amount * 0.7, ZEUS_CHAINS, ZEUS_REACH, player, GODS[&"zeus"].color)
		&"poseidon":
			if zombie.has_method(&"apply_knockback"):
				var push := zombie.global_position - player.global_position
				push.y = 0.0
				zombie.call(&"apply_knockback", push.normalized() * POSEIDON_PUSH)


func _on_killed(zombie: Node3D, info: DamageInfo) -> void:
	if active == &"" or info == null or info.source != player:
		return
	match active:
		&"ares":
			streak = mini(ARES_MAX, streak + 1)
			_streak_left = ARES_WINDOW
			_apply()
		&"hades":
			if randf() < HADES_CHANCE and is_instance_valid(zombie):
				AllySpirit.summon(get_tree(), zombie.global_position, player)
