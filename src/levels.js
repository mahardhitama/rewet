import { placeLevel } from './sim/game.js';
import { hydroTick } from './sim/hydro.js';
import { seasonAt, TICKS_PER_YEAR } from './sim/season.js';
import { computeStrength } from './sim/drainage.js';
import { seedVegetation } from './sim/mapgen.js';

const pass = (k) => ({ rewet: 60 + 3 * k, reveg: 40 + 3 * k, revit: 60 + 2 * k }); // R17

// map: generateMap() parameters (src/sim/mapgen.js); branches are per trunk. The seed sets the shape.
export const LEVELS = [
  {
    id: 1, name: 'Small drained plot', size: 22, years: 3, seed: 101, grant: 1800, arson: 0, elNinoYear: null,
    pass: pass(0), teaches: 'Blocks, the 40 cm line, distance factor',
    map: { trunks: 3, branches: 0, meander: 0.15, river: false, villages: 0, illegal: 0 },
  },
  {
    id: 2, name: 'Burnt former forest', size: 24, years: 3, seed: 203, grant: 2200, arson: 0, elNinoYear: null,
    pass: pass(1), teaches: 'Planting, drowning in dips, mounds',
    map: { trunks: 3, branches: 1, meander: 0.2, river: false, villages: 0, illegal: 0, treeShare: 0.3 },
  },
  {
    id: 3, name: 'Village edge', size: 26, years: 4, seed: 305, grant: 2400, arson: 4, elNinoYear: null,
    pass: pass(2), teaches: 'Goodwill, paludiculture, arson',
    map: { trunks: 3, branches: 1, meander: 0.2, river: true, villages: 1, illegal: 0 },
  },
  {
    id: 4, name: 'Canal network', size: 30, years: 4, seed: 405, grant: 2800, arson: 3, elNinoYear: null,
    pass: pass(3), teaches: 'Cascades, backfill, illegal canals',
    map: { trunks: 3, branches: 2, meander: 0.25, river: false, villages: 1, illegal: 2 },
  },
  {
    id: 5, name: 'El Nino year', size: 30, years: 4, seed: 510, grant: 2800, arson: 3, elNinoYear: 2,
    pass: pass(4), teaches: 'Wells, fire crews, smouldering fire',
    map: { trunks: 4, branches: 1, meander: 0.25, river: false, villages: 1, illegal: 1 },
  },
  {
    id: 6, name: 'Full peat dome', size: 40, years: 5, seed: 622, grant: 3600, arson: 5, elNinoYear: 3,
    pass: pass(5), teaches: 'Everything, with higher pass lines',
    map: { trunks: 4, branches: 1, meander: 0.3, river: true, villages: 2, illegal: 2 },
  },
];

// R1: placeLevel, then 52 weeks of hydrology with no actions, so the level opens already drained.
export function buildLevelWorld(level) {
  const world = placeLevel(level);
  const S = computeStrength(world);
  for (let t = 0; t < TICKS_PER_YEAR; t++) hydroTick(world, S, seasonAt(t));
  seedVegetation(world, { treeShare: level.map?.treeShare });
  return world;
}
