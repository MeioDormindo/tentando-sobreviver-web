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
## Pausa ligada/desligada.
signal pause_changed(paused: bool)
## A HUD pediu para jogar de novo.
signal restart_requested()
