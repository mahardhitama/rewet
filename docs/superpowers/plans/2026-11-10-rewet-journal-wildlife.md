# Rewet: canal network, journal and wildlife, implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Canals run to the map edge and form a network, plants have variants, all levels are open, and a journal teaches the concepts and collects the wildlife that a restored map attracts.

**Architecture:** Mapgen and a new pure `src/sim/fauna.js` stay in the deterministic sim. `src/render/iso.js` draws the edge notch, plant variants and animals. A new `src/journal.js` holds the journal data, and a new `src/journalView.js` holds the journal overlay. The found species live in the save, not in the sim.

**Tech Stack:** Plain ES modules, canvas `fillRect` art, DOM UI, `node --test`. No build step, no dependencies.

**Spec:** `docs/superpowers/specs/2026-11-10-rewet-journal-wildlife-design.md` (it adds to `docs/superpowers/specs/2026-11-10-rewet-procgen-map-design.md`).

## Global Constraints

- Invoke the `rewet` skill first. Read the area files for each task. Use STE100 for docs, comments and commits.
- `src/sim/*` never touches `window`, `document` or a canvas. Render and UI change game state only through `applyAction()`.
- C1, C2 and C3 in `test/hydro.calibration.test.js` pass. Do not loosen a tolerance; re-tune constants.
- Each real-world fact needs a source opened in the session, cited in `docs/references/`. Mark a game value `NOT SOURCED`.
- `localStorage` key `rewet_v1`, only through `src/save.js`.
- A button that can be pressed during the intro calls `stopPropagation()`.
- Touch targets are at least 44×44 CSS px, with a visible focus ring.
- No dependencies, no build step. `npm test` passes after each task.
- Carbon is shown in t C, not t CO2.
- Fauna uses `mulberry32(world.seed ^ 0xfa07a)` and never calls `world.rng`.
- At most 24 animals on the map. The found list is in the save, not in the sim.

## Review Focus

1. An old save (`unlocked: 1`, no stars) loads with all levels open. "Continue" is still disabled when the player has no stars.
2. Esc with the journal open during a level closes the journal only. It does not open the quit dialog, and the old speed comes back.
3. A drag (pan) that ends on an animal does not count as a find.
4. A canal end on a map corner, or a trunk that ends in the river, gets no wrong off-map arm.
5. With storage blocked, a find shows the toast and the game runs. Only the save fails.

---

### Task 10 (A): Canal ends run to the map edge

**Files:**
- Modify: `src/render/iso.js` (`canalMask`, `canalSprite`, the canal key loop in `drawWorld`)
- Test: `test/iso.test.js`

**Interfaces:**
- Produces: `canalMask(w, h, kind, i)` also sets the side bit that points off the map for a canal end on the map edge.

- [ ] **Step 1: Write the failing tests** in `test/iso.test.js`:
  - `canalMask: a canal end on the map edge gets an arm off the map`: a 5×5 grid, canal at (2,2),(2,3),(2,4). `dirs(canalMask(...,  idx(2,4)))` deep-equals `['0,1', '0,-1']`. A 5×5 grid with canal at (2,0),(2,1): tile (2,0) gives `['0,1', '0,-1']`.
  - `canalMask: a canal that runs along the edge gets no off-map arm`: canal at (1,4),(2,4),(3,4). Tile (2,4) gives `['1,0', '-1,0']`.
  - `canalMask: a canal end next to the river gets no off-map arm`: canal (2,2),(2,3), river on row 4. Tile (2,3) gives `['0,1', '0,-1']` (the river arm, no extra bit).
  - `canalMask: a canal end on a corner gets one off-map arm`: canal (3,4),(4,4) on 5×5. Tile (4,4) gives `['1,0', '-1,0']`.
- [ ] **Step 2: Run** `node --test test/iso.test.js`. Expected: the 4 new tests FAIL.
- [ ] **Step 3: Implement.** Rule: a canal tile on the map edge whose in-map side mask has exactly one side bit gets the opposite side bit, when that opposite side is off the map. A tile with no side bit and one off-map side gets that side bit. A corner end continues straight (the opposite of its one arm).
  - In the `drawWorld` key loop, an off-map neighbour uses the tile's own width step. Do not read `kind[]` or `cWidth[]` outside the map.
- [ ] **Step 4: Draw the notch.** In `canalSprite`, when the edge flag (bit 20) is set and an arm has `dx = 1` (right front face) or `dy = 1` (left front face), cut the canal cross-section into that side face. Draw the bank, then the `WALL` colour, then the bed (`MUD`), then the water, at the water step `ws` (0 = at the bank, 3 = at the bed). Use the same channel width as the arm at the tile edge. The back edges (x = 0, y = 0) draw no notch because no side face shows there.
- [ ] **Step 5: Run** `npm test`. Expected: all pass.
- [ ] **Step 6: Browser check.** Open a level at 1280×800 and zoom to step 2. The trunk outlet end shows the notch in the front wall. Check the wet season (water near the bank) and the dry season (water near the bed). Save the shots in the scratchpad.
- [ ] **Step 7: Update** spec 3.3 in the procgen spec (one line on the edge notch). Commit `feat(render): run canal ends to the map edge with a wall notch`.

### Task 11 (C): Plant variants

**Files:**
- Modify: `src/render/iso.js` (plant helpers, `cache.veg`, the plant draw in `drawWorld`)
- Modify: `.claude/skills/rewet/sprites.md` (list the new plant forms)
- Test: `test/iso.test.js`

**Interfaces:**
- Produces: `export const vegVariant = i => Math.floor(hash(i) * 4) % 4`.

- [ ] **Step 1: Write the failing test** `vegVariant spreads over 4 variants`: for i in 0..999, each value 0–3 appears at least 150 times. `vegVariant(i)` is the same on 2 calls.
- [ ] **Step 2: Run** `node --test test/iso.test.js`. Expected: FAIL (not exported).
- [ ] **Step 3: Implement.** `cache.veg[type]` holds 4 sprites for each of FERN, SEEDLING, SHRUB and TREE. `drawWorld` uses `cache.veg[veg][vegVariant(i)]`. New helpers next to `tree()`:
  - `emergent(g, bx, by)`: a tall thin trunk and a high, flat crown above the other trees.
  - `broadCrown(g, bx, by)`: a short trunk and a wide round crown of 2–3 blobs.
  - `pandan(g, bx, by)`: no trunk, long thin leaves fanning up and out from one base, as on a pandan.
  - A young-tree variant: the current `tree()` at a smaller size.
  - Fern, seedling and shrub variants: change the count, size and position of the existing helpers. Add one new form per type, for example a sedge tuft for FERN.
  - Keep the palette, the shadow pools and the sprite size.
- [ ] **Step 4: Run** `npm test`. Expected: all pass.
- [ ] **Step 5: Browser check** at zoom step 2: a forest patch shows the 4 tree forms mixed. Save shots.
- [ ] **Step 6: Commit** `feat(render): add 4 variants for each plant type`.

### Task 12 (D): All levels open

**Files:**
- Modify: `src/save.js`
- Modify: `src/main.js` only if the level select reads `unlocked` in a way that hides levels
- Test: `test/save.test.js`

**Interfaces:**
- Produces: `DEFAULT_SAVE.unlocked === MAX_LEVEL`. `hasProgress(save)` is `totalStars(save) > 0 || save.unlocked > MAX_LEVEL`.

- [ ] **Step 1: Write the failing tests** in `test/save.test.js`:
  - `a new save opens all levels`: `loadSave(emptyStorage).unlocked === MAX_LEVEL`.
  - `an old save opens all levels and keeps its stars`: stored `{version:1, unlocked:2, stars:{1:2}, ...}` loads with `unlocked === MAX_LEVEL` and `stars[1] === 2`.
  - `a save with the sandbox open keeps it`: stored `unlocked: MAX_LEVEL + 1` stays `MAX_LEVEL + 1`.
  - `hasProgress is false for a new save and true with one star`.
- [ ] **Step 2: Run** `node --test test/save.test.js`. Expected: the new tests FAIL. Fix the old tests that expect `unlocked: 1`, and say which ones changed in the report.
- [ ] **Step 3: Implement.** `DEFAULT_SAVE.unlocked = MAX_LEVEL`. In `sanitize`, `s.unlocked = Math.max(MAX_LEVEL, o.unlocked)` when `o.unlocked` is valid. `recordResult` still opens the sandbox after level 6.
- [ ] **Step 4: Run** `npm test`. Expected: all pass.
- [ ] **Step 5: Browser check:** the level select with an empty save shows 6 open levels and no "Locked" mark on them. "Continue" is disabled.
- [ ] **Step 6: Commit** `feat(save): open all levels from the start`.

### Task 13 (B): Canal network: merges, forks and links

**Files:**
- Modify: `src/sim/mapgen.js`
- Modify: `src/levels.js` (map fields, seeds)
- Modify: `docs/superpowers/specs/2026-11-10-rewet-procgen-map-design.md` (sections 2.3 and 8)
- Modify: `test/fixtures/*` only if a level they use changes
- Test: `test/mapgen.test.js`, `test/levels.test.js`

**Interfaces:**
- Consumes: `generateMap(level)` with `level.map.merges`, `level.map.forks`, `level.map.links` (default 0).
- Produces: the same return shape as now. Each canal stays a list of tiles with a bed and a size. A link canal uses `BRANCH` size.

- [ ] **Step 1: Write the failing tests** in `test/mapgen.test.js`. Use a 24×24 level with `trunks: 3`, a fixed seed, and in turn `merges: 1`, `forks: 1`, `links: 1`:
  - `merge: the trunks that reach the outlet edge are one fewer`: count the canal tiles on the canonical outlet row (map back with the outlet from `terrain.outlet`). `trunks - 1` groups.
  - `fork: the trunks that reach the outlet edge are one more`: `trunks + 1` groups, each at least 3 tiles from the next.
  - `link: a link canal touches two different trunks`: a canal of 3 to 8 tiles on one row, with its 2 end tiles next to tiles of 2 different trunks.
  - `every canal tile has a lower canal or river neighbour, or is on the outlet edge`: for each case above and for each level in `LEVELS`. Use the `canalZ` values.
  - `the same seed gives the same map` with all three fields set.
- [ ] **Step 2: Run** `node --test test/mapgen.test.js`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** after the trunks are made, before villages, in this order: merges, forks, links.
  - **Merge:** take 2 neighbouring trunks (by `xs[0]`). Pick a join row `yj` in the lower 40% (`0.6 × end` to `0.8 × end`). From `yj - k`, the second trunk moves one column per row toward the first until it is next to it. It joins at row `yj`. Remove its tiles below the join. Then set each bed of the joining arm to at least `bedA[yj] + 0.01 × (steps to the join)`, so the bed falls into the join.
  - **Fork:** pick a trunk and a row `ys` in the middle 60%. A new arm leaves `xs[ys]` diagonally, away from the nearest trunk, for at least 3 columns. Then it runs straight to the outlet edge, at least 3 tiles from every other canal. Bed: start at `bed[ys]`, then `min(prev − 0.01, surface)`. Use `TRUNK` size. If no free path exists after `TRIES`, place no fork.
  - **Link:** pick 2 neighbouring trunks and a row where their gap gives 3 to 8 free tiles between them. The link is the tiles between them on that row. Its bed falls in a straight line from `max(bedA, bedB) − 0.01` to `min(bedA, bedB) + 0.01` toward the lower trunk. Use `BRANCH` size.
  - Use the existing `tag`, `clear()`, `TRIES` and `rng`. Do not call `rng` for a field that is 0, so the maps of levels without these fields do not change.
- [ ] **Step 4: Run** `node --test test/mapgen.test.js`. Expected: PASS.
- [ ] **Step 5: Set the level fields** in `src/levels.js`: L3 `links: 1`; L4 `forks: 1`; L5 `merges: 1`; L6 `merges: 1, links: 1`. Then run `node --test test/levels.test.js`. Each level must pass with `blockPlan` and fail with no action. If a level fails, change its seed first, then its fields. Record the final seeds and fields in spec section 8.
- [ ] **Step 6: Run** `npm test`. Expected: all pass, C1–C3 included. Regenerate a fixture only if its level changed.
- [ ] **Step 7: Browser check:** L4, L5 and L6 at 1280×800 show the fork, the merge and the link as joined streams. Save shots.
- [ ] **Step 8: Commit** `feat(mapgen): add canal merges, forks and links`.

### Task 14 (R): Source keys and concept sources

**Files:**
- Create: `docs/references/peat-restoration-concepts.md`
- Modify: `docs/references/peat-hydrology-and-emissions.md`, `docs/references/canal-dimensions.md` (add a `## Sources` key table)

**Interfaces:**
- Produces: each source in `docs/references/` has a key in a table row `| KEY | ... |`. Existing keys: `H18`, `C19`, `PIN`, `KMP`, `WP`. New keys: `R14` (Ritzema et al. 2014), `IPCC13` (Wetlands Supplement), `KFCP14` (KFCP 2014), plus one key for each new source.

- [ ] **Step 1: Add the key tables** for R14, IPCC13 and KFCP14, in the same form as the table in `peat-swamp-wildlife.md`.
- [ ] **Step 2: Research** each journal concept and open a source for each fact: the 3R framework (BRG/BRGM), canals and drainage, the 0.4 m rule (PP 57/2016 Art. 23, try again), block cascades, fire, subsidence and carbon, revegetation, paludiculture, livelihoods. Write 1 to 3 short facts per concept, each with a key and a page or a table. A concept with no sourced fact gets the line `NOT SOURCED: no journal page`.
- [ ] **Step 3: Lint** the file against `ste100-lint.md`. **Commit** `docs: add sources for the journal concepts`.

### Task 15 (E): Journal

**Files:**
- Create: `src/journal.js` (data only), `src/journalView.js` (DOM overlay)
- Modify: `index.html` (the `<dialog id="dJournal">` and CSS, the menu button `bJrnMenu`, the HUD button `bJournal`), `src/main.js` (open, pause, restore), `src/strings.js` (labels), `src/save.js` (`found`)
- Test: `test/journal.test.js`, `test/save.test.js`

**Interfaces:**
- Consumes: the source keys from Task 14; the species from `docs/references/peat-swamp-wildlife.md`.
- Produces:
  - `src/journal.js`: `export const CONCEPTS = [{ id, title, body, sources: [key] }]` and `export const SPECIES = [{ id, name, local, sci, status, fact, sources: [key] }]`. `id` is a short lowercase word, for example `orangutan`. `local` is `''` when no Indonesian name has a source.
  - `src/journalView.js`: `openJournal({ found, page, onClose })`, where `page` is a concept or species `id` or null.
  - `src/save.js`: `save.found` is an array of species ids. `sanitize` keeps only strings that are ids in `SPECIES`, with no duplicates. `export function recordFind(save, id)` returns `{ save, isNew }`.

- [ ] **Step 1: Write the failing tests:**
  - `test/journal.test.js`: each entry in `CONCEPTS` and `SPECIES` has at least one source. Each source key is the first cell of a table row in a file in `docs/references/`. Ids are unique. `SPECIES` has an entry for each species heading in `peat-swamp-wildlife.md`. `status` is one of `LC NT VU EN CR`.
  - `test/save.test.js`: a new save has `found: []`. `recordFind` adds a new id with `isNew: true`, and gives `isNew: false` for an id it has. An unknown id or a duplicate in a stored save is dropped on load.
- [ ] **Step 2: Run** `node --test test/journal.test.js test/save.test.js`. Expected: FAIL.
- [ ] **Step 3: Write `src/journal.js`** from Task 14's concept file and from the species file. Use the "IUCN now" status. Each body is 2 to 4 short sentences in STE100, for a player. No fact without a key.
- [ ] **Step 4: Write `src/journalView.js` and the dialog.**
  - Use a `<dialog>` with `showModal()`. Esc then closes it natively. Stop the Esc keydown from reaching the level key handler.
  - Layout: a two-page book spread on a wide screen and one page on a screen ≤ 600 px wide. A contents page lists the concepts and the wildlife.
  - Left and Right arrows turn pages. Prev, Next and Close buttons are at least 44×44 with a focus ring.
  - Header: `Wildlife found X of N`, with N = `SPECIES.length`.
  - A species not in `found` shows a framed "?" box and "Not found yet". Task 17 puts the sprite there.
  - Each page lists its source keys at the bottom in small text.
- [ ] **Step 5: Wire it in `src/main.js`.** The menu button opens the journal. The HUD button stores the speed and the paused state, pauses, and opens the journal. `onClose` restores them. Neither button can be pressed during the intro. If one can, call `stopPropagation()`.
- [ ] **Step 6: Run** `npm test`. Expected: all pass.
- [ ] **Step 7: Browser check** at 390×844 and 1280×800: open from the menu and from the HUD, turn pages with the keys and the buttons, close with Esc. The level speed comes back, and the quit dialog does not open. Save shots.
- [ ] **Step 8: Commit** `feat(ui): add the journal with concept and wildlife pages`.

### Task 16 (F1): Fauna simulation

**Files:**
- Create: `src/sim/fauna.js`
- Modify: `src/sim/game.js` (`createGame`, `step`), `src/sim/score.js` (`evaluate`)
- Test: `test/fauna.test.js`, `test/score.test.js`

**Interfaces:**
- Consumes: the species ids from `src/journal.js` `SPECIES` (the test checks that the two lists match; the sim does not import `journal.js`).
- Produces:
  - `export const FAUNA_SALT = 0xfa07a`, `export const MAX_FAUNA = 24`.
  - `export const FAUNA = [{ id, rule: (g, i) => boolean, cap }]`, one entry for each species. Each rule is a game value, marked `NOT SOURCED`. Base each rule on the "Game mapping" row in `peat-swamp-wildlife.md`. Closed-forest species need high `cover` and `wt ≤ WET_WT`. Water species need a canal or river tile, or a peat tile next to one, with `wt ≤ WET_WT`.
  - `export function faunaTick(g)`: it creates `g.faunaRng` on the first call, then spawns, moves and removes animals, and adds to `g.seen`.
  - `createGame` sets `g.fauna = []` and `g.seen = new Set()`. `step` calls `faunaTick(g)` when `g.tick % 4 === 0`, after the fire step.
  - `evaluate(g)` also returns `speciesSeen: [...g.seen]`. `passed` and `stars` do not change.

- [ ] **Step 1: Write the failing tests** in `test/fauna.test.js`:
  - `same seed and actions give the same fauna`: 2 games of level 1 with the same actions, 400 steps each. Their `g.fauna` are deep-equal.
  - `faunaTick does not use world.rng`: 2 equal games. Call `faunaTick` 50 times on one only. Then `g1.world.rng() === g2.world.rng()`.
  - `animals stand only on tiles that meet their rule`: after each of 400 steps, `FAUNA.find(f => f.id === a.species).rule(g, a.i)` is true for each animal.
  - `no animal within 2 tiles of fire`: set `fire[i] = 1` at a tile next to an animal, call `faunaTick`. No animal remains with Chebyshev distance ≤ 2.
  - `a wet green map has more animals than a dry bare map`: map A: `cover = 1`, `wt = 0.1` on every peat tile. Map B: `cover = 0`, `wt = 1.0`. After 30 calls, A has more animals than B, and B has none of the forest species.
  - `never more than MAX_FAUNA animals`, and `species ids match SPECIES ids in src/journal.js`.
  - In `test/score.test.js`: `evaluate returns speciesSeen and the same stars with and without fauna`.
- [ ] **Step 2: Run** `node --test test/fauna.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `src/sim/fauna.js`.
  - **Spawn:** for each species, count its suitable tiles `s`. Target = `min(cap, floor(s / 30))` (game value, NOT SOURCED). While the species is under target and the total is under `MAX_FAUNA`, add one animal per tick on a random suitable tile. Prefer a tile on the map edge or a tile with `cover ≥ 0.85`.
  - **Move:** each animal steps to a random suitable 8-neighbour, or stays.
  - **Leave:** remove an animal whose tile no longer meets its rule, or that is within 2 tiles of `fire > 0`.
  - **Seen:** add each species on the map to `g.seen`.
  - Animal: `{ id, species, i, born }`, where `id` is a counter on `g`.
- [ ] **Step 4: Wire `game.js` and `score.js`. Run** `npm test`. Expected: all pass, C1–C3 included. The level results with `blockPlan` do not change.
- [ ] **Step 5: Commit** `feat(sim): add wildlife that comes back to a restored map`.

### Task 17 (F2): Wildlife render, finds and report

**Files:**
- Modify: `src/render/iso.js` (animal sprites, draw, hit list), `src/render/view.js` (`pickAnimal`), `src/ui.js` (click with no action), `src/main.js` (find toast, menu count), `src/journalView.js` (sprite in the species pages), `index.html`, `src/strings.js`
- Test: `test/iso.test.js`

**Interfaces:**
- Consumes: `g.fauna`, `g.seen`, `evaluate().speciesSeen`, `recordFind`, `openJournal({ page })`, `SPECIES`.
- Produces:
  - `iso.js`: `export function animalSprite(id, silhouette = false)` returns a cached canvas (8 to 16 px art). `drawWorld` returns `hits = [{ species, bx, by }]` in buffer px, one for each animal it drew.
  - `export function nearestHit(hits, bx, by, maxD)` (pure) returns the nearest hit within `maxD`, or null.
  - `view.js`: `pickAnimal(evt, hits)` uses `nearestHit` with `maxD = 22 / scale` (22 CSS px, half of a 44 px target).

- [ ] **Step 1: Write the failing test** in `test/iso.test.js`: `nearestHit picks the closest animal inside the radius`. It returns null when every hit is outside `maxD` and picks the closer of 2 hits.
- [ ] **Step 2: Run** `node --test test/iso.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement the sprites and the draw.**
  - One small sprite per species, drawn with `fillRect` in the map palette. The silhouette is the same shape in one dark colour.
  - Draw an animal in the tile loop right after the plants, so the depth order stays right. Add a 1 px idle bob from `now` and `hash(id)`. Skip off-screen tiles, as for the other sprites.
  - Draw no animals in the data view.
- [ ] **Step 4: Implement the find.**
  - A canvas click with no action selected, and not after a drag (`wasDrag`), calls `pickAnimal`.
  - On a hit, call `recordFind`, then persist. When `isNew`, show a find toast "New in your journal: <name>" with a 44 px "Open" button that opens the journal at that species page.
  - With an action selected, a click goes to the tile as now.
- [ ] **Step 5: Show the metric.**
  - The year report and the debrief show "Species seen: K" and the names, from `evaluate().speciesSeen`.
  - The main menu shows "Wildlife found X of N".
  - The species pages in the journal show `animalSprite(id)` when the species is found, and `animalSprite(id, true)` when it is not.
- [ ] **Step 6: Run** `npm test`. Expected: all pass.
- [ ] **Step 7: Browser check.**
  - Use the sandbox, or a level after `blockPlan` and planting, so animals show. Click an animal: the toast shows, and the journal page opens.
  - Drag a pan that ends on an animal: no find.
  - With storage blocked (`localStorage` throws), a find still shows the toast.
  - Frame time at 1280×800 with 24 animals: the median stays near 16.7 ms.
  - Save shots at 390×844 and 1280×800.
- [ ] **Step 8: Commit** `feat(ui): show wildlife on the map and record finds in the journal`.
