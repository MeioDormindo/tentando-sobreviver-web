# Tentando Sobreviver — Godot 4.7

Versão em **Godot 4.7 + GDScript** do jogo de sobrevivência por rounds (especificação mestre do
projeto). O jogo web em TypeScript (raiz deste repositório) continua no ar e serve de referência
de conceitos: ver `docs/analise-typescript.md`.

**Estado: combate, mapas, loja e máquinas migrados do jogo web.** Tem:
- **Terminal Central migrado** (a partida começa nele) e o Hospital Santa Luzia pronto para
  entrar:
  - o mesmo layout do jogo web: áreas, paredes, trem parado, janelas por onde os zumbis entram,
    props e luzes;
  - portas compráveis com E, que abrem a área e os spawns dela;
  - barricadas nas janelas: os zumbis arrancam as tábuas vindo de fora, e segurar E conserta
    (+10 por tábua);
  - armas e munição na parede, com o giz na parede mais próxima do ponto do layout;
  - Mystery Box, com os pesos de raridade do jogo web, armas só de um mapa e troca de lugar a cada
    3 usos;
  - Weapon Lab: Mk II e Mk III (o Canhão de Vento vira Tornado);
  - 7 perks com os efeitos do jogo web; o Quick Revive levanta sozinho, até 3 vezes;
  - energia: segurar E no disjuntor liga perks e Lab, e as luzes voltam piscando;
  - mapa de teste (`scenes/maps/test_arena.tscn`);
- jogador com os atributos do jogo web (velocidade, regeneração, invulnerabilidade curta, mais
  lento de lado e de costas);
- 2 armas com troca, faca com avanço e as 19 armas do jogo web:
  - chumbos, perfuração e o giro da minigun;
  - as especiais: granada, plasma, lança-chamas, raio e Canhão de Vento;
- zumbi Walker com navegação e ataque;
- rounds cada vez mais difíceis, pontos, HUD, pausa, fim de jogo e reinício.

## Como abrir e jogar

1. Godot **4.7.2** (versão padrão, sem .NET): https://godotengine.org. Nesta máquina ele está em
   `E:\Tools\Godot\`.
2. Abrir o `project.godot` desta pasta no Godot (ou `Godot --path godot` na raiz do repo).
3. F5 roda a cena principal (`scenes/main.tscn`).

| Controle | Teclado + mouse | Controle |
|---|---|---|
| Mover | WASD / setas | analógico esquerdo |
| Mirar | mouse (sobre a cabeça do zumbi = headshot) | analógico direito |
| Atirar | botão esquerdo | RT |
| Recarregar | R | X |
| Trocar arma | Q, 1 / 2, roda do mouse | Y |
| Faca | V / botão direito | RB |
| Comprar / abrir porta | E | A |
| Consertar barricada, ligar o disjuntor | segurar E | segurar A |
| Pausar | ESC / P | Start |

Já mapeado para as próximas fases: pular (Espaço / B).

## Migração do jogo web

Os dados não são copiados à mão: `npm run godot:data` (na raiz do repositório) lê as configs
reais do jogo web (`src/config`) e gera os `.tres` de `data/`:
- as 19 armas e a faca;
- o jogador;
- as fórmulas dos rounds e a economia;
- os 8 tipos de zumbi;
- barricadas, Mystery Box, Weapon Lab, os 7 perks, energia e o catálogo de armas;
- os mapas (`data/maps/terminal.json` e `map2.json`): a grade de tiles montada na mesma ordem do
  jogo web, com áreas, portas, janelas, spawns por área, luzes, props, máquinas e compras na
  parede.

Conversão: 32 px = 1 m, ms → s. O script é `scripts/godot/export-data.ts`. Enquanto o jogo web
for a referência, mude os valores lá e rode de novo. Quando o Godot virar a fonte, os `.tres`
passam a ser editados direto no Godot.

## Testes

```sh
# Sistemas isolados, sem janela (vida, headshot, munição e recarga, fórmulas dos rounds,
# escolha do ponto de spawn, pontos, inventário, giro da minigun, dados migrados, os dois
# mapas com portas, barricadas, compras, máquinas e navegação, sorteio da caixa, Weapon Lab,
# perks) e, na mesma execução, testes de cena das 5 armas especiais:
Godot --headless --path godot -s res://tests/run_tests.gd

# Jogado (abre uma janela), no Terminal migrado: um bot joga até o round 3 e confere
# navegação, ataque, abates na cabeça e no corpo, compra de porta, compras na parede,
# barricadas (quebra e conserto), Mystery Box, Weapon Lab, energia, perks, Quick Revive,
# troca de arma, chumbos, faca, pontos, limite de vivos, morte e reinício.
# Salva prints em tests/output/.
Godot --path godot -s res://tests/playtest.gd
```

Os dois saem com código 1 se algo falhar. Depois de criar scripts novos com `class_name`, rode
`Godot --headless --path godot --import` uma vez para atualizar o cache de classes.

## Arquitetura

```
scenes/main.tscn                 Main: World, Player, Camera, Zombies, SpawnManager,
                                 RoundManager, PointsManager, GameManager, AudioManager, HUD
scripts/systems/events.gd        autoload Events: barramento de sinais (sistemas não se conhecem)
scripts/systems/input_bindings.gd autoload InputBindings: ações abstratas (teclado, mouse, controle)
scripts/components/              HealthComponent, Hurtbox (corpo/cabeça), DamageInfo
scripts/characters/              CharacterBase (CharacterBody3D + vida por composição)
scripts/player/                  Player + PlayerData (movimento, mira, tiro, faca, regeneração),
                                 TopDownCamera
scripts/zombies/                 ZombieBase (perseguir → atacar → morto, NavigationAgent3D),
                                 ZombieData, ZombieFactory
scripts/weapons/                 Weapon (munição, recarga, raycast, chumbos, perfuração, giro),
                                 WeaponData, WeaponInventory (2 espaços), Melee + MeleeData (faca),
                                 WeaponUpgrade (Mk II/III), WeaponCatalog, SpecialFire +
                                 WeaponProjectile (granada, plasma, chama, raio, vento)
scripts/systems/                 PerkSystem (modificadores dos perks), PowerSystem (energia),
                                 RoundManager + RoundData, SpawnManager, PointsManager +
                                 PointsData, GameManager, AudioManager
scripts/maps/                    GameWorld (base: spawn do jogador, áreas abertas, spawns ativos),
                                 LayoutMap (mapa migrado do JSON), Arena (mapa de teste)
scripts/interactables/           tudo que se usa com E (grupo "interactable"): Door, Barricade,
                                 WallBuy, MysteryBox, WeaponLab, PerkMachine, Breaker (+ os
                                 Resources de dados de cada um)
scripts/ui/hud.gd                HUD (só escuta Events)
data/                            .tres: m1911, walker, rounds, points, barramentos de áudio
```

Decisões:
- **Câmera de cima, inclinada:** mantém os sistemas do jogo atual (áreas, portas, lanterna,
  controles de celular com dois analógicos) e é mais leve para Web e celular. A arquitetura não
  impede um modo em primeira pessoa depois.
- **Renderizador Compatibility em todas as plataformas:** é o único da exportação Web e roda bem
  no celular.
- **Dados em Resources:** arma, zumbi, rounds e pontos. Arma ou zumbi novo = novo `.tres`.
- **Camadas de física** (`scripts/utilities/physics_layers.gd`):
  - 1 `world`, 2 `player`, 3 `zombies`, 4 `hurtboxes`;
  - 5 `player_only`: janelas, que os zumbis atravessam;
  - 6 `props`: móveis que bloqueiam a passagem, mas não a bala;
  - 7 `barricades`: tábuas das janelas, que bloqueiam os zumbis enquanto existem.
  - O tiro acerta paredes e hurtboxes, não o corpo físico.
  - A navegação usa só `world` e `props`.
- **Máquina de estados simples nos zumbis;** Behavior Tree só quando o comportamento pedir
  (seção 11). O caminho é recalculado a cada 0,25s, espalhado entre os zumbis.
- **Munição:** como no jogo web, vem das compras na parede. O reabastecimento automático no fim do
  round (`RoundData.refill_ammo_on_round_end`) ficou desligado.
- **Nenhum addon externo.**

## Próximas fases (roadmap da especificação)

- **Fase 4 (rounds):** novos tipos de zumbi e composição por round.
- **Inimigos:** tipos de zumbi com corpo e comportamento próprios, composição por round, rodada
  dos cães, bosses (The Conductor, Paciente Zero).
- **Menu e progressão:** escolha de mapa, save, ranking online, conquistas, visuais.
- **Eventos e extras:** power-ups (incluindo o Fire Sale), eventos do mapa (trem, apagão...),
  missão do Hospital, arma caída ao trocar.
- **Fase 7 (polimento):** sons e efeitos, modelos do Blender no lugar das primitivas.
- **Fase 8 (plataformas):** exportações e controles de toque.
