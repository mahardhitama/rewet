# Rewet Procedural Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate each level map from parameters and a seed, give canals width, depth and a water level, add starting vegetation, show the full map with zoom on 32×16 tiles, and improve the UI layout.

**Architecture:** A new pure module `src/sim/mapgen.js` turns level parameters into the tile lists that `placeLevel()` reads now, plus canal size lists. `resolveLevel(level)` expands a parameter level into a tile-list level once, before `buildLevelWorld()` and `createGame()`. Old tile-list levels (the tests use them) still work. The renderer and the camera change in `src/render/`; the sim stays pure.

**Tech Stack:** plain JavaScript (ES modules), Canvas 2D, Node ≥ 20 `node --test`. No dependencies, no build step.

**Spec:** `docs/superpowers/specs/2026-11-10-rewet-procgen-map-design.md`. Base spec: `docs/superpowers/specs/2026-11-10-rewet-gameplay-design.md`. Sourced values: `docs/references/canal-dimensions.md`, `docs/references/peat-hydrology-and-emissions.md`.

## Global Constraints

- All constraints of `docs/superpowers/plans/2026-11-10-rewet-gameplay.md` stay.
- `src/sim/**` must not reference `window`, `document` or canvas.
- Same seed and same action list give an identical end state.
- C1, C2 and C3 pass with no change to their tolerances. If a change breaks them, tune the constants.
- A new chance roll must not use `world.rng` on the default path. Vegetation uses `mulberry32(seed ^ VEG_SALT)`, with `VEG_SALT = 0x5eed`.
- Trunk canal base size: 8 m wide, 5 m deep (KFCP 2014 p.9). Branch base size: 4 m wide, 2.5 m deep (`NOT SOURCED`). Each section of 3 to 6 tiles varies by ±25%.
- `cDepthRef = 5` m. Canal fill: 0.15 of `cDepth` in the wet season, 0.7 in the dry season. `kCanal = 0.05` per tick. Tilt 1.0 m. These are game values, `NOT SOURCED`.
- Start cover: `TREE` 1.0, `SHRUB` 0.6, `SEEDLING` 0.3, `FERN` 0.15, `NONE` 0.
- `TW = 32`, `TH = 16`. Zoom steps: the fit scale, then each of 1, 2 and 3 that is larger than the fit scale.
- Buttons at least 44×44 CSS px. Each control works with the keyboard and shows a focus ring.
- Each comment, doc and commit message passes the STE100 lint (`.claude/skills/rewet/ste100-lint.md`).
- Each tuned game value goes in spec section 8 with the run that set it.

## Review Focus

1. **Seed with no room for canals:** a small map with many trunks can fail to place trunks 4 tiles apart. Expected: `generateMap` places fewer trunks (at least 1) and does not loop forever. Test in Task 2.
2. **Branch that would cross a trunk or a village:** expected: the branch stops one tile before it. Test in Task 2.
3. **Zoom while a drag is in progress, and a pinch that starts as a tap:** expected: no tile is picked, and the pan does not jump. Test in Task 5 (pure `panForZoom` test) and the browser check.
4. **Resize or rotation at a zoom step that no longer exists** (the new fit scale is larger than the old step): expected: the zoom falls back to the nearest step that exists. Test in Task 5.
5. **Sandbox seed shared between players:** the same seed must give the same map. Test in Task 2 (`resolveLevel` twice with the same seed gives deep-equal results).

---

### Task 1: Tilted dome terrain

**Files:**
- Modify: `src/sim/terrain.js`
- Test: `test/terrain.test.js`

**Interfaces:**
- Produces: `generateTerrain(world, { domeRise = 2, microAmp = 0.3, smoothR = 2, centre, tilt = 0, outlet = 'S' })`. `outlet` is `'N' | 'E' | 'S' | 'W'`. With `tilt > 0` and no `centre`, the centre is the midpoint of the edge opposite the outlet. With `tilt = 0` and no `centre`, the result is the same as today (old tests stay).

- [ ] **Step 1: Write the failing tests**
  - `tilted terrain falls along each straight path to the outlet`: for each outlet in `['N','E','S','W']`, world 20×20, `microAmp: 0`, `tilt: 1`. Along each line perpendicular to the outlet edge, `z` falls strictly at each step toward the outlet.
  - `tilt 0 gives the old dome`: same seed, `generateTerrain(a)` and `generateTerrain(b, { tilt: 0 })` give equal `z`.
- [ ] **Step 2: Run `node --test test/terrain.test.js`.** Expected: the tilt test fails.
- [ ] **Step 3: Implement.** `u` = distance from the outlet edge divided by `size − 1`. Add `tilt × u` to `z`.
- [ ] **Step 4: Run `npm test`.** Expected: all pass.
- [ ] **Step 5: Commit** `feat(sim): add tilt and outlet edge to terrain`.

### Task 2: Map generator

**Files:**
- Create: `src/sim/mapgen.js`
- Test: `test/mapgen.test.js`

**Interfaces:**
- Consumes: `generateTerrain` (Task 1), `createWorld`, `mulberry32` (`src/sim/world.js`).
- Produces:
  - `generateMap(level) -> { canals, canalZ, canalW, canalD, rivers, villages, farms, illegalCanals, terrain }`.
    - `canals`: `[x, y][]`. `canalZ`, `canalW`, `canalD`: numbers in the same order as `canals` (bed elevation in m, width in m, depth in m).
    - `illegalCanals`: `[x, y][][]`, each path ordered from the map edge inward.
    - `terrain`: the options object for `generateTerrain` (`{ tilt, outlet }`). `placeLevel()` and `domeZ()` pass it on.
  - `resolveLevel(level) -> level`. If `level.map` is set, it returns `{ ...level, ...generateMap(level) }`. Otherwise it returns `level` unchanged.
- `level.map` shape: `{ trunks, branches, meander, river, villages, illegal }`. `branches` is per trunk. `river` is a boolean.

- [ ] **Step 1: Write the failing tests.** For a test level `{ size: 30, seed: 11, map: { trunks: 3, branches: 2, meander: 0.2, river: true, villages: 1, illegal: 2 } }`:
  - `same seed gives the same map`: `assert.deepEqual(generateMap(L), generateMap(L))`.
  - `each trunk touches the high edge and the outlet edge`. Find trunks as connected canal groups that touch the outlet edge.
  - `canal bed falls toward the outlet`: each canal tile that is not on the outlet edge has an 8-neighbour canal tile with a lower `canalZ`, or a river neighbour.
  - `canal sizes`: each trunk `canalW` is in [6, 10] and `canalD` in [3.75, 6.25]. Each branch `canalW` is in [3, 5] and `canalD` in [1.875, 3.125].
  - `branches join a trunk and touch no village, farm or river tile` (Review Focus 2).
  - `villages and farms sit on the low half of the map; each farm touches a village`.
  - `illegal canals start on a map edge and touch no existing canal`.
  - `crowded map`: `{ size: 10, map: { trunks: 6, ... } }` returns at least 1 trunk and ends (Review Focus 1).
  - `resolveLevel twice with the same seed gives deep-equal results; a level with no map field comes back unchanged` (Review Focus 5).
- [ ] **Step 2: Run `node --test test/mapgen.test.js`.** Expected: fail, module not found.
- [ ] **Step 3: Implement `generateMap(level)` in `src/sim/mapgen.js`.**
  - Use `mulberry32(level.seed ^ 0x3a9)` as the map RNG. The outlet edge is `'NESW'[floor(rng() × 4)]`.
  - Work in canonical coordinates: high edge `y = 0`, outlet edge `y = size − 1`. Rotate each tile list to the real outlet at the end. Use the same rotation for `terrain.outlet`.
  - Smooth surface: a world from `createWorld` plus `generateTerrain(w, { microAmp: 0, tilt: 1, outlet })`.
  - Trunk: start at a random `x` on `y = 0` that is at least 4 tiles from each placed trunk. Step `y + 1` each time, plus a sideways step with chance `meander` (stay ≥ 4 tiles from other trunks). Try up to 20 starts per trunk, then skip that trunk.
  - Trunk bed, inlet to outlet: `bed[k] = min(bed[k − 1] − 0.01, surface[k])`.
  - Branch: start on a trunk tile in the middle 60% of the trunk. Go diagonally uphill (`y − 1`, `x ± 1`) for 5 to 10 tiles. Stop one tile before a tile that is a canal, river, village or farm, or within one tile of one. Branch bed, from the junction outward: `bed[k] = max(bed[k − 1] + 0.01, surface[k])`.
  - Size per section: base size × `(0.75 + 0.5 × rng())`, a new roll each 3 to 6 tiles.
  - River: the row `y = size − 1` when `map.river` is true. Trunks then end on `y = size − 2`.
  - Village: a 3×3 block next to a trunk, in rows `size − 5` to `size − 2`. Farm: a 4×3 block that touches the village and no canal.
  - Illegal canal: from a side edge (`x = 0` or `x = size − 1`) at a random `y` in the upper half, toward the dome centre, 6 to 10 tiles. Stop before a canal.
- [ ] **Step 4: Run `node --test test/mapgen.test.js`.** Expected: pass.
- [ ] **Step 5: Commit** `feat(sim): generate level maps from parameters and a seed`.

### Task 3: Levels from parameters

**Files:**
- Modify: `src/levels.js`, `src/sim/game.js:42-57` (`domeZ`, `placeLevel`), `src/main.js:90-97`, `scripts/sim-run.js`
- Create: `scripts/auto-plan.js`
- Modify: `test/levels.test.js`, `test/fixtures/l1-cascade.json`, `test/fixtures/l1-reveg.json`
- Modify: spec section 8

**Interfaces:**
- Consumes: `resolveLevel` (Task 2).
- Produces:
  - `placeLevel(level)` reads `canalZ` when it is present (else the dome, as now). `domeZ(level)` passes `level.terrain` to `generateTerrain`.
  - `blockPlan(level, { perm = true } = {}) -> [{ tick, id, x, y }]` in `scripts/auto-plan.js`, for a resolved level.
  - `startLevel(level)` in `main.js` and `runPlan` in `sim-run.js` call `resolveLevel()` first.

- [ ] **Step 1: Change `LEVELS`.** Replace the tile lists with a `map` object per level. Start values (spec 2.1):

| Level | trunks | branches | meander | river | villages | illegal |
|---|---|---|---|---|---|---|
| 1 | 3 | 0 | 0.15 | false | 0 | 0 |
| 2 | 3 | 1 | 0.2 | false | 0 | 0 |
| 3 | 3 | 1 | 0.2 | true | 1 | 0 |
| 4 | 3 | 2 | 0.25 | false | 1 | 2 |
| 5 | 4 | 1 | 0.25 | false | 1 | 1 |
| 6 | 4 | 2 | 0.3 | true | 2 | 2 |

  Remove `line`, `lines` and `rect` if no level uses them.
- [ ] **Step 2: Update `test/levels.test.js`.** Each test that reads `l.canals` or `l.illegalCanals` calls `resolveLevel(l)` first. `level 5 has an El Nino year; illegal canals only from level 4` reads `resolveLevel(l).illegalCanals`.
- [ ] **Step 3: Write `blockPlan(level)`.** Sort canal tiles by `canalZ`, low first. Pick a tile if no picked tile is within 4 tiles (Chebyshev). At tick 0, order `tempBlock` on each picked tile, as crews allow (one order per free crew each 4 ticks). After each `tempBlock` ends, order `permBlock` on the same tile. CLI: `node scripts/auto-plan.js --level N > plan.json`.
- [ ] **Step 4: Add the test `each level passes with blockPlan and fails with no action`.** For each level: `runPlan(id, blockPlan(resolveLevel(l)))` gives `evaluate.passed === true`. The no-action test stays.
- [ ] **Step 5: Run `npm test`.** Expected: the new pass test and C3 can fail. Tune `map` parameters and the level seeds until they pass. Do not change `pass.rewet` lines or C3 tolerances. Record the final values and the run results in spec section 8.
- [ ] **Step 6: Regenerate the fixtures.** `l1-cascade.json` = `node scripts/auto-plan.js --level 1`. `l1-reveg.json` = that plan plus a planting grid on every third tile (as the old fixture). Both fixture tests pass.
- [ ] **Step 7: Run `npm test` and `node scripts/sim-run.js --level 1 --plan test/fixtures/l1-cascade.json`.** Expected: all pass, `passed: true`.
- [ ] **Step 8: Check in the browser** that each level opens with canals edge to edge. Then commit `feat(levels): build level maps from parameters`.

### Task 4: Canal width, depth and water level

**Files:**
- Modify: `src/sim/world.js`, `src/sim/hydro.js`, `src/sim/game.js` (`placeLevel`, `step`, `finish`)
- Test: `test/hydro.test.js`, `test/game.test.js`

**Interfaces:**
- Produces:
  - `world.cWidth`, `world.cDepth`, `world.cWater`: `Float32Array(n)`, 0 off canals.
  - `CANAL = { depthRef: 5, fillWet: 0.15, fillDry: 0.7, k: 0.05 }` exported from `hydro.js`.
  - `canalTick(world, S, env)` in `hydro.js`.
  - In `hydroTick`, for a source `s` with `cDepth[s] > 0`: `eq × cDepth[s] / CANAL.depthRef`. Other sources use `eq` as now.

- [ ] **Step 1: Write the failing tests.**
  - `a 5 m canal gives the same wt as a canal with no depth`: two equal worlds, one with `cDepth = 5` on its canal tiles. After 208 ticks of `hydroTick`, `wt` is equal.
  - `a 2.5 m canal drains less than a 5 m canal`: mean `wt` within 200 m is smaller.
  - `canal water drops in the dry season`: open canal, `cDepth = 5`. After the dry season, `cWater` is within 0.05 m of `3.5`. After the wet season, within 0.05 m of `0.75`.
  - `water stays higher behind a block`: tile with `S = 0.1` has `cWater` near `0.1 × 3.5`.
  - `backfill sets cWater to 0` (game test).
  - `placeLevel copies canalW and canalD into the world`.
- [ ] **Step 2: Run the tests.** Expected: fail.
- [ ] **Step 3: Implement.** `canalTick`: target = `cDepth × (fillWet + (fillDry − fillWet) × env.dry) × min(1, S[i] / DRAIN.canal)`; `cWater += CANAL.k × (target − cWater)`. Call `canalTick` in `step()` right after `hydroTick`. At `placeLevel`, set `cWater` to the dry target, since `buildLevelWorld` ends in the dry season.
- [ ] **Step 4: Run `npm test`.** Expected: all pass, C1 to C3 included. If Task 3 balance tests fail now (branches drain less), tune `map` parameters, not `CANAL.depthRef`. Record it in spec section 8.
- [ ] **Step 5: Commit** `feat(sim): give canals width, depth and a seasonal water level`.

### Task 5: Starting vegetation and the revegetation goal

**Files:**
- Modify: `src/sim/world.js` (`VEG`, `vegOf`), `src/sim/mapgen.js` (`seedVegetation`), `src/levels.js` (`buildLevelWorld`), `src/sim/game.js` (`createGame`), `src/sim/score.js`
- Test: `test/mapgen.test.js`, `test/score.test.js`, `test/levels.test.js`

**Interfaces:**
- Produces:
  - `VEG = { NONE: 0, FERN: 1, SEEDLING: 2, SHRUB: 3, TREE: 4 }`, `vegOf(cover) -> VEG value` (limits: 0.1, 0.2, 0.5, 0.85).
  - `seedVegetation(world, { treeShare = 1 } = {})`: sets `cover` on peat tiles. Called at the end of `buildLevelWorld`. Level 2 uses `treeShare: 0.3`; put it in `level.map.treeShare`.
  - `g.cover0`: `Float32Array` copy of `cover` at `createGame`.
  - `evaluate(g).coverPct`: mean of `max(0, cover − cover0) / max(0.01, 1 − cover0)` over the tiles it counts now, × 100.

- [ ] **Step 1: Write the failing tests.**
  - `vegOf limits`: `vegOf(0.05) === NONE`, `0.15` FERN, `0.3` SEEDLING, `0.6` SHRUB, `0.9` TREE.
  - `seedVegetation is deterministic and does not touch world.rng`: two equal worlds; seed one. Next `world.rng()` values are equal.
  - `more trees far from canals`: mean cover at `dist > 200` m is larger than at `dist ≤ 50` m.
  - `coverPct is 0 at the start of each level` (score test, for all 6 levels).
  - `full growth gives 100`: set `cover = 1` on all counted tiles; `coverPct === 100`.
- [ ] **Step 2: Run the tests.** Expected: fail.
- [ ] **Step 3: Implement.** Per peat tile: `p = noise × wetness`, where `wetness = clamp01(1 − wt)` and `noise` is blurred `vegRng` noise in [0, 1] (export `boxBlur` from `terrain.js`). Pick the type with one constant table `VEG_LIMITS = [[0.55, TREE], [0.4, SHRUB], [0.28, SEEDLING], [0.15, FERN]]`: the first row with `p ≥ limit` wins, else `NONE`. A `TREE` roll becomes `SHRUB` when `vegRng() > treeShare`. No vegetation within 1 tile of a canal or a farm. Tune the limits so level 1 opens with 20% to 40% mean cover; record the result in spec section 8.
- [ ] **Step 4: Run `npm test`.** The fixture `l1-reveg.json` must still reach the revegetation star. If not, tune `pass.reveg` with headless runs and update the `levels.test.js` pass-line test. Record the runs in spec section 8.
- [ ] **Step 5: Commit** `feat(sim): seed starting vegetation; score cover gain`.

### Task 6: Fit-and-zoom camera with 32×16 tiles

**Files:**
- Modify: `src/render/isoMath.js`, `src/render/view.js`, `index.html` (zoom buttons, `#zoom` group), `src/strings.js` (button labels), `src/main.js` (keys `+`, `-`, `0`)
- Test: `test/isoMath.test.js`

**Interfaces:**
- Produces:
  - `TW = 32`, `TH = 16`, `PAD = 48`, `HUD_PAD = 96`. `zOffset(z)`: 0.075 m per px, clamped to ±4 px.
  - `fitScale(innerW, innerH, w, h, insets = { top: 0, bottom: 0 }) -> number`: largest scale at which the map box plus `PAD` fits between the insets.
  - `zoomSteps(fit) -> number[]`: `[fit, ...[1, 2, 3].filter(s => s > fit * 1.1)]`.
  - `cameraFor(innerW, innerH, w, h, pan, scale, insets)`: `scale` replaces the fixed 2 or 3. The map centres between the insets.
  - `panForZoom(cam0, scale1, clientX, clientY, innerW, innerH, insets) -> pan`: the pan at `scale1` that keeps the map point under the client point in place.
  - `view.zoom(dir, clientX?, clientY?)`, with `dir` in `+1 | −1 | 0` (0 = fit).

- [ ] **Step 1: Update and write the failing tests.**
  - Change `Review: inverse still exact after origin change (resize)`: the scale is now an argument. Keep the round trip at each step of `zoomSteps(fitScale(...))` for 1280×720, 390×844, 844×390, 1921×1081.
  - `fit shows the full map`: for 390×844, 844×390 and 1280×800 with `w = h = 40` and insets `{ top: 56, bottom: 72 }`, the four corner tiles are inside the buffer and outside the inset bands.
  - `largest zoom gives tiles at least 48 x 24 CSS px on a 390 px screen`: `TW × max(zoomSteps(fit)) ≥ 48`.
  - `panForZoom keeps the tile under the pointer` for zoom in and zoom out (Review Focus 3).
  - `a zoom step that no longer exists falls back to the nearest step` after a resize (Review Focus 4). Put this rule in `view.fit()` and test it through a pure helper `nearestStep(steps, scale)`.
- [ ] **Step 2: Run `node --test test/isoMath.test.js`.** Expected: fail.
- [ ] **Step 3: Implement the pure functions in `isoMath.js`.**
- [ ] **Step 4: Implement input in `view.js`.** Wheel: one step per event around the pointer, `preventDefault`. Pinch: track 2 active pointers; the distance ratio changes the step at ±25%. A pinch sets `wasDrag = true`, so it never picks a tile. Insets come from `#hud` and `#bar` `offsetHeight` when they are shown.
- [ ] **Step 5: Add `+`, `−` and fit buttons** (44×44 CSS px, focus ring, labels in `strings.js`) and the keys `+`, `-`, `0`.
- [ ] **Step 6: Run `npm test`.** Expected: all pass.
- [ ] **Step 7: Check in the browser** at 390×844 with touch, 844×390 and 1280×800: the level opens with the full map, zoom works, a tap after a zoom picks the right tile. Commit `feat(render): fit-and-zoom camera with 32x16 tiles`.

### Task 7: Detailed sprites, canal water and flow markers

**Files:**
- Modify: `src/render/iso.js`
- Read first: `.claude/skills/rewet/sprites.md`

**Interfaces:**
- Consumes: `TW`, `TH` (Task 6), `cWidth`, `cWater`, `cDepth` (Task 4), `vegOf`, `VEG` (Task 5).
- Produces: `drawWorld()` with the same signature.

- [ ] **Step 1: Rescale the sprite frame.** `SW = TW`, `HEAD = 28`, `D = 10`, `EDGE = D + 12`. `block()` uses `TW/2` and `TH/2`, not literal 8 and 4.
- [ ] **Step 2: Ground.** 3 water states × 5 cover bins, as now. Add 2 or 3 shades and specks per sprite, placed with `hash`. Flooded ground has water patches.
- [ ] **Step 3: Vegetation.** 2 variants for each of `FERN`, `SEEDLING`, `SHRUB`, `TREE` (spec 3.3). Draw the sprite for `vegOf(cover[i])`. A tile in `game.seedlings` shows `SEEDLING`.
- [ ] **Step 4: Canal.** Cache 4 water steps × 3 width steps × 2 (inner, edge). Water step = `round(cWater / cDepth × 3)`. Width step: `< 5` m, `5–8` m, `> 8` m. Draw banks, the exposed wet bed, then the water. Temporary block: sandbags. Permanent block: plank wall with posts. Pond and backfill keep a different shape.
- [ ] **Step 5: Flow markers.** For each open canal tile, the downstream neighbour is the 8-neighbour canal or river tile with the lowest `z`. Draw 2 light pixels that move from the tile centre toward that neighbour, with phase `now / 600 + hash(i)`. Skip in data view. Skip a tile that has a block, and a tile whose downstream neighbour has a block.
- [ ] **Step 6: Cull.** Skip tiles whose sprite box is outside the buffer.
- [ ] **Step 7: Check in the browser** (`sprites.md` "Verify"): screenshots at zoom 1 and 2, map edge, data view, dry and wet season. Show the screenshots to the user.
- [ ] **Step 8: Commit** `feat(render): detailed sprites, canal water level and flow`.

### Task 8: UI layout

**Files:**
- Modify: `index.html`, `src/ui.js`, `src/strings.js` (only after the user agrees)
- Read first: `.claude/skills/rewet/design-polish.md`, `.claude/skills/rewet/ui-ux.md`

- [ ] **Step 1: Ask the user** before the first run of `scripts/impeccable` in the session.
- [ ] **Step 2: Take before screenshots** of the menu, level select and level screen at 390×844 and 1280×800.
- [ ] **Step 3: Run `impeccable critique`** on those screens.
- [ ] **Step 4: Show the findings to the user.** Agree on the changes. **Stop here until the user agrees.**
- [ ] **Step 5: Make the agreed changes** with `impeccable layout`. Keep the constraints in `design-polish.md`.
- [ ] **Step 6: Run `npm test`.** Take after screenshots with the same screen state. Show both sets to the user.
- [ ] **Step 7: Commit** `feat(ui): new layout for HUD, action bar and menus`.

### Task 9: Wildlife and activities research note

**Files:**
- Create: `docs/research/wildlife-and-activities.md`

- [ ] **Step 1: Write the note** (spec section 5). For each option: what the player sees, which sim state drives it, the teaching value, and the cost in code. Mark each species and behaviour `NOT SOURCED` until a source is opened.
- [ ] **Step 2: Do the STE100 lint pass.**
- [ ] **Step 3: Commit** `docs: add research note on wildlife and activities`.

### Task 10: Review and finish

- [ ] **Step 1: Run `npm test`.** Expected: all pass.
- [ ] **Step 2: Run the whole-branch review** (`superpowers:requesting-code-review`).
- [ ] **Step 3: Use `superpowers:finishing-a-development-branch`.**
