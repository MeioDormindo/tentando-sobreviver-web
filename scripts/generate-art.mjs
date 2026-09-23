// Gera toda a arte vetorial do jogo em public/assets (SVG).
// Uso: npm run art
import { corpseSheet, playerLegsSheet, playerTorsoSheet, softShadow, zombieSheet, ZOMBIE_VARIANTS } from './art/characters.mjs';
import {
  decalBloodPool, decalBloodSplats, decalDebris, decalPapers, floorTerminal,
  propBarrel, propBench, propCrate, propSuitcase, propTrash, wallCap, wallFull, wallShadow,
} from './art/environment.mjs';
import { write } from './art/lib.mjs';
import { ammoCrate, WEAPON_KINDS, weaponCase } from './art/weapons.mjs';
import * as T from './art/terminal.mjs';
import * as M from './art/machines.mjs';
import { POWERUPS, powerUpIcon } from './art/powerups.mjs';
import { bossCorpse, bossSheet } from './art/boss.mjs';
import * as E from './art/events.mjs';

const OUT = 'public/assets';

console.log('Gerando arte...');
for (const kind of WEAPON_KINDS) {
  write(`${OUT}/player/player_torso_${kind}.svg`, playerTorsoSheet(kind));
  write(`${OUT}/weapons/case_${kind}.svg`, weaponCase(kind));
}
write(`${OUT}/weapons/ammo_crate.svg`, ammoCrate());
write(`${OUT}/player/player_legs.svg`, playerLegsSheet());
for (const id of Object.keys(ZOMBIE_VARIANTS)) {
  write(`${OUT}/zombies/zombie_${id}.svg`, zombieSheet(id));
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
write(`${OUT}/map/floor_concrete.svg`, T.floorConcrete());
write(`${OUT}/map/floor_metal.svg`, T.floorMetal());
write(`${OUT}/map/floor_tracks.svg`, T.floorTracks());
write(`${OUT}/map/floor_tunnel.svg`, T.floorTunnel());
write(`${OUT}/map/floor_wagon.svg`, T.floorWagon());
write(`${OUT}/map/tactile_strip.svg`, T.tactileStrip());
write(`${OUT}/map/train_cap.svg`, T.trainCap());
write(`${OUT}/map/train_full.svg`, T.trainFull());
write(`${OUT}/map/train_roof_unit.svg`, T.trainRoofUnit());
write(`${OUT}/props/wagon_seat.svg`, T.wagonSeat());
write(`${OUT}/map/door_shutter.svg`, T.doorShutter());
write(`${OUT}/map/hazard_stripe.svg`, T.hazardStripe());
write(`${OUT}/map/plank.svg`, T.plank());
write(`${OUT}/map/window_sill.svg`, T.windowSill());
write(`${OUT}/props/generator.svg`, T.propGenerator());
write(`${OUT}/particles/burst.svg`, T.decalBurst());
write(`${OUT}/machines/mystery_box.svg`, M.mysteryBox());
write(`${OUT}/machines/weapon_lab.svg`, M.weaponLab());
for (const id of Object.keys(M.PERKS)) {
  write(`${OUT}/machines/perk_${id}.svg`, M.perkMachine(id));
  write(`${OUT}/ui/perk_icon_${id}.svg`, M.perkIcon(id));
}
for (const kind of WEAPON_KINDS) write(`${OUT}/weapons/gun_${kind}.svg`, M.gunIcon(kind));
for (const id of Object.keys(POWERUPS)) write(`${OUT}/powerups/${id}.svg`, powerUpIcon(id));
write(`${OUT}/bosses/conductor.svg`, bossSheet());
write(`${OUT}/bosses/conductor_corpse.svg`, bossCorpse());
write(`${OUT}/events/train_head.svg`, E.trainHead());
write(`${OUT}/events/train_car.svg`, E.trainCar());
write(`${OUT}/events/supply_crate.svg`, E.supplyCrate());
write(`${OUT}/events/parachute.svg`, E.parachute());
write(`${OUT}/events/gas_pipe.svg`, E.gasPipe());
console.log('Pronto.');
