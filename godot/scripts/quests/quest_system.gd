class_name QuestSystem
extends Node
## Missão principal genérica (como no jogo web): uma lista de etapas em ordem. Envia o estado
## para a HUD (Events.quest_state) e marca o objetivo no minimapa (grupo "minimap_objective").
## Também tem as peças que as missões dos mapas usam: pontos de interação, cadeado que abre com
## tiro, energia, Blindado que carrega um item e o prêmio (perks + arma).

@export var data: QuestData
@export var player: Player
@export var world: GameWorld
@export var round_manager: RoundManager
@export var spawn_manager: SpawnManager
@export_dir var perks_dir: String = "res://data/perks"
@export var reward_weapon: WeaponData

var title: String = ""
var steps: Array[QuestStep] = []
## Etapa atual (0 = primeira; -1 = não começou).
var index: int = -1
var done: bool = false

var _on_complete: Callable
var _last_text := ""
var _marker: Node3D
## Partida em rede, num colega: a missão só mostra (pontos, peças, sinal); quem avança é o host.
var remote := false


func begin(p_title: String, p_steps: Array[QuestStep], on_complete: Callable) -> void:
	remote = Net.is_client()
	title = p_title
	steps = p_steps
	_on_complete = on_complete
	_marker = Node3D.new()
	_marker.name = "QuestObjective"
	add_child(_marker)
	index = -1
	done = false
	_advance()


func _physics_process(delta: float) -> void:
	if done or index < 0:
		return
	if remote:
		_remote_update(delta)
		return
	var step := steps[index]
	if step.update.call(delta):
		if step.exit.is_valid():
			step.exit.call()
		_advance()
		return
	_emit()
	_update_marker()


func current_target() -> Variant:
	return null if done or index < 0 else steps[index].target.call()


func _advance() -> void:
	index += 1
	if index >= steps.size():
		done = true
		_marker.remove_from_group(&"minimap_objective")
		if remote:
			return
		_net(&"advance", {"index": index, "state": net_state()})
		Events.quest_state.emit({})
		if _on_complete.is_valid():
			_on_complete.call()
		return
	if not remote:
		_net(&"advance", {"index": index, "state": net_state()})
	if steps[index].enter.is_valid():
		steps[index].enter.call()
	if remote:
		return
	_emit(true)
	_update_marker()


func _emit(force := false) -> void:
	var text: String = steps[index].objective.call()
	if not force and text == _last_text:
		return
	_last_text = text
	Events.quest_state.emit({"title": title, "objective": text, "step": index + 1, "total": steps.size()})


func _update_marker() -> void:
	var target: Variant = current_target()
	if target is Vector3:
		_marker.global_position = target
		if not _marker.is_in_group(&"minimap_objective"):
			_marker.add_to_group(&"minimap_objective")
	elif _marker.is_in_group(&"minimap_objective"):
		_marker.remove_from_group(&"minimap_objective")


# ───────────────────────── Peças das missões ─────────────────────────

## Posição de um ponto do mapa (tiles, centro do tile).
func _at(spot: Dictionary) -> Vector3:
	return Vector3(float(spot.tx) + 0.5, 0.0, float(spot.ty) + 0.5)


## Posições da missão `key` no mapa (seção "quest"), por cima da config da missão.
func _merge_map_spots(cfg: Dictionary, key: String) -> Dictionary:
	var merged := cfg.duplicate(true)
	var quest: Variant = (world as LayoutMap).data.get("quest") if world is LayoutMap else null
	var spots: Dictionary = quest.get(key, {}) if quest is Dictionary else {}
	for name: String in spots:
		var entry: Dictionary = merged.get(name, {})
		entry.merge(spots[name], true)
		merged[name] = entry
	return merged


func _spot(text: String, at: Vector3, on_done: Callable, hold := 0.0) -> QuestSpot:
	var spot := QuestSpot.create(text, at, on_done, hold)
	world.add_child(spot)
	return spot


func _clear_spots() -> void:
	for node in get_tree().get_nodes_in_group(&"quest_spots"):
		node.queue_free()


func _power_on() -> bool:
	var power := get_tree().get_first_node_in_group(&"power_system") as PowerSystem
	return power != null and power.is_on


func _breaker_position() -> Variant:
	for node in world.find_children("*", "", true, false):
		if node is Breaker:
			return (node as Node3D).global_position
	return null


## Cadeado na frente de um objeto: uma hurtbox com 1 de vida; o tiro abre (on_open).
func _make_lock(parent: Node3D, on_open: Callable) -> Node3D:
	var padlock := Node3D.new()
	padlock.name = "Padlock"
	padlock.position = Vector3(0.0, 0.8, 0.3)
	parent.add_child(padlock)
	var lock_art := PixelShapes.standing("res://assets/web/props/padlock.png", 80.0)
	padlock.add_child(lock_art if lock_art else EventFx.box(Vector3(0.18, 0.22, 0.08), EventFx.glow(Color(0.85, 0.7, 0.25), 1.0, 0.3)))
	var health := HealthComponent.new()
	health.name = "HealthComponent"
	padlock.add_child(health)
	health.reset(1.0)
	var hurtbox := Hurtbox.new()
	hurtbox.name = "Hurtbox"
	hurtbox.health = health
	hurtbox.collision_layer = PhysicsLayers.HURTBOXES
	hurtbox.collision_mask = 0
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(0.6, 0.6, 0.4)
	shape.shape = box
	hurtbox.add_child(shape)
	padlock.add_child(hurtbox)
	# Em rede, no colega: o tiro aqui é só visual; o cadeado abre quando o host avisa.
	health.invulnerable = remote
	health.died.connect(func(_info: DamageInfo) -> void:
		_net(&"lock", {"path": String(world.get_path_to(padlock))})
		on_open.call()
		Audio.play_at("armor_hit", padlock.global_position, "world", 1.0)
		SpecialFire.flash(get_tree(), padlock.global_position, 1.0, Color(1.0, 0.85, 0.4))
		_toast("CADEADO ABERTO")
		padlock.queue_free())
	return padlock


## Um Blindado extra que carrega um item (sprite em cima dele); entra na conta do round.
## `type`: quem carrega (Blindado por padrão; no Templo, um Esqueleto); `item`: arte pronta
## em cima dele (senão a imagem de `item_art`).
func _spawn_carrier(item_art: String, toast: String, type: StringName = &"armored", item_node: Node3D = null, item_prop := "") -> ZombieBase:
	var number := maxi(1, round_manager.round_number)
	var rounds := round_manager.data
	var carrier := spawn_manager.spawn_zombie(rounds.health_multiplier(number), rounds.damage_multiplier(number), rounds.speed_multiplier(number), number, type)
	if carrier == null:
		return null
	Events.zombies_summoned.emit(1)
	var item: Node3D = item_node if item_node else (PixelShapes.standing(item_art, 56.0) if item_art != "" else null)
	if item == null:
		item = EventFx.box(Vector3(0.25, 0.04, 0.16), EventFx.glow(Color(0.3, 0.6, 1.0), 1.0, 1.2))
	item.position = Vector3(0.0, 2.0, 0.0)
	carrier.add_child(item)
	_net(&"carrier", {"zombie": int(carrier.get_meta(&"net_id", 0)), "art": item_art, "prop": item_prop})
	Events.toast.emit(toast)
	return carrier


## Prêmio: todos os perks que ainda dá para ter e a arma (level 1 = já no Mk II). No
## cooperativo, cada jogador do time ganha o seu.
func _grant_rewards(weapon_data: WeaponData, level := 0) -> void:
	for someone in Players.victims(player):
		if not Players.coop() or (someone as Player).is_alive():
			_reward(someone as Player, weapon_data, level)


func _reward(who: Player, weapon_data: WeaponData, level: int) -> void:
	for file in DirAccess.get_files_at(perks_dir):
		if file.ends_with(".tres") or file.ends_with(".tres.remap"):
			var perk := load("%s/%s" % [perks_dir, file.trim_suffix(".remap")]) as PerkData
			if perk and who.perks.can_buy(perk):
				who.perks.grant(perk)
	if weapon_data == null:
		return
	var dropped := who.give_weapon(weapon_data)
	if dropped:
		Events.weapon_dropped.emit(dropped, who.global_position)
	var weapon := who.inventory.find(weapon_data.id)
	if weapon and level > 0:
		var lab := load("res://data/configs/weapon_lab.tres") as WeaponLabData
		while weapon.level < level:
			var next := WeaponUpgrade.next_level(weapon.data, weapon.level, lab)
			if next == null:
				break
			weapon.upgrade_to(next)


# ───────────────────────── Rede ─────────────────────────

## Aviso da missão (no colega, os avisos já vêm do host).
func _toast(text: String) -> void:
	if not remote:
		Events.toast.emit(text)


## Host: avisa os colegas (avanço de etapa, cadeado aberto, item de um Blindado...).
func _net(kind: StringName, payload: Dictionary) -> void:
	if Net.world and Net.is_host():
		Net.world.on_quest(self, kind, payload)


## O que o colega precisa saber ao avançar de etapa (onde o chefe caiu...).
func net_state() -> Dictionary:
	return {}


func _apply_state(_state: Dictionary) -> void:
	pass


## Colega: só o visual entre os avisos do host (a luz de um sinal...).
func _remote_update(_delta: float) -> void:
	pass


## Colega: o que o host avisou.
func net_apply(kind: StringName, payload: Dictionary) -> void:
	match kind:
		&"advance":
			_apply_state(payload.get("state", {}))
			var target := int(payload.get("index", index + 1))
			while index < target and not done:
				if index >= 0 and steps[index].exit.is_valid():
					steps[index].exit.call()
				_advance()
		&"lock":
			var padlock := world.get_node_or_null(String(payload.get("path", "")))
			var health := padlock.get_node_or_null("HealthComponent") as HealthComponent if padlock else null
			if health:
				health.invulnerable = false
				health.apply_damage(DamageInfo.new(health.current + 1.0, DamageInfo.Kind.WEAPON))
		&"carrier":
			var carrier := Net.world.call(&"_puppet", int(payload.get("zombie", 0))) as Node3D if Net.world else null
			if carrier:
				var prop := String(payload.get("prop", ""))
				var item: Node3D = PropFactory.create(prop) if prop != "" else (PixelShapes.standing(String(payload.get("art", "")), 56.0) if String(payload.get("art", "")) != "" else null)
				if item == null:
					item = EventFx.box(Vector3(0.25, 0.04, 0.16), EventFx.glow(Color(0.3, 0.6, 1.0), 1.0, 1.2))
				item.position = Vector3(0.0, 2.0, 0.0)
				carrier.add_child(item)
		_:
			_net_custom(kind, payload)


## Colega: aviso próprio de cada missão.
func _net_custom(_kind: StringName, _payload: Dictionary) -> void:
	pass
