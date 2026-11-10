# Rewet: procedural map, canal water, starting vegetation, view and layout (design spec)

Date: 2026-11-10. Branch: `feat/procgen-map`.
Base spec: `2026-11-10-rewet-gameplay-design.md` (called "the base spec" below). This spec changes the base spec sections 2.2, 2.4, 4, 5 and 6. All other rules of the base spec stay.

## 1. Intent

The user asked for these changes:

1. A procedurally generated landscape.
2. Canals that run from one map edge to the other, so the direction of flow is clear.
3. Canals with different width, depth and water level. In the dry season, the water surface in an open canal section drops.
4. Random vegetation at the start: trees, shrubs, seedlings and ferns.
5. A view that scales with the window, so the full map is visible at each size and orientation.
6. More detailed sprites.
7. Larger tiles, so the touch area is larger.
8. Research on procedurally generated wildlife and other activities (a note only, no code).
9. A better UI layout.

Decisions that the user made in the brainstorm:

| Topic | Decision |
|---|---|
| Levels | Each level keeps its lesson as parameters. The level seed makes the shape. |
| View | The level opens at "fit" (full map visible). Pinch, wheel and +/- buttons zoom. |
| Canal depth | Width, depth and water level per canal tile. They change the sim, not only the look. |
| Flow | Tilted dome. Trunk canals run downhill from a high edge to a low outlet edge. |
| Vegetation | The revegetation goal measures cover gain above the start cover. |
| Wildlife | Research note only in this round. |

### Success criteria

- Each level map comes from `generateMap(params, seed)`. The same seed gives the same map.
- Each trunk canal touches two opposite map edges. Its bed falls from the inlet to the outlet at each step.
- In the dry season, an open canal tile shows its water surface below the bank. A tile behind a block shows a higher water surface.
- Calibration tests C1, C2 and C3 pass with no change to their tolerances.
- A level opens with the full map visible at 390×844, 844×390 and 1280×800.
- At the largest zoom, one tile is at least 48 CSS px wide and 24 CSS px high on a 390 px wide screen.
- Each level can pass with a plan that blocks canals. A plan with no blocks does not pass.

## 2. Procedural map (`src/sim/mapgen.js`)

### 2.1 Level parameters

`src/levels.js` keeps the level list. Each level replaces its tile lists (`canals`, `rivers`, `villages`, `farms`, `illegalCanals`) with a `map` object:

```js
map: { trunks: 3, branches: 0, meander: 0.2, rivers: 0, villages: 0, illegal: 0 }
```

| Level | Trunks | Branches per trunk | River | Villages | Illegal canals |
|---|---|---|---|---|---|
| 1 Small drained plot | 3 | 0 | no | 0 | 0 |
| 2 Burnt former forest | 3 | 0 to 1 | no | 0 | 0 |
| 3 Village edge | 3 | 0 to 1 | yes | 1 | 0 |
| 4 Canal network | 3 | 2 | no | 1 | 2 |
| 5 El Niño year | 4 | 1 | no | 1 | 1 |
| 6 Full peat dome | 4 | 1 | yes | 2 | 2 |

`size`, `years`, `grant`, `arson`, `elNinoYear` and `pass` stay as they are now. The plan sets the final parameter values with headless runs (see 7).

`generateMap(level, seed)` returns the same data that `placeLevel()` reads now: tile lists for each kind, plus the new per-tile canal and vegetation arrays. `placeLevel()` calls it. Level seeds stay fixed, so tests stay deterministic.

The sandbox (base spec section 5) and a new "New map" button on the level card use a random seed. The save keeps the seed of the map in play.

### 2.2 Terrain: tilted dome

`generateTerrain()` gets a `tilt` option (metres of fall across the map) and an `outlet` edge (`N`, `E`, `S` or `W`, chosen from the seed).

`z = domeRise × (1 − r²) + tilt × u + micro`, where `u` goes from 0 at the outlet edge to 1 at the opposite edge. The dome centre is the midpoint of the high edge. Thus the smooth surface falls along each straight path from the high edge to the outlet edge. The default is `tilt = 1.0` m. This is a game value, not sourced.

If a river is in the level, it runs along the outlet edge.

### 2.3 Canal paths

- **Trunk:** starts on the high edge and ends on the outlet edge. The path is a random walk with a bias toward the outlet. Each step moves one tile toward the outlet, plus a sideways step with probability `meander`. Trunks keep at least 4 tiles between them.
- **Branch:** starts on a trunk tile and runs at about 45° to the trunk, uphill, for 5 to 10 tiles. It does not touch another canal. Water flows down the branch into the trunk.
- **Illegal canal:** a path from a map edge toward the dome centre. It is cut tile by tile during play, as now (base spec section 3).
- **Canal bed:** walk each trunk from the inlet to the outlet. Set `bed[k] = min(bed[k−1] − 0.01, surface[k])`. `generateMap()` returns this value as `canalZ`. `placeLevel()` sets the `z` of each canal tile to `canalZ`, and `walkUp()` reads this `z`. Each branch bed ends above the trunk bed where it joins. The bed then falls at each step in the flow direction, so `walkUp()` finds upstream tiles as it does now. The canal depth is in `cDepth`. It does not change `z`.
- **Villages and farms:** on the low side of the map, next to a trunk or the river. A farm touches its village.

### 2.4 Canal width, depth and water level

New per-tile arrays in `world`. They hold 0 on tiles that are not canal tiles.

| Array | Unit | Meaning |
|---|---|---|
| `cWidth` | m | canal width |
| `cDepth` | m | bed depth below the bank |
| `cWater` | m | water surface depth below the bank (0 = full, `cDepth` = empty) |

- **Width and depth at generation:** a trunk gets a base size, and a branch gets a smaller one. Each section of 3 to 6 tiles varies by ±25%. The base trunk size is 8 m wide and 5 m deep, from KFCP 2014 p.9 (see `docs/references/canal-dimensions.md`). That value is for the main Blok A canals. The branch size (4 m wide, 2.5 m deep) is a game value, `NOT SOURCED`.
- **Water level each tick:** `cWater` moves toward a target with rate `kCanal` per tick.
  - Open canal: the target is `cDepth × fill`, where `fill = 0.15` in the wet season and `0.7` in the dry season. The value moves smoothly with `env.dry`.
  - Canal tile behind a block (`S < DRAIN.canal`): the target is multiplied by `S / DRAIN.canal`. Thus the water stays near the bank.
  - Backfilled tile: `cWater = 0`.
  - `fill` and `kCanal` are game values, `NOT SOURCED`.
- **Effect on the water table:** `hydroTick()` now pulls each tile toward one equilibrium depth `eq` for all sources. The new rule: for a canal source, `eq = eqSeason × cDepth[src] / cDepthRef`, where `cDepthRef = 5` m (the reference trunk canal). A river source keeps `eqSeason`. Thus a reference canal gives the same result as today, and C1, C2 and C3 stay the same. A deep canal drains more, and a shallow canal drains less.
- **Blocks:** a block lowers `S`, as now (C2 calibrates it). The higher `cWater` behind a block is shown on screen, but it does not change `eq`. If it did, the block effect would count twice.
- **Width:** only changes the sprite in this round. Effect on drainage is out of scope.

### 2.5 Starting vegetation

Vegetation types: `NONE`, `FERN`, `SEEDLING`, `SHRUB`, `TREE`. The type is not stored. `vegOf(cover)` gives it from the cover of the tile.

- **Placement:** after the pre-drain year (`buildLevelWorld()`), roll a vegetation type per peat tile and set its start cover. The chance of each type depends on the water-table depth and the distance to a canal: more trees on wet tiles far from canals, more ferns and bare peat near canals. Use blurred noise, so vegetation forms patches. Level 2 ("Burnt former forest") gets a lower tree share.
- **Start cover:** `TREE` 1.0, `SHRUB` 0.6, `SEEDLING` 0.3, `FERN` 0.15, `NONE` 0. Game values, `NOT SOURCED`.
- **Growth:** `vegOf(cover)`: below 0.1 is `NONE`, 0.1 to 0.2 is `FERN`, 0.2 to 0.5 is `SEEDLING`, 0.5 to 0.85 is `SHRUB`, 0.85 and up is `TREE`. Fire sets `cover = 0` as now, so the tile shows `NONE`.
- **Determinism:** the vegetation roll uses its own RNG, `mulberry32(seed ^ VEG_SALT)`. Thus the vegetation roll does not change the sequence of `world.rng`.

### 2.6 Revegetation goal

`evaluate()` (`src/sim/score.js`) now gives `coverPct` as the mean cover. The new rule: `coverPct` is the mean gain above the start cover. The gain is `max(0, cover − cover0)`, divided by `max(0.01, 1 − cover0)` on each tile. `cover0` is a copy of `cover` at `createGame()`. The pass lines (`pass.reveg`) get a new tune with headless runs.

## 3. View and touch

### 3.1 Tile size

`TW` goes from 16 to 32 and `TH` from 8 to 16 (`src/render/isoMath.js`). `zOffset()` scales to 0.075 m per pixel, clamped to ±4 px. `PAD` and `HUD_PAD` double.

### 3.2 Camera: fit plus zoom

- The canvas buffer equals the window size divided by the zoom scale, as now. The buffer has the window aspect ratio, so `object-fit: cover` cuts off less than 1 buffer pixel. `object-fit` stays.
- `fitScale(innerW, innerH, w, h)` returns the scale at which the full map box (plus `PAD`) fits in the window, below the HUD and above the action bar. The scale can be a fraction below 1. The pixel art then loses pixels at fit. This is accepted. At a whole-number scale, the art stays sharp.
- Zoom steps: the fit scale, then 1, 2, 3 and 4. The level opens at the fit scale.
- **Input:**
  - mouse wheel: zoom one step around the pointer;
  - pinch with two fingers: zoom around the pinch centre;
  - `+` and `−` buttons on the map (44×44 CSS px) and the `+`, `-` and `0` (fit) keys.
- Drag pans as now. `clampPan()` uses the zoom scale.
- `screenToTile()` and `clientToBuffer()` stay the inverse of the draw transform at each zoom. A test checks a tap at each zoom step and after a resize.

### 3.3 Sprites (`src/render/iso.js`)

With 32×16 tiles, each sprite has four times the pixels. The sprite cache stays (`buildCache()`). New and changed sprites:

- **Ground:** peat texture with 2 or 3 shades and small specks. Flooded ground shows water patches.
- **Vegetation:** one sprite set for each vegetation type (`vegOf(cover)`), with 2 variants per type (picked by tile hash).
  - `TREE`: a trunk, a crown with light and shadow sides, and a shadow on the ground.
  - `SHRUB`: a low round bush.
  - `SEEDLING`: 2 or 3 small stems with leaves.
  - `FERN`: a low fan of fronds.
- **Canal:** banks of a lighter peat colour, a channel with a width in pixels from `cWidth`, and a water surface that sits `cWater` below the bank. Draw the exposed wet bed between the bank and the water. Cache the canal sprites in 4 water-level steps × 3 width steps. The flow markers show the direction, so the sprites do not join to their neighbours.
- **Flow:** small light pixels move along each canal in the flow direction (from higher bed to lower bed). Draw them each frame. They are markers, so the data view (`D` key) does not show them.
- **Blocks:** a temporary block shows sandbags. A permanent block shows a plank wall with posts. Each one has a shape that differs from a pond and a backfill.

### 3.4 Performance

At 40×40 tiles, the map has 1600 tiles. Draw only the tiles in the visible box. The flow markers use one `fillRect` each. The frame budget stays at 60 fps on a mid-range phone.

## 4. UI layout

1. Run `impeccable critique` on the level screen and the menu at 390×844 and 1280×800. Take screenshots first.
2. Show the findings to the user. Agree on the changes.
3. Make the changes with `impeccable layout`. Use the CSS tokens on `:root` in `index.html`. Keep the fonts.
4. Keep these fixed:
   - Buttons are at least 44×44 CSS px.
   - Each control works with the keyboard and shows a focus ring.
   - The HUD and the action bar do not cover the map at the fit scale.
5. Take after screenshots with the same screen state.

## 5. Wildlife and activities (research note)

Write `docs/research/wildlife-and-activities.md`. It lists options with their cost and their teaching value. The recommended direction for a later round:

- Agents are render-only. They use their own RNG, so sim seeds and tests stay the same.
- Agents read the sim state, so they act as visible feedback.
  - Hornbills and monkeys appear in wet, forested patches.
  - Fish appear in canals behind blocks and in fish ponds.
  - Villagers fish at ponds and work on paludiculture tiles.
  - Loggers walk along illegal canals.
  - Smoke rises over fires.
- Each wildlife species and real behaviour in the note needs a source before it goes in the game (`methodology.md`).

## 6. Architecture changes

| File | Change |
|---|---|
| `src/sim/mapgen.js` | new: `generateMap(level, seed)` |
| `src/sim/terrain.js` | `tilt` and `outlet` options |
| `src/sim/world.js` | new arrays `cWidth`, `cDepth`, `cWater`; `VEG` and `vegOf()` |
| `src/sim/hydro.js` | per-source `eq` from `cWater`; canal water level step |
| `src/sim/game.js` | `placeLevel()` writes the canal arrays; `cover0`; canal water step |
| `src/sim/score.js` | `coverPct` = gain above `cover0` |
| `src/levels.js` | `map` parameters in place of tile lists |
| `src/render/isoMath.js` | `TW = 32`, `TH = 16`, `fitScale()`, zoom in `cameraFor()` |
| `src/render/iso.js` | new sprites, flow markers, visible-box draw |
| `src/render/view.js` | wheel, pinch, zoom buttons, zoom keys |
| `index.html`, `src/ui.js` | layout from section 4 |
| `test/fixtures/*.json` | new plans for the generated level 1 map |

The sim stays pure: no `window`, `document` or canvas in `src/sim/`.

## 7. Testing

- `mapgen`: same seed gives the same map. Each trunk touches two opposite edges. The bed falls at each step along the flow. Branches join a trunk. Canals do not touch villages.
- Canal water: an open canal tile in the dry season has `cWater` near `0.7 × cDepth`. A tile behind a block has a smaller `cWater`. A 5 m deep canal gives the same `wt` as the old global `eq`.
- C1, C2, C3: pass with no change to the tolerances.
- Vegetation: same seed gives the same cover. The vegetation roll does not change the next value of `world.rng`.
- Score: `coverPct` is 0 at the start of each level.
- Camera: `screenToTile(tileToScreen(x, y))` gives `(x, y)` at each zoom step and after a resize. The full map box fits at the fit scale for 390×844, 844×390 and 1280×800.
- Balance: for each level, save a block plan and a no-block plan as fixtures. Run `node scripts/sim-run.js`. The block plan passes. The no-block plan fails.
- Browser: check at 390×844 with touch and at 1280×800 (`ui-ux.md`, `sprites.md`).

## 8. Open items

1. **Canal size for branches and small canals:** `NOT SOURCED`. KFCP 2014 gives only the main Blok A canals (about 8 m wide, more than 5 m deep originally).
2. **Canal fill fractions (`fill` 0.15 wet, 0.7 dry) and `kCanal`:** game values, `NOT SOURCED`. Tune them so the water drop is clear on screen.
3. **Tilt (1.0 m) and dome rise:** game values, `NOT SOURCED`.
4. **Start cover per vegetation type:** game values, `NOT SOURCED`.
5. **Pass lines for revegetation:** new tune after the gain rule (2.6). Record the runs here.
6. **Fit scale below 1:** the pixel art loses pixels at fit on a small screen with a large map. If this looks bad, use the smallest whole-number scale and accept a small pan at the fit scale.
7. **Level map parameters and seeds (Task 3):** game values, set with headless runs. A seed search ran 40 seeds for each level that failed. `blockPlan()` (`scripts/auto-plan.js`) must pass each level, and a plan with no action must fail it. Fire is the usual cause of a failed run.

   | Level | Seed | trunks | branches | meander | river | villages | illegal |
   |---|---|---|---|---|---|---|---|
   | 1 | 101 | 3 | 0 | 0.15 | no | 0 | 0 |
   | 2 | 203 | 3 | 1 | 0.2 | no | 0 | 0 |
   | 3 | 305 | 3 | 1 | 0.2 | yes | 1 | 0 |
   | 4 | 405 | 3 | 2 | 0.25 | no | 1 | 2 |
   | 5 | 510 | 4 | 1 | 0.25 | no | 1 | 1 |
   | 6 | 622 | 4 | 1 | 0.3 | yes | 2 | 2 |

   - Seed search with the start values (passing seeds out of 40): L2 24, L3 21, L4 10, L5 4, L6 0. For L6 with 1 branch per trunk: 4. For L6 with 3 trunks and 1 branch: 7. For L6 with 3 trunks: 0. Thus level 6 has 1 branch per trunk, not 2.
   - Runs with `blockPlan()` (rewet %, pass line, then the run with no action):
     - L1: 90.0% (pass 60), passed. No action: 27.3%, fire loss.
     - L2: 99.2% (pass 63), passed. No action: 30.1%, fire loss.
     - L3: 94.6% (pass 66), passed. No action: 34.3%, fire loss.
     - L4: 84.3% (pass 69), passed. No action: 36.7%, goodwill loss.
     - L5: 91.1% (pass 72), passed. No action: 42.9%, fire loss.
     - L6: 90.0% (pass 75), passed. No action: 42.6%, goodwill loss.
   - C3 on level 4: best single block +89 tiles, best cascade +162 tiles (1.82×).
   - The pass of a level is sensitive to the fire rolls. A change to the sim or to the map can make a level fail again. Then do the seed search again.
   - Task 4 re-tune: canal depth now scales the drained depth (`eq × cDepth / 5`), so branches drain less. Level 6 with seed 610 then failed with a fire loss (rewet 61.9%). A seed search on seeds 610 to 649 gave 8 passing seeds: 622, 623, 624, 625, 626, 632, 640, 647. Level 6 now uses seed 622. The other levels kept their seeds. The `map` parameters did not change.
   - Runs with `blockPlan()` after Task 4 (rewet %, then the run with no action):
     - L1: 90.7%, passed. No action: 36.4%, fire loss.
     - L2: 100.0%, passed. No action: 41.7%, fire loss.
     - L3: 96.7%, passed. No action: 43.5%, fire loss.
     - L4: 84.6%, passed. No action: 68.9%, goodwill loss.
     - L5: 93.6%, passed. No action: 29.0%, goodwill loss.
     - L6 (seed 622): 93.8%, passed. No action: 53.8%, goodwill loss.
8. **Fixture `l1-reveg.json` (Task 3):** the `l1-cascade.json` plan, then a plant order on every third tile from tick 208. Each order waits for a free crew and for 170 funds (one plant plus one more action). The cascade has 12 blocks and uses most of the funds, so only 20 plants fit. The run gives rewet 90.7%, cover 15.3%, 1 star. The R27 test is a `todo` until Task 5 tunes `pass.reveg`. After Task 4 (canal depth), the same fixture gives rewet 90.7%, cover 15.9%, 1 star. The level 1 map did not change, so the fixtures stay the same.
