# Rewet Gameplay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Rewet intro/menu prototype into a playable 6-level peat restoration game: a hydrology-lite simulation, the 3R actions, scoring with one star per R, and a data view.

**Architecture:** A pure, deterministic simulation in `src/sim/` (typed arrays, seeded RNG, fixed tick), tested with `node --test`. Canvas rendering and DOM UI in `src/render/` and `src/ui.js` read the simulation state but never change it, except through `applyAction`. `index.html` keeps the markup and CSS and loads `src/main.js` as an ES module.

**Tech Stack:** plain JavaScript (ES modules), Canvas 2D, WebAudio, `localStorage`, Node ≥ 20 `node --test`. No dependencies, no build step.

**Spec:** `docs/superpowers/specs/2026-11-10-rewet-gameplay-design.md`. Sourced values: `docs/references/peat-hydrology-and-emissions.md`.

## Global Constraints

- No npm dependencies. `package.json` exists only for `"type": "module"` and the `test` script.
- Tile = 50 m; 4 ticks per week; 52 weeks per year, so `TICKS_PER_YEAR = 208`.
- Wet season = weeks 0–30, dry season = weeks 31–51. ×1 speed = 208 ticks per 75 s.
- Wet/healthy threshold: `wt ≤ 0.40` m. Positive `wt` means the water is below the surface.
- Distance decay: `L_dry = 100` m, `L_wet = 45` m, cutoff 400 m.
- Drainage strength `S`: open canal 1.0; river 0.6; above a temporary block 0.35; above a permanent block 0.1 (was 0.2, set by C2); backfilled 0. `maxHeadTiles = 6`.
- Subsidence: `dz (cm/yr) = 0.1 × wt (cm)` when `wt > 0`.
- Clamp `wt` to [-0.3, 1.5]. Micro-relief amplitude ±0.3 m.
- CO2: shown as **t C**. Drained cropland 14 t C/ha/yr; rewetted 0; fire 353 t d.m./ha × 0.464.
- `src/sim/**` must not reference `window`, `document` or canvas.
- Same seed + same action list gives an identical end state.
- Save key `rewet_v1`. Every `localStorage` access goes through `src/save.js` in a try/catch.
- All UI text is in English and kept in `src/strings.js`.

## Review Focus

1. **Repeated taps / double actions on one tile.** The second action is refused with reason `"busy"`, and no funds are spent twice. Test in Task 7.
2. **Tab hidden, then shown again** (a huge frame gap). The loop runs at most 8 ticks per frame and drops the backlog; it doesn't freeze or skip a season report. Test in Task 10.
3. **Resize or rotation mid-level.** The buffer and camera are recomputed, and `screenToTile` still hits the tapped tile. Test in Task 11 (iso math with a changed origin).
4. **Corrupt, old-version or blocked `localStorage`.** The game starts from a fresh save and doesn't throw. Test in Task 13.
5. **An illegal canal reaching a block, village or backfilled tile.** Its path stops there; it never overwrites those tiles. Test in Task 7.

---

## File Structure

```
package.json                 {"type":"module","scripts":{"test":"node --test"}}
src/sim/world.js             createWorld, idx, KIND, BLOCK, mulberry32
src/sim/terrain.js           generateTerrain
src/sim/drainage.js          computeStrength, computeDistance
src/sim/season.js            TICKS_PER_YEAR, seasonAt(tick) -> env
src/sim/hydro.js             HYDRO params, hydroTick
src/sim/fire.js              fireTick, ignite
src/sim/game.js              createGame, step, applyAction, ACTIONS
src/sim/score.js             evaluate, checkEarlyLoss, co2Estimate, PASS_LINES
src/levels.js                LEVELS (6 definitions), buildLevelWorld(level)
src/render/isoMath.js        tileToScreen, screenToTile
src/render/iso.js            sprite cache, drawWorld(ctx, game, view)
src/render/view.js           camera, data-view heatmap
src/ui.js                    HUD, action bar, tile info, year report, debrief
src/audio.js                 blip (moved from index.html)
src/save.js                  loadSave, writeSave, DEFAULT_SAVE
src/strings.js               all UI copy
src/main.js                  boot, screens, loop
scripts/sim-run.js           headless level + plan runner
test/*.test.js
```

---

### Task 1: World state, seeded RNG, test harness

**Files:**
- Create: `package.json`, `src/sim/world.js`
- Test: `test/world.test.js`

**Interfaces:**
- Produces:
  - `KIND = {PEAT:0, CANAL:1, RIVER:2, VILLAGE:3, FARM:4}`
  - `BLOCK = {NONE:0, TEMP:1, PERM:2, FILLED:3}`
  - `mulberry32(seed:number) -> () => number` (values in [0,1))
  - `idx(w, x, y) -> number`
  - `createWorld({w, h, seed}) -> World`, where World is `{w, h, n, seed, rng, z, wt, cover, dist: Float32Array; kind, block, fire: Uint8Array; src: Int32Array}`
  - Initial values: `wt` = 0.3; `src` = -1 (index of the nearest drainage tile).

- [ ] **Step 1: Write the failing tests**

```js
test('rng is deterministic', () => { const a = mulberry32(7), b = mulberry32(7); assert.deepEqual([a(),a(),a()], [b(),b(),b()]); });
test('world arrays sized w*h', () => { const W = createWorld({w:5,h:4,seed:1}); assert.equal(W.n,20); assert.equal(W.z.length,20); assert.equal(W.kind[0], KIND.PEAT); assert.equal(W.src[0], -1); });
test('idx row-major', () => assert.equal(idx(5,2,3), 17));
```

- [ ] **Step 2:** Run `npm test` and expect it to FAIL (module not found).
- [ ] **Step 3:** Create `package.json` (contents in File Structure) and implement `src/sim/world.js`.
- [ ] **Step 4:** Run `npm test` and expect PASS.
- [ ] **Step 5:** Commit: `git add package.json src/sim/world.js test/world.test.js && git commit -m "feat(sim): world state and seeded rng"`

### Task 2: Terrain (gentle dome plus micro-relief)

**Files:**
- Create: `src/sim/terrain.js`
- Test: `test/terrain.test.js`

**Interfaces:**
- Consumes: `createWorld`, `World.rng`
- Produces: `generateTerrain(world, {domeRise=2, microAmp=0.3, smoothR=2, centre=[w/2,h/2]})`. It mutates `world.z`, setting `z = dome + micro`, where:
  - `dome = domeRise × (1 − (r/rMax)²)`
  - `micro` = rng noise box-blurred `smoothR` times, then rescaled to ±`microAmp`

- [ ] **Step 1: Write the failing tests**

```js
test('micro-relief within ±0.3 m of dome', () => { /* generate with domeRise 0: every z in [-0.3, 0.3], and max-min > 0.3 */ });
test('dome highest at centre', () => { /* domeRise 2, microAmp 0: z[centre] ≈ 2, corner < 0.5 */ });
test('same seed same terrain', () => { /* two worlds seed 3: z arrays deepEqual */ });
test('smoothed: neighbour diff small', () => { /* domeRise 0: mean |z[i]-z[i+1]| < 0.1 */ });
```

- [ ] **Step 2:** Run `npm test` and expect FAIL.
- [ ] **Step 3:** Implement `generateTerrain`.
- [ ] **Step 4:** Run `npm test` and expect PASS.
- [ ] **Step 5:** Commit `feat(sim): dome terrain with micro-relief`.

### Task 3: Drainage strength and distance field

**Files:**
- Create: `src/sim/drainage.js`
- Test: `test/drainage.test.js`

**Interfaces:**
- Consumes: `World`, `KIND`, `BLOCK`
- Produces:
  - `DRAIN = {canal:1, river:0.6, temp:0.35, perm:0.1, maxHeadTiles:6, tileM:50}`
  - `computeStrength(world) -> Float32Array S`:
    - Canal tiles start at 1.0 and river tiles at 0.6; every other tile is 0.
    - For each canal tile with `block` TEMP or PERM, walk **upstream** (to canal neighbours with higher `z`) for up to `maxHeadTiles` tiles, stopping at another block. Set S on the walked tiles, and on the block tile itself, to `min(current, temp|perm)`.
    - FILLED tiles are given S = 0.
  - `computeDistance(world, S)`: an 8-connected chamfer distance in metres (orthogonal 50, diagonal 70.71), started from every tile with S > 0. Fills `world.dist` and `world.src` (index of the nearest source). Tiles with no source get `dist = Infinity` and `src = -1`.

- [ ] **Step 1: Write the failing tests**

```js
test('distance in metres from a canal line', () => { /* 10x1 strip, canal at x=0: dist[1]=50, dist[4]=200, src[4]=0 */ });
test('diagonal uses 70.71 m', () => { /* single canal at (0,0) in 3x3: dist at (1,1) ≈ 70.71 */ });
test('block lowers S upstream only, up to maxHeadTiles', () => { /* canal along a slope of 10 tiles, z rising with x, TEMP block at x=2: S[x=2..8]=0.35, S[x=9]=1, S[x=0..1]=1 */ });
test('second block stops the walk', () => { /* blocks at x=2 (TEMP) and x=5 (PERM): S[3..4]=0.35, S[5..11 within head]=0.2 */ });
test('backfilled canal is not a source', () => { /* only canal tile FILLED: dist all Infinity */ });
```

- [ ] **Step 2:** Run `npm test` and expect FAIL.
- [ ] **Step 3:** Implement both functions. Use a two-pass chamfer sweep (forward and backward) that carries `src`.
- [ ] **Step 4:** Run `npm test` and expect PASS.
- [ ] **Step 5:** Commit `feat(sim): drainage strength and distance field`.

### Task 4: Season clock and hydro tick, calibrated to Ritzema Table 4

**Files:**
- Create: `src/sim/season.js`, `src/sim/hydro.js`
- Test: `test/hydro.test.js`, `test/hydro.calibration.test.js`

**Interfaces:**
- Consumes: `World`, `computeStrength`, `computeDistance`
- Produces:
  - `TICKS_PER_YEAR = 208`
  - `seasonAt(tick, {elNino=false}) -> {week, dry:0..1, L}`:
    - `dry` ramps over 4 weeks at each season change.
    - `L = 45 + (100 − 45) × dry`, in metres.
    - In an El Niño year the dry season starts at week 21 instead of 31.
  - `HYDRO` = the tunable constants `{kDrain, kLat, eqDry:0.9, eqWet:0.5, farDry:0.33, farWet:0.06, kVert, cutoffM:400}`
  - `hydroTick(world, S, env, params = HYDRO)` does three things (tests pass `params` overrides, e.g. a raised `farDry` for C2):
    1. Moves `wt` toward the far-from-drainage baseline at rate `kVert`. The baseline is a blend of `farWet` and `farDry` by `env.dry`; dense cover lowers it by up to 0.03.
    2. Applies the pull `kDrain × S[src] × exp(−dist/L) × (eq − wt)` when `dist ≤ 400`, with `eq` a blend of `eqWet` and `eqDry`.
    3. Applies conserving lateral flow on head `h = z − wt`, using 4 neighbours and flux `kLat × Δh`, computed into a delta buffer and then applied.

    It also subtracts subsidence `0.001 × max(0, wt×100) / 208` from `z`, and clamps `wt`.

- [ ] **Step 1: Write the failing unit tests** in `test/hydro.test.js`:

```js
test('T1 lateral flow conserves water', () => { /* random z, wt; S all 0; kVert 0: sum(z - wt) before == after (±1e-4) over 100 ticks */ });
test('flooded dips: lower z tile ends wetter', () => { /* 3x3, centre z -0.3: after 200 ticks wt[centre] < wt[corner] */ });
test('subsidence 0.1 x depth per year', () => { /* fixed wt 0.5 (S 0, flow 0): after 208 ticks z drops 0.05 m ±0.005 */ });
test('seasonAt ramps dry from 0 to 1', () => { /* week 10 -> dry 0, L 45; week 45 -> dry 1, L 100 */ });
```

- [ ] **Step 2: Write the failing calibration test C1** in `test/hydro.calibration.test.js`. Use a 41×1 flat strip with a canal at x=0, run 2000 ticks at fixed env dry=1 (then separately dry=0), and assert `wt` within ±0.10 m:

```js
const DRY = {1:0.70, 2:0.54, 8:0.35, 20:0.33}, WET = {1:0.24, 2:0.13, 8:0.05, 20:0.06};
// targets = the exp fit at tile centres 50/100/400/1000 m (spec §2.3)
```

- [ ] **Step 3:** Run `npm test` and expect FAIL.
- [ ] **Step 4:** Implement `season.js` and `hydro.js`. Tune `kDrain`, `kVert` and `kLat` until C1 passes, and write the final values into `HYDRO`.
- [ ] **Step 5:** Run `npm test` and expect PASS (T1, units, C1).
- [ ] **Step 6:** Commit `feat(sim): seasonal hydrology calibrated to Ritzema 2014 Table 4`.

### Task 5: Block calibration (C2) and T2

**Files:**
- Test: `test/hydro.calibration.test.js` (extend)
- Modify: `src/sim/drainage.js` (only the `DRAIN.temp` / `DRAIN.perm` values, if tuning needs it)

**Interfaces:**
- Consumes: Tasks 3 and 4.

- [ ] **Step 1: Write the failing tests**

```js
test('T2 block raises wt upstream', () => { /* sloped canal, add PERM block, 1 year: mean wt of tiles within 4 of upstream canal decreases */ });
test('C2 cascade: 1.1 m -> 0.30–0.45 m mean, dry season still > 0.40 on degraded', () => {
  /* 20x20 degraded site (farDry raised so the start mean wt ≈ 1.1 with open canal);
     full cascade of PERM blocks every 6 tiles; run 1 year of seasonAt;
     assert mean wt over transect tiles in [0.30, 0.45] and max dry-season wt > 0.40 */ });
```

- [ ] **Step 2:** Run `npm test` and expect FAIL or a tuning miss.
- [ ] **Step 3:** Tune `DRAIN.temp` / `DRAIN.perm` (keep both > 0, because blocks leak) until C2 passes. If a value changes from the spec, note it in the spec's section 8.
- [ ] **Step 4:** Run `npm test` and expect PASS.
- [ ] **Step 5:** Commit `test(sim): block calibration against Ritzema 2014 dam results`.

### Task 6: Fire

**Files:**
- Create: `src/sim/fire.js`
- Modify: `src/sim/world.js` (add `fireT`)
- Test: `test/fire.test.js`

**Interfaces:**
- Consumes: `World`, `seasonAt` env.
- Produces:
  - `FIRE = {base:0.0004, spreadP:0.15, smoulderP:0.2, surfaceTicks:8, smoulderTicks:56}`
  - `ignite(world, i) -> boolean`: only works if `wt[i] > 0.40` and the tile is peat or farm.
  - `fireTick(world, env, wind:[dx,dy]) -> {burnt:number[]}`:
    - Spontaneous ignition chance `base × env.dry × (wt − 0.4)`.
    - Fire spreads to dry neighbours, doubled downwind.
    - A burning tile loses cover (to 0) and becomes smouldering (2) with chance `smoulderP`.
    - A smouldering tile re-ignites as surface fire if `wt > 0.40` when its timer ends.
  - Fire timers live in a `Uint16Array` on `world.fireT`. Add this field in `createWorld` (Task 1 file).

- [ ] **Step 1: Write the failing tests**

```js
test('T3 wet peat never ignites', () => { /* all wt 0.3, 10k ticks dry=1, plus ignite() on every tile: no fire */ });
test('fire spreads downwind more', () => { /* seeded: ignite centre, wind [1,0]: burnt count east > west over 50 runs */ });
test('smouldering flares again only if dry', () => { /* set fire=2 timer 1: wt 0.6 -> fire 1; wt 0.2 -> fire 0 */ });
```

- [ ] **Step 2:** Run `npm test` and expect FAIL.
- [ ] **Step 3:** Implement `fire.js` and add `fireT` to `createWorld`.
- [ ] **Step 4:** Run `npm test` and expect PASS.
- [ ] **Step 5:** Commit `feat(sim): peat fire and smouldering`.

### Task 7: Game state, actions, crews, threats

**Files:**
- Create: `src/sim/game.js`
- Test: `test/game.test.js`

**Interfaces:**
- Consumes: everything in `src/sim/`.
- Produces:
  - `ACTIONS`: `{id: {cost, weeks, r: 'rewet'|'reveg'|'revit'|'defense', valid(world, i, game) -> true|reason}}`, with these starting values:

| id | cost | weeks | valid on |
|---|---|---|---|
| `tempBlock` | 100 | 1 | a canal tile |
| `permBlock` | 250 | 3 | a canal tile that has a temporary block |
| `backfill` | 600 | 6 | a canal tile |
| `well` | 80 | 1 | any tile |
| `plant` | 120 (was 60, spec §8 item 6) | 1 | a peat tile; seeds a 3×3 patch |
| `mound` | 50 | 1 | a peat tile |
| `palud` | 200 | 2 | a wet tile next to a village |
| `pond` | 200 | 2 | a canal tile behind a block |
| `fireGroup` | 250 | 2 | a village tile |
| `fireCrew` | 0 | until the fire is out | a burning tile |

    Wet season: `cost × 0.8`.
  - `createGame(level, upgrades={}) -> Game`, where Game is `{world, level, tick, funds, crews:number[] (busy-until tick), jobs:[{id,i,doneAt}], goodwill:50, burnt:Set, dryWtHistory:Float32Array[], wind, events:[], S}`
    - Crews = 3, plus `upgrades.crew`.
    - Funds = `level.grant`.
  - `applyAction(game, id, i) -> {ok:true} | {ok:false, reason:'busy'|'funds'|'crew'|'invalid'}`. Refuses with `busy` if the tile already has a job.
  - `step(game)` runs one tick in this order:
    1. Season.
    2. Finish jobs whose time is up; changing a block or backfilling triggers `computeStrength` + `computeDistance`.
    3. `hydroTick`.
    4. `fireTick`.
    5. Threats:
       - **Arson:** per dry tick, chance `level.arson × (1 − goodwill/100) / 147`.
       - **Illegal canal:** from `level.illegalCanals`, one tile every 8 ticks, from the edge toward the centre. It stops at a block, village or FILLED tile.
    6. Plant growth: `cover += 1/416` per tick while `0 ≤ wt ≤ 0.4`; the seedling dies after 12 ticks at `wt > 0.4`, or after 12 ticks at `wt < 0`.
    7. Yearly grant plus `events.push({type:'yearEnd'})`.
  - The El Niño year is `level.elNinoYear`. Push `events.push({type:'elNinoWarning'})` one year before it.
  - **Action effects:**
    - `mound`: `z += 0.2`.
    - `well`: a fire crew within 3 tiles puts fires out 2× faster.
    - `palud` / `pond`: +5 goodwill per year end. `palud` also gives +40 funds per year while its tile stays wet.
    - `fireGroup`: fires within 6 tiles are spotted at once, and arson chance near the village is × 0.5.
    - A fire reaching a village tile: −10 goodwill.
    - `tempBlock` washes out (block → NONE) with chance 0.02 per wet week when the canal run above it is longer than `maxHeadTiles`.
    - Natural regrowth: peat tiles with `0 ≤ wt ≤ 0.4` next to cover ≥ 0.6 gain `cover += 1/1248` per tick.
  - **Wind:** a random 8-direction wind, changed every 4 weeks.
  - **Upgrades:** `cheapBlocks` = block costs × 0.75; `fastCrew` = fire crew time × 0.7.

- [ ] **Step 1: Write the failing tests**

```js
test('action spends funds and occupies a crew', ...);
test('Review: second action on same tile -> busy, funds unchanged', ...);
test('refuses invalid tile, no funds, no crew', ...);
test('wet season discount 0.8', ...);
test('backfill removes drainage source after job completes', ...);
test('Review: illegal canal stops at block / village / filled tile', ...);
test('low goodwill -> more arson (seeded, 200 runs)', ...);
test('T5 determinism: same seed + action list -> identical wt and z arrays after 2 years', ...);
```

- [ ] **Step 2:** Run `npm test` and expect FAIL.
- [ ] **Step 3:** Implement `game.js`.
- [ ] **Step 4:** Run `npm test` and expect PASS.
- [ ] **Step 5:** Commit `feat(sim): game state, 3R actions, crews and threats`.

### Task 8: Scoring, stars, early loss, CO2

**Files:**
- Create: `src/sim/score.js`
- Test: `test/score.test.js`

**Interfaces:**
- Consumes: `Game`
- Produces:
  - `evaluate(game) -> {rewetPct, coverPct, goodwill, passed, stars, hints: string[]}`
    - `rewetPct` = share of peat tiles whose mean `wt` over the final dry season (`dryWtHistory`) is ≤ 0.40.
    - `coverPct` = mean cover on tiles that aren't canals or farms.
    - Pass lines come from `level.pass = {rewet, reveg, revit}`.
    - `passed = rewetPct ≥ pass.rewet`.
    - `stars = passed ? 1 + (coverPct ≥ reveg) + (goodwill ≥ revit) : 0`.
  - `checkEarlyLoss(game) -> null | 'fire'|'funds'|'goodwill'`:
    - `'fire'`: burnt tiles > 35% of the site.
    - `'funds'`: funds < the cheapest action, all crews idle, no jobs.
    - `'goodwill'`: goodwill ≤ 0.
  - `co2Estimate(game) -> {avoidedTC, fireTC}`:
    - `avoidedTC`: for each tile that started with `wt > 0.4` and ends ≤ 0.4, add `14 × 0.25 × yearsWet`.
    - `fireTC` = burnt tiles × 0.25 × 353 × 0.464.

- [ ] **Step 1: Write the failing tests**

```js
test('T4 stars at exact boundaries', () => { /* rewet 60 & reveg 40 & goodwill 60 -> 3 stars; rewet 59.9 -> 0 stars, passed false; goodwill 59 -> 2 */ });
test('early loss at 35% burnt, not 34%', ...);
test('early loss funds only when idle and broke', ...);
test('fire CO2: one burnt tile = 0.25*353*0.464 t C', () => assert.ok(Math.abs(fireTC - 40.946) < 0.01));
```

- [ ] **Step 2:** Run `npm test` and expect FAIL.
- [ ] **Step 3:** Implement `score.js`.
- [ ] **Step 4:** Run `npm test` and expect PASS.
- [ ] **Step 5:** Commit `feat(sim): 3R scoring, stars, early loss, carbon estimate`.

### Task 9: Levels and headless runner (C3)

**Files:**
- Create: `src/levels.js`, `scripts/sim-run.js`, `test/fixtures/l1-cascade.json`
- Test: `test/levels.test.js`

**Interfaces:**
- Consumes: Tasks 1–8.
- Produces:
  - `LEVELS`: an array of 6 entries `{id, name, size, years, seed, grant, arson, illegalCanals, elNinoYear, pass, canals:[[x,y]...], rivers, villages, farms, teaches}`. Use the sizes, years and pass lines from spec section 5. Level 1's pass is `{60,40,60}` and level 6's is `{75,55,70}`; interpolate linearly for the levels in between.
  - `buildLevelWorld(level) -> World`, which runs terrain, then canals/rivers/villages, then strength and distance, then 52 weeks of warm-up with no actions. That way the level opens already drained.
  - `node scripts/sim-run.js --level N --plan plan.json`, where the plan is `[{tick,id,x,y}]`. Prints `evaluate()` and `co2Estimate()` as JSON.

- [ ] **Step 1: Write the failing tests**

```js
test('every level builds and opens drained (rewetPct < pass.rewet)', ...);
test('pass lines rise monotonically 1..6', ...);
test('C3 on level 4: best 3-block cascade rewets >= 1.5x tiles of best single block', () => { /* brute force over canal tiles, 1 year */ });
test('no-action run of level 1 fails the level', ...);
```

- [ ] **Step 2:** Run `npm test` and expect FAIL.
- [ ] **Step 3:** Write `levels.js` (hand-placed canal layouts; level 4 gets a branching network) and `sim-run.js`.
- [ ] **Step 4:** Run `npm test` and expect PASS. Then run `node scripts/sim-run.js --level 1 --plan test/fixtures/l1-cascade.json` and expect `"passed": true`.
- [ ] **Step 5:** Commit `feat: six levels and headless sim runner`.

### Task 10: Modular boot and game loop

**Files:**
- Create: `src/main.js`, `src/audio.js`, `src/strings.js`
- Modify: `index.html` (move the inline `<script>` logic into modules; keep the markup and CSS; add `<script type="module" src="src/main.js">`)
- Test: `test/loop.test.js`

**Interfaces:**
- Consumes: `createGame`, `step`, `TICKS_PER_YEAR`
- Produces:
  - `ticksForFrame(dtMs, speed, carry) -> {ticks, carry}`. Pure; lives in `main.js` and is exported. Rate = 208 ticks / 75000 ms × speed (0, 1, 2). Result is capped at 8 ticks per frame, and the backlog beyond that is dropped.
  - Screens `intro | menu | levelSelect | level | yearReport | debrief`. A `yearEnd` event pauses the game and shows the year report.
  - `blip(f, d, type, v)` moved unchanged into `audio.js`.

- [ ] **Step 1: Write the failing test**

```js
test('75 s at x1 = 208 ticks', ...);
test('Review: 60 s frame gap -> 8 ticks, carry reset', () => assert.deepEqual(ticksForFrame(60000,1,0), {ticks:8, carry:0}));
test('paused -> 0 ticks', ...);
```

- [ ] **Step 2:** Run `npm test` and expect FAIL.
- [ ] **Step 3:** Implement. The intro and menu behave as they did in the prototype. "New game" opens `levelSelect`.
- [ ] **Step 4:** Run `npm test`, then `python3 -m http.server 8765`. In the browser, the intro plays, the menu works, and level 1 starts and ticks; no console errors.
- [ ] **Step 5:** Commit `refactor: modular boot and fixed-tick game loop`.

### Task 11: Iso rendering and data view

**Files:**
- Create: `src/render/isoMath.js`, `src/render/iso.js`, `src/render/view.js`
- Test: `test/isoMath.test.js`

**Interfaces:**
- Consumes: `Game` (read-only)
- Produces:
  - `tileToScreen(x, y, z, view) -> [sx, sy]`, with TW 16, TH 8, and a z offset of `round(z_micro/0.15)` px, clamped to ±2.
  - `screenToTile(sx, sy, view) -> [x, y] | null`, ignoring the z offset.
  - `view = {ox, oy, zoom}`
  - `drawWorld(ctx, game, view, mode:'normal'|'data')`:
    - Normal mode colours each tile by `wt` (flooded / wet / dry) and `cover`, reusing the block/blob drawing from the prototype.
    - Data mode is a heatmap of `wt`, from 0 (blue) to 1.5 (brown), with a bright outline where `wt` crosses 0.40.
  - Buffer = `ceil(innerWidth/scale) × ceil(innerHeight/scale)`, with scale 3 (or 2 when `innerWidth < 600`). Recomputed on `resize`.

- [ ] **Step 1: Write the failing tests**

```js
test('screenToTile inverts tileToScreen for all tiles of 40x40', ...);
test('Review: inverse still exact after origin/zoom change (resize)', ...);
test('outside map -> null', ...);
```

- [ ] **Step 2:** Run `npm test` and expect FAIL.
- [ ] **Step 3:** Implement. The sprite cache is built once with `fillRect` into offscreen canvases.
- [ ] **Step 4:** Run `npm test`. In the browser, level 1 renders, the tile under the cursor is highlighted, the data toggle (`D` key and a button) works, and `resize` keeps tile picking accurate.
- [ ] **Step 5:** Commit `feat(render): iso map with water-state tiles and data view`.

### Task 12: HUD, actions, year report, debrief

**Files:**
- Create: `src/ui.js`
- Modify: `index.html` (HUD and panel markup and CSS, in the prototype's style), `src/strings.js`

**Interfaces:**
- Consumes: `applyAction`, `evaluate`, `co2Estimate`, `ACTIONS`, `screenToTile`
- Produces: `initUI(game, handlers)` and `renderUI(game)`, both DOM only.
  - **HUD:** year/season, pause/×1/×2 speed buttons (also `P` and `Space`), funds, free crews, goodwill, % wet, and a 40 cm marker.
  - **Action bar:** grouped by R. Tapping an action then a tile calls `applyAction`. A refused action shows `strings.reason[reason]` near the tile for 2 s.
  - **Year report:** water chart (`<canvas>`), burnt %, seedling survival, goodwill and the grant. Shows the El Niño warning when one is pending.
  - **Debrief:** stars, before/after thumbnails, one plain line per goal, data-view figures (including `co2Estimate` labelled "estimate, t C"), and one hint.

- [ ] **Step 1:** Implement against the already-tested simulation API. There are no new sim rules, so no new unit tests: the logic is covered in Tasks 7–8.
- [ ] **Step 2:** Browser check: play level 1 with a cascade plan and pass it with ≥ 1 star. Play it without blocks and fail it. Both debriefs should show correct numbers that match `node scripts/sim-run.js` on the same plan.
- [ ] **Step 3:** Commit `feat(ui): HUD, 3R action bar, year report and debrief`.

### Task 13: Save, unlocks, upgrades, sandbox

**Files:**
- Create: `src/save.js`
- Modify: `src/main.js` (level select, upgrades, sandbox)
- Test: `test/save.test.js`

**Interfaces:**
- Produces:
  - `DEFAULT_SAVE = {version:1, unlocked:1, stars:{}, upgrades:{crew:0, cheapBlocks:0, fastCrew:0}, settings:{mute:false}}`
  - `loadSave(storage) -> Save`, where `storage` has a `getItem`/`setItem` interface (injected so it can be tested).
  - `writeSave(storage, save)`
  - `recordResult(save, levelId, stars) -> Save`: keeps the best stars and unlocks `levelId + 1` when stars > 0.
  - `buyUpgrade(save, id) -> Save | {error}`, with costs crew ★3, cheapBlocks ★3, fastCrew ★4, spent from `totalStars − spent`.
  - Sandbox becomes available when `unlocked > 6`: a random seed, no pass check, and data view on.

- [ ] **Step 1: Write the failing tests**

```js
test('Review: corrupt JSON -> DEFAULT_SAVE, no throw', ...);
test('Review: getItem throws (blocked storage) -> DEFAULT_SAVE', ...);
test('Review: version 0 save -> DEFAULT_SAVE', ...);
test('recordResult keeps best and unlocks next only on pass', ...);
test('buyUpgrade refuses when stars insufficient', ...);
```

- [ ] **Step 2:** Run `npm test` and expect FAIL.
- [ ] **Step 3:** Implement, and wire it into the menu: Continue opens level select, and the old `rewet_save` / `rewet_mute` keys are migrated into `rewet_v1`.
- [ ] **Step 4:** Run `npm test` and expect PASS. In the browser: pass level 1, reload, and level 2 is unlocked; buy an upgrade, and the crew count rises in the next level.
- [ ] **Step 5:** Commit `feat: saves, unlocks, upgrades and sandbox`.
