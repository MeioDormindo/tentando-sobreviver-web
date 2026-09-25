# Tentando Sobreviver — Godot 4.7

Versão em **Godot 4.7 + GDScript** do jogo de sobrevivência por rounds (especificação mestre do
projeto). O jogo web em TypeScript (raiz deste repositório) continua no ar e serve de referência
de conceitos: ver `docs/analise-typescript.md`.

**Estado: combate, mapas, loja, máquinas, inimigos e progressão local migrados do jogo web.** Tem:
- **menu principal**, escolha de mapa (o Hospital libera ao vencer o boss do round 10 no
  Terminal), ranking local por mapa, configurações (volume, som, música, tremor, tela cheia,
  nome, apagar progresso);
- **save** em `user://save.json` com **o mesmo formato JSON do jogo web** (prepara o save na
  nuvem entre as duas versões): configurações, recordes, mapas liberados, ranking, totais,
  segredos e conquistas; validado campo a campo e gravado de forma segura;
- **pontuação do ranking** (score, separada dos pontos de compra), como no jogo web;
- **online, o mesmo do jogo web** (Supabase via `HTTPRequest`, funciona também na Web):
  - ranking global por temporada de 15 dias, com abas LOCAL/GLOBAL;
  - conta com usuário e senha (tela CONTA): a senha fica só como hash no servidor, e no
    aparelho fica apenas a sessão (`user://session.json`);
  - save na nuvem mesclado ao entrar e enviado a cada mudança, **compartilhado com a versão web**;
- **conquistas** (as 17 do jogo web), com aviso na HUD e tela CONQUISTAS (progresso, datas,
  estatísticas por mapa e da carreira);
- **power-ups** (como no jogo web): zumbis às vezes soltam Max Ammo, Double Cash, Instant Kill,
  Nuke, Full Heal, Armor (barra azul que absorve o dano), Speed Boost, Carpenter, Fire Sale
  (caixa a 10 em todos os locais das áreas abertas) e o raro Golden Drop (arma especial,
  dinheiro, perk grátis ou Fúria); o boss deixa um Golden Drop e um Max Ammo; cronômetros
  dos efeitos na HUD;
- **arma caída**: ao pegar uma arma com os dois espaços cheios, a arma em mãos cai no chão e
  pode ser pega de volta por 60s (com a munição e as melhorias dela);
- **minimapa** no canto (áreas abertas e fechadas, portas, jogador, zumbis, boss, Mystery Box);
  Tab segurado mostra o mapa grande; liga/desliga e tamanho nas configurações;
- **eventos do mapa** (os 10 do jogo web, com a mesma agenda: sorteio no início do round,
  round mínimo, espera entre repetições, Horda garantida no round 15 e a cada 10): Apagão,
  Alarme de emergência, Horda, Suprimentos (caixa de paraquedas, segurar E), Vazamento de gás
  (válvula), Zumbi Dourado (foge; abatido dá Golden Drop), Lua de Sangue, Desabamento,
  Neblina e o trem, com agenda própria, que atropela quem estiver nos trilhos; indicador na HUD;
- **painéis e armadilhas**: energia (encerra o Apagão), alarme, painel do trem (chama o trem)
  e armadilhas elétricas; estação com túneis, semáforos e painel de horários;
- **missão do Hospital, "O Soro do Dr. Almeida"** (como no jogo web): ligar a energia →
  amostras da UTI, reagente do armário da Farmácia (atire no cadeado) e o catalisador da
  gaveta do Necrotério, que abre com o cartão de um Blindado → defender a centrífuga → o
  Paciente Zero enfurecido num round de boss forçado → aplicar o soro. Prêmio: todos os perks
  e o Canhão de Vento. Objetivo na HUD e no minimapa;
- **segredos**: ursinhos escondidos (todos = Golden Drop e conquista), rádio/gravador com a
  história do mapa e a placa de créditos;
- **sons e música do jogo web**: os 142 sons (293 variações) são os mesmos, sintetizados pelo
  código do jogo web e exportados para WAV (`npm run godot:audio`, na raiz do repositório;
  o Godot comprime em QOA na importação). Tiros, recargas, faca, passos pelo tipo de piso,
  zumbis (gemidos, golpes, mortes, armadura, cuspe), boss, barricadas, máquinas, eventos
  (sirene, gás, trem, avião, caixa), ambiente por área com transição e sons em volta,
  batimento com pouca vida e a música adaptativa em camadas (exploração, round, alta
  intensidade, boss) com vinhetas de vitória e de fim de jogo. Som posicional como no jogo
  web (volume pela distância, pan pela tela) e limite de vozes por categoria, cada uma no
  seu barramento;
- **visual 2.5D em pixel art** (especificação 2.5D pixel): câmera reta como no jogo web
  (inclinada 60°, ~20 m de largura); paredes que abrem um círculo
  pontilhado quando o jogador passa atrás delas; tudo desenhado por código:
  - personagens "Pixar em pixel" (`npm run godot:sprites`): renderizador por pixel de formas
    arredondadas, 6 tons com sombra fria e luz quente, 8 direções na vista da câmera — os 7
    zumbis, o cão, os 2 bosses, o jogador nos 4 visuais e as 19 armas (Mk II e Mk III
    visíveis), com ícones e efeitos em pixel (clarão, faíscas, sangue, explosão, plasma,
    granada, chama, vento);
  - cenário (`npm run godot:scenery`): pisos, paredes, portões das portas e o trem, 41
    objetos 2.5D montados pela PropFactory (caixas, barris, bancos, macas, máquinas de perk
    na cor do perk, Mystery Box com tampa que abre, painéis de alarme, energia, armadilha e
    trem, disjuntor, caixa de suprimentos, geladeira de amostras, cano de gás, entulho...) e
    decoração de parede e de chão espalhada por semente;
  - jogador com cotovelos e duas posturas: fuzil (mão no cabo, a outra sob o cano) e pistola
    (as duas mãos juntas); a faca aparece na mão no golpe; a arma é desenhada junto com o
    corpo (a mão cobre o cabo) e a folha grava a ponta do cano, de onde sai o tiro;
  - tiros como balas luminosas que voam até o alvo (faíscas quando chegam), raio e vento em
    feixe; cuspe ácido, poças borbulhando, nuvem de gás, onda de choque e marcas no chão em
    pixel; power-ups com os ícones do jogo web; personagens puxados para perto da câmera no
    shader (pernas não entram no chão nem nos objetos);
- **luz por área**: a luz ambiente acompanha a área do jogador (bem iluminada, meia-luz ou
  escura, do mapa), quente nas salas iluminadas e funda nas escuras, com vinheta que acompanha;
  **lanterna** que liga e desliga (F), com aviso na HUD e dica ao entrar no escuro sem ela;
  luminárias que falham piscando e as quebradas soltando faíscas;
- **menu de pausa** com CONTINUAR, REINICIAR, MENU e as configurações que valem na hora;
- **visuais do personagem** (tela PERSONAGEM): Sobrevivente, Enfermeiro, Maquinista e Agente,
  liberados por conquistas, com as cores da paleta do jogo web;
- **código Konami** no menu (↑↑↓↓←→←→BA): libera o modo cabeção;
- **anti-trapaça**: ganho impossível para o round ou pontos/score alterados por fora invalidam a
  partida, com zoeira na tela, e ela não vale save nem ranking;
- **tela de fim**: estatísticas, recorde, nome no ranking e botões de jogar de novo, ranking e
  menu;
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
- os 8 inimigos do jogo web, com comportamento e aparência próprios (provisória, em blocos):
  - Walker e Runner;
  - Tank: grande e não é empurrado;
  - Exploder: arma e explode perto do jogador e ao morrer;
  - Rastejante: baixo, deixa gás ao morrer;
  - Cuspidor: cospe ácido de longe, que vira poça;
  - Blindado: a armadura absorve 75% no corpo, e o headshot derruba o capacete;
  - Cão Infernal: não deixa corpo.
- composição por round e por mapa, com limite de vivos por tipo; zumbi preso é realocado;
- rodada dos cães no Hospital: rounds 5, 11, 17…, raios perto do jogador, névoa, munição cheia
  no último cão;
- bosses no round 10, 20, 30: The Conductor (Terminal) e Paciente Zero (Hospital):
  - 4 fases com rugido invulnerável;
  - golpe e investida (atordoado se bater na parede);
  - The Conductor: onda de choque, invocação e círculos que explodem;
  - Paciente Zero: vômito ácido, grito que deixa lento e chuva de ácido;
  - escolta reduzida; barra de vida na HUD;
- rounds cada vez mais difíceis, pontos, HUD, pausa, fim de jogo e reinício.

## Como abrir e jogar

1. Godot **4.7.2** (versão padrão, sem .NET): https://godotengine.org. Nesta máquina ele está em
   `E:\Tools\Godot\`.
2. Abrir o `project.godot` desta pasta no Godot (ou `Godot --path godot` na raiz do repo).
3. F5 abre o menu (`scenes/ui/main_menu.tscn`); a partida é `scenes/main.tscn`, que carrega o
   mapa escolhido.

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
| Lanterna (liga/desliga) | F | direcional ↑ |
| Mapa grande | segurar Tab | Back |
| Pausar | ESC / P | Start |

Já mapeado para as próximas fases: pular (Espaço / B).

## Migração do jogo web

Sons: `npm run godot:audio` gera os WAV de `assets/audio/` com o mesmo código de síntese do
jogo web. Arte: `npm run godot:sprites` (personagens, armas, ícones e efeitos) e
`npm run godot:scenery` (pisos, paredes, objetos e decoração), tudo gerado por código em
`scripts/godot/pixel/`.

Os dados não são copiados à mão: `npm run godot:data` (na raiz do repositório) lê as configs
reais do jogo web (`src/config`) e gera os `.tres` de `data/`:
- as 19 armas e a faca;
- o jogador;
- as fórmulas dos rounds e a economia;
- os 8 tipos de zumbi e as habilidades deles, a composição por round e a rodada dos cães;
- os 2 bosses, com cada ataque;
- barricadas, Mystery Box, Weapon Lab, os 7 perks, energia e o catálogo de armas;
- a pontuação do ranking e o catálogo de mapas (nomes, descrições, desbloqueio);
- online (servidor, temporada, regras de usuário e senha) e anti-trapaça;
- conquistas e visuais (as cores saem de `scripts/art/characters.mjs`);
- power-ups, eventos do mapa, painéis e armadilhas, segredos e a missão do Soro;

Os **mapas** são só do Godot (o jogo web continua com os dele): `npm run godot:maps` gera
`data/maps/terminal.json` e `map2.json` a partir da DSL em `scripts/godot/maps/` (um arquivo
por mapa: `room`, `solid`, `door`, `window`, `spawn`, `weapon`, `perk`, `lamp`, `prop`...).
O gerador confere o desenho (tudo em chão, portas ligando as áreas certas, toda área alcançável)
e grava uma prévia em `build/maps/<id>.png`. Além da grade, áreas, portas, janelas, spawns,
máquinas, luzes e objetos, cada mapa traz a luz por área (`lit`, `dim`, `dark`), luminárias
quebradas, a densidade da decoração por área e, no Hospital, as posições da missão do Soro.
Os ids dos mapas e das áreas são os do jogo web (save, ranking, som ambiente e missão).

Conversão: 32 px = 1 m, ms → s. O script é `scripts/godot/export-data.ts`. Enquanto o jogo web
for a referência, mude os valores lá e rode de novo. Quando o Godot virar a fonte, os `.tres`
passam a ser editados direto no Godot.

## Testes

```sh
# Sistemas isolados, sem janela (vida, headshot, munição e recarga, fórmulas dos rounds,
# escolha do ponto de spawn, pontos, inventário, giro da minigun, dados migrados, os dois
# mapas com portas, barricadas, compras, máquinas e navegação, sorteio da caixa, Weapon Lab,
# perks, composição por round, rodada dos cães) e, na mesma execução, os testes de cena: as
# 5 armas especiais, cada tipo de zumbi, a rodada dos cães, os dois bosses nos mapas migrados
# as telas de menu, os power-ups, a arma caída, o minimapa, a pausa e os eventos, painéis,
# armadilhas e segredos, a missão do Soro de ponta a ponta, o áudio e os sprites; e o online contra o servidor real, só com operações que não gravam
# (ler o ranking, envio recusado, login errado). Os testes usam um save de teste (o do
# jogador não muda) e o bot joga offline (não envia nada ao ranking global):
Godot --headless --path godot -s res://tests/run_tests.gd
# Uma suíte só (unit, weapons, zombies, bosses, menus, powerups, match, events, quest, audio, models, online):
Godot --headless --path godot -s res://tests/run_tests.gd -- --only=events

# Jogado (abre uma janela), no Terminal migrado: um bot joga até o round 3 e confere
# navegação, ataque, abates na cabeça e no corpo, compra de porta, compras na parede,
# barricadas (quebra e conserto), Mystery Box, Weapon Lab, energia, perks, Quick Revive,
# troca de arma, chumbos, faca, pontos, limite de vivos, Fire Sale, morte, nome no ranking, recordes
# gravados e reinício.
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
scripts/systems/save_store.gd    autoload Save: save no formato do jogo web (+ mesclagem da nuvem)
scripts/systems/session.gd       autoload Session: mapa escolhido para a partida
scripts/main.gd                  troca o mapa da partida pelo escolhido
scripts/online/                  autoloads Online (cliente REST) e Account (conta e nuvem),
                                 Leaderboard (ranking global), AntiCheat
scripts/ui/                      HUD (fim de jogo com ranking), Minimap, PauseMenu, SettingsRows
                                 (configurações do menu e da pausa), MenuKit e as telas de menu
scripts/systems/input_bindings.gd autoload InputBindings: ações abstratas (teclado, mouse, controle)
scripts/components/              HealthComponent, Hurtbox (corpo/cabeça), DamageInfo
scripts/characters/              CharacterBase (CharacterBody3D + vida por composição)
scripts/player/                  Player + PlayerData (movimento, mira, tiro, faca, regeneração),
                                 TopDownCamera
scripts/zombies/                 ZombieBase (perseguir → atacar → morto, NavigationAgent3D),
                                 ZombieData, ZombieFactory, ZombieAbilities (explosão, cuspe,
                                 armadura, gás), HazardPool (poças/nuvens), Boss + BossData +
                                 BossAttacks
scripts/weapons/                 Weapon (munição, recarga, raycast, chumbos, perfuração, giro),
                                 WeaponData, WeaponInventory (2 espaços), Melee + MeleeData (faca),
                                 WeaponUpgrade (Mk II/III), WeaponCatalog, SpecialFire +
                                 WeaponProjectile (granada, plasma, chama, raio, vento)
scripts/systems/                 PerkSystem (modificadores dos perks), PowerSystem (energia),
                                 BossManager (round de boss), ScoreManager (score do ranking),
                                 AchievementSystem (conquistas), PowerUpSystem +
                                 PowerUpData (power-ups), MinimapFeed (minimapa),
                                 RoundManager + RoundData, SpawnManager, PointsManager +
                                 PointsData, GameManager, AudioManager (sons da partida e música adaptativa)
scripts/maps/                    GameWorld (base: spawn do jogador, áreas abertas, spawns ativos),
                                 LayoutMap (mapa do JSON gerado pela DSL), Arena (mapa de teste),
                                 StationBoard (túneis, semáforos, horários do trem)
scripts/characters/character_sprite.gd CharacterSprite: folha de pixel art, 8 direções, animações
scripts/maps/prop_factory.gd     PropFactory: objetos 2.5D a partir das receitas (props.json)
scripts/weapons/pixel_fx.gd      PixelFx: efeitos e decalques em pixel art
scripts/audio/audio_service.gd   autoload Audio: catálogo, play/play_at/loop_at, vozes, barramentos
scripts/quests/                  QuestSystem (etapas, HUD, minimapa), QuestStep, QuestSpot,
                                 SerumQuest (missão do Hospital), QuestData
scripts/events/                  WorldEventSystem (agenda), WorldEvent + um arquivo por evento
                                 (Apagão, Alarme, Horda, Suprimentos, Gás, Zumbi Dourado, Lua de
                                 Sangue, Desabamento, Neblina, Trem), WorldEventData, EventFx
scripts/interactables/           tudo que se usa com E (grupo "interactable"): Door, Barricade,
                                 WallBuy, MysteryBox, WeaponLab, PerkMachine, Breaker, WeaponDrop,
                                 MapPanel → EventSwitch/TrainPanel/ElectricTrap, e os segredos
                                 Teddy, LoreRadio e CreditsSign (+ os Resources de dados)
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

- **HUD em fonte pixel** (fonte gerada por código, barras e molduras no estilo da referência).
- **Fase 8 (plataformas):** exportações e controles de toque.
