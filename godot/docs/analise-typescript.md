# Análise do projeto TypeScript (seção 43 da especificação)

O jogo web atual (`src/`, Phaser 3 + TypeScript, no ar no GitHub Pages) é a **referência de
conceitos** do projeto Godot. Nada é convertido linha a linha: cada item abaixo diz o que
aproveitar e como ele vira algo natural no Godot.

**Legenda:**
- **REAPROVEITAR CONCEITO:** a regra ou fórmula vale igual; a implementação é nova.
- **ADAPTAR:** a ideia fica, mas muda de forma por causa do 3D, dos nós ou dos Resources.
- **REIMPLEMENTAR:** o sistema é refeito com as ferramentas do Godot.
- **DESCARTAR:** existe só por causa do Phaser/web e não vai para o Godot.

**Escala:** 32 px do jogo TS equivalem a 1 m no Godot (um tile = 1 m).

## Fluxo de jogo

| Item TS | Classificação | No Godot |
|---|---|---|
| Menu → escolha de mapa → partida → Game Over → ranking | ADAPTAR | Cenas: `main_menu`, `main` (partida) e `game_over` na HUD. Na Fase 1 a partida já abre direto |
| Pausa (ESC, perda de foco) | REAPROVEITAR CONCEITO | `get_tree().paused` com `process_mode` na HUD |
| Waves com espera e intervalo (`WaveSystem`) | REAPROVEITAR CONCEITO | `RoundManager` com fases espera → ativo → intervalo |

## Fórmulas e dados (os valores mais úteis)

| Item TS | Classificação | No Godot |
|---|---|---|
| `difficulty.ts` + `waves.config.ts`: total = 6 + 3×wave; vida +12%/wave (+6% extra a partir da 10); dano +8%; velocidade +1,5%; intervalo de spawn 1,8s −0,12s/wave (mín. 0,4s); máx. vivos 8 +1,75/wave (teto 30) | REAPROVEITAR CONCEITO | `RoundData` (Resource) + funções puras no `RoundManager`. A wave 1 tem 9 zumbis, como no jogo atual |
| Composição por wave (pesos por tipo e por mapa) | REAPROVEITAR CONCEITO | Fase 4: `RoundData.composition` (tabela de pesos) usada pela `ZombieFactory` |
| `zombies.config.ts` (Walker: 100 de vida, 10 de dano, 60 px/s, ataque a 30 px a cada 1s, $100) | REAPROVEITAR CONCEITO | `ZombieData` (`walker.tres`): 100 de vida, 10 de dano, 1,9 m/s, alcance 1,1 m, 1s, 100 pontos |
| Runner, Tank, Exploder, Crawler, Spitter, Blindado, Cães | REAPROVEITAR CONCEITO | Fase 4/6: novas `ZombieData` + cenas herdadas de `ZombieBase` |
| `weapons.config.ts` (M1911: 35 de dano, 250 ms, pente 8, reserva 80, recarga 1,4s, spread 2°, alcance 700 px) | REAPROVEITAR CONCEITO | `WeaponData` (`m1911.tres`): alcance 22 m, cadência 4 tiros/s |
| Outras 13 armas, Mk II/III, elementos | REAPROVEITAR CONCEITO | Fase 6: mais `WeaponData`. Mk e elementos viram modificadores (Resources) aplicados na arma |
| `economy.config.ts` (início $500, headshot +50, faca +60, bônus de wave 300 + 50×wave) | REAPROVEITAR CONCEITO | `PointsData` + `PointsManager` |
| `score.config.ts` (score separado do dinheiro) | ADAPTAR | Fase 1 tem só os pontos (moeda, como no CoD). O score de ranking volta junto com o ranking |

## Entidades

| Item TS | Classificação | No Godot |
|---|---|---|
| `Player` (tronco + pernas, mira no mouse, lanterna) | REIMPLEMENTAR | `Player` (`CharacterBody3D`): movimento no plano, mira por raio da câmera, `SpotLight3D` como lanterna |
| `Zombie` + `PathFollower` + `NavGrid` (A* próprio) | REIMPLEMENTAR | `ZombieBase` + `NavigationAgent3D` sobre `NavigationRegion3D`, com o caminho recalculado a cada 0,25s |
| Headshot pela distância do tiro à cabeça | REIMPLEMENTAR | `Hurtbox` de cabeça (`Area3D`); o raio da arma acerta a cabeça quando a mira está nela |
| `Damageable` / vida espalhada | REIMPLEMENTAR | `HealthComponent` (composição) + `DamageInfo` |
| `Projectile` (balas com velocidade) | ADAPTAR | Fase 3: raycast instantâneo (hitscan). Projéteis reais só para lança-granadas e similares |
| Boss The Conductor, Paciente Zero | REAPROVEITAR CONCEITO | Fase 6: `ZombieBoss` com Behavior Tree (seção 11) |
| Faca (avanço + arco, 1s de recarga) | REAPROVEITAR CONCEITO | Fase 3: `Melee` com `ShapeCast3D` em arco |

## Mapa

| Item TS | Classificação | No Godot |
|---|---|---|
| `MapLayout` (áreas, portas, janelas, spawns, props, luzes em tiles) | ADAPTAR — **feito** | `npm run godot:data` exporta a grade e os dados para `data/maps/*.json`; `LayoutMap` monta o 3D. A arte do Blender entra por cima; o layout pode vir do Tiled no futuro (seção 16) |
| Portas pagas que abrem áreas e spawns | REAPROVEITAR CONCEITO — **feito** | `Door` (custo, área liberada, navegação refeita) |
| Barricadas nas janelas | REAPROVEITAR CONCEITO | Fase 5: `Barricade.tscn` |
| Armas na parede (`wallSnap`, contorno de giz) | ADAPTAR | Fase 5: `WallBuy.tscn` posicionado no editor (sem encaixe automático) |
| Energia + disjuntor | REAPROVEITAR CONCEITO | Fase 5: `PowerSwitch` + sinal global de energia |
| Missão do Hospital (`QuestSystem` por etapas) | ADAPTAR | Fase 6: etapas como Resources |
| Minimapa | REIMPLEMENTAR | `SubViewport` com câmera ortográfica de cima, ou desenho 2D |

## Máquinas, power-ups e eventos

| Item TS | Classificação | No Godot |
|---|---|---|
| Mystery Box (pesos por raridade, troca de lugar, Fire Sale) | REAPROVEITAR CONCEITO | Fase 5: `MysteryBox.tscn` + tabela configurável |
| Perks e Weapon Lab | REAPROVEITAR CONCEITO | Fase 5: `PerkData` + modificadores fora do `Player` (seção 25) |
| Power-ups (Max Ammo, Insta-Kill, Nuke, Double Points, Carpenter, Fire Sale) | REAPROVEITAR CONCEITO | Fase 6: `PowerUpData` + efeitos |
| Eventos do mundo (Apagão, Trem, Horda, Gás, Alarme) | REAPROVEITAR CONCEITO | Fase 6+: um script por evento, sorteado por peso |

## Progressão, save e online

| Item TS | Classificação | No Godot |
|---|---|---|
| `SaveStore` (`localStorage`, sanitize, migração) | ADAPTAR | `user://save.json` (ou `ConfigFile`) com versão e sanitização; nunca caminho fixo do Windows (seção 32) |
| Conquistas e visuais do personagem | REAPROVEITAR CONCEITO | `AchievementData`; na Steam, via GodotSteam na camada Platform (seção 31) |
| Ranking global + conta na nuvem (Supabase REST) | ADAPTAR | Mesmo backend via `HTTPRequest`; o Steam Cloud é uma alternativa na Steam |
| Anti-trapaça (tetos por wave + valores guardados em dobro) | REAPROVEITAR CONCEITO | Mesma ideia no `PointsManager` |

## Apresentação

| Item TS | Classificação | No Godot |
|---|---|---|
| `LightingSystem` (escuridão em canvas, lanterna, luzes de emergência) | REIMPLEMENTAR | Luzes 3D reais (`SpotLight3D`, `OmniLight3D`) + `WorldEnvironment` escuro |
| HUD em Phaser (textos, barras, banners) | REIMPLEMENTAR | `CanvasLayer` + nós `Control` (seção 27) |
| Controles de toque (dois analógicos, botões) | REIMPLEMENTAR | Fase 8: `TouchScreenButton` / analógico virtual que disparam as ações do `InputMap` |
| Câmera com zoom pela resolução | ADAPTAR | `Camera3D` de cima, inclinada; o `stretch` do Godot cuida da resolução |
| Arte SVG procedural (`scripts/art/*.mjs`) | DESCARTAR | Modelos do Blender (seção 15); no MVP, primitivas |
| Sons sintetizados no boot (`SoundBank`, `dsp.ts`) | DESCARTAR | Arquivos de áudio nos barramentos Music/SFX/Weapons/Zombies/Environment/UI/Voice (seção 35) |
| Fatiamento de spritesheets, `uiScale`, `window.__GAME__` | DESCARTAR | Não existe equivalente necessário; os testes usam o próprio Godot |
