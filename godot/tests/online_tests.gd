extends RefCounted
## Testes do online contra o servidor de verdade (o mesmo Supabase do jogo web), só com
## operações que não gravam nada: ler o ranking, envio recusado e login errado.
## Sem internet, os testes de rede são pulados (não contam como falha).

var _passed := 0
var _failed := 0


func run(tree: SceneTree) -> int:
	print("Online (servidor real, sem gravar)")
	var online := tree.root.get_node("Online")
	var account := tree.root.get_node("Account")
	check(account.call(&"username_error", "a'; drop table scores--") != "", "usuário com SQL é recusado no cliente")
	check(account.call(&"username_error", "jogador_1") == "" and account.call(&"password_error", "123") != "", "valida usuário e tamanho da senha")
	var top: Variant = await Leaderboard.fetch_top(online, "terminal")
	if top == null:
		print("  (sem conexão com o servidor: testes de rede pulados)")
	else:
		check(top is Array, "lê o ranking global da temporada %d (%d nomes)" % [Leaderboard.current_season(online), (top as Array).size()])
		var refused: String = await Leaderboard.submit(online, "terminal", "TESTE_GODOT", 9999999, 1, 1)
		check(refused != "", "pontuação impossível é recusada pelo servidor (%s)" % refused)
		var login: String = await account.call(&"sign_in", "naoexiste_gd7", "senhaerrada123")
		check(login == "Usuário ou senha incorretos", "login com senha errada: %s" % login)
		check(account.call(&"current_user") == "", "login errado não cria sessão")
	print("\n%d ok, %d falharam (online)" % [_passed, _failed])
	return _failed


func check(condition: bool, description: String) -> void:
	if condition:
		_passed += 1
		print("  ok  ", description)
	else:
		_failed += 1
		printerr("  FALHOU  ", description)
