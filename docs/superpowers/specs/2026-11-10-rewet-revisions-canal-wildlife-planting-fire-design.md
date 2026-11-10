# Rewet: canal bank, wildlife, planting and fire revisions (design)

Date: 2026-11-10. Branch: `feat/procgen-map`. This spec changes the rules and the art from `2026-11-10-rewet-journal-wildlife-design.md` and `2026-11-10-rewet-procgen-map-design.md`. Where they disagree, this spec wins.

The work starts after the UI layout plan (`2026-11-10-rewet-ui-layout.md`) is complete, so the two plans do not edit `src/render/iso.js` and `src/ui.js` at the same time.

## 1. Intent

The user asked for these revisions:

1. **Canal bank colour.** Today the canal bank always has the dry soil colour. The bank must follow the colour of the peat next to it, which changes with wetness and cover.
2. **Black bar.** A black bar shows at a canal end on the map edge. Remove it.
3. **Wildlife count.** There must not be too many animals on a map.
4. **Wildlife visits.** Animals are not on the map all the time. They come and go as the seasons pass.
5. **Wildlife movement.** An animal moves at most one tile at a time and does not appear to jump.
6. **Planting growth.** Planted vegetation grows a little faster, so planting is worth doing.
7. **Planting area.** One Plant action covers more tiles.
8. **Planting cost.** Planting costs less.
9. **Fire sprite.** A better fire sprite.
10. **Smoke.** Soft smoke drifts from fires, in a general direction that changes each year.

User decisions:

- Planting area: a bigger stamp, with no drag. One tap plants a 5×5 patch instead of a 3×3 patch. The pan gesture does not change.
- Planting cost: a price per new tile planted, and 1 crew for each action. The work time grows with the tile count.
- Wildlife: at most 8 animals at one time, and fewer on a degraded map.
- Process: a spec and a plan, run with subagents after the UI layout plan.

Success criteria:

- On a wet green map, the canal bank pixels have the colour of the peat next to the canal. On a dry map, they have the dry colour.
- No black column shows at a canal end on the map edge, in the dry or the wet season, at zoom 1 to 3.
- `g.fauna.length <= 8` at each tick. A restored map still has more animals than a map with no action (the balance test stays).
- Each animal leaves after a stay. The species seen over a level changes with the season.
- Between 2 weekly fauna steps, an animal's position changes by at most 1 tile, and the render moves it smoothly between the 2 tiles.
- `blockPlan` still passes each level, and a run with no action still fails. C1, C2 and C3 pass with no tolerance change.

## 2. Canal bank colour (render, `src/render/iso.js`)

- The bank zone of a canal sprite (from `canalZone()`) takes the ground colour of the peat next to the canal tile. The ground colour is the colour the peat tile gets from its `wt` and `cover` today.
- The bank colour has 4 steps: dry, damp, wet and green. The step comes from the mean ground state of the peat neighbours (4 sides) of the canal tile.
- The step is part of the canal sprite cache key, so the sprite set grows by at most 4 times. The key layout in the procgen spec (bits 0–21+) gets 2 more bits. The bit layout is in the plan.
- The step updates when the canal sprites rebuild. The plan checks that this is not each frame: the step changes slowly, so a rebuild once a week is enough.
- The data view does not change.

## 3. Black bar at the canal end (render)

- Find the cause of the black column at a canal end on the map edge (see the user's screenshot). Candidates are the edge notch from the procgen spec section 2 and the 1 px `block()` / `zMicro` line parked in the earlier final review.
- Fix the cause. A test or a pixel check proves the fix: no pixel in the notch column has the `block()` shadow colour where the bank or the water must show.

## 4. Wildlife (`src/sim/fauna.js`, render)

All values are game values, `NOT SOURCED`.

- `MAX_FAUNA = 8`. The species targets keep the rule from the earlier balance fix (target from suitable tiles and the peat share), and the total cap is 8.
- **Stay:** each animal gets `leave = born + stay`, with `stay` from 4 to 13 weeks, drawn from the fauna RNG. At `g.tick >= leave`, the animal walks to the nearest map edge at one tile per weekly step and leaves there. It also leaves when its tile fails the habitat rule or when fire is within 2 tiles, as now.
- **Seasons:** the spawn chance for each species changes with the season. Each species gets a game value `wet` and `dry` spawn weight in the `FAUNA` table. The plan sets the weights so that each season shows a different mix of species. The weights are game values and claim no real-world behaviour.
- **Arrival:** a new animal enters on a suitable map edge tile when one exists. If no edge tile is suitable, it appears on a suitable tile in a forest patch, and the render fades it in.
- **Movement:** a move is to one 8-neighbour tile in a weekly step, or no move. Each animal stores `from` (the tile before the last move) and `moved` (the tick of the last move).
- **Render:** when the render first sees a new `moved` value for an animal, it records the time. It draws the sprite between `from` and `i` with `t = (now − seenAt) / 600 ms`, clamped to [0, 1]. A time-based slide is smooth at each speed and stops when the game pauses after the slide ends. A new animal fades in over 600 ms. A leaving animal fades out over 600 ms when it steps off the map edge.
- The hit test uses the drawn position.
- Determinism and the fauna RNG rule do not change. `faunaTick` never calls `world.rng`.

## 5. Planting (`src/sim/game.js`, `src/strings.js`, `src/ui.js`)

All values are game values, `NOT SOURCED`, and go in spec section 8 of the procgen spec.

- **Stamp:** a Plant action seeds the plantable tiles in the 5×5 patch around the tapped tile (today 3×3).
- **Cost:** `PLANT_TILE` per new tile seeded. The plan sets `PLANT_TILE` so that the cost per tile is at most 60% of today's (120 / 9 = 13.3, so at most 8). The upgrade `cheapBlocks` does not change this cost.
- **Time:** `weeks = ceil(tiles / 10)`, with a minimum of 1. One crew does the job.
- **Funds:** when the funds do not cover all the tiles, the action seeds as many tiles as the funds pay for, in a fixed order (nearest to the tapped tile first). With funds for no tile, the action is refused with the `funds` reason.
- **Growth:** the seedling growth step goes from `1/416` to `1/312` per tick (about 1.5 years to full cover instead of 2). The natural regrowth rate (`1/1248`) does not change.
- **UI:** the Plant slot shows the cost per tile, for example `8/tile · 1–3w`. The hint text in `ACTION_TEXT.plant` says 5×5.
- **Tests:** the fixture `test/fixtures/l1-reveg.json` (R27) gets a new planting grid with a 5-tile spacing, and it must still reach the L1 revegetation star.

## 6. Fire sprite and smoke (render)

- **Sprite:** surface fire (`fire = 1`) gets a cached flame sprite with 4 animation frames: a base of glowing peat, 2 to 3 flame tongues in yellow, orange and red, and a dark char ring. Smouldering fire (`fire = 2`) gets a cached sprite of a dark ember patch with a slow pulse. All art uses `fillRect` and the named colours in `iso.js`.
- **Smoke:** a render-only particle list in `src/render/iso.js`.
  - Each burning tile emits puffs at a fixed rate. Surface fire emits more puffs than smouldering fire.
  - A puff is a soft blob: 3 nested `fillRect` disks with alpha 0.18, 0.26 and 0.4 (section 9). It grows, rises and fades over 3 to 6 seconds.
  - The drift direction is `yearDir`, an angle from `hash(world.seed, year)`, with a random spread of ±30° per puff. It is a general direction, not the sim wind.
  - At most 160 puffs. When the cap is reached, the oldest puff goes first.
  - The smoke is drawn after the tiles and the animals, so it passes over them. It is not drawn in the data view.
- With `prefers-reduced-motion`, the flames show 1 frame and the smoke is off.
- Frame time: the median stays about 16.7 ms at 1280×800 with 40 burning tiles.

## 7. Architecture

| Unit | Change |
|---|---|
| `src/sim/fauna.js` | cap 8, stay, season weights, edge arrival and walk out, `from` and `moved` |
| `src/sim/game.js` | 5×5 stamp, per-tile cost, weeks by tile count, growth 1/312 |
| `src/render/iso.js` | bank colour step in the canal key, black bar fix, animal tween and fade, fire sprites, smoke |
| `src/strings.js`, `src/ui.js` | Plant cost text and hint |
| `test/fixtures/l1-reveg.json` | 5-tile planting grid |

## 8. Testing

- fauna:
  - `g.fauna.length <= 8` over full runs of all 6 levels;
  - each animal leaves at or after `leave`;
  - an animal moves at most 1 tile per weekly step, and a leaving animal reaches an edge;
  - `from` and `moved` are set on each move;
  - the species mix in wet seasons differs from the mix in dry seasons over a 3-year run;
  - the restored-against-no-action balance test still passes;
  - determinism tests stay.
- planting:
  - a 5×5 stamp seeds up to 25 tiles;
  - the cost equals `PLANT_TILE ×` the tiles seeded;
  - the weeks follow `ceil(tiles / 10)`;
  - low funds seed a partial patch, nearest first;
  - no funds give the `funds` reason;
  - the R27 fixture reaches the revegetation star.
- levels: `blockPlan` passes and no action fails, on all levels. C1 to C3 pass.
- render: a pure test for the bank colour step function, and a pixel test for the black bar fix.
- Browser at 1280×800 and 390×844:
  - the bank colour on a dry and on a restored map;
  - the canal end on the map edge at zoom 1 and 3;
  - an animal walks with no jump at ×2 speed;
  - fire and smoke during a dry season with 40 or more burning tiles, with the frame time measured.

## 9. Open items

- The season weights per species are game values. The journal does not state them as facts.
- The flame and smoke art is a first pass. The user reviews screenshots before the plan's last task.
- Smoke values after the review of task 5 (`src/render/iso.js`). The first values gave smoke that was too faint, so these values replace them:
  - Puff colour `SMOKE = [205, 200, 192]`. Disk alpha `PUFF_ALPHA = [.18, .26, .4]`. Puff fade `(1 - t) ** .7`. Puff radius 3 to 7 px.
  - A surface-fire puff starts at the flame tip, 14 px above the tile centre. A smouldering puff starts 4 px above it.
  - The emit interval of each tile is multiplied by `max(1, nFire / 14)`, where `nFire` is the burning-tile count of the last frame. With many fires, the 160 puffs then stay alive for about 3 s or more.
