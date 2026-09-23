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
| R | recarregar |
| M | ligar/desligar o som |
| ESC / P | pausar (também pausa sozinho se a janela perde o foco) |
| E | comprar (arma, munição, porta, perk, Mystery Box, Weapon Lab) |
| segurar E | reparar barricada (+$10 por tábua) |
| Q / 1 / 2 / roda do mouse | trocar de arma |

## Estrutura

```
scripts/
  generate-art.mjs   gera toda a arte vetorial original (personagens, cenário, props, decals)
  art/               desenho procedural dos sprites (SVG, escala 2x, vista de cima)
src/
  main.ts            ponto de entrada (cria o Phaser.Game)
  config/            valores de gameplay e visual (game, player, weapons, zombies, spawn, visual, assets)
  game/events.ts     eventos globais tipados (lógica → HUD)
  scenes/            Boot → Preload (carrega SVGs, fatia frames, cria animações) → Menu → Game (+ UI)
  map/               TerminalMap (grade, colisão, navegação, visual 3/4) e terminal/layout.ts
                     (áreas, portas, janelas, spawns, props, luzes do Terminal Central)
  entities/          Player (tronco + pernas), Zombie (Walker, Runner, Tank, Exploder), Projectile,
                     Boss (The Conductor), BuyStations (maletas, munição), Door, Barricade,
                     Machines (Mystery Box, Weapon Lab, máquinas de perk), Damageable
  weapons/           Weapon (estado/munição/recarga) e WeaponSystem (inventário de 2 armas, disparo)
  audio/             som 100% sintetizado em código: dsp.ts (síntese), recipes/ (armas, criaturas,
                     mundo, interface, ambientes), SoundBank (catálogo), AudioSystem (reprodução)
  effects/           LightingSystem (escuridão, lanterna, luzes), EffectsSystem (sangue, cadáveres,
                     cápsulas, faíscas), fxTextures (texturas de luz/partículas em canvas)
  systems/           WaveSystem, SpawnSystem, difficulty (fórmulas), EconomySystem, InteractionSystem,
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
- [ ] Fase 9 — Eventos (blackout, trem, horda, supply drop, gás, alarme)

Observações:
- Waves seguem as fórmulas do GDD §32 (`src/config/waves.config.ts`).
- Economia em `src/config/economy.config.ts`: $500 iniciais, $100 por Walker, +$50 por headshot
  (1,5× de dano), bônus de wave $300 + $50 × wave. Armas e preços em `weapons.config.ts`.
- Comprar numa maleta de arma que você já tem compra munição dela (metade do preço).
- Vida regenera devagar após 5s sem levar dano.
- Mapa: Hall Central (início), Plataforma Norte com trem (um vagão aberto), Bilheteria, Lojas,
  Área Técnica, Túneis e Manutenção. Portas pagas liberam as áreas e os spawns delas.
- Zumbis do Hall, Bilheteria e Lojas surgem do lado de fora e entram quebrando as barricadas.
- Navegação: perseguição direta quando o zumbi enxerga o jogador; senão, caminho A* (portas e
  janelas consideradas). Zumbis parados por 12s fora da tela são realocados.
- Escuridão varia por área (túneis quase sem luz).
- Mystery Box ($950, Hall): sorteia por raridade (40/28/17/11/4%). Arma repetida vira munição.
  Exclusivas da caixa (não vendidas nas maletas):
  - RPK (épica) e Rail Weapon (lendária, atravessa zumbis);
  - Grenade Launcher (épica): granadas que explodem no impacto (dano em área, não ferem você);
  - Flamethrower (épica): jato curto e contínuo que incendeia (dano ao longo do tempo);
  - Arc Gun (épica): raio instantâneo que salta entre até 5 zumbis próximos e os atordoa;
  - Energy Cannon (lendária): esfera de plasma que atravessa a horda e explode numa descarga.
  O Weapon Lab também fortalece a mecânica especial (explosão maior, fogo mais forte, +3 saltos).
- Weapon Lab ($5000, Manutenção): arma em mãos vira "Mk II" (mais dano, pente, recarga).
- Perks (`src/config/machines.config.ts`): Fortify, Quick Hands, Sprint+, Deadeye,
  Adrenaline e Overload, uma máquina por área.
- Power-ups (`src/config/powerups.config.ts`): 5% de drop por abate (máx. 4 por wave) — Max Ammo,
  Double Cash, Instant Kill, Nuke, Full Heal, Armor, Speed Boost — e 0,5% de Golden Drop
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
