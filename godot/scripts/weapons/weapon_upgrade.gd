class_name WeaponUpgrade
extends RefCounted
## Melhorias do Weapon Lab (como no jogo web): normal → Mk II → Mk III. Cria um WeaponData novo
## (o original, compartilhado, nunca é alterado). O id continua o mesmo: a compra de munição
## na parede reconhece a arma melhorada.

const MAX_LEVEL := 2


## Dados do próximo nível, ou null se já está no máximo.
static func next_level(data: WeaponData, level: int, lab: WeaponLabData) -> WeaponData:
	if level == 0:
		return mk2(data, lab)
	if level == 1:
		return mk3(data, lab)
	return null


static func mk2(data: WeaponData, lab: WeaponLabData) -> WeaponData:
	var up := data.duplicate() as WeaponData
	up.display_name = data.upgrade_name if data.upgrade_name != "" else data.display_name + " Mk II"
	up.damage = roundf(data.damage * lab.damage_multiplier)
	up.magazine_size = roundi(data.magazine_size * lab.magazine_multiplier)
	up.reserve_ammo = roundi(data.reserve_ammo * lab.reserve_multiplier)
	up.reload_time = data.reload_time * lab.reload_multiplier
	up.fire_rate = data.fire_rate * lab.fire_rate_multiplier
	up.pierce = data.pierce + lab.extra_pierce
	up.tracer_color = lab.tracer_mk2
	up.special_params = _upgrade_special(data.special_type, data.special_params, lab)
	return up


static func mk3(data: WeaponData, lab: WeaponLabData) -> WeaponData:
	var up := data.duplicate() as WeaponData
	up.display_name = data.display_name.replace(" Mk II", " Mk III") if data.display_name.ends_with(" Mk II") else data.display_name + " Mk III"
	up.pellets = data.pellets * lab.mk3_pellet_multiplier
	up.spread_degrees = data.spread_degrees + lab.mk3_extra_spread
	up.tracer_color = lab.tracer_mk3
	return up


## O Lab também fortalece a mecânica especial (explosão, queima, saltos do raio, vento).
static func _upgrade_special(kind: StringName, params: Dictionary, lab: WeaponLabData) -> Dictionary:
	var p := params.duplicate()
	var d := lab.damage_multiplier
	match kind:
		&"grenade", &"plasma":
			p.blast_damage = roundf(float(p.get("blast_damage", 0)) * d)
			p.blast_radius = float(p.get("blast_radius", 0)) * 1.15
		&"flame":
			p.burn_dps = roundf(float(p.get("burn_dps", 0)) * d)
		&"arc":
			p.chains = int(p.get("chains", 0)) + 3
		&"gust":
			p.damage = roundf(float(p.get("damage", 0)) * d)
			p.range = float(p.get("range", 0)) * 1.25
			p.arc_deg = float(p.get("arc_deg", 0)) + 15.0
	return p
