# Tentando Sobreviver

Survival shooter top-down de zumbis por ondas, para navegador.
Especificação completa: GDD (`Terminal_Outbreak_GDD_v0.1.md`).

Stack: TypeScript + Phaser 3 + Vite.

## Comandos

```bash
npm install        # dependências
npm run dev        # servidor de desenvolvimento (http://localhost:5173)
npm run typecheck  # checagem de tipos
npm run build      # typecheck + build de produção em dist/
npm run preview    # serve o build de produção
npm run art        # regera a arte SVG em public/assets
```

## Controles

| Tecla | Ação |
|---|---|
| WASD | mover (de lado 85% e de costas 60% da velocidade, em relação à mira) |
| Mouse | mirar |
| Clique esquerdo | atirar (M1911 é semiautomática) |
| V / botão direito | faca: avança até o zumbi à frente e corta em arco (abate na faca paga +$60) |
| R | recarregar |
| M | ligar/desligar o som |
| N | ligar/desligar só a música |
| ESC / P | pausar (também pausa sozinho se a janela perde o foco) |
| E | comprar (arma, munição, porta, perk, Mystery Box, Weapon Lab) |
| segurar E | reparar barricada (+$10 por tábua), comprar o elemento da arma na maleta dela, usar painéis do mapa |

**Celular / tablet** (detectado automaticamente; jogue na horizontal — em pé aparece um aviso):

| Controle | Ação |
|---|---|
| Analógico esquerdo (toque na metade esquerda) | mover (empurrar pouco = andar devagar) |
| Analógico direito (metade direita) | só gira a lanterna (sem ele, a lanterna segue o movimento) |
| ATIRAR (botão grande) | atira para onde a lanterna aponta, com mira assistida (puxa de leve para o zumbi mais perto dentro do cone da lanterna) |
| USAR | comprar/usar; segurar = ações de "SEGURE E" |
| RECARR. / TROCAR | recarregar / trocar de arma |
| FACA | golpe de faca |
| II | pausar |

Ao começar uma partida no celular o jogo entra em tela cheia. Não há mira na tela: o tiro sai sempre
na direção da lanterna. Os controles de toque também ligam sozinhos no primeiro toque na tela.

## Armas: Mk III e elementos

- **Weapon Lab**: Mk II ($5.000) e depois **Mk III** ($10.000) — o Mk III dobra os projéteis de
  qualquer arma (espingardas 2× chumbos, Arc Gun 2 raios, lançador 2 granadas), traçante dourado.
- **Elementos** (`src/config/elements.config.ts`): cada arma de maleta tem o seu, comprado
  **segurando E** na maleta da própria arma (tocar E continua comprando munição). O da M1911 é
  vendido na caixa de munição do Hall. O elemento continua depois do Mk II/III.

| Arma | Elemento | Efeito |
|---|---|---|
| M1911 | ☀ Luz | atordoa e causa +50% de dano no boss |
| Glock | ☾ Sombra | cada acerto cura um pouco o jogador |
| MP5 / Combat Shotgun | ❄ Gelo | deixa lento e às vezes congela |
| Vector | ⚡ Raio | salta para 2 zumbis próximos |
| M4 / Pump | 🔥 Fogo | incendeia (dano ao longo do tempo) |
| AK | 💥 Explosivo | pequena explosão no acerto (não fere você) |

## Plataforma Norte (estação)

- De cima para baixo: trilho de trás com o trem parado (um vagão aberto com a Combat Shotgun),
  a **ilha** entre os trilhos, o **trilho da frente** — por onde o trem passa, bem à vista de quem
  está na plataforma — e a plataforma principal, ligada ao Hall.
- Os zumbis da Plataforma saem das bocas de túnel nas pontas dos trilhos (e podem ser atropelados).
- **Painel de horários**: contagem do próximo trem, "TREM CHEGANDO" e "TREM PASSANDO".
- **Semáforos** nas pontas: verdes; vermelho piscando no aviso e vermelho fixo na passagem.
- Ao passar, o trem mostra quantos zumbis atropelou e o deslocamento de ar empurra quem está
  na beira da plataforma (sem dano). Parado nos trilhos, o jogador é atropelado.

## Tela e resolução

- O zoom da câmera se ajusta à janela (largura e altura): qualquer resolução, de 720p a 4K ou
  ultrawide, mostra o mesmo pedaço do mapa. HUD e menus crescem junto em telas com mais de 900 px
  de altura (`uiConfig` em `src/config/visual.config.ts`).

## Interações e segredos no mapa

- **Painel de energia** (Área Técnica): durante um Apagão, segure E ($500) para religar a luz.
- **Botão do alarme** (Hall): durante o Alarme de Emergência, segure E ($750) para desligar.
- **Painel do trem** (Plataforma): $1.500 chama o trem na hora (recarga de 90s).
- **Armadilhas elétricas** (Hall, logo abaixo da porta da Plataforma, e corredor de baixo dos
  Túneis): $1.000 eletrifica a grade por 15s matando os zumbis que passam; recarga de 45s.
- **Válvula do gás**: no Vazamento de Gás, segure E no cano para fechar a válvula.
- Segredos (spoiler): 3 ursinhos escondidos em cantos escuros (achar os 3 toca uma canção e solta
  um Golden Drop), um rádio velho na Manutenção que conta a história do terminal, a placa perto da
  Plataforma e o código Konami no menu (↑↑↓↓←→←→BA, ou tocar 10 vezes no título no celular), que
  libera o "modo cabeção" em Configurações.

## Menus, minimapa e configurações

- **ARMAS**: catálogo das 14 armas com raridade, atributos, onde conseguir (maleta e área, arma
  inicial ou só na Mystery Box), mecânica especial, versões Mk II/Mk III e o elemento.
- **CONFIGURAÇÕES**: volume geral, som, música, minimapa, tremor de tela, controles de toque
  (automático/sempre/nunca), tela cheia, estatísticas acumuladas e apagar progresso.
- **Minimapa** no canto superior esquerdo: áreas abertas (claras) e trancadas (escuras), portas
  fechadas (laranja), você (seta amarela), zumbis (vermelho), boss, Mystery Box (dourado) e
  suprimentos (verde).
- O boss sempre surge no centro do Hall Central (no ponto mais longe de você).

## Mapas, save e ranking

- Menu → JOGAR abre a escolha de mapa. O **Mapa 2** fica trancado até você derrotar o boss da
  wave 10 no Terminal Central (o conteúdo dele ainda está em desenvolvimento).
- Save local no navegador (`src/save/SaveStore.ts`, chave `ts-save-v1`): som/música, nome,
  recordes por mapa, mapas liberados, ranking e totais (partidas, abates, bosses, tempo).
  Dados antigos (recordes e som) são migrados automaticamente.
- Ranking por mapa (top 10) em Menu → RANKING. Se a pontuação entrar no top, a tela de Game Over
  pede o nome. O ranking é deste navegador/aparelho (não é online).
| Q / 1 / 2 / roda do mouse | trocar de arma |

## Estrutura

```
scripts/
  generate-art.mjs   gera toda a arte vetorial original (personagens, cenário, props, decals)
  art/               desenho procedural dos sprites (SVG, escala 2x, vista de cima); undead.mjs
                     desenha os zumbis (anatomia, roupas, rostos) e boss.mjs o The Conductor
src/
  main.ts            ponto de entrada (cria o Phaser.Game)
  config/            valores de gameplay e visual (game, player, weapons, zombies, spawn, visual, assets)
  game/events.ts     eventos globais tipados (lógica → HUD)
  scenes/            Boot → Preload (carrega SVGs, fatia frames, cria animações) → Menu → MapSelect /
                     Ranking / Armory / Settings → Game (+ UI)
  map/               TerminalMap (grade, colisão, navegação, visual 3/4) e terminal/layout.ts
                     (áreas, portas, janelas, spawns, props, luzes do Terminal Central)
  entities/          Player (tronco + pernas), Zombie (Walker, Runner, Tank, Exploder), Projectile,
                     Boss (The Conductor), BuyStations (maletas, munição), Door, Barricade,
                     Machines (Weapon Lab, máquinas de perk), MysteryBox (sorteio e troca de lugar),
                     Damageable
  weapons/           Weapon (estado/munição/recarga) e WeaponSystem (inventário de 2 armas, disparo)
  audio/             som 100% sintetizado em código: dsp.ts (síntese), recipes/ (armas, criaturas,
                     mundo, interface, ambientes), SoundBank (catálogo), AudioSystem (reprodução)
  effects/           LightingSystem (escuridão, lanterna, luzes), EffectsSystem (sangue, cadáveres,
                     cápsulas, faíscas), fxTextures (texturas de luz/partículas em canvas)
  events/            eventos dinâmicos (WorldEvent + um arquivo por evento: Blackout, Alarm, Train,
                     Horde, SupplyDrop, GasLeak)
  ui/                componentes da HUD (EventHud, DamageOverlay, GameOverOverlay, TouchControls,
                     MiniMap, menuWidgets)
  input/             toque no celular (touchInput: estado dos analógicos/botões; device)
  save/              SaveStore (save local versionado)
  systems/           EventSystem (sorteio e ciclo dos eventos), StatsSystem (estatísticas e recordes),
                     ScoreSystem (pontuação), ProgressSystem (libera mapas), MinimapFeed, WaveSystem, SpawnSystem, difficulty (fórmulas), EconomySystem, InteractionSystem,
                     CombatSystem (inclui headshot), CameraController, pathfinding/NavGrid (A*),
                     PerkSystem (modificadores de perks), PowerUpSystem (drops e efeitos),
                     BossSystem (ciclo do boss), pathfinding/PathFollower (navegação comum)
public/assets/       arte gerada (SVG) — pode ser trocada por PNGs com o mesmo layout de frames
```

## Visual

- Câmera top-down próxima com zoom adaptado à janela e deslocamento na direção da mira.
- Vista 3/4: paredes mostram a face frontal, e tudo é ordenado por profundidade (Y).
- Iluminação: ambiente escuro, lanterna em cone, luminárias defeituosas, clarão dos disparos.
- Pós-processamento (WebGL): vinheta e cores dessaturadas.
- Ajustes em `src/config/visual.config.ts`.

## Áudio

Todos os sons são **sintetizados em código** durante o carregamento (sem arquivos de áudio):
- Tiro próprio para cada arma, recarga por tipo, tiro seco, troca de arma, cápsulas no chão.
- Passos que mudam com o piso (pedra, concreto, brita, metal, chão molhado, borracha).
- Vozes por formantes: gemido, ataque e morte de Walker, Runner, Tank e Exploder; rugido,
  investida, pancada, invocação e morte do boss; dor, morte e batimento cardíaco do jogador.
- Ambiente em loop por área (com transição suave) e sons pontuais aleatórios (estrondos,
  gemidos distantes, gotas, buzina de trem, vapor).
- Interface: compra, recusa, Mystery Box (caixinha de música), Weapon Lab, perks, power-ups,
  início/fim de wave e sirene do boss.
- Áudio posicional (volume por distância e pan) e limite de vozes por categoria
  (`src/config/audio.config.ts`). Qualquer som pode ser trocado por um arquivo real depois.
- Música adaptativa (GDD §58), também sintetizada: quatro camadas de 8 compassos em ré menor
  tocando juntas e sincronizadas — exploração (acordes e drone), wave normal (baixo pulsando),
  alta intensidade (bateria e arpejo; com 12+ zumbis vivos, vida baixa, Horda ou Alarme) e boss
  (riff pesado com trítono). As camadas entram e saem por volume (`MusicSystem`); vinhetas de
  vitória (fim de wave, boss derrotado) e de Game Over. Tecla N liga/desliga só a música.

## Status

- [x] Fase 0 — Setup
- [x] Fase 1 — MVP Core (player, câmera, tiro, M1911, Walker, dano, morte, reinício)
- [x] Passe visual (arte original, iluminação, câmera, efeitos) — antecipado da Fase 10
- [x] Fase 2 — Waves (WaveSystem, SpawnSystem, dificuldade progressiva, HUD de wave)
- [x] Fase 3 — Economia (dinheiro, headshot, 8 armas, compras, munição)
- [x] Fase 4 — Mapa Terminal Central (7 áreas, portas, barricadas, spawn por área, A*)
- [x] Fase 5 — Máquinas (Mystery Box, Weapon Lab, 6 perks)
- [x] Fase 6 — Power-ups (7 comuns + Golden Drop, armadura)
- [x] Fase 7 — Inimigos (Runner, Tank, Exploder, composição por wave)
- [x] Fase 8 — Boss (The Conductor, 4 fases, 5 ataques)
- [x] Fase 9 — Eventos (blackout, trem, horda, supply drop, gás, alarme)
- [x] Fase 10 — Visual (props do §52, animações de dano/morte, partículas, HUD de dano, Game Over)
- [x] Fase 11 — Áudio (música adaptativa; armas, zumbis, ambiente, boss e eventos já sintetizados)
- [x] Fase 12 — Balanceamento (testado com bots; ver abaixo)

Observações:
- Balanceamento (Fase 12): medido com bots que jogam de verdade no navegador (mira perfeita e
  mira de jogador comum), compram armas/perks entre as waves e registram duração, dano sofrido e
  dinheiro por wave. Resultado antes dos ajustes: waves 1–6 tranquilas (aprendizado), dano a
  partir da 7, boss da wave 10 em ~1 min tirando 120–200 de vida — e waves 11+ triviais, porque
  o jogador já tem perks e Mk II. Ajustes: +6% de vida extra por wave a partir da 10, até 30
  zumbis vivos, spawn mais rápido no fim, mais Runners/Tanks nas waves 11+ e 16+; espingardas
  mais fortes (Pump 20 × 8 chumbos, Combat 16 × 7) e com recarga menor. Wave 15 tem Horda
  garantida (GDD §31).
- Visual (Fase 10): props novos do GDD §52 (extintores, carrinhos de bagagem, paletes, placas de
  saída luminosas, mesas com computador, cadeiras, armários, barreiras, cabos, tubulação, vitrines);
  zumbis recuam ao levar tiro e os corpos tombam; o jogador tranca ao levar dano e cai ao morrer
  (câmera se aproxima); bordas da tela piscam em vermelho no dano e pulsam com vida baixa; anel e
  faíscas ao pegar power-up; poeira na pancada do boss.
- Game Over (GDD §63–64): wave, abates, headshots, dinheiro, tempo, bosses, dano, disparos/acertos,
  precisão, power-ups e score. Recorde (pontuação, melhor wave e abates) salvo no navegador e
  mostrado no menu.
- Score (`src/config/score.config.ts`): abates por tipo (valendo +10% a cada wave), headshot,
  abate a queima-roupa, sequência de abates (MULTI x3...), wave completa, boss e power-ups. Mortes
  por explosão, Nuke, trem ou gás valem metade.
- Eventos (`src/config/events.config.ts`): a partir da wave 2, cada wave tem 60% de chance de um
  evento (um por vez, nunca em wave de boss), sorteado por peso, com wave mínima e cooldown:
  - Apagão: luzes piscam e apagam por 25s; só a lanterna e as luzes de emergência ficam.
  - Alarme de Emergência: luzes vermelhas, sirene e spawn 2× mais rápido por 20s.
  - Trem: aviso (buzina, faixa vermelha) e um trem cruza a faixa livre dos trilhos da Plataforma,
    matando os zumbis nela e ferindo quem estiver nos trilhos. Tem sorteio próprio e roda junto
    com os outros eventos: com a Plataforma aberta, 65% das waves têm trem (e 40% de chance de
    passar de novo na mesma wave).
  - Horda: +60% de zumbis na wave, chegando mais rápido.
  - Suprimentos: uma caixa cai de paraquedas (sinalizador vermelho); segure E por 3s para abrir
    (levar dano zera a barra): munição cheia, armadura e $750. Some em 60s.
  - Vazamento de Gás: nuvem verde perto do jogador que fere quem ficar dentro (jogador e zumbis).
  - Zumbi Dourado: um zumbi brilhante e rápido que foge de você; matá-lo em 20s dá $1.000 e um
    Golden Drop.
  - Lua de Sangue: 25s de luz vermelha, zumbis 30% mais rápidos e dinheiro/score em dobro.
  - Desabamento: pedaços do teto caem perto de você (círculo vermelho de aviso) e ferem quem
    estiver embaixo, zumbis também.
  - Neblina: 25s com escuridão extra, lanterna mais curta e névoa.
  Mortes por trem/gás não pagam nem soltam power-ups. HUD: anúncio + indicador com tempo no topo.
- Waves seguem as fórmulas do GDD §32 (`src/config/waves.config.ts`).
- Economia em `src/config/economy.config.ts`: $500 iniciais, $100 por Walker, +$50 por headshot
  (1,5× de dano), bônus de wave $300 + $50 × wave. Armas e preços em `weapons.config.ts`.
- Comprar numa maleta de arma que você já tem compra munição dela (metade do preço).
- Vida regenera devagar após 5s sem levar dano.
- Mapa: Hall Central (início), Plataforma Norte (dois trilhos, ilha e trem parado com um vagão aberto), Bilheteria, Lojas,
  Área Técnica, Túneis e Manutenção. Portas pagas liberam as áreas e os spawns delas.
- Zumbis do Hall, Bilheteria e Lojas surgem do lado de fora e entram quebrando as barricadas.
- Navegação: perseguição direta quando o zumbi enxerga o jogador; senão, caminho A* (portas e
  janelas consideradas). Zumbis parados por 12s fora da tela são realocados.
- Escuridão varia por área (túneis quase sem luz).
- Mystery Box ($950, começa no Hall): sorteia por raridade (22/26/25/19/8% — armas boas saem com
  frequência). Arma repetida vira munição. A cada 3 usos ela treme, some e reaparece em outro
  local do mapa — 4 pontos no Hall e 1 em cada outra área, inclusive áreas ainda fechadas (aí é
  preciso abrir a porta para alcançá-la). Aviso na tela, coluna de luz e marcador no minimapa.
  Exclusivas da caixa (não vendidas nas maletas):
  - RPK (épica) e Rail Weapon (lendária, atravessa zumbis);
  - Grenade Launcher (épica): granadas que explodem no impacto (dano em área, não ferem você);
  - Flamethrower (épica): jato curto e contínuo que incendeia (dano ao longo do tempo);
  - Arc Gun (épica): raio instantâneo que salta entre até 5 zumbis próximos e os atordoa;
  - Energy Cannon (lendária): esfera de plasma que atravessa a horda e explode numa descarga.
  O Weapon Lab também fortalece a mecânica especial (explosão maior, fogo mais forte, +3 saltos).
- Weapon Lab ($5000, Manutenção): arma em mãos vira "Mk II" (mais dano, pente, recarga).
- Perks (`src/config/machines.config.ts`): Fortify, Quick Hands, Sprint+, Deadeye,
  Adrenaline e Overload, uma máquina por área, e **Quick Revive** ($1500, no Hall): ao cair você
  fica 3s no chão (sem levar dano) e levanta com a vida cheia empurrando os zumbis em volta. O perk
  se gasta e pode ser comprado até 3 vezes por partida.
- Power-ups (`src/config/powerups.config.ts`): 5% de drop por abate (máx. 4 por wave) — Max Ammo,
  Double Cash, Instant Kill, Nuke, Full Heal, Armor, Speed Boost, Carpenter (conserta todas as
  barricadas e paga $200) — e 0,5% de Golden Drop
  (arma especial, $2000, perk grátis ou Fúria). Somem após 30s. Armadura absorve dano antes da vida.
- Inimigos (`src/config/zombies.config.ts`): Walker; Runner (rápido); Tank (600 HP, maior, arranca
  2 tábuas por golpe, não é empurrado); Exploder (arma a explosão perto do jogador e explode ao
  morrer — abatido a tiro, as mortes na explosão contam para você). Composição por wave em
  `waves.config.ts`: Runners a partir da wave 3, Tanks da 6, Exploders da 11.
- Boss (`src/config/bosses.config.ts`): The Conductor nas waves 10, 20 e 30, com escolta reduzida.
  Fases 100–75% (golpe + investida), 75–50% (+ onda de choque), 50–25% (+ invoca zumbis) e
  Rage Mode (+ ataque em área; a arena escurece com luzes vermelhas). Investida contra a parede
  deixa o boss atordoado. Recompensa: $2000, Golden Drop e Max Ammo.
- Em modo dev, `window.__GAME__` expõe a instância do jogo para depuração.
