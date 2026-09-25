extends Node
## Barramento de eventos global (autoload "Events"): sistemas avisam o que aconteceu sem
## conhecer quem escuta (HUD, pontuação, rounds, áudio). Só sinais, sem estado.

## Um zumbi levou dano de uma fonte (arma, faca...).
signal zombie_hit(zombie: Node3D, info: DamageInfo)
## Um zumbi morreu.
signal zombie_killed(zombie: Node3D, info: DamageInfo)
## A vida do jogador mudou.
signal player_health_changed(current: float, maximum: float)
## O jogador morreu.
signal player_died()
## Munição da arma em mãos (nome, pente, reserva, recarregando).
signal ammo_changed(weapon_name: String, magazine: int, reserve: int, reloading: bool)
## Arma em mãos trocada (nome da atual e da outra; vazio = só uma arma).
signal weapon_changed(current_name: String, other_name: String)
## Pontos do jogador (total e variação).
signal points_changed(total: int, delta: int)
## Round começou (número e total de zumbis).
signal round_started(round_number: int, total_zombies: int)
## Zumbis que faltam no round atual.
signal round_remaining_changed(remaining: int)
## Round terminou (todos os zumbis abatidos).
signal round_completed(round_number: int)
## Texto de interação na HUD (vazio = esconder).
signal interaction_prompt(text: String)
## Fim de jogo com o resumo da partida.
signal game_over(summary: Dictionary)
## Uma área do mapa foi aberta (porta comprada).
signal area_opened(area_id: StringName, area_name: String)
## Compra recusada (pontos insuficientes).
signal purchase_denied()
## Aviso curto no meio da tela (a caixa mudou de lugar, arma melhorada...).
signal toast(text: String)
## Energia do mapa ligada/desligada.
signal power_changed(on: bool)
## Perks ativos do jogador (nomes).
signal perks_changed(names: Array[String])
## Começou/acabou uma rodada dos cães (config da névoa quando começa).
signal hound_round_changed(active: bool, config: Dictionary)
## Munição cheia para todas as armas (último cão, power-up Max Ammo).
signal max_ammo(at: Vector3)
## Boss chegando (aviso), estado da vida (barra da HUD), troca de fase e derrota.
signal boss_incoming(boss_name: String)
signal boss_state(boss_name: String, current: float, maximum: float, phase: int)
signal boss_phase(boss_name: String, phase: int)
signal boss_defeated(boss_id: StringName, boss_name: String, reward: int, at: Vector3)
## O boss invocou zumbis (entram na contagem do round).
signal zombies_summoned(count: int)
## Pontuação do ranking (total e variação).
signal score_changed(total: int, delta: int)
## O jogador disparou (estatística de precisão).
signal shot_fired()
## Um mapa foi liberado (fica salvo).
signal map_unlocked(map_id: String, map_name: String)
## Anti-trapaça: a partida foi invalidada (zoeira e aviso).
signal cheat_detected(taunt: String, subtitle: String)
## Conquista liberada (aviso na HUD).
signal achievement_unlocked(id: String, achievement_name: String, description: String)
## Power-up pego (nome, cor e detalhe do efeito) e cronômetros dos efeitos ativos.
signal power_up_collected(id: StringName, power_up_name: String, color: Color, detail: String)
signal power_up_timers(active: Dictionary, definitions: Dictionary)
## Armadura do jogador.
signal player_armor_changed(current: float, maximum: float)
## A Mystery Box começou a sortear (com Fire Sale ativo ou não).
signal mystery_box_rolled(fire_sale: bool)
## Uma arma saiu do inventário (vai para o chão por um tempo).
signal weapon_dropped(weapon: Weapon, at: Vector3)
## Pausa ligada/desligada.
signal pause_changed(paused: bool)
## A HUD pediu para jogar de novo.
signal restart_requested()
