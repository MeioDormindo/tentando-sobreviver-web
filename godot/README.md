# Tentando Sobreviver — Godot 4.7

Versão em **Godot 4.7 + GDScript** do jogo de sobrevivência por rounds (especificação mestre do
projeto). O jogo web em TypeScript (raiz deste repositório) continua no ar e serve de referência
de conceitos: ver `docs/analise-typescript.md`.

**Estado: MVP jogável (seção 39).** Tem:
- mapa de teste;
- jogador com lanterna e M1911 (tiro, munição, recarga, headshot);
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
| Pausar | ESC / P | Start |

Já mapeados para as próximas fases: interagir (E / A), trocar arma (Q / Y), faca (V ou botão
direito / RB) e pular (Espaço / B).

## Testes

```sh
# Sistemas isolados, sem janela (vida, headshot, munição e recarga, fórmulas dos rounds,
# escolha do ponto de spawn, pontos):
Godot --headless --path godot -s res://tests/run_tests.gd

# Jogado (abre uma janela): um bot joga até o round 3, confere navegação, ataque, abates
# na cabeça e no corpo, reabastecimento, pontos, limite de vivos, morte e reinício.
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
scripts/player/                  Player (movimento, mira, tiro), TopDownCamera
scripts/zombies/                 ZombieBase (perseguir → atacar → morto, NavigationAgent3D),
                                 ZombieData, ZombieFactory
scripts/weapons/                 Weapon (munição, recarga, raycast), WeaponData
scripts/systems/                 RoundManager + RoundData, SpawnManager, PointsManager +
                                 PointsData, GameManager, AudioManager
scripts/maps/arena.gd            blockout a partir de dados + malha de navegação gerada
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
- **Camadas de física:** 1 `world`, 2 `player`, 3 `zombies`, 4 `hurtboxes`
  (`scripts/utilities/physics_layers.gd`). O tiro acerta paredes e hurtboxes, não o corpo físico.
- **Máquina de estados simples nos zumbis;** Behavior Tree só quando o comportamento pedir
  (seção 11). O caminho é recalculado a cada 0,25s, espalhado entre os zumbis.
- **Munição volta a encher ao fim de cada round** (`RoundData.refill_ammo_on_round_end`), porque
  o MVP ainda não tem compras. Desligar quando entrarem as armas e munição na parede (Fase 5).
- **Nenhum addon externo.**

## Próximas fases (roadmap da especificação)

- **Fase 3 (combate):** faca, mais armas, `Melee`.
- **Fase 4 (rounds):** novos tipos de zumbi e composição por round.
- **Fase 5 (mapa):** portas e áreas, armas na parede, Mystery Box, perks, energia.
- **Fase 7 (polimento):** sons e efeitos, modelos do Blender no lugar das primitivas.
- **Fase 8 (plataformas):** exportações e controles de toque.
