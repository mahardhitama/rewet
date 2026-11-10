# Rewet canal bank, wildlife, planting and fire revisions: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- Canal banks follow the peat colour, and the black bar at canal ends goes.
- Wildlife is fewer and comes and goes, and moves smoothly.
- Planting is a cheaper and faster 5×5 stamp.
- Fire gets a better sprite and drifting smoke.

**Architecture:**
- Sim changes are in `src/sim/fauna.js` and `src/sim/game.js`, with tests.
- Render changes are in `src/render/iso.js`: the canal key, the animal slide, the fire sprites and the smoke particles.
- The text changes are in `src/strings.js` and `src/ui.js`.

**Tech Stack:** plain ES modules, canvas 2D with `fillRect` sprites in a cache, `node --test`. No dependencies.

**Spec:** `docs/superpowers/specs/2026-11-10-rewet-revisions-canal-wildlife-planting-fire-design.md`

Start this plan only after the UI layout plan (`docs/superpowers/plans/2026-11-10-rewet-ui-layout.md`) has its last task complete.

## Global Constraints

- No npm dependencies, no build step, no image or audio files.
- `src/sim/*` stays pure and deterministic. `faunaTick` never calls `world.rng`.
- C1, C2 and C3 pass with no tolerance change. `blockPlan` passes each level, and a run with no action fails each level (`test/levels.test.js`).
- Every new number is a game value marked `NOT SOURCED` in a code comment. Record each tuned value in section 8 of `docs/superpowers/specs/2026-11-10-rewet-procgen-map-design.md`.
- Canvas art uses `fillRect` and the named colours at the top of `iso.js`. A new sprite goes in the cache. No per-frame sprite building.
- All visible text is in `src/strings.js`.
- Docs, comments and commit messages follow STE100. Each commit message ends with `Claude-Session: https://claude.ai/code/session_0122Eb6A4L6KroW9bbCsS8j2`.
- Stage files by name. Make one commit for each task.
- Frame time on the level screen: the median is about 16.7 ms at 1280×800.

## Review Focus

1. **Planting with an armed tap during a running job.** A second Plant tap on an overlapping 5×5 patch while the first job runs. It must not double-charge tiles that the first job will seed. Test: Task 2 `overlapping plant jobs charge only new tiles`.
2. **Partial funds.** Funds for 3 tiles out of 25. The action seeds exactly the 3 nearest plantable tiles and takes the right number of weeks. Test: Task 2.
3. **A save or a level restart in the middle of an animal slide.** `map.leave()` must clear the slide state, so an animal does not slide from the last level's position. Test: Task 4 browser step and a unit check on the slide map reset.
4. **Many fires.** 40 or more burning tiles plus 160 puffs must hold the frame time. Test: Task 5 browser measurement.
5. **A canal bank between a dry tile and a wet tile.** The step uses the mean of the peat neighbours and must not flicker between frames. It changes only when the canal sprites rebuild. Test: Task 3 unit test on `bankStep`.

---

### Task 1: Wildlife visits (sim)

**Files:**
- Modify: `src/sim/fauna.js`, `test/fauna.test.js`

**Interfaces:**
- Produces:
  - `MAX_FAUNA = 8`.
  - Each `FAUNA` entry gets `wet` and `dry` spawn weights in [0, 1].
  - An animal is `{ id, species, i, from, moved, born, leave, leaving }`.
    - `from` is the tile before the last move. On spawn, it equals `i`.
    - `moved` is the tick of the last move. On spawn, it equals `born`.
    - `leave` is `born + 4 × (4 + floor(rng() × 10))`, a stay of 4 to 13 weeks.
    - `leaving` is true after `tick >= leave`, or when the habitat rule fails, or when fire is within 2 tiles.
  - A leaving animal steps each week to the 8-neighbour tile nearest to the closest map edge (ties by the lowest index). On an edge tile, it is removed at the next step. The habitat rule does not apply to a leaving animal's moves.
  - Exception: when fire is within 2 tiles, the animal is removed at once, as now. Fire must not trap an animal.
- Season weights (game values, NOT SOURCED):

| Species | wet | dry |
|---|---|---|
| orangutan | 1 | 1 |
| gibbon | 1 | 1 |
| langur | 1 | 1 |
| sunbear | 0.5 | 1 |
| hornbill | 1 | 0.5 |
| stork | 1 | 0.3 |
| fishowl | 0.6 | 1 |
| otter | 1 | 0.6 |
| gharial | 1 | 0.5 |
| monitor | 0.5 | 1 |
| snakehead | 1 | 0.4 |

- Spawn rule:
  - When `have < target` and `g.fauna.length < MAX_FAUNA`, spawn with chance `0.35 × weight` for the current season. Use `seasonAt(g.tick)` and the wet-season rule that `isWetSeason` uses.
  - The tile is a suitable map-edge tile when one exists. Otherwise it is a suitable tile with `cover >= 0.85`. Otherwise it is any suitable tile.

- [ ] **Step 1: Write the failing tests** in `test/fauna.test.js`:
  - `g.fauna.length <= 8` at each weekly step over full `blockPlan` runs of levels 1 to 6;
  - each animal's `|dx|` and `|dy|` between 2 weekly steps are each at most 1 (track it by id);
  - `from` and `moved` are set on a move;
  - no animal stays past `leave + 4 × (w + h)` ticks;
  - a leaving animal's distance to the edge does not grow;
  - over a 3-year L6 `blockPlan` run, the count of spawns per species in wet weeks differs from the count in dry weeks for at least 3 species;
  - the existing balance test (restored has more animals than no action in the final year) still passes. You may change its numbers to the new cap; record the new numbers.
- [ ] **Step 2: Run** `node --test test/fauna.test.js`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement.** Keep the order: leave, then move, then spawn, then `seen`.
- [ ] **Step 4: Run** `npm test`. Expected: all pass. Paste the new 6-level balance table (final-year animals, restored against no action) into the report.
- [ ] **Step 5:** Add the values to procgen spec section 8.
- [ ] **Step 6: Commit:** `feat(sim): make wildlife visit, stay a few weeks and leave`.

### Task 2: Planting stamp, cost and growth (sim and text)

**Files:**
- Modify: `src/sim/game.js`, `src/strings.js`, `src/ui.js` (slot cost text), `test/game.test.js`, `test/fixtures/l1-reveg.json`, `test/levels.test.js` (only if R27 needs a new fixture path)

**Interfaces:**
- Produces:
  - `PLANT_TILE = 8` (NOT SOURCED) and `PLANT_R = 2`, the stamp radius (2 gives 5×5).
  - `plantTiles(g, i)` returns the plantable tiles in the 5×5 patch, sorted nearest first (by Chebyshev distance, then by index). A tile is not plantable when an unfinished Plant job will already seed it.
  - `costOf(g, 'plant')` returns the price per tile: `PLANT_TILE`, times 0.8 in the wet season, rounded to 1 decimal place.
  - `applyAction(g, 'plant', i)`:
    - `n = min(tiles.length, floor(funds / perTile))`;
    - `n = 0` with plantable tiles gives `{ ok: false, reason: 'funds' }`, and no plantable tiles gives `'nothingToPlant'`;
    - it charges `round(n × perTile)`;
    - the job gets `tiles` (the first `n` tiles) and `weeks = max(1, ceil(n / 10))`.
  - `finish` for `plant` seeds the job's `tiles` that are still plantable. This is the R32 check at finish time.
  - The seedling growth step is `1 / 312` (NOT SOURCED; it was `1 / 416`).
  - `actionMeta` for plant shows the price per tile, for example `8/tile · 1–3w`. `ACTION_TEXT.plant[1]` says "5×5".

- [ ] **Step 1: Write the failing tests** in `test/game.test.js`:
  - a 5×5 stamp on open peat seeds 25 tiles at finish;
  - the funds drop by `round(25 × perTile)`;
  - `weeks` is 3 for 25 tiles and 1 for 4 tiles;
  - with funds for 3 tiles, exactly the 3 nearest tiles are seeded;
  - with funds below one tile's price, the reason is `'funds'`;
  - `overlapping plant jobs charge only new tiles` (Review Focus 1);
  - `costOf(g, 'plant')` in the wet season is `PLANT_TILE × 0.8`.
  - Update the old 3×3 and cost tests (`test/game.test.js:65-68`, `:174-193`) to the new rule. Do not delete their intent.
- [ ] **Step 2: Run** `node --test test/game.test.js`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement.** Keep the `nothingToPlant` and `invalid` reasons.
- [ ] **Step 4: Fixture.** Change `test/fixtures/l1-reveg.json` to a planting grid with a 5-tile spacing, so the stamps do not overlap. R27 must reach the L1 revegetation star. Run `node scripts/sim-run.js --level 1 --plan test/fixtures/l1-reveg.json`.
- [ ] **Step 5: Run** `npm test`. Expected: all pass, with C1 to C3 and the level pass and fail tests.
- [ ] **Step 6:** Add `PLANT_TILE`, `PLANT_R`, the weeks rule and the growth step to procgen spec section 8.
- [ ] **Step 7: Commit:** `feat(sim): make planting a cheaper 5x5 stamp that grows faster`.

### Task 3: Canal bank colour and the black bar (render)

**Files:**
- Modify: `src/render/iso.js`, `test/iso.test.js`

**Interfaces:**
- Produces:
  - `bankStep(wd, i)`: a pure function. It returns 0 (dry), 1 (damp), 2 (wet) or 3 (green) from the 4 side neighbours of canal tile `i` that are peat. Over those neighbours:
    - green when the mean cover is 0.6 or more;
    - else wet when the mean `wt` is `WET_WT` or less;
    - else damp when the mean `wt` is 0.8 or less;
    - else dry.
    - With no peat neighbour, the step is 0.
  - Canal key: the bank step goes in bits 24–25. The full key is `canalBase | ws << 18 | e << 20 | (o + 1) << 21 | bank << 24`. The patch index uses bits 21–23.
  - `canalSprite` colours the bank zone with the ground colour that the peat sprite uses for that step.
  - The bank step array is computed when the canal layout rebuilds. Also recompute it once each week (`game.tick % 4 === 0`, at most once per tick), so it does not flicker (Review Focus 5).

- [ ] **Step 1: Write the failing tests** in `test/iso.test.js`:
  - `bankStep` gives 0 for dry neighbours, 2 for wet neighbours with low cover, 3 for high cover, and 0 with no peat neighbour;
  - the key with bank 3 and patch 3 decodes back to both values.
- [ ] **Step 2: Run** `node --test test/iso.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** the bank colour.
- [ ] **Step 4: Black bar.**
  - Use superpowers:systematic-debugging. Reproduce the bar in the browser: a canal end on the map edge, as in the user's screenshot at `<session dir>/images/1.png`, at zoom 1 to 3 and in both seasons.
  - Find the pixel source: the notch drawing, `block()`, the `zMicro` line, or the patch sprite.
  - Write a pixel test that draws the edge canal sprite into an offscreen buffer. Use a minimal canvas stub if the sprite code needs one, or test the pure `canalZone()` output on the notch column. The test must fail before the fix.
  - Fix the cause.
- [ ] **Step 5: Browser check** at 1280×800 and 390×844:
  - bank colour on a dry level start;
  - bank colour on a restored map (use `?debug` to set `wt` and `cover`);
  - the canal end on the map edge at zoom 1 and 3, before and after the fix.
  - Save the screenshots under `<session dir>/scratchpad/rev-t3/`.
- [ ] **Step 6: Run** `npm test`. Expected: all pass.
- [ ] **Step 7: Commit:** `fix(render): colour canal banks by the peat beside them and remove the black bar`.

### Task 4: Animal slide and fade (render)

**Files:**
- Modify: `src/render/iso.js`, `src/render/view.js` (`leave()` resets the slide state), `test/iso.test.js`

**Interfaces:**
- Consumes: the animal fields `from`, `moved` and `leaving` from Task 1.
- Produces:
  - A module-level `slides` Map in `iso.js`, from animal id to `{ moved, seenAt }`. `resetSlides()` is exported and called from `view.leave()`.
  - `slidePos(fromXY, toXY, t)` is a pure linear blend. `fadeAlpha(age, leavingAge)` is pure.
  - In `drawWorld`, the animals are drawn in a separate pass after the tile loop, sorted by the screen y of their drawn position. This keeps the depth order right during a slide. The animal pass must still draw in front of the plants of the animal's own tile. Accept that a sliding animal can show in front of a tree on the tile below it, and note it in the report.
  - `t = clamp((now − seenAt) / 600)`. A new animal (`moved === born` on first sight) fades in over 600 ms. A leaving animal on an edge tile fades out over 600 ms. Draw with `ctx.globalAlpha`, and set it back to 1.
  - The hit list uses the drawn position.
  - Remove the `slides` entries for ids that are no longer in `game.fauna`.

- [ ] **Step 1: Write the failing tests:**
  - `slidePos` at t = 0, 0.5 and 1;
  - `fadeAlpha` limits;
  - `resetSlides()` empties the map.
- [ ] **Step 2: Run** `node --test test/iso.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Browser check:**
  - at ×2 speed, record the drawn positions of one animal for 3 weeks. No jump is larger than 1 tile per 600 ms window.
  - a level restart during a slide shows no slide from the old level (Review Focus 3).
  - frame time at 1280×800.
- [ ] **Step 5: Run** `npm test`. Expected: all pass.
- [ ] **Step 6: Commit:** `feat(render): slide animals between tiles and fade them in and out`.

### Task 5: Fire sprite and smoke (render)

**Files:**
- Modify: `src/render/iso.js`, `test/iso.test.js`

**Interfaces:**
- Produces:
  - `cache.flame`: 4 frames. The frame is `((now / 120) + hash(i) × 4) | 0) % 4`.
  - `cache.ember`: 2 frames.
  - `smoke`: a module-level array of puffs `{ x, y, vx, vy, born, life, r }` in buffer px. At most 160 puffs; when full, the oldest puff is replaced.
  - `yearDir(seed, year)`: a pure function that returns an angle in radians from `hash(seed × 31 + year)`.
  - `emitSmoke(i, sx, sy, kind, now)` and `drawSmoke(ctx, now, data)`.
  - Emission rate: about 1 puff each 400 ms per surface-fire tile, and about 1 each 1200 ms per smouldering tile. Use a per-tile timer, so the rate does not depend on the frame rate.
  - A puff's speed is about 6 buffer px per second, in the direction `yearDir ± 30°`, plus a rise of 4 px per second. It lives 3 to 6 s. Its radius grows from 2 to 6 px, and its alpha falls from 0.2 to 0.
  - Draw a puff as 3 nested disks of `fillRect` rows at alpha 0.08, 0.12 and 0.2 × fade. The colour is a grey from the palette.
  - `drawSmoke` runs after the tile loop and the animal pass. It does not run in the data view.
  - `resetSmoke()` is called from `view.leave()`.
  - With `prefers-reduced-motion`: 1 flame frame, and no smoke. Read it once with `matchMedia` in the render, guarded for Node.

- [ ] **Step 1: Write the failing tests:**
  - `yearDir` gives the same angle for the same input and a different angle for the next year;
  - the smoke array never exceeds 160 after 1000 emits;
  - `resetSmoke()` empties it.
- [ ] **Step 2: Run** `node --test test/iso.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.** Replace the per-frame flame and wisp `fillRect` code in the tile loop with the cached sprites and the emitters.
- [ ] **Step 4: Browser check** during a dry season with 40 or more burning tiles (set `fire` through `?debug`):
  - screenshots at 1280×800 and 390×844 in `<session dir>/scratchpad/rev-t5/`;
  - a 6× crop of the flame frames;
  - the frame time median (Review Focus 4);
  - the smoke drift direction for 2 years.
- [ ] **Step 5: Run** `npm test`. Expected: all pass.
- [ ] **Step 6: Commit:** `feat(render): add a flame sprite and soft smoke that drifts each year`.

### Task 6: User review and final check

- [ ] **Step 1:** The controller shows the user these screenshots: the canal banks (dry and restored), the canal end on the edge, an animal mid-slide, fire and smoke, and the Plant slot text. The controller records the user's changes in the ledger.
- [ ] **Step 2:** A fix task makes the changes. Use one commit: `fix(render): apply the revision review`.
- [ ] **Step 3: Run** `npm test` and `node scripts/sim-run.js --level 1 --plan test/fixtures/l1-cascade.json`. Expected: all pass, and the run has no loss.
