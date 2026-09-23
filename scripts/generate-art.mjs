// Gera toda a arte vetorial do jogo em public/assets (SVG).
// Uso: npm run art
import { corpseSheet, playerLegsSheet, playerTorsoSheet, softShadow, zombieSheet, ZOMBIE_VARIANTS } from './art/characters.mjs';
import {
  decalBloodPool, decalBloodSplats, decalDebris, decalPapers, floorTerminal,
  propBarrel, propBench, propCrate, propSuitcase, propTrash, wallCap, wallFull, wallShadow,
} from './art/environment.mjs';
import { write } from './art/lib.mjs';
import { ammoCrate, WEAPON_KINDS, weaponCase } from './art/weapons.mjs';

const OUT = 'public/assets';

console.log('Gerando arte...');
for (const kind of WEAPON_KINDS) {
  write(`${OUT}/player/player_torso_${kind}.svg`, playerTorsoSheet(kind));
  write(`${OUT}/weapons/case_${kind}.svg`, weaponCase(kind));
}
write(`${OUT}/weapons/ammo_crate.svg`, ammoCrate());
write(`${OUT}/player/player_legs.svg`, playerLegsSheet());
for (const id of Object.keys(ZOMBIE_VARIANTS)) {
  write(`${OUT}/zombies/walker_${id}.svg`, zombieSheet(id));
}
write(`${OUT}/zombies/corpses.svg`, corpseSheet());
write(`${OUT}/sprites/shadow.svg`, softShadow());

write(`${OUT}/map/floor_terminal.svg`, floorTerminal());
write(`${OUT}/map/wall_full.svg`, wallFull());
write(`${OUT}/map/wall_cap.svg`, wallCap());
write(`${OUT}/map/wall_shadow.svg`, wallShadow());

write(`${OUT}/props/bench.svg`, propBench());
write(`${OUT}/props/crate.svg`, propCrate());
write(`${OUT}/props/barrel.svg`, propBarrel());
write(`${OUT}/props/trash.svg`, propTrash());
write(`${OUT}/props/suitcase.svg`, propSuitcase());

write(`${OUT}/particles/papers.svg`, decalPapers());
write(`${OUT}/particles/debris.svg`, decalDebris());
write(`${OUT}/particles/blood_splats.svg`, decalBloodSplats());
write(`${OUT}/particles/blood_pool.svg`, decalBloodPool());
console.log('Pronto.');
