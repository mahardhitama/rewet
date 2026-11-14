import test from 'node:test';
import assert from 'node:assert/strict';
import { KIND, BLOCK, idx } from '../src/sim/world.js';
import { seasonAt } from '../src/sim/season.js';
import { canalTarget } from '../src/sim/hydro.js';
import { createGame, applyAction, step, costOf, placeLevel, isWetSeason, freeCrews, PLANT_TILE, plantTiles, growSeedlings, seedlingStress, SEEDLING_DEATH } from '../src/sim/game.js';

const S = 12;
const canal = [[0, 6], [1, 6], [2, 6], [3, 6], [4, 6], [5, 6]]; // edge toward dome centre
const lvl = (o = {}) => ({
  id: 1, size: S, years: 2, seed: 7, grant: 1000, arson: 0, illegalCanals: [], elNinoYear: null, pass: {},
  canals: canal, villages: [[10, 10]], ...o,
});
const at = (x, y) => idx(S, x, y);
const busyCrews = (g) => g.crews.filter((t) => t > g.tick).length;

test('action spends funds and occupies a crew', () => {
  const g = createGame(lvl());
  assert.deepEqual(applyAction(g, 'tempBlock', at(3, 6)), { ok: true });
  assert.equal(g.funds, 1000 - 80);
  assert.equal(busyCrews(g), 1);
  assert.equal(g.jobs.length, 1);
  for (let t = 0; t < 4; t++) step(g);
  assert.equal(g.world.block[at(3, 6)], BLOCK.TEMP);
  assert.equal(busyCrews(g), 0);
  assert.equal(g.jobs.length, 0);
});

test('Review: second action on same tile -> busy, funds unchanged', () => {
  const g = createGame(lvl());
  applyAction(g, 'tempBlock', at(3, 6));
  const f = g.funds;
  assert.deepEqual(applyAction(g, 'tempBlock', at(3, 6)), { ok: false, reason: 'busy' });
  assert.deepEqual(applyAction(g, 'well', at(3, 6)), { ok: false, reason: 'busy' });
  assert.equal(g.funds, f);
  assert.equal(busyCrews(g), 1);
});

test('refuses invalid tile, no funds, no crew', () => {
  const g = createGame(lvl());
  assert.deepEqual(applyAction(g, 'tempBlock', at(8, 8)), { ok: false, reason: 'invalid' });
  assert.deepEqual(applyAction(g, 'permBlock', at(3, 6)), { ok: false, reason: 'invalid' });
  assert.deepEqual(applyAction(g, 'fireGroup', at(8, 8)), { ok: false, reason: 'invalid' });
  assert.deepEqual(applyAction(g, 'fireCrew', at(8, 8)), { ok: false, reason: 'invalid' });
  for (const x of [1, 2, 3]) assert.equal(applyAction(g, 'tempBlock', at(x, 6)).ok, true);
  assert.deepEqual(applyAction(g, 'tempBlock', at(4, 6)), { ok: false, reason: 'crew' });
  assert.deepEqual(applyAction(g, 'tempBlock', at(3, 6)), { ok: false, reason: 'busy' }); // busy before crew

  const poor = createGame(lvl({ grant: 50 }));
  assert.deepEqual(applyAction(poor, 'tempBlock', at(3, 6)), { ok: false, reason: 'funds' });
  assert.equal(poor.funds, 50);
  assert.equal(busyCrews(poor), 0);

  const more = createGame(lvl(), { crew: 1 });
  assert.equal(more.crews.length, 4);
});

test('wet season discount 0.8', () => {
  const g = createGame(lvl());
  assert.equal(costOf(g, 'tempBlock'), 80);
  assert.equal(costOf(g, 'backfill'), 480);
  g.tick = 31 * 4; // dry
  assert.equal(costOf(g, 'tempBlock'), 100);
  g.tick = 25 * 4; // wet normally
  assert.equal(costOf(g, 'plant'), Math.round(PLANT_TILE * 0.8 * 10) / 10); // per tile, 1 decimal (R2)
  assert.equal(costOf(g, 'plant'), 6.4);
  const n = createGame(lvl({ elNinoYear: 0 }));
  n.tick = 25 * 4; // El Nino year: dry from week 21
  assert.equal(costOf(n, 'plant'), PLANT_TILE);
  const c = createGame(lvl(), { cheapBlocks: true });
  assert.equal(costOf(c, 'tempBlock'), 60);
  assert.equal(costOf(c, 'well'), 64);
});

test('isWetSeason: weeks 0-30 wet, 31 dry', () => { const g = createGame(lvl()); g.tick = 30 * 4; assert.equal(isWetSeason(g), true); g.tick = 31 * 4; assert.equal(isWetSeason(g), false); });

test('freeCrews counts crews whose busy-until tick has passed', () => { const g = createGame(lvl()); g.crews = [0, 10, Infinity]; g.tick = 10; assert.equal(freeCrews(g), 2); });

test('backfill removes drainage source after job completes', () => {
  const g = createGame(lvl());
  const i = at(2, 6);
  assert.ok(g.S[i] > 0);
  assert.equal(applyAction(g, 'backfill', i).ok, true);
  for (let t = 0; t < 23; t++) step(g);
  assert.ok(g.S[i] > 0, 'not done before 6 weeks');
  step(g);
  assert.equal(g.S[i], 0);
  assert.equal(g.world.block[i], BLOCK.FILLED);
  assert.notEqual(g.world.src[i], i);
});

test('Review: illegal canal stops at block / village / filled tile', () => {
  const path = [0, 1, 2, 3, 4, 5, 6].map((x) => [x, 2]);
  const run = (setup) => {
    const g = createGame(lvl({ canals: [], illegalCanals: [path] }));
    setup(g.world, at(3, 2));
    for (let t = 0; t < 80; t++) step(g);
    return g.world;
  };
  const block = run((w, i) => { w.kind[i] = KIND.CANAL; w.block[i] = BLOCK.TEMP; });
  const village = run((w, i) => { w.kind[i] = KIND.VILLAGE; });
  const filled = run((w, i) => { w.block[i] = BLOCK.FILLED; });
  const river = run((w, i) => { w.kind[i] = KIND.RIVER; });
  for (const w of [block, village, filled, river]) {
    for (const x of [0, 1, 2]) assert.equal(w.kind[at(x, 2)], KIND.CANAL);
    for (const x of [4, 5, 6]) assert.equal(w.kind[at(x, 2)], KIND.PEAT);
  }
  assert.equal(block.block[at(3, 2)], BLOCK.TEMP);
  assert.equal(village.kind[at(3, 2)], KIND.VILLAGE);
  assert.equal(filled.kind[at(3, 2)], KIND.PEAT);
  assert.equal(filled.block[at(3, 2)], BLOCK.FILLED);
  assert.equal(river.kind[at(3, 2)], KIND.RIVER);
  const open = run(() => {});
  for (const x of [0, 1, 2, 3, 4, 5, 6]) assert.equal(open.kind[at(x, 2)], KIND.CANAL);
});

test('low goodwill -> more arson (seeded, 200 runs)', () => {
  const count = (goodwill) => {
    let n = 0;
    for (let s = 1; s <= 200; s++) {
      const g = createGame(lvl({ seed: s, arson: 20, canals: [] }));
      g.goodwill = goodwill;
      g.tick = 31 * 4;
      for (let t = 0; t < 84; t++) step(g);
      n += g.events.filter((e) => e.type === 'arson').length;
    }
    return n;
  };
  const low = count(10), high = count(90);
  assert.ok(low > 4 * high, `low ${low} high ${high}`);
  assert.ok(high > 0);
});

test('T5 determinism: same seed + action list -> identical wt and z arrays after 2 years', () => {
  const plan = [[0, 'tempBlock', at(4, 6)], [10, 'mound', at(8, 8)], [20, 'plant', at(8, 8)], [40, 'permBlock', at(4, 6)],
    [130, 'well', at(9, 9)], [150, 'fireGroup', at(10, 10)]];
  const run = () => {
    const g = createGame(lvl({ arson: 30, elNinoYear: 1, illegalCanals: [[[11, 2], [10, 2], [9, 2], [8, 3]]] }));
    for (let t = 0; t < 416; t++) {
      for (const [tt, id, i] of plan) if (tt === t) applyAction(g, id, i);
      for (let i = 0; i < g.world.n; i++) if (g.world.fire[i]) applyAction(g, 'fireCrew', i);
      step(g);
    }
    return g;
  };
  const a = run(), b = run();
  assert.deepEqual(a.world.wt, b.world.wt);
  assert.deepEqual(a.world.z, b.world.z);
  assert.deepEqual(a.world.cover, b.world.cover);
  assert.deepEqual(a.events, b.events);
  assert.equal(a.funds, b.funds);
  assert.equal(a.events.filter((e) => e.type === 'yearEnd').length, 2);
  assert.ok(a.events.some((e) => e.type === 'elNinoWarning'));
});

test('mound lifts the tile above the water without adding water', () => {
  const i = at(8, 8);
  const mk = () => { const g = createGame(lvl()); g.world.wt[i] = -0.1; return g; };
  const a = mk(), b = mk();
  assert.equal(applyAction(a, 'mound', i).ok, true);
  for (let t = 0; t < 3; t++) { step(a); step(b); }
  const wt0 = a.world.wt[i];
  step(a); step(b); // mound completes in this step, then one hydro tick
  const head = (g) => g.world.z.reduce((s, z, k) => s + z - g.world.wt[k], 0);
  assert.ok(Math.abs(a.world.z[i] - b.world.z[i] - 0.2) < 1e-3); // minus one tick of subsidence
  assert.ok(Math.abs(a.world.wt[i] - b.world.wt[i] - 0.2) < 0.02, `wt diff ${a.world.wt[i] - b.world.wt[i]}`);
  assert.ok(a.world.wt[i] > wt0 + 0.15);
  assert.ok(Math.abs(head(a) - head(b)) < 0.02, `head diff ${head(a) - head(b)}`);
});

const run = (g, n = 12) => { for (let t = 0; t < n; t++) step(g); };

test('R27: plant seeds a 5x5 stamp of peat, skipping canals, cover 1 and existing seedlings', () => {
  const g = createGame(lvl());
  g.world.cover[at(2, 7)] = 1;
  g.seedlings.set(at(3, 7), 5);
  assert.equal(applyAction(g, 'plant', at(2, 7)).ok, true); // centre has cover 1, neighbours are eligible
  run(g);
  for (const [x, y] of [[0, 7], [1, 7], [1, 8], [2, 8], [3, 8], [4, 9], [4, 7]]) assert.ok(g.seedlings.has(at(x, y)), `${x},${y}`);
  for (let x = 0; x <= 4; x++) assert.ok(!g.seedlings.has(at(x, 6)), 'canal row skipped');
  assert.ok(!g.seedlings.has(at(2, 7)), 'cover 1 skipped');
  assert.ok(g.seedlings.has(at(3, 7)), '(3,7) kept');
  assert.ok(!g.planted.has(at(3, 7)));
});

test('R27: a 5x5 stamp on open peat seeds 25 tiles, costs round(25 x price), takes 3 weeks', () => {
  const g = createGame(lvl()); // week 0 is wet: 6.4 per tile
  const f = g.funds, i = at(8, 3);
  assert.equal(plantTiles(g, i).length, 25);
  assert.deepEqual(applyAction(g, 'plant', i), { ok: true });
  assert.equal(g.funds, f - Math.round(25 * costOf(g, 'plant')));
  assert.equal(g.jobs[0].weeks, 3);
  assert.equal(g.jobs[0].tiles.length, 25);
  assert.equal(g.jobs[0].doneAt, 12);
  run(g, 11);
  assert.equal(g.planted.size, 0, 'not done before 3 weeks');
  run(g, 1);
  assert.equal(g.planted.size, 25);
});

test('R27: planting time is 1 week for 4 tiles, 3 weeks for 25', () => {
  const g = createGame(lvl());
  g.funds = 26; // 4 tiles at 6.4, 5 tiles would cost 32
  assert.equal(applyAction(g, 'plant', at(8, 3)).ok, true);
  assert.equal(g.jobs[0].tiles.length, 4);
  assert.equal(g.jobs[0].weeks, 1);
});

test('R27: with funds for 3 tiles the 3 nearest tiles are seeded', () => {
  const g = createGame(lvl());
  g.funds = 20; // 3 tiles at 6.4 cost 19.2, 4 tiles cost 25.6
  const i = at(8, 3), want = plantTiles(g, i).slice(0, 3);
  assert.equal(want[0], i); // nearest first
  assert.equal(applyAction(g, 'plant', i).ok, true);
  run(g);
  assert.deepEqual([...g.planted.keys()].sort((a, b) => a - b), want.sort((a, b) => a - b));
  assert.ok(g.funds < costOf(g, 'plant'));
});

test('R27: funds below one tile price refuse with funds', () => {
  const g = createGame(lvl());
  g.funds = 6; // below one tile at 6.4
  assert.deepEqual(applyAction(g, 'plant', at(8, 3)), { ok: false, reason: 'funds' });
  assert.equal(g.jobs.length, 0);
});

test('R27: overlapping plant jobs charge only new tiles', () => {
  const g = createGame(lvl());
  assert.equal(applyAction(g, 'plant', at(7, 3)).ok, true); // 25 tiles: x 5-9, y 1-5
  const f = g.funds;
  assert.equal(plantTiles(g, at(9, 3)).length, 10); // only x 10 and 11 are new, y 1-5
  assert.equal(applyAction(g, 'plant', at(9, 3)).ok, true);
  assert.equal(g.jobs[1].tiles.length, 10);
  assert.equal(g.funds, f - Math.round(10 * costOf(g, 'plant')));
  for (const j of g.jobs) for (const t of j.tiles) assert.equal(g.jobs.filter((q) => q.tiles.includes(t)).length, 1);
});

test('R32: plant needs a plantable tile in the 5x5; tiles are checked again at finish', () => {
  const g = createGame(lvl());
  assert.equal(applyAction(g, 'plant', at(8, 3)).ok, true);
  g.seedlings.set(at(8, 3), 0); // another source seeds a tile before the job ends
  run(g);
  assert.equal(g.planted.size, 24);
  const f = g.funds;
  assert.deepEqual(applyAction(g, 'plant', at(8, 3)), { ok: false, reason: 'nothingToPlant' });
  assert.deepEqual(applyAction(g, 'plant', at(3, 6)), { ok: false, reason: 'invalid' }); // canal centre
  assert.equal(g.funds, f);
});

test('R29: one mound per tile', () => {
  const g = createGame(lvl()), i = at(8, 8);
  assert.equal(applyAction(g, 'mound', i).ok, true);
  assert.deepEqual(applyAction(g, 'mound', i), { ok: false, reason: 'busy' });
  for (let t = 0; t < 4; t++) step(g);
  const f = g.funds;
  assert.deepEqual(applyAction(g, 'mound', i), { ok: false, reason: 'mounded' });
  assert.equal(g.funds, f);
  assert.equal(applyAction(g, 'mound', at(9, 8)).ok, true);
});

test('R29: fire crew on a burning tile cancels its pending build job', () => {
  const g = createGame(lvl()), i = at(8, 8);
  assert.equal(applyAction(g, 'well', i).ok, true);
  g.world.fire[i] = 1; g.world.fireT[i] = 8;
  assert.equal(applyAction(g, 'fireCrew', i).ok, true);
  assert.deepEqual(g.jobs.map((j) => j.id), ['fireCrew']);
  assert.equal(freeCrews(g), 2); // build crew freed, one crew on the fire
  assert.deepEqual(applyAction(g, 'fireCrew', i), { ok: false, reason: 'busy' });
  for (let t = 0; t < 8; t++) step(g);
  assert.ok(!g.wells.has(i));
});

test('crewed fire re-lit by a neighbour is capped and put out', () => {
  const g = createGame(lvl());
  const i = at(8, 8);
  g.world.wt[i] = 0.8; // only this tile can burn
  g.world.fire[i] = 1; g.world.fireT[i] = 8;
  assert.equal(applyAction(g, 'fireCrew', i).ok, true);
  step(g);
  assert.equal(g.world.fire[i], 0);
  g.world.fire[i] = 1; g.world.fireT[i] = 8; // re-lit while the crew job still runs
  assert.equal(g.jobs.length, 1);
  step(g); // job sees fire, stays; cap 1 -> out
  assert.equal(g.world.fire[i], 0);
  step(g);
  assert.equal(g.jobs.length, 0);
  assert.equal(g.crews.filter((t) => t > g.tick).length, 0);
});

test('fire crew fights every burning tile in the 3x3 square around its fire', () => {
  const g = createGame(lvl());
  const i = at(8, 8), nb = at(9, 9), out = at(10, 8);
  g.world.wt.fill(0.3); // wet, not flooded: nothing can catch or re-light
  for (const k of [i, nb, out]) { g.world.fire[k] = 2; g.world.fireT[k] = 50; }
  assert.equal(applyAction(g, 'fireCrew', i).ok, true);
  step(g);
  assert.ok(g.world.fireT[nb] <= 8, 'neighbour capped like the crewed tile');
  assert.ok(g.world.fireT[out] > 8, 'tile 2 away not fought');
  for (let t = 0; t < 10; t++) step(g);
  assert.equal(g.world.fire[i], 0);
  assert.equal(g.world.fire[nb], 0);
});

test('fire crew puts out its whole 3x3 square when its fire goes out', () => {
  const g = createGame(lvl());
  const i = at(8, 8), nb = at(7, 9), out = at(10, 8);
  g.world.wt.fill(0.3); // wet, not flooded: nothing can catch or re-light
  g.world.fire[i] = 1; g.world.fireT[i] = 8; // surface fire: cap 1, out in the first tick
  for (const k of [nb, out]) { g.world.fire[k] = 2; g.world.fireT[k] = 50; }
  assert.equal(applyAction(g, 'fireCrew', i).ok, true);
  step(g);
  assert.equal(g.world.fire[i], 0);
  assert.equal(g.world.fire[nb], 0, 'smouldering neighbour out with it');
  assert.equal(g.world.fire[out], 2, 'tile 2 away still burns');
});

test('arson ignition runs fire side effects (village goodwill, spotting, seedling loss)', () => {
  const villages = [];
  for (let y = 0; y < S; y += 2) for (let x = 0; x < S; x += 2) villages.push([x, y]); // every other tile is next to a village
  const g = createGame(lvl({ arson: 147 * 1000, canals: [], villages }));
  for (const [x, y] of villages) g.fireGroups.add(at(x, y));
  for (let i = 0; i < g.world.n; i++) g.seedlings.set(i, 0);
  g.goodwill = 99; // p = arson*0.01/147 >> 1: every dry tick tries
  g.tick = 31 * 4;
  let k = -1;
  for (let t = 0; t < 84 && k < 0; t++) {
    g.world.wt.fill(1.2); // keep every tile ignitable
    step(g);
    k = g.events.findIndex((e) => e.type === 'arson' && e.lit);
  }
  assert.ok(k >= 2, 'arson lit');
  const { i } = g.events[k];
  assert.deepEqual(g.events.slice(k - 2, k), [{ type: 'fireSpotted', i }, { type: 'villageFire', i }]);
  assert.ok(!g.seedlings.has(i));
  assert.ok(g.burnt.has(i));
  assert.ok(g.goodwill < 99);
});

test('placeLevel canal z is the dome term of the default terrain', () => {
  const w = placeLevel(lvl());
  const free = placeLevel(lvl({ canals: [] }));
  const dome = (x, y) => { const c = S / 2, r = Math.hypot(x - c, y - c) / Math.hypot(c, c); return 2 * (1 - r * r); };
  let maxMicro = 0;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = at(x, y);
    if (w.kind[i] === KIND.CANAL) assert.ok(Math.abs(w.z[i] - dome(x, y)) < 1e-5, `canal z at ${x},${y}`);
    else assert.equal(w.z[i], free.z[i]);
    maxMicro = Math.max(maxMicro, Math.abs(free.z[i] - dome(x, y)));
  }
  assert.ok(maxMicro > 0.05 && maxMicro <= 0.3 + 1e-5, `micro ${maxMicro}`);
});

test('placeLevel reads canalZ and level.terrain when present', () => {
  const canalZ = canal.map((_, k) => -1 - 0.01 * k);
  const terrain = { tilt: 1, outlet: 'E' };
  const w = placeLevel(lvl({ canalZ, terrain }));
  const free = placeLevel(lvl({ canals: [], terrain }));
  const flat = placeLevel(lvl({ canals: [] }));
  canal.forEach(([x, y], k) => assert.ok(Math.abs(w.z[at(x, y)] - canalZ[k]) < 1e-6, `canal z at ${x},${y}`));
  assert.ok(free.z[at(0, 10)] > flat.z[at(0, 10)] + 0.5, 'tilt raises the high edge');
});

test('placeLevel copies canalW and canalD into the world', () => {
  const canalW = canal.map((_, k) => 8 + k), canalD = canal.map((_, k) => 5 - 0.1 * k);
  const w = placeLevel(lvl({ canalW, canalD }));
  canal.forEach(([x, y], k) => {
    const i = at(x, y);
    assert.equal(w.cWidth[i], Math.fround(canalW[k]));
    assert.equal(w.cDepth[i], Math.fround(canalD[k]));
    assert.ok(Math.abs(w.cWater[i] - 0.9 * canalD[k]) < 1e-5, `dry water at ${x},${y}`);
  });
  assert.equal(w.cDepth[at(10, 10)], 0);
});

test('backfill sets cWater to 0', () => {
  const g = createGame(lvl({ canalW: canal.map(() => 8), canalD: canal.map(() => 5) }));
  const i = at(2, 6);
  assert.ok(g.world.cWater[i] > 0);
  applyAction(g, 'backfill', i);
  for (let t = 0; t < 24; t++) step(g);
  assert.equal(g.world.cWater[i], 0);
  assert.equal(g.world.cDepth[i], 0);
  assert.equal(g.world.cWidth[i], 0);
});

test('an illegal canal tile gets the branch size and the current water level', () => {
  const g = createGame(lvl({ canals: [], illegalCanals: [[[0, 2], [1, 2]]] }));
  for (let t = 0; t < 8; t++) step(g);
  const i = at(0, 2), env = seasonAt(g.tick - 1);
  assert.equal(g.world.kind[i], KIND.CANAL);
  assert.equal(g.world.cWidth[i], 4);
  assert.equal(g.world.cDepth[i], 2.5);
  assert.ok(Math.abs(g.world.cWater[i] - canalTarget(g.world, g.S, i, env.dry)) < 1e-6, `${g.world.cWater[i]}`);
  assert.ok(g.world.cWater[i] > 0);
});

test('seedling stress: dry stress grows with depth, flood kills in 3 weeks, a nurse tree halves dry stress', () => {
  const ticksToDie = (wt, nurse = false) => Math.round(SEEDLING_DEATH / seedlingStress(wt, nurse));
  assert.equal(ticksToDie(0.45), 48); // 12 weeks
  assert.equal(ticksToDie(0.6), 24); // 6 weeks
  assert.equal(ticksToDie(0.8), 12); // 3 weeks
  assert.equal(ticksToDie(-0.1), 12); // flood: 3 weeks
  assert.equal(ticksToDie(0.6, true), 48);
  assert.equal(ticksToDie(-0.1, true), 12, 'a nurse tree does not help in a flood');
  assert.equal(seedlingStress(0.2), 0);
});

test('growSeedlings: a seedling beside cover >= 0.6 grows twice as fast; a wet tick resets stress; stress kills', () => {
  const g = createGame(lvl()), wd = g.world;
  const lone = at(2, 2), nursed = at(8, 2), tree = at(9, 2), dry = at(2, 9);
  wd.cover[tree] = 0.6;
  wd.wt.fill(0.2);
  wd.wt[dry] = 0.8;
  for (const i of [lone, nursed]) g.seedlings.set(i, 10);
  g.seedlings.set(dry, SEEDLING_DEATH - 4);
  growSeedlings(g);
  assert.ok(Math.abs(wd.cover[nursed] - 2 * wd.cover[lone]) < 1e-7, `${wd.cover[nursed]} vs ${wd.cover[lone]}`);
  assert.equal(g.seedlings.get(lone), 0);
  assert.ok(!g.seedlings.has(dry), 'dead');
  assert.equal(wd.cover[dry], 0);
});

test('an illegal canal dug through a smouldering tile puts the fire out', () => {
  const g = createGame(lvl({ canals: [], illegalCanals: [[[0, 2], [1, 2]]] }));
  g.world.fire[at(0, 2)] = 2; g.world.fireT[at(0, 2)] = 56; g.world.wt[at(0, 2)] = 0.8;
  for (let t = 0; t < 8; t++) step(g);
  assert.equal(g.world.kind[at(0, 2)], KIND.CANAL);
  assert.equal(g.world.fire[at(0, 2)], 0);
});
