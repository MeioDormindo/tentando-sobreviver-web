// Gera toda a arte vetorial do jogo em public/assets (SVG).
// Uso: npm run art
import { zombieBigHead, corpseSheet, playerLegsSheet, playerTorsoSheet, PLAYER_SKINS, softShadow, zombieSheet, ZOMBIE_VARIANTS } from './art/characters.mjs';
import {
  decalBloodPool, decalBloodSplats, decalDebris, decalPapers, floorTerminal,
  propBarrel, propBench, propCrate, propSuitcase, propTrash, wallCap, wallFull, wallShadow,
} from './art/environment.mjs';
import { write } from './art/lib.mjs';
import { ammoCrate, WEAPON_KINDS } from './art/weapons.mjs';
import * as T from './art/terminal.mjs';
import * as M from './art/machines.mjs';
import { POWERUPS, powerUpIcon } from './art/powerups.mjs';
import { bossCorpse, bossSheet } from './art/boss.mjs';
import { patientZeroCorpse, patientZeroSheet } from './art/patientZero.mjs';
import * as E from './art/events.mjs';
import * as P from './art/props.mjs';
import * as H from './art/hospital.mjs';

const OUT = 'public/assets';

console.log('Gerando arte...');
for (const kind of WEAPON_KINDS) {
  write(`${OUT}/player/player_torso_${kind}.svg`, playerTorsoSheet(kind));
  for (const skin of Object.keys(PLAYER_SKINS)) write(`${OUT}/player/player_torso_${kind}_${skin}.svg`, playerTorsoSheet(kind, skin));
}
write(`${OUT}/weapons/ammo_crate.svg`, ammoCrate());
write(`${OUT}/player/player_legs.svg`, playerLegsSheet());
for (const id of Object.keys(ZOMBIE_VARIANTS)) {
  write(`${OUT}/zombies/zombie_${id}.svg`, zombieSheet(id));
  if (!ZOMBIE_VARIANTS[id].body) write(`${OUT}/zombies/big_head_${id}.svg`, zombieBigHead(id));
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
write(`${OUT}/map/tunnel_mouth.svg`, T.tunnelMouth());
write(`${OUT}/map/rail_signal.svg`, T.railSignal());
write(`${OUT}/map/departure_board.svg`, T.departureBoard());
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
write(`${OUT}/bosses/patient_zero.svg`, patientZeroSheet());
write(`${OUT}/bosses/patient_zero_corpse.svg`, patientZeroCorpse());
write(`${OUT}/events/train_head.svg`, E.trainHead());
write(`${OUT}/events/train_car.svg`, E.trainCar());
write(`${OUT}/events/supply_crate.svg`, E.supplyCrate());
write(`${OUT}/events/parachute.svg`, E.parachute());
write(`${OUT}/events/gas_pipe.svg`, E.gasPipe());
for (const [name, draw] of Object.entries({
  extinguisher: P.extinguisher, luggage_cart: P.luggageCart, pallet: P.pallet, sign_stand: P.signStand,
  desk_computer: P.deskComputer, chair: P.chair, locker: P.locker, barrier: P.barrier, cables: P.cables,
  floor_pipe: P.floorPipe, vitrine: P.vitrine,
})) write(`${OUT}/props/${name}.svg`, draw());
for (const [name, color] of Object.entries({ power: '#e8c14a', alarm: '#e0412f', train: '#4ac0e8', trap: '#7fd8ff' })) {
  write(`${OUT}/props/panel_${name}.svg`, P.controlPanel(color));
}
write(`${OUT}/props/trap_grate.svg`, P.trapGrate());
write(`${OUT}/props/teddy.svg`, P.teddyBear());
write(`${OUT}/props/radio.svg`, P.radio());
// Hospital Santa Luzia (Mapa 2)
write(`${OUT}/map/floor_hospital.svg`, H.floorHospital());
write(`${OUT}/map/floor_linoleum.svg`, H.floorLinoleum());
write(`${OUT}/map/floor_morgue.svg`, H.floorMorgue());
write(`${OUT}/props/hospital_bed.svg`, H.hospitalBed());
write(`${OUT}/props/wheelchair.svg`, H.wheelchair());
write(`${OUT}/props/iv_stand.svg`, H.ivStand());
write(`${OUT}/props/gurney.svg`, H.gurney());
write(`${OUT}/props/med_cabinet.svg`, H.medCabinet());
write(`${OUT}/props/morgue_drawers.svg`, H.morgueDrawers());
write(`${OUT}/props/lab_bench.svg`, H.labBench());
write(`${OUT}/props/vending.svg`, H.vending());
write(`${OUT}/props/surgical_light.svg`, H.surgicalLight());
write(`${OUT}/props/waiting_chairs.svg`, H.waitingChairs());
for (const [file, fn] of [['sample_fridge', H.sampleFridge], ['padlock', H.padlock], ['centrifuge', H.centrifuge], ['keycard', H.keycard], ['serum_vial', H.serumVial]]) {
  write(`${OUT}/props/${file}.svg`, fn());
}
console.log('Pronto.');
