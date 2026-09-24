# Tentando Sobreviver — Godot 4.7

Versão em **Godot 4.7 + GDScript** do jogo de sobrevivência por rounds (especificação mestre do
projeto). O jogo web em TypeScript (raiz deste repositório) continua no ar e serve de referência
de conceitos: ver `docs/analise-typescript.md`.

**Estado: combate e mapas migrados do jogo web.** Tem:
- **Terminal Central migrado** (a partida começa nele) e o Hospital Santa Luzia pronto para
  entrar:
  - o mesmo layout do jogo web: áreas, paredes, trem parado, janelas por onde os zumbis entram,
    props e luzes;
  - portas compráveis com E, que abrem a área e os spawns dela;
  - mapa de teste (`scenes/maps/test_arena.tscn`);
- jogador com os atributos do jogo web (velocidade, regeneração, invulnerabilidade curta, mais
  lento de lado e de costas);
- 2 armas com troca, faca com avanço, e as 19 armas do jogo web em dados (chumbos, perfuração,
  giro da minigun). As mecânicas especiais (granada, chama, raio, plasma, vento) entram com a
  Mystery Box;
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
| Pausar | ESC / P | Start |

Já mapeados para as próximas fases: interagir (E / A) e pular (Espaço / B).

## Migração do jogo web

Os dados não são copiados à mão: `npm run godot:data` (na raiz do repositório) lê as configs
reais do jogo web (`src/config`) e gera os `.tres` de `data/`:
- as 19 armas e a faca;
- o jogador;
- as fórmulas dos rounds e a economia;
- os 8 tipos de zumbi;
- os mapas (`data/maps/terminal.json` e `map2.json`): a grade de tiles montada na mesma ordem do
  jogo web, com áreas, portas, janelas, spawns por área, luzes, props, máquinas e compras na
  parede.

Conversão: 32 px = 1 m, ms → s. O script é `scripts/godot/export-data.ts`. Enquanto o jogo web
for a referência, mude os valores lá e rode de novo. Quando o Godot virar a fonte, os `.tres`
passam a ser editados direto no Godot.

## Testes

```sh
# Sistemas isolados, sem janela (vida, headshot, munição e recarga, fórmulas dos rounds,
# escolha do ponto de spawn, pontos, inventário, giro da minigun, dados migrados, carregar
# os dois mapas com portas, spawns e navegação):
Godot --headless --path godot -s res://tests/run_tests.gd

# Jogado (abre uma janela), no Terminal migrado: um bot joga até o round 3 e confere
# navegação, ataque, abates na cabeça e no corpo, compra de porta (área e spawns novos),
# troca de arma, chumbos da espingarda, faca, reabastecimento, pontos, limite de vivos,
# morte e reinício.
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
                                 WeaponData, WeaponInventory (2 espaços), Melee + MeleeData (faca)
scripts/systems/                 RoundManager + RoundData, SpawnManager, PointsManager +
                                 PointsData, GameManager, AudioManager
scripts/maps/                    GameWorld (base: spawn do jogador, áreas abertas, spawns ativos),
                                 LayoutMap (mapa migrado do JSON), Arena (mapa de teste)
scripts/interactables/door.gd    porta comprável (grupo "interactable", tecla E)
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
  - 6 `props`: móveis que bloqueiam a passagem, mas não a bala.
  - O tiro acerta paredes e hurtboxes, não o corpo físico.
  - A navegação usa só `world` e `props`.
- **Máquina de estados simples nos zumbis;** Behavior Tree só quando o comportamento pedir
  (seção 11). O caminho é recalculado a cada 0,25s, espalhado entre os zumbis.
- **Munição volta a encher ao fim de cada round** (`RoundData.refill_ammo_on_round_end`), porque
  o MVP ainda não tem compras. Desligar quando entrarem as armas e munição na parede (Fase 5).
- **Nenhum addon externo.**

## Próximas fases (roadmap da especificação)

- **Fase 4 (rounds):** novos tipos de zumbi e composição por round.
- **Fase 5 (mapa):** armas na parede, barricadas nas janelas, Mystery Box, perks, energia (os
  dados das posições já estão nos JSON dos mapas); escolha de mapa no menu.
- **Fase 7 (polimento):** sons e efeitos, modelos do Blender no lugar das primitivas.
- **Fase 8 (plataformas):** exportações e controles de toque.
