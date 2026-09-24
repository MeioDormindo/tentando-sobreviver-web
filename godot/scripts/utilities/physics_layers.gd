class_name PhysicsLayers
extends RefCounted
## Bits das camadas de física 3D (nomes em Project Settings > Layer Names).

const WORLD := 1 << 0
const PLAYER := 1 << 1
const ZOMBIES := 1 << 2
const HURTBOXES := 1 << 3

## O que um tiro pode acertar: paredes (param o tiro) e hurtboxes.
const SHOT_MASK := WORLD | HURTBOXES
