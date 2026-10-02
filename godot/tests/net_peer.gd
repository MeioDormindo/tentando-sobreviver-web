extends SceneTree
## O colega do teste de rede (outro processo, sem janela; o host é a suíte `net`):
##   godot --headless --path godot -s res://tests/net_peer.gd -- --port=24711 --out=user://x.json
## O roteiro fica em net_peer_role.gd, carregado só aqui dentro: com `-s`, este arquivo é
## compilado antes dos autoloads existirem, então não pode citar os scripts do jogo.


func _initialize() -> void:
	await process_frame
	var role: RefCounted = (load("res://tests/net_peer_role.gd") as GDScript).new()
	await role.call(&"run", self)
	quit(0)
