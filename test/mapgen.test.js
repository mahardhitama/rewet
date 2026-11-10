import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMap, resolveLevel, seedVegetation } from '../src/sim/mapgen.js';
import { createWorld, idx, vegOf, VEG, KIND } from '../src/sim/world.js';
import { LEVELS, buildLevelWorld } from '../src/levels.js';
import { generateTerrain } from '../src/sim/terrain.js';

const L = { size: 30, seed: 11, map: { trunks: 3, branches: 2, meander: 0.2, river: true, villages: 1, illegal: 2 } };
const SEEDS = Array.from({ length: 30 }, (_, i) => i + 1); // covers all four outlets
const maps = SEEDS.map((seed) => ({ ...L, seed })).map((l) => [l, generateMap(l)]);

const key = ([x, y]) => `${x},${y}`;
const near8 = ([x, y], set) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (set.has(key([x + dx, y + dy]))) return true; return false; };
// Tiles to outlet edge: 0 on the outlet edge, size - 1 on the high edge.
const dOut = (n, o) => ([x, y]) => ({ S: n - 1 - y, N: y, E: n - 1 - x, W: x })[o];
// 8-connected groups of a tile list.
function groups(tiles) {
  const left = new Map(tiles.map((t) => [key(t), t])), out = [];
  while (left.size) {
    const [k0, t0] = left.entries().next().value, g = [t0], q = [t0];
    left.delete(k0);
    while (q.length) {
      const [x, y] = q.pop();
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const k = key([x + dx, y + dy]);
        if (left.has(k)) { const t = left.get(k); left.delete(k); g.push(t); q.push(t); }
      }
    }
    out.push(g);
  }
  return out;
}
const trunkTiles = (m) => m.canals.filter((_, i) => m.canalW[i] >= 6);
const branchTiles = (m) => m.canals.filter((_, i) => m.canalW[i] < 6);

test('same seed gives the same map', () => {
  assert.deepEqual(generateMap(L), generateMap(L));
  const m = generateMap(L);
  assert.equal(m.canals.length, m.canalZ.length);
  assert.equal(m.canals.length, m.canalW.length);
  assert.equal(m.canals.length, m.canalD.length);
  assert.deepEqual(Object.keys(m.terrain).sort(), ['outlet', 'tilt']);
  assert.equal(m.terrain.tilt, 1);
  assert.ok('NESW'.includes(m.terrain.outlet));
});

test('each trunk touches the high edge and the outlet edge', () => {
  const outlets = new Set();
  for (const [l, m] of maps) {
    const d = dOut(l.size, m.terrain.outlet), river = new Set(m.rivers.map(key));
    outlets.add(m.terrain.outlet);
    const trunks = groups(trunkTiles(m));
    assert.ok(trunks.length >= 1);
    for (const g of trunks) {
      assert.ok(g.some((t) => d(t) === l.size - 1), 'high edge');
      assert.ok(g.some((t) => d(t) === 0 || near8(t, river)), 'outlet edge');
    }
    assert.ok(m.rivers.length === l.size && m.rivers.every((t) => d(t) === 0));
  }
  assert.equal(outlets.size, 4);
});

test('canal bed falls toward the outlet', () => {
  for (const [l, m] of maps) {
    const d = dOut(l.size, m.terrain.outlet), river = new Set(m.rivers.map(key));
    const z = new Map(m.canals.map((t, i) => [key(t), m.canalZ[i]]));
    m.canals.forEach((t, i) => {
      if (d(t) === 0 || near8(t, river)) return;
      const [x, y] = t;
      let lower = false;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const v = z.get(key([x + dx, y + dy]));
        if (v !== undefined && v < m.canalZ[i]) lower = true;
      }
      assert.ok(lower, `seed ${l.seed} tile ${t}`);
    });
  }
});

// tol: a merged arm bed rises to 0.01 m per step above the join, so it can sit up to about 5 cm above the smooth surface (game value).
function assertBelowSurface(l, m, tol) {
  const w = createWorld({ w: l.size, h: l.size, seed: l.seed });
  generateTerrain(w, { microAmp: 0, ...m.terrain });
  m.canals.forEach(([x, y], i) => {
    if (m.canalW[i] >= 6) assert.ok(m.canalZ[i] <= w.z[idx(l.size, x, y)] + tol, `seed ${l.seed} tile ${x},${y}`);
  });
}

test('trunk bed is at or below the real smooth surface', () => {
  const outlets = new Set();
  for (const [l, m] of maps) {
    outlets.add(m.terrain.outlet);
    assertBelowSurface(l, m, 1e-9);
  }
  assert.equal(outlets.size, 4);
  for (const seed of SEEDS) {
    const l = { ...L, seed, map: { ...L.map, merges: 1 } };
    assertBelowSurface(l, generateMap(l), 0.06);
  }
});

test('canal sizes', () => {
  for (const [, m] of maps) m.canals.forEach((_, i) => {
    const w = m.canalW[i], dd = m.canalD[i];
    if (w >= 6) assert.ok(w <= 10 && dd >= 3.75 && dd <= 6.25);
    else assert.ok(w >= 3 && w <= 5 && dd >= 1.875 && dd <= 3.125);
  });
});

test('branches join a trunk and touch no village, farm or river tile', () => {
  let count = 0;
  for (const [, m] of maps) {
    const trunk = new Set(trunkTiles(m).map(key));
    const avoid = new Set([...m.villages, ...m.farms, ...m.rivers].map(key));
    const bs = groups(branchTiles(m));
    count += bs.length;
    for (const g of bs) {
      assert.ok(g.some((t) => near8(t, trunk)), 'joins a trunk');
      assert.ok(g.every((t) => !near8(t, avoid)), 'touches no village, farm or river');
    }
  }
  assert.ok(count >= SEEDS.length, 'branches exist');
});

test('villages and farms sit on the low half of the map; each farm touches a village', () => {
  let farms = 0;
  for (const [l, m] of maps) {
    const d = dOut(l.size, m.terrain.outlet), village = new Set(m.villages.map(key));
    const canal = new Set(m.canals.map(key)), trunk = new Set(trunkTiles(m).map(key));
    for (const g of groups(m.villages)) assert.ok(g.some((t) => near8(t, trunk)), 'village touches a trunk');
    for (const t of [...m.villages, ...m.farms]) assert.ok(d(t) < l.size / 2);
    assert.ok(m.villages.length <= 9);
    for (const g of groups(m.farms)) {
      farms++;
      assert.ok(g.some((t) => near8(t, village)), 'touches a village');
      assert.ok(g.every((t) => !near8(t, canal)), 'touches no canal');
    }
  }
  assert.ok(farms >= 1);
});

test('illegal canals start on a map edge and touch no existing canal', () => {
  let placed = 0, asked = 0;
  for (const seed of Array.from({ length: 40 }, (_, i) => i + 1)) {
    const l = { ...L, seed }, m = generateMap(l);
    const canal = new Set(m.canals.map(key)), n = l.size;
    asked += l.map.illegal; placed += m.illegalCanals.length;
    for (const p of m.illegalCanals) {
      assert.ok(p.length >= 6 && p.length <= 10, `seed ${l.seed} length ${p.length}`);
      const [x, y] = p[0];
      assert.ok(x === 0 || y === 0 || x === n - 1 || y === n - 1, 'starts on an edge');
      assert.notEqual(dOut(n, m.terrain.outlet)(p[0]), 0, 'not on the outlet edge');
      assert.ok(p.every((t) => !near8(t, canal)));
    }
  }
  assert.ok(placed >= 0.9 * asked, `placed ${placed} of ${asked}`);
});

test('crowded map', () => {
  const m = generateMap({ size: 10, seed: 5, map: { trunks: 6, branches: 2, meander: 0.5, river: true, villages: 2, illegal: 2 } });
  assert.ok(groups(trunkTiles(m)).length >= 1);
});

test('resolveLevel is deterministic and leaves a level with no map unchanged', () => {
  assert.deepEqual(resolveLevel(L), resolveLevel(L));
  assert.equal(resolveLevel(L).size, 30);
  const plain = { size: 22, seed: 1, canals: [[0, 0]] };
  assert.equal(resolveLevel(plain), plain);
  assert.equal(generateMap({ size: 20, seed: 3, map: {} }).canals.length, 0);
});

test('vegOf limits', () => {
  assert.equal(vegOf(0.05), VEG.NONE);
  assert.equal(vegOf(0.15), VEG.FERN);
  assert.equal(vegOf(0.3), VEG.SEEDLING);
  assert.equal(vegOf(0.6), VEG.SHRUB);
  assert.equal(vegOf(0.9), VEG.TREE);
});

test('seedVegetation is deterministic and does not touch world.rng', () => {
  const mk = () => { const wd = createWorld({ w: 20, h: 20, seed: 7 }); generateTerrain(wd); return wd; };
  const a = mk(), b = mk(), c = mk();
  seedVegetation(a); seedVegetation(c);
  assert.deepEqual(a.cover, c.cover);
  assert.ok(a.cover.some((v) => v > 0));
  for (let k = 0; k < 5; k++) assert.equal(a.rng(), b.rng());
});

test('more trees far from canals', () => {
  const wd = buildLevelWorld(resolveLevel(LEVELS[0]));
  const mean = (f) => { let s = 0, c = 0; for (let i = 0; i < wd.n; i++) if (wd.kind[i] === KIND.PEAT && f(wd.dist[i])) { s += wd.cover[i]; c++; } return s / c; };
  assert.ok(mean((d) => d > 200) > mean((d) => d <= 50));
});

// Task 13: canal merges, forks and links. A 24x24 level with 3 trunks and no river, so the outlet edge is d = 0.
const NET = { size: 24, seed: 1, map: { trunks: 3, branches: 0, meander: 0.2, river: false, villages: 0, illegal: 0 } };
const net = (f, seed = NET.seed) => { const l = { ...NET, seed, map: { ...NET.map, ...f } }; return [l, generateMap(l)]; };
const NET_SEEDS = [1, 2, 3, 4, 5, 6];
// Trunk-size canals in output order. Each canal lists its tiles by canonical row, so a new canal starts where the row does not go up by 1.
function trunkCanals(l, m) {
  const d = dOut(l.size, m.terrain.outlet), out = [];
  let prev = -2;
  m.canals.forEach((t, i) => {
    if (m.canalW[i] < 6) return;
    const row = l.size - 1 - d(t);
    if (row !== prev + 1) out.push([]);
    out[out.length - 1].push({ t, z: m.canalZ[i], row });
    prev = row;
  });
  return out;
}
const outletGroups = (l, m) => { const d = dOut(l.size, m.terrain.outlet); return groups(m.canals.filter((t) => d(t) === 0)); };
// Each canal tile has a lower canal neighbour or a river neighbour, or is on the outlet edge.
function assertFalls(l, m) {
  const d = dOut(l.size, m.terrain.outlet), river = new Set(m.rivers.map(key));
  const z = new Map(m.canals.map((t, i) => [key(t), m.canalZ[i]]));
  m.canals.forEach(([x, y], i) => {
    if (d([x, y]) === 0 || near8([x, y], river)) return;
    let lower = false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (z.get(key([x + dx, y + dy])) < m.canalZ[i]) lower = true;
    assert.ok(lower, `seed ${l.seed} tile ${x},${y}`);
  });
}

test('merge: the trunks that reach the outlet edge are one fewer', () => {
  const [l, m] = net({ merges: 1 });
  assert.equal(outletGroups(l, m).length, l.map.trunks - 1);
});

test('merge: the bed at the join is lower than the last tile of each arm', () => {
  for (const seed of NET_SEEDS) {
    const [l, m] = net({ merges: 1 }, seed);
    const cs = trunkCanals(l, m), d = dOut(l.size, m.terrain.outlet);
    const arm = cs.find((c) => d(c[c.length - 1].t) > 0);
    assert.ok(arm, `seed ${seed}: no merged arm`);
    const e = arm[arm.length - 1];
    const near = ([x, y], [u, v]) => Math.max(Math.abs(x - u), Math.abs(y - v)) === 1;
    const into = cs.filter((c) => c !== arm).map((c) => [c, c.findIndex((p) => p.row === e.row && near(p.t, e.t))]).find(([, k]) => k > 0);
    assert.ok(into, `seed ${seed}: no join tile`);
    const [c, k] = into;
    assert.ok(c[k].z < e.z, `seed ${seed}: join below the merged arm`);
    assert.ok(c[k].z < c[k - 1].z, `seed ${seed}: join below the other arm`);
  }
});

test('fork: the trunks that reach the outlet edge are one more', () => {
  for (const seed of NET_SEEDS) {
    const [l, m] = net({ forks: 1 }, seed);
    const g = outletGroups(l, m);
    assert.equal(g.length, l.map.trunks + 1, `seed ${seed}`);
    // Each group is at least 3 tiles from the next (Chebyshev).
    for (let a = 0; a < g.length; a++) for (let b = a + 1; b < g.length; b++)
      for (const [x1, y1] of g[a]) for (const [x2, y2] of g[b]) assert.ok(Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2)) >= 3, `seed ${seed}`);
    // The fork arm is the trunk-size canal that does not start on the high edge. Its bed falls at each step.
    const arms = trunkCanals(l, m).filter((c) => c[0].row > 0);
    assert.equal(arms.length, 1, `seed ${seed}`);
    arms[0].forEach((p, k) => k && assert.ok(p.z < arms[0][k - 1].z, `seed ${seed} step ${k}`));
  }
});

test('link: a link canal touches two different trunks', () => {
  const [, m] = net({ links: 1 });
  const trunks = groups(trunkTiles(m)).map((g) => new Set(g.map(key)));
  const links = groups(branchTiles(m)).filter((g) => g.length >= 3 && g.length <= 8 && (g.every((t) => t[0] === g[0][0]) || g.every((t) => t[1] === g[0][1])));
  assert.ok(links.some((g) => {
    const s = [...g].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const ta = trunks.findIndex((t) => near8(s[0], t)), tb = trunks.findIndex((t) => near8(s[s.length - 1], t));
    return ta >= 0 && tb >= 0 && ta !== tb;
  }));
});

test('every canal tile has a lower canal or river neighbour, or is on the outlet edge', () => {
  for (const f of [{ merges: 1 }, { forks: 1 }, { links: 1 }]) assertFalls(...net(f));
  for (const l of LEVELS) assertFalls(l, generateMap(l));
});

test('the same seed gives the same map with merges, forks and links', () => {
  const [l, m] = net({ merges: 1, forks: 1, links: 1 });
  assert.deepEqual(generateMap(l), m);
});
