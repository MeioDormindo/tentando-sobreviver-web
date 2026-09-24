class_name PhysicsLayers
extends RefCounted
## Bits das camadas de física 3D (nomes em Project Settings > Layer Names).

const WORLD := 1 << 0
const PLAYER := 1 << 1
const ZOMBIES := 1 << 2
const HURTBOXES := 1 << 3
## Bloqueia só o jogador (janelas: os zumbis passam por elas).
const PLAYER_ONLY := 1 << 4
## Móveis que bloqueiam a passagem mas não os tiros (bancos, carrinhos).
const PROPS := 1 << 5
## Tábuas das janelas: bloqueiam os zumbis enquanto existem.
const BARRICADES := 1 << 6

## O que o jogador e os zumbis não atravessam.
const PLAYER_MASK := WORLD | ZOMBIES | PLAYER_ONLY | PROPS
const ZOMBIE_MASK := WORLD | PLAYER | ZOMBIES | PROPS | BARRICADES
## Colisores usados para gerar a malha de navegação (janelas ficam de fora: são passagem).
const NAV_MASK := WORLD | PROPS

## O que um tiro pode acertar: paredes (param o tiro) e hurtboxes.
const SHOT_MASK := WORLD | HURTBOXES
