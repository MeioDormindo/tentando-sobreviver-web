# Glossário das traduções

Termos fixos dos 14 idiomas traduzidos a partir do português (`godot/locale/<idioma>.po`). Serve para
manter a consistência ao traduzir textos novos (`npm run godot:i18n` acrescenta as entradas vazias) e
para quem for revisar. As traduções foram feitas por IA: vale uma revisão de falantes nativos.

## Ficam como estão (todos os idiomas)

- **Modelos de arma**: AK, M1911, M4, MP5, P90, RPK, Glock 17, Beretta 92, Barrett .50, Bren,
  Lee-Enfield, Lupara, Magnum .44, Makarov PM, Mauser C96, StG 44, Thompson M1928, Vector,
  Winchester 1887, Arc Gun, Rail Weapon. Armas descritivas (Combat Shotgun, Nail Gun...) são
  traduzidas.
- **Perks**: Adrenaline, Deadeye, Fortify, Overload, Quick Hands, Quick Revive, Sprint+.
- **Power-ups**: Max Ammo, Double Cash, Instant Kill, Nuke, Full Heal, Armor, Speed Boost, Carpenter,
  Golden Drop, Fire Sale.
- **Mystery Box**, **Weapon Lab**, **Mk II / Mk III**, **The Conductor** (o chefe; o personagem nas
  missões e nos rádios é traduzido: Conducteur, Schaffner, Capotreno, Кондуктор, 列车长, 車掌, 차장...).
- Nomes de pessoas: Dr. Almeida, Dra. Helena, Siryus Canuto. Lugares próprios: Santa Luzia.

## Termos traduzidos

| pt_BR | en | es | fr | de | ru | ja | ko | zh_CN |
|---|---|---|---|---|---|---|---|---|
| round | round | ronda | manche | Runde | раунд | ラウンド | 라운드 | 回合 |
| pontos | points | puntos | points | Punkte | очки | ポイント | 포인트 | 点数 |
| zumbi | zombie | zombi | zombie | Zombie | зомби | ゾンビ | 좀비 | 僵尸 |
| boss / chefe | boss | jefe | boss | Boss | босс | ボス | 보스 | 首领 |
| perk | perk | perk | perk | Perk | перк | パーク | 퍼크 | Perk |
| power-up | power-up | power-up | power-up | Power-up | бонус | パワーアップ | 파워업 | 强化道具 |
| faca | knife | cuchillo | couteau | Messer | нож | ナイフ | 칼 | 小刀 |
| disjuntor / energia | breaker / power | disyuntor / energía | disjoncteur / courant | Sicherungskasten / Strom | рубильник / питание | ブレーカー / 電源 | 차단기 / 전원 | 电闸 / 电源 |
| sala (co-op) | room | sala | salon | Raum | комната | ルーム | 방 | 房间 |
| Submundo | Underworld | Inframundo | Enfers | Unterwelt | Подземный мир | 冥界 | 명계 | 冥界 |
| bênção | blessing | bendición | bénédiction | Segen | благословение | 加護 | 축복 | 祝福 |

Os outros idiomas seguem o mesmo critério: o termo comum do gênero (CoD Zombies) em cada um;
`perk`, `boss` e `power-up` ficam em inglês onde a comunidade usa assim.

## Regras de formato

- Os marcadores (`%s`, `%d`, `%.1f`, `%%`) ficam **na mesma ordem** do português: o Godot não
  reordena. Monte a frase em volta deles (`npm run godot:i18n:check` confere).
- `[SEGURE %s]` é a tecla da ação na máquina de quem joga (`Loc.key`); o texto em volta é traduzido.
- Textos em maiúsculas no original ficam em maiúsculas onde o idioma tem caixa.
- Chinês, japonês e coreano usam pontuação de largura cheia (`：`, `（）`); os caracteres usados
  precisam existir na Fusion Pixel (o `godot:i18n:fonts` recorta a fonte do idioma e o check
  confere).
- Coreano: depois de um nome (`%s`) use `님이` / `님을` ou `:` para não depender da partícula.
- zh_TW é convertido do zh_CN com o OpenCC (vocabulário de Taiwan) e revisado (殭屍, 滑鼠, 帳號...).
