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
| WASD | mover |
| Mouse | mirar |
| Clique esquerdo | atirar (M1911 é semiautomática) |
| R | recarregar |

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
  map/               TestMap (piso, paredes 3/4, props, luminárias) e definições de props
  entities/          Player (tronco + pernas), Zombie (3 variantes), Projectile (traçante), Damageable
  weapons/           Weapon (estado/munição/recarga) e WeaponSystem (input → disparo)
  effects/           LightingSystem (escuridão, lanterna, luzes), EffectsSystem (sangue, cadáveres,
                     cápsulas, faíscas), fxTextures (texturas de luz/partículas em canvas)
  systems/           WaveSystem, SpawnSystem, difficulty (fórmulas), CombatSystem, CameraController
public/assets/       arte gerada (SVG) — pode ser trocada por PNGs com o mesmo layout de frames
```

## Visual

- Câmera top-down próxima com zoom adaptado à janela e deslocamento na direção da mira.
- Vista 3/4: paredes mostram a face frontal, e tudo é ordenado por profundidade (Y).
- Iluminação: ambiente escuro, lanterna em cone, luminárias defeituosas, clarão dos disparos.
- Pós-processamento (WebGL): vinheta e cores dessaturadas.
- Ajustes em `src/config/visual.config.ts`.

## Status

- [x] Fase 0 — Setup
- [x] Fase 1 — MVP Core (player, câmera, tiro, M1911, Walker, dano, morte, reinício)
- [x] Passe visual (arte original, iluminação, câmera, efeitos) — antecipado da Fase 10
- [x] Fase 2 — Waves (WaveSystem, SpawnSystem, dificuldade progressiva, HUD de wave)
- [ ] Fase 3 — Economia

Observações:
- Waves seguem as fórmulas do GDD §32 (`src/config/waves.config.ts`).
- Provisório até a Fase 3: munição reabastecida ao fim de cada wave e regeneração lenta de vida.
  Só com a M1911, a munição fica apertada na wave 5 e não fecha a partir da wave 6. A economia
  (compra de munição e armas) resolve isso.
- Zumbis presos fora da tela por 12s são realocados para outro spawn (a wave nunca trava).
- Zumbis perseguem em linha reta e contornam paredes deslizando por elas. O pathfinding A* entra na Fase 4.
- Em modo dev, `window.__GAME__` expõe a instância do jogo para depuração.
